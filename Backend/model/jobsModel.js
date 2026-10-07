const mongoose = require("mongoose")

// THE JOB QUEUE (Round 22) — every piece of background work, one row each: scoring a student, building
// their report, and the calendar jobs. It replaced BullMQ on Redis after the idle polling of a
// scheduled queue used up Upstash's free 500k commands a month before a single student had arrived.
// Atlas has no command quota, so a worker asking "anything for me?" every few seconds costs nothing.
//
// See workers/jobQueue.js for the rules; this is only their shape.

const jobSchema = new mongoose.Schema(
    {
        queue: {
            type: String,
            required: true, // score_profile | generate_report | housekeeping
        },
        name: {
            type: String,
            required: true, // the job's name within its queue (housekeeping runs several)
        },
        data: {
            type: mongoose.Schema.Types.Mixed,
            default: {},
        },
        key: {
            type: String,
            default: null, // the student's id, or schedule:<name> for a calendar job
        },
        repeat: {
            type: String,
            default: null, // a calendar job's pattern ("0 9 1 * *", IST): when it finishes, the next one is queued
        },
        activeKey: {
            type: String,
            required: true, // = key while waiting or active; once done, "<key>#<id>" — the one-at-a-time guard
        },
        status: {
            type: String,
            default: "waiting", // waiting | active | completed | failed
        },
        attempts: {
            type: Number,
            default: 1, // how many tries it gets in all
        },
        attemptsMade: {
            type: Number,
            default: 0, // how many have failed so far
        },
        backoffMs: {
            type: Number,
            default: 0, // the first pause before a retry; each next one doubles
        },
        stalls: {
            type: Number,
            default: 0, // times a worker died holding it (a redeploy) and another took it over
        },
        runAt: {
            type: Date,
            default: Date.now, // not before this — a retry's pause, or a calendar job's due time
        },
        lockedUntil: {
            type: Date,
            default: null, // a worker holds it until then, and renews while it runs
        },
        lastError: {
            type: String,
            default: null,
        },
        result: {
            type: mongoose.Schema.Types.Mixed,
            default: null,
        },
        finishedAt: {
            type: Date,
            default: null,
        },
    },
    { timestamps: true }
)

// what a worker asks every few seconds
jobSchema.index({ queue: 1, status: 1, runAt: 1 })
// ONE AT A TIME per student and per schedule: a second waiting or active row with the same key is
// refused. A plain unique index, so every MongoDB-compatible database enforces it — a finished row and a
// row with no key carry "<key>#<id>", which never collides.
jobSchema.index({ queue: 1, activeKey: 1 }, { unique: true })
// finished rows clear themselves after a week — enough to look into a failure, never a growing pile
jobSchema.index({ finishedAt: 1 }, { expireAfterSeconds: 7 * 24 * 3600 })

module.exports = mongoose.model("Job", jobSchema)
