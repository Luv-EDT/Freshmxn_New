// Is the pipeline actually alive, and if not, which half is missing?
//
//     node Backend/tools/pipelineStatus.js            queue depths and failures
//     node Backend/tools/pipelineStatus.js --probe    THE RELIABLE LIVENESS TEST
//     node Backend/tools/pipelineStatus.js --failures the failure reasons in full
//
// WHY THIS EXISTS. A worker that is not running looks exactly like a worker with nothing to do:
// both print nothing. A student presses Submit, the job is queued, and it sits there forever while
// every terminal stays silent and every screen says "your report is being prepared". There is no
// error anywhere, because nothing failed — nobody was listening.
//
// Since Round 22 the queue is the `jobs` collection in MongoDB (workers/jobQueue.js), so this reads
// it directly. A due job that keeps waiting is the honest symptom of a dead worker.
//
// --probe queues a real job for a user that cannot exist and watches what happens to it. If a
// worker is listening, the job fails within seconds (no submission for that user) and the failure
// IS the proof of life. If nothing touches it, nobody is home.

const path = require("path")

require("dotenv").config({ path: path.join(__dirname, "..", ".env") })

const mongoose = require("mongoose")
const Job = require("../model/jobsModel")
const { createJobQueue } = require("../workers/jobQueue")

const QUEUES = ["score_profile", "generate_report", "housekeeping"]
const START = { score_profile: "worker:score", generate_report: "worker:report", housekeeping: "worker:housekeeping" }

const main = async () => {
    if (!process.env.DB_URI) {
        console.error("DB_URI is not set — the queue lives in the database")
        process.exit(1)
    }
    await mongoose.connect(process.env.DB_URI)

    const queue = createJobQueue(Job)
    const showFailures = process.argv.includes("--failures")
    const probing = process.argv.includes("--probe")
    let stuck = false

    console.log(`\n${"queue".padEnd(18)}waiting  active  failed (7 days)  oldest due`)
    console.log("─".repeat(66))

    for (const row of await queue.health(QUEUES)) {
        console.log(row.queue.padEnd(18) + String(row.waiting).padEnd(9) + String(row.active).padEnd(8) + String(row.failed).padEnd(17) + `${row.oldestWaitingSeconds}s`)

        if (row.waiting > 0 && row.oldestWaitingSeconds > 60) {
            stuck = true
            console.log(`    ! a job has been due for ${row.oldestWaitingSeconds}s. Nothing is consuming ${row.queue}.`)
            console.log(`      Start it:  npm run ${START[row.queue]}  (or RUN_WORKERS_IN_WEB=true on the server)`)
        }

        if (row.failed > 0) {
            const failed = await Job.find({ queue: row.queue, status: "failed" }).sort({ finishedAt: -1 }).limit(showFailures ? 20 : 3).lean()
            failed.forEach((job) => {
                console.log(`    FAILED ${job._id} ${job.name} (attempt ${job.attemptsMade}) — ${String(job.lastError).slice(0, showFailures ? 500 : 130)}`)
            })
            if (!showFailures && row.failed > 3) console.log(`    … and ${row.failed - 3} more. Run with --failures for the rest.`)
        }
    }

    if (!probing) {
        console.log(`\nqueues are ${stuck ? "BACKED UP" : "clear"}. To prove a worker is actually alive:  npm run pipeline:status -- --probe`)
        await mongoose.disconnect()
        process.exit(stuck ? 1 : 0)
    }

    // ── the probe ────────────────────────────────────────────────────────────────────────────
    console.log("\nprobing — queuing a job for a user that cannot exist, on both report queues\n")

    let allAlive = true

    for (const name of ["score_profile", "generate_report"]) {
        const job = await queue.enqueue(name, name, { userId: "000000000000000000000009" }, { attempts: 1 })
        let alive = false

        for (let elapsed = 0; elapsed < 30; elapsed += 2) {
            await new Promise((resolve) => setTimeout(resolve, 2000))
            const state = await Job.findById(job._id).select("status").lean()
            if (state && (state.status === "failed" || state.status === "completed")) { alive = true; break }
        }

        // The probe is always removed, so a failing job for a fake user never makes a later run look alarming
        await Job.deleteOne({ _id: job._id })

        console.log(alive
            ? `  ${name.padEnd(18)} ALIVE — picked up and processed`
            : `  ${name.padEnd(18)} NO RESPONSE in 30s — nothing is consuming this queue`)

        if (!alive) allAlive = false
    }

    console.log(`\n${allAlive ? "both workers are consuming jobs — a submitted assessment will be picked up" : "AT LEAST ONE WORKER IS DOWN — submissions will queue and nothing will happen"}`)
    await mongoose.disconnect()
    process.exit(allAlive ? 0 : 1)
}

main().catch((error) => {
    console.error(`could not read the queue — ${error.message}`)
    process.exit(1)
})
