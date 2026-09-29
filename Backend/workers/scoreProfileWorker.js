// THE score_profile WORKER. The thin I/O wrapper the pure scoring engine deliberately does not
// contain: read the submission, call scoreProfile(), write the profile row.
//
//     node Backend/workers/scoreProfileWorker.js          run the worker
//     node Backend/workers/scoreProfileWorker.js --once <userId>    score one student and exit
//
// WHY A QUEUE AT ALL, when scoreProfile() is pure and fast. Because scoring is not the whole job:
// llmScorer.js has to grade the five open items first, and that is five model calls that can be
// slow, rate-limited or briefly down. A student who has just finished a forty-minute assessment
// must not sit on a spinner waiting for someone else's API, and a transient 529 must not lose
// their submission. The queue makes the slow part retryable and the request instant.
//
// THE LLM SCORES ARE STORED ON THE SUBMISSION, NOT RECOMPUTED HERE. That is what makes re-scoring
// free: a formula change re-runs this worker over every submission without re-billing a single
// API call. If the open-item scores are missing the job fails loudly rather than scoring a partial
// profile — a profile silently missing four inputs looks exactly like a complete one.

const path = require("path")

// Explicit path: this file is run directly from the repo root as often as from Backend/, and
// dotenv resolves against the working directory. server.js can rely on the default; a worker
// cannot.
require("dotenv").config({ path: path.join(__dirname, "..", ".env") })

const { Queue, Worker } = require("bullmq")
const { addOnce, attachConnectionLogging, withDnsWorkaround, idleTimings } = require("./queueHelpers")
const mongoose = require("mongoose")

const scoreProfile = require("../scoring/scoreProfile")
const Submission = require("../model/submissionsModel")
const { gradeOpenItems, gradeStoryRecall, createGradingClient } = require("./gradeOpenItems")
const Profile = require("../model/profilesModel")
const User = require("../model/userModel")

const QUEUE_NAME = "score_profile"

// BullMQ needs the connection options rather than a client, and maxRetriesPerRequest must be null
// or it aborts the blocking reads a worker lives on.
//
// BUILT LAZILY, and that matters: a router that imports enqueueScoreProfile must not fail to load
// on a machine with no Redis configured. The error belongs at the moment someone tries to queue a
// job, where it says something useful, not at require() time, where it takes the whole server down
// for a feature that may not be in use yet.
const connectionOptions = () => {
    const url = process.env.REDIS_URL
    if (!url) throw new Error("REDIS_URL is not set — the score_profile queue cannot be reached")
    return withDnsWorkaround({ url, maxRetriesPerRequest: null })
}

let queue = null

const scoreProfileQueue = () => {
    if (!queue) queue = new Queue(QUEUE_NAME, { connection: connectionOptions() })
    return queue
}

// Called from the request path: enqueue and return. `addOnce` keys the job on the student's id so
// a double-tap on Submit produces one job — while still letting a genuine resubmit re-run. See
// queueHelpers.js; the naive version silently swallowed every resubmit for 24 hours.
//
// The id uses a HYPHEN, not a colon: BullMQ reserves ":" for its own Redis key namespacing and
// rejects a custom id containing one.
const enqueueScoreProfile = async (userId) => addOnce(scoreProfileQueue(), QUEUE_NAME, userId, {
    attempts: 5,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: { age: 86400, count: 1000 },
    removeOnFail: { age: 604800 },
})

