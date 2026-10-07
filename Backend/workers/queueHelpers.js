// Shared by everything that queues a job.
//
// Until Round 22 this file also held the Redis plumbing — the ioredis DNS workaround, the reconnect
// log, the idle-polling settings and `addOnce`. The queue now lives in MongoDB (workers/jobQueue.js,
// where `addOnce`'s rule survives as the one-job-per-student guard), so only the timeout is left.

// ── a bound on "the queue is unreachable" ───────────────────────────────────────────────────────
//
// A database that is not answering must not hang the student's Submit request with it (backend
// review #17). After QUEUE_TIMEOUT_MS the request gives up with a clear error and the caller decides
// what the student sees.
const QUEUE_TIMEOUT_MS = Number(process.env.QUEUE_TIMEOUT_MS) || 8000

const withTimeout = (promise, what) => {
    let timer
    const timeout = new Promise((resolve, reject) => {
        timer = setTimeout(() => reject(new Error(`timed out ${what} — the job queue did not answer within ${QUEUE_TIMEOUT_MS / 1000}s`)), QUEUE_TIMEOUT_MS)
    })
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

// EVERY PLACE A STUDENT'S ACTION QUEUES THEIR REPORT goes through here (Round 22): Submit, "Try again",
// "Update my report", a story recall sent after Submit, and the admin's re-queue. Bounded by the
// timeout, and a failure is never silent — the admin gets an Assessment issue, and an email, with the
// real error. Before this, a queue that could not be reached left only "Try again" on the student's
// screen and nothing at all in the admin's.
const queueReport = async (userId, what) => {
    const { enqueueScoreProfile } = require("./scoreProfileWorker")
    try {
        return await withTimeout(enqueueScoreProfile(userId), what)
    } catch (error) {
        const { raiseIssue } = require("../utils/assessmentIssues")
        await raiseIssue({ user: userId, module: "report", kind: "queue_unreachable", detail: `${what}: ${String(error.message).slice(0, 300)}`, notify: true })
        throw error
    }
}

module.exports = { withTimeout, queueReport, QUEUE_TIMEOUT_MS }
