// THE HOUSEKEEPING WORKER (Round 10) — the jobs that run on a calendar rather than on a click:
//
//     followup_scan    the 1st of each month, 09:00 IST   housekeeping/followUpScan.js
//     data_refresh     the 1st of each month       housekeeping/dataRefresh.js
//     career_scout     every Monday                housekeeping/careerScout.js
//     draft_career     on demand — the admin approved a scout row (housekeeping/draftCareer.js)
//
// ONE QUEUE, ONE WORKER, three job names — each extra worker costs idle Redis commands (see
// queueHelpers idleTimings), and these jobs are rare and small. BullMQ's job schedulers keep the
// calendar in Redis, so a redeploy does not lose it, and upserting them at every start is harmless.
//
// ON THE FREE PLAN a schedule only fires while the server is awake. A job that fell due while it
// slept runs when it wakes; the follow-up scan's catch-up window and the refresh's oldest-first order
// mean a late run makes up the difference. The uptime ping keeps it awake anyway.
//
//     node Backend/workers/housekeepingWorker.js             run the worker
//     node Backend/workers/housekeepingWorker.js --once followup_scan   one job, then exit

const path = require("path")
require("dotenv").config({ path: path.join(__dirname, "..", ".env") })

const { Queue, Worker } = require("bullmq")
const mongoose = require("mongoose")
const { attachConnectionLogging, withDnsWorkaround, idleTimings } = require("./queueHelpers")

const QUEUE_NAME = "housekeeping"
const TZ = "Asia/Kolkata"

const SCHEDULES = [
    { name: "followup_scan", pattern: "0 9 1 * *" },   // monthly (owner, Round 11) — the scan's 45-day window covers the gap
    { name: "data_refresh", pattern: "0 4 1 * *" },
    { name: "career_scout", pattern: "0 5 * * 1" },
]

const JOBS = {
    followup_scan: () => require("../housekeeping/followUpScan").runFollowUpScan(),
    data_refresh: () => require("../housekeeping/dataRefresh").runDataRefresh(),
    career_scout: () => require("../housekeeping/careerScout").runCareerScout(),
    draft_career: (data) => require("../housekeeping/draftCareer").runDraftCareer({ candidateId: data && data.candidateId }),
}

// jobs the admin may start from "Run now" — draft_career is started only by approving a scout row
const RUNNABLE = ["followup_scan", "data_refresh", "career_scout"]

const connectionOptions = () => {
    const url = process.env.REDIS_URL
    if (!url) throw new Error("REDIS_URL is not set — the housekeeping queue cannot be reached")
    return withDnsWorkaround({ url, maxRetriesPerRequest: null })
}

let queue = null
const housekeepingQueue = () => {
    if (!queue) queue = new Queue(QUEUE_NAME, { connection: connectionOptions() })
    return queue
}

// The admin's "Run now". A hyphenated id with the time, so it never collides with a scheduled run
// (BullMQ rejects ":" in custom ids).
const runNow = async (name, data = {}) => {
    if (!JOBS[name]) throw new Error(`unknown housekeeping job ${name}`)
    return housekeepingQueue().add(name, data, { jobId: `${name}-manual-${Date.now()}`, attempts: 2, backoff: { type: "exponential", delay: 60000 }, removeOnComplete: { count: 50 }, removeOnFail: { count: 50 } })
}

const registerSchedules = async () => {
    for (const schedule of SCHEDULES) {
        await housekeepingQueue().upsertJobScheduler(
            schedule.name,
            { pattern: schedule.pattern, tz: TZ },
            { name: schedule.name, data: {}, opts: { attempts: 2, backoff: { type: "exponential", delay: 60000 }, removeOnComplete: { count: 50 }, removeOnFail: { count: 50 } } }
        )
    }
}

const start = async () => {
    require("../config/MongoDBCon")

    if (process.env.HOUSEKEEPING_ENABLED !== "false") {
        await registerSchedules()
    }

    const worker = new Worker(QUEUE_NAME, async (job) => {
        const run = JOBS[job.name]
        if (!run) throw new Error(`unknown housekeeping job ${job.name}`)
        return run(job.data)
    }, { connection: connectionOptions(), concurrency: 1, ...idleTimings() })

    attachConnectionLogging(worker, QUEUE_NAME)

    worker.on("completed", (job, result) => {
        console.log(`${QUEUE_NAME} ${job.name} done — ${JSON.stringify(result).slice(0, 300)}`)
    })

    worker.on("failed", (job, error) => {
        console.error(`${QUEUE_NAME} ${job && job.name} FAILED — ${error.message}`)
    })

    console.log(`${QUEUE_NAME} worker listening`)
    return worker
}

if (require.main === module) {
    const onceIndex = process.argv.indexOf("--once")

    if (onceIndex !== -1) {
        require("../config/MongoDBCon")
        mongoose.connection.once("connected", async () => {
            try {
                const name = process.argv[onceIndex + 1]
                if (!JOBS[name]) throw new Error(`unknown job ${name} — one of ${Object.keys(JOBS).join(", ")}`)
                console.log(JSON.stringify(await JOBS[name](), null, 1))
                process.exit(0)
            } catch (error) {
                console.error(error.message)
                process.exit(1)
            }
        })
    } else {
        start()
    }
}

module.exports = { QUEUE_NAME, SCHEDULES, JOBS, RUNNABLE, start, runNow, registerSchedules }
