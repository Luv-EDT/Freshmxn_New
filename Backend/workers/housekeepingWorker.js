// THE HOUSEKEEPING WORKER (Round 10) — the jobs that run on a calendar rather than on a click:
//
//     followup_scan    the 1st of each month, 09:00 IST   housekeeping/followUpScan.js
//     data_refresh     the 1st of each month       housekeeping/dataRefresh.js
//     career_scout     every Monday                housekeeping/careerScout.js
//     study_refresh    the 1st of each month       housekeeping/studyRefresh.js — seasonal: exams before
//                      their window, colleges Sep–Oct, facts quarterly, cut-offs Aug–Oct (Round 13)
//     draft_career     on demand — the admin approved a scout row (housekeeping/draftCareer.js)
//     batch_collect    every hour, at :17 — files the answers of a finished half-price batch
//                      (housekeeping/researchBatch.js); with no batch waiting it makes no AI call
//     model_compare    on demand — the one-time Opus/Sonnet comparison (housekeeping/modelCompare.js)
//
// ONE QUEUE, ONE WORKER, several job names — these jobs are rare and small. The calendar lives in the
// database (workers/jobQueue.js `schedule`: one waiting row per schedule, due at its next time), so a
// redeploy does not lose it, and registering the schedules at every start is harmless.
//
// ROUND 22: this calendar is what used up the free Redis. BullMQ kept each schedule's next run as a
// delayed job, and with one waiting an idle worker re-asked Redis every 10 seconds instead of once a
// minute — about 500k commands a month from this worker alone. The queue moved to MongoDB, which has
// no command quota, so the hourly batch check costs nothing when no batch is waiting.
//
// ON THE FREE PLAN a schedule only fires while the server is awake. A job that fell due while it
// slept runs when it wakes; the follow-up scan's catch-up window and the refresh's oldest-first order
// mean a late run makes up the difference. The uptime ping keeps it awake anyway.
//
//     node Backend/workers/housekeepingWorker.js             run the worker
//     node Backend/workers/housekeepingWorker.js --once followup_scan   one job, then exit

const path = require("path")
require("dotenv").config({ path: path.join(__dirname, "..", ".env") })

const mongoose = require("mongoose")
const { jobQueue } = require("./jobQueue")

const QUEUE_NAME = "housekeeping"
// Every pattern is read in IST (Asia/Kolkata) — see nextRun in jobQueue.js

const SCHEDULES = [
    { name: "followup_scan", pattern: "0 9 1 * *" },   // monthly (owner, Round 11) — the scan's 45-day window covers the gap
    { name: "data_refresh", pattern: "0 4 1 * *" },
    { name: "career_scout", pattern: "0 5 * * 1" },
    { name: "study_refresh", pattern: "0 6 1 * *" },
    { name: "batch_collect", pattern: "17 * * * *" },   // hourly (Round 12) — usually collects within the hour of the 1st
]

const JOBS = {
    followup_scan: () => require("../housekeeping/followUpScan").runFollowUpScan(),
    data_refresh: () => require("../housekeeping/dataRefresh").runDataRefresh(),
    career_scout: () => require("../housekeeping/careerScout").runCareerScout(),
    study_refresh: (data) => require("../housekeeping/studyRefresh").runStudyRefresh({ force: Boolean(data && data.force) }),
    draft_career: (data) => require("../housekeeping/draftCareer").runDraftCareer({ candidateId: data && data.candidateId }),
    batch_collect: () => require("../housekeeping/researchBatch").collectBatches(),
    model_compare: () => require("../housekeeping/modelCompare").runModelCompare(),
}

// jobs the admin may start from "Run now" — draft_career is started only by approving a scout row
const RUNNABLE = ["followup_scan", "data_refresh", "career_scout", "study_refresh", "batch_collect", "model_compare"]

const JOB_OPTIONS = { attempts: 2, backoffMs: 60000 }

// The admin's "Run now" — no key, so it never waits behind (or blocks) the scheduled run.
const runNow = async (name, data = {}) => {
    if (!JOBS[name]) throw new Error(`unknown housekeeping job ${name}`)
    return jobQueue().enqueue(QUEUE_NAME, name, data, JOB_OPTIONS)
}

const registerSchedules = async () => {
    for (const schedule of SCHEDULES) {
        await jobQueue().schedule(QUEUE_NAME, schedule, JOB_OPTIONS)
    }
}

const start = async () => {
    require("../config/MongoDBCon")

    // Never holds up the other workers: a database still connecting gets a second try a minute later
    if (process.env.HOUSEKEEPING_ENABLED !== "false") {
        registerSchedules().catch((error) => {
            console.warn(`${QUEUE_NAME}: could not register the calendar (${error.message}) — trying again in a minute`)
            setTimeout(() => registerSchedules().catch((retryError) => console.error(`${QUEUE_NAME}: the calendar is not registered — ${retryError.message}`)), 60000)
        })
    }

    const worker = jobQueue().createWorker(QUEUE_NAME, async (job) => {
        const run = JOBS[job.name]
        if (!run) throw new Error(`unknown housekeeping job ${job.name}`)
        return run(job.data)
    }, { concurrency: 1 })

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