// `lastAttempt` decides what a failed grading CALL means (gradeOpenItems.js, isTransient): before
// the last attempt it throws so BullMQ retries just the failed items; on the last attempt the null
// is stored and the student gets a profile with that one factor dropped rather than no report.
const runOne = async (userId, { lastAttempt = false } = {}) => {
    const submission = await Submission.findOne({ user: userId })
    if (!submission) throw new Error(`no submission for user ${userId}`)
    if (!submission.psychometric || Object.keys(submission.psychometric).length === 0) {
        throw new Error(`submission for user ${userId} has no psychometric answers`)
    }

    // GRADE THE WRITTEN ANSWERS FIRST. scoreProfile expects each open item as an already-graded
    // object; handed raw text it silently returns a PERFECT belief_bank for anybody who typed
    // anything. See gradeOpenItems.js — raw text and grades live under different keys precisely so
    // that can never happen.
    //
    // The grades are written back onto the submission, so a formula change re-runs this worker over
    // every student without re-billing a single model call.
    const graded = await gradeOpenItems({
        psychometric: submission.psychometric,
        callLlm: createGradingClient(),
        acceptTransient: lastAttempt,
    })

    // What did grade is written FIRST, so a retry never re-bills it.
    if (graded) {
        await Submission.findOneAndUpdate(
            { user: userId },
            { $set: { "psychometric.perspective.open": graded.open, "psychometric.perspective.openMeta": graded.meta } }
        )
        submission.psychometric.perspective.open = graded.open
        console.log(`${QUEUE_NAME} ${userId} — graded ${Object.keys(graded.open).join(", ") || "nothing new"}`)
    }

    // The story's free recall, same separation: `freeText` is what the student narrated, `free` is
    // the graded result, and scoreProfile only reads `free`.
    const story = await gradeStoryRecall({
        psychometric: submission.psychometric,
        callLlm: createGradingClient(),
        acceptTransient: lastAttempt,
    })

    // A failed call before the last attempt: throw, and the job retries only what is missing.
    const pending = [...((graded && graded.transient) || []), ...(story && story.transient ? ["story free recall"] : [])]
    if (pending.length > 0) {
        throw new Error(`grading temporarily failed for ${pending.join(", ")} — will retry`)
    }

    if (story) {
        await Submission.findOneAndUpdate(
            { user: userId },
            { $set: { "psychometric.storyRecall.free": story.free, "psychometric.storyRecall.freeMeta": story.meta } }
        )
        submission.psychometric.storyRecall.free = story.free
        console.log(`${QUEUE_NAME} ${userId} — graded story free recall (${story.meta.score})`)
    }

    const profile = scoreProfile(submission.psychometric)

    // Mixed fields: always findOneAndUpdate + $set. Mongoose does not track changes inside them,
    // so mutating and saving would write nothing and report success.
    await Profile.findOneAndUpdate(
        { user: userId },
        {
            $set: {
                user: userId,
                sessionId: submission.sessionId || null,
                scoring_version: profile.scoring_version,
                component_versions: profile.component_versions || {},
                norm_set_id: profile.norm_set_id || null,
                computed_at: new Date(),
                raw_scores: profile.raw_scores,
                normed_scores: profile.normed_scores || {},
                bands: profile.bands || {},
                data_quality: profile.data_quality || {},
                flags: profile.flags || {},
                banks: profile.banks || {},
                components: profile.components || {},
                values_profile: profile.values_profile || {},
                completeness: profile.completeness || {},
            },
        },
        { upsert: true, returnDocument: "after" }
    )

    return profile
}

const start = async () => {
    require("../config/MongoDBCon")

    const worker = new Worker(QUEUE_NAME, async (job) => {
        const lastAttempt = job.attemptsMade + 1 >= (job.opts.attempts || 1)
        const profile = await runOne(job.data.userId, { lastAttempt })

        // Hand off to generate_report as a SEPARATE job, not an inline call. That separation is
        // the whole point: report generation makes model calls and can fail for reasons that have
        // nothing to do with scoring, and when it does it must retry on its own without re-running
        // anything here. Required lazily so this worker still loads if the report side is down.
        const { enqueueGenerateReport } = require("./generateReportWorker")
        await enqueueGenerateReport(job.data.userId)

        return {
            userId: job.data.userId,
            scoring_version: profile.scoring_version,
            completeness: profile.completeness,
        }
    }, { connection: connectionOptions(), concurrency: 4, ...idleTimings() })

    // Summarises ioredis's reconnect churn instead of letting it bury the job output. See
    // queueHelpers.js — a successful job once vanished inside forty ENOTFOUND stack traces.
    attachConnectionLogging(worker, QUEUE_NAME)

    worker.on("completed", (job, result) => {
        console.log(`${QUEUE_NAME} ${job.id} — scored ${result.scoring_version}, matching completeness ${result.completeness && result.completeness.matching}`)
    })

    // A failure is logged loudly and the job is retried. It is never swallowed: a student whose
    // profile silently never computed looks identical to one who never submitted.
    worker.on("failed", async (job, error) => {
        console.error(`${QUEUE_NAME} ${job && job.id} FAILED (attempt ${job && job.attemptsMade}) — ${error.message}`)

        // Out of retries: mark it, so the student sees "something went wrong — try again" rather
        // than a spinner that never ends. See userModel `reportFailedAt`.
        if (job && job.attemptsMade >= (job.opts.attempts || 1)) {
            console.error(`${QUEUE_NAME} GAVE UP for student ${job.data.userId} — their report page now offers a retry`)
            try {
                await User.updateOne({ _id: job.data.userId }, { reportFailedAt: new Date() })
            } catch (markError) {
                console.error(`${QUEUE_NAME} could not mark ${job.data.userId} as failed — ${markError.message}`)
            }
        }
    })

    console.log(`${QUEUE_NAME} worker listening`)

    // handed back so server.js can close it cleanly on shutdown when it hosts the workers itself
    return worker
}

if (require.main === module) {
    const onceIndex = process.argv.indexOf("--once")

    if (onceIndex !== -1) {
        require("../config/MongoDBCon")
        mongoose.connection.once("connected", async () => {
            try {
                const profile = await runOne(process.argv[onceIndex + 1])
                console.log(`scored ${process.argv[onceIndex + 1]} — ${profile.scoring_version}, matching completeness ${profile.completeness && profile.completeness.matching}`)
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

module.exports = { QUEUE_NAME, scoreProfileQueue, enqueueScoreProfile, runOne, start }
