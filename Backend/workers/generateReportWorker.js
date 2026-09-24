// THE generate_report WORKER. Everything between a scored profile and a report the student can read:
//
//     resolve activities  →  matchProfile()  →  recommendations  →  compose prose  →  reports
//
//     node Backend/workers/generateReportWorker.js              run the worker
//     node Backend/workers/generateReportWorker.js --once <userId>   one student, then exit
//
// WHY MATCHING LIVES IN THIS JOB RATHER THAN ITS OWN. The rule is that a report failure must never
// re-run scoring, and this satisfies it: scoring's expensive half is the five open-item LLM calls,
// and those are stored on the submission, so a retry here never re-bills them. Matching itself is
// pure and free. The activity resolver does cost something on a first encounter, but its cache
// absorbs that on any retry. So this whole job is safely retryable end to end, and `score_profile`
// stays untouched — which is the property that actually matters.
//
// THE PURE CORE STAYS PURE. matchProfile() does no I/O; every piece of I/O it needs is resolved
// here and passed in. Same split the scoring engine keeps with llmScorer.js.

const fs = require("fs")
const path = require("path")

require("dotenv").config({ path: path.join(__dirname, "..", ".env") })

const { Queue, Worker } = require("bullmq")
const { addOnce, attachConnectionLogging, withDnsWorkaround } = require("./queueHelpers")
const mongoose = require("mongoose")

const scoreProfile = require("../scoring/scoreProfile")
const matchProfile = require("../matching/matchProfile")
const { createActivityResolver } = require("../matching/activityResolver")
const { composeReport, createReportClient, REPORT_VERSION } = require("./reportComposer")

const Submission = require("../model/submissionsModel")
const Profile = require("../model/profilesModel")
const User = require("../model/userModel")
const Recommendation = require("../model/recommendationsModel")
const Report = require("../model/reportsModel")
const ActivityFactors = require("../model/activityFactorsModel")

const QUEUE_NAME = "generate_report"
const DATA = path.join(__dirname, "..", "data")

const readData = (name) => JSON.parse(fs.readFileSync(path.join(DATA, name), "utf8"))

// Read once at module load, not per job. These are ~4 MB of profession data and they do not change
// between students; re-reading them on every job would be the slowest thing in the pipeline.
let cachedData = null

const loadData = () => {
    if (!cachedData) {
        cachedData = {
            professions: readData("ALL-professions.json"),
            baseline: readData("baseline_rating.json"),
            anchors: readData("factor_anchors.json"),
            professionEmbeddings: readData("profession_embeddings.json"),
        }
    }
    return cachedData
}

const connectionOptions = () => {
    const url = process.env.REDIS_URL
    if (!url) throw new Error("REDIS_URL is not set — the generate_report queue cannot be reached")
    return withDnsWorkaround({ url, maxRetriesPerRequest: null })
}

let queue = null

const reportQueue = () => {
    if (!queue) queue = new Queue(QUEUE_NAME, { connection: connectionOptions() })
    return queue
}

// Enqueued by score_profile on completion. `addOnce` keeps a re-score from racing a re-report on
// the same student, while still allowing a genuine re-run — see queueHelpers.js.
const enqueueGenerateReport = async (userId) => addOnce(reportQueue(), QUEUE_NAME, userId, {
    attempts: 5,
    backoff: { type: "exponential", delay: 10000 },
    removeOnComplete: { age: 86400, count: 1000 },
    removeOnFail: { age: 604800 },
})

