// Is the pipeline actually alive, and if not, which half is missing?
//
//     node Backend/tools/pipelineStatus.js            queue depths and failures
//     node Backend/tools/pipelineStatus.js --probe    THE RELIABLE LIVENESS TEST
//     node Backend/tools/pipelineStatus.js --failures the failure reasons in full
//
// WHY THIS EXISTS. A worker that is not running looks exactly like a worker with nothing to do:
// both print nothing. A student presses Submit, the job lands in Redis, and it sits there forever
// while every terminal stays silent and every screen says "your report is being prepared". There
// is no error anywhere, because nothing failed — nobody was listening.
//
// USE --probe, NOT THE WORKER COUNT. The first version of this file reported liveness from
// BullMQ's getWorkers(), which reads Redis CLIENT LIST. Upstash is serverless and restricts that
// command, so the count came back 0 while a worker was demonstrably consuming jobs — the tool
// raised a false alarm and sent someone hunting a bug that did not exist. A monitoring tool that
// cries wolf is worse than no tool, because it costs you the time you were trying to save.
//
// --probe queues a real job for a user that cannot exist and watches what happens to it. If a
// worker is listening, the job fails within seconds (no submission for that user) and the failure
// IS the proof of life. If nothing touches it, nobody is home. That test cannot be fooled by a
// Redis provider's command policy, because it uses the same path a student's submission does.

const path = require("path")

require("dotenv").config({ path: path.join(__dirname, "..", ".env") })

const { Queue } = require("bullmq")

const QUEUES = ["score_profile", "generate_report"]

const main = async () => {
    if (!process.env.REDIS_URL) {
        console.error("REDIS_URL is not set — nothing can be queued at all")
        process.exit(1)
    }

    const showFailures = process.argv.includes("--failures")
    const probing = process.argv.includes("--probe")
    let stuck = false

    console.log(`\n${"queue".padEnd(18)}waiting  active  delayed  completed  failed`)
    console.log("─".repeat(66))

    for (const name of QUEUES) {
        const queue = new Queue(name, { connection: { url: process.env.REDIS_URL, maxRetriesPerRequest: null } })

        const counts = await queue.getJobCounts("waiting", "active", "completed", "failed", "delayed")

        console.log(
            name.padEnd(18)
            + String(counts.waiting).padEnd(9)
            + String(counts.active).padEnd(8)
            + String(counts.delayed).padEnd(9)
            + String(counts.completed).padEnd(11)
            + String(counts.failed)
        )

        // Jobs sitting in `waiting` is the honest symptom of a dead worker, and unlike a worker
        // count it cannot be wrong: something was queued and nothing took it.
        if (counts.waiting > 0) {
            stuck = true
            console.log(`    ! ${counts.waiting} job(s) WAITING. If this does not clear in a few seconds, nothing is consuming ${name}.`)
            console.log(`      Start it:  npm run ${name === "score_profile" ? "worker:score" : "worker:report"}`)
        }

        if (counts.failed > 0) {
            const failed = await queue.getFailed(0, showFailures ? 20 : 3)
            failed.forEach((job) => {
                console.log(`    FAILED ${job.id} (attempt ${job.attemptsMade}) — ${String(job.failedReason).slice(0, showFailures ? 500 : 130)}`)
            })
            if (!showFailures && counts.failed > 3) console.log(`    … and ${counts.failed - 3} more. Run with --failures for the rest.`)
        }

        await queue.close()
    }

    if (!probing) {
        console.log(`\nqueues are ${stuck ? "BACKED UP" : "clear"}. To prove a worker is actually alive:  npm run pipeline:status -- --probe`)
        process.exit(stuck ? 1 : 0)
    }

    // ── the probe ────────────────────────────────────────────────────────────────────────────
    console.log("\nprobing — queuing a job for a user that cannot exist, on both queues\n")

    let allAlive = true

    for (const name of QUEUES) {
        const queue = new Queue(name, { connection: { url: process.env.REDIS_URL, maxRetriesPerRequest: null } })
        const job = await queue.add(name, { userId: "000000000000000000000009" }, { jobId: `probe-${name}-${Date.now()}`, attempts: 1, removeOnFail: false })

        let alive = false

        for (let elapsed = 0; elapsed < 20; elapsed += 2) {
            await new Promise((resolve) => setTimeout(resolve, 2000))
            const state = await job.getState()
            if (state === "failed" || state === "completed") { alive = true; break }
        }

        // The probe is always removed. A permanently failing job for a fake user would otherwise
        // sit in the failed set forever and make every future run look alarming.
        try { await job.remove() } catch (error) { /* a worker still holds it; it self-expires */ }
        await queue.close()

        console.log(alive
            ? `  ${name.padEnd(18)} ALIVE — picked up and processed`
            : `  ${name.padEnd(18)} NO RESPONSE in 20s — nothing is consuming this queue`)

        if (!alive) allAlive = false
    }

    console.log(`\n${allAlive ? "both workers are consuming jobs — a submitted assessment will be picked up" : "AT LEAST ONE WORKER IS DOWN — submissions will queue and nothing will happen"}`)

    process.exit(allAlive ? 0 : 1)
}

main().catch((error) => {
    console.error(`could not reach Redis — ${error.message}`)
    process.exit(1)
})