const runOne = async (userId) => {
    const { professions, baseline, anchors, professionEmbeddings } = loadData()

    const [profile, submission, user] = await Promise.all([
        Profile.findOne({ user: userId }).lean(),
        Submission.findOne({ user: userId }).lean(),
        User.findById(userId).lean(),
    ])

    if (!profile) throw new Error(`no profile for user ${userId} — score_profile has not run`)
    if (!user) throw new Error(`no user ${userId}`)

    const interest = (submission && submission.interest) || {}

    // ── the impure half: activity text → factors + a candidate shortlist ─────────────────────
    const resolver = createActivityResolver({
        ActivityFactors,
        professionEmbeddings,
        anchors,
        factorSlugs: scoreProfile.MATCHING_FACTORS,
    })

    const persistentInterests = (interest.currentInterests && interest.currentInterests.persistentInterests) || []
    const rows = persistentInterests
        .filter((row) => row && String(row.activity || "").trim() !== "")
        .map((row) => ({ activity: row.activity, key: String(row.activity).trim().replace(/\s+/g, " ").toLowerCase() }))

    // A resolver failure must not cost the student their whole report. Matching degrades to the
    // directly-named aspirations plus the "worth the switch" list, which is thin but honest —
    // and far better than a 500 after they have finished a forty-minute assessment.
    let resolvedActivities = []

    try {
        resolvedActivities = await resolver.resolveActivities(rows)
    } catch (error) {
        console.error(`${QUEUE_NAME} ${userId}: activity resolution failed (${error.message.slice(0, 160)}) — matching on named aspirations only`)
    }

    // ── the pure half ────────────────────────────────────────────────────────────────────────
    const match = matchProfile({
        profile,
        interest,
        user,
        professions: professions.professions,
        baseline,
        resolvedActivities,
    })

    await Recommendation.findOneAndUpdate(
        { user: userId },
        {
            $set: {
                user: userId,
                sessionId: submission ? submission.sessionId : null,
                generatedAt: new Date(),
                scoring_version: profile.scoring_version,
                norm_set_id: profile.norm_set_id || null,
                taxonomy_version: professions.generated_on || null,
                baseline_version: baseline.schema_version || null,
                matching_version: match.matching_version,
                ranked_professions: match.ranked,
                worth_the_switch: match.worthTheSwitch,
                filtered: match.filtered,
                aspiration_signals: match.aspirationSignals,
                readiness_layer: {
                    confidence: profile.raw_scores.confidence,
                    consistency_grit: profile.raw_scores.consistency_grit,
                    learning_capacity: profile.raw_scores.learning_capacity,
                    informed_decision_making: profile.raw_scores.informed_decision_making,
                },
                values_profile: profile.values_profile || {},
                list_counts: match.listCounts,
                dominant_reasons: (match.programOne && match.programOne.dominantReasons) || [],
            },
        },
        { upsert: true, returnDocument: "after" }
    )

    // ── the prose ────────────────────────────────────────────────────────────────────────────
    const release = (profile.completeness && profile.completeness.release) || "withhold"

    // NO MODEL CALL FOR A WITHHELD REPORT. Below the release threshold the page shows the
    // completion prompt instead of findings, so prose written here is never read by anyone — and a
    // student who abandons after one module is exactly the student most likely to trigger this.
    // Paying to write a report for every dropout is a cost that scales with the wrong thing.
    //
    // The row is still written, with the reason. That matters: it keeps one report per student
    // rather than an absent row that looks like a failed pipeline, and the moment they finish more
    // of the assessment a re-run replaces it with the real thing.
    const composed = release === "withhold"
        ? { sections: { withheld: "Not enough of the assessment is complete to say anything useful yet." }, report_version: REPORT_VERSION }
        : await composeReport({ profile, match, user, callLlm: createReportClient() })

    const { sections, report_version } = composed

    await Report.findOneAndUpdate(
        { user: userId },
        {
            $set: {
                user: userId,
                generatedAt: new Date(),
                report_version,
                matching_version: match.matching_version,
                scoring_version: profile.scoring_version,
                journey: user.journey || null,
                release,
                sections,
                model: process.env.REPORT_MODEL || "claude-sonnet-5",
                reviewStatus: "unreviewed",
            },
        },
        { upsert: true, returnDocument: "after" }
    )

    // A withheld report is still written and still stored — the page renders the completion prompt
    // instead of the findings. Marking it "ready" anyway would show a student a thin report as if
    // it were the finished thing.
    await User.findByIdAndUpdate(userId, { "progress.report": release === "withhold" ? "locked" : "ready" })

    return { userId, ranked: match.ranked.length, release, report_version }
}

const start = async () => {
    require("../config/MongoDBCon")

    const worker = new Worker(QUEUE_NAME, async (job) => runOne(job.data.userId), {
        connection: connectionOptions(),
        // Deliberately low. Each job holds the whole profession set in memory and makes model
        // calls; four of these at once is plenty and keeps us inside the API's rate limits.
        concurrency: 2,
    })

    // See queueHelpers.js: ioredis retries a dropped connection forever and stack-traces every
    // attempt. One compact line per problem, so a completed job stays visible.
    attachConnectionLogging(worker, QUEUE_NAME)

    worker.on("completed", (job, result) => {
        console.log(`${QUEUE_NAME} ${job.id} — ${result.ranked} professions ranked, release ${result.release}`)
    })

    worker.on("failed", (job, error) => {
        console.error(`${QUEUE_NAME} ${job && job.id} FAILED (attempt ${job && job.attemptsMade}) — ${error.message}`)
    })

    console.log(`${QUEUE_NAME} worker listening`)
}

if (require.main === module) {
    const onceIndex = process.argv.indexOf("--once")

    if (onceIndex !== -1) {
        require("../config/MongoDBCon")
        mongoose.connection.once("connected", async () => {
            try {
                const result = await runOne(process.argv[onceIndex + 1])
                console.log(`${result.ranked} professions ranked · release ${result.release} · ${result.report_version}`)
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

module.exports = { QUEUE_NAME, enqueueGenerateReport, runOne, start, REPORT_VERSION }
