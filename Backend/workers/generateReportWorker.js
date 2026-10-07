// THE generate_report WORKER. Everything between a scored profile and a report the student can read:
//
//     resolve activities  →  matchProfile()  →  recommendations  →  reports
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

const { jobQueue } = require("./jobQueue")
const { raiseIssue } = require("../utils/assessmentIssues")
const mongoose = require("mongoose")

const scoreProfile = require("../scoring/scoreProfile")
const matchProfile = require("../matching/matchProfile")
const { createActivityResolver } = require("../matching/activityResolver")
// NO AI SUMMARY SINCE ROUND 19 (owner: "remove it entirely — stop the call, not just hide it"). The
// report is the ranking and the data behind each career; no model writes anything for it, so a report
// costs no model call at all. reportComposer.js stays in the repo as reference, unused.
// report@4.0.0 = "no prose": the `sections` field is stored empty.
const REPORT_VERSION = "report@4.0.0"

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

// Enqueued by score_profile on completion. Keyed on the student, so a re-score never races a
// re-report on the same student, while a finished job never blocks a genuine re-run — see jobQueue.js.
const enqueueGenerateReport = async (userId) => jobQueue().enqueue(QUEUE_NAME, QUEUE_NAME, { userId: String(userId) }, {
    key: String(userId),
    attempts: 5,
    backoffMs: 10000,
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

    const release = (profile.completeness && profile.completeness.release) || "withhold"
    const sections = {}
    const report_version = REPORT_VERSION
    const now = new Date()

    await Recommendation.findOneAndUpdate(
        { user: userId },
        {
            $set: {
                user: userId,
                sessionId: submission ? submission.sessionId : null,
                generatedAt: now,
                scoring_version: profile.scoring_version,
                norm_set_id: profile.norm_set_id || null,
                taxonomy_version: professions.generated_on || null,
                baseline_version: baseline.schema_version || null,
                matching_version: match.matching_version,
                ranked_professions: match.ranked,
                combined_careers: match.combined || [],
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
                activity_readings: resolvedActivities.map((resolved) => ({
                    said: resolved.activity,
                    readAs: resolved.readAs || resolved.canonicalActivity,
                    rowId: resolved.rowId || null,
                    cacheHit: resolved.unrateable ? "unrateable" : resolved.cacheHit,
                    // the trace (Round 19): the common name, the near-match cosine, the careers it points to
                    namedAs: resolved.namedAs || null,
                    nearScore: typeof resolved.nearScore === "number" ? resolved.nearScore : null,
                    candidates: (resolved.candidateProfessionIds || []).slice(0, 20),
                    pointsTo: resolved.pointsTo || [],
                    partial: (resolved.partialProfessionIds || []).slice(0, 20),
                })),
            },
        },
        { upsert: true, returnDocument: "after" }
    )

    // generatedAt is the FIRST report's date and is never overwritten (it anchors the 6- and
    // 12-month follow-up), so it lives only in $setOnInsert; each rebuild moves lastGeneratedAt.
    await Report.findOneAndUpdate(
        { user: userId },
        {
            $setOnInsert: { generatedAt: now },
            $set: {
                user: userId,
                lastGeneratedAt: now,
                sourceSubmittedAt: profile.sourceSubmittedAt || null,
                report_version,
                matching_version: match.matching_version,
                scoring_version: profile.scoring_version,
                journey: user.journey || null,
                release,
                sections,
                reviewStatus: "unreviewed",
            },
        },
        { upsert: true, returnDocument: "after" }
    )

    // A withheld report is still written and still stored — the page renders the completion prompt
    // instead of the findings. Marking it "ready" anyway would show a student a thin report as if
    // it were the finished thing.
    await User.findByIdAndUpdate(userId, { "progress.report": release === "withhold" ? "locked" : "ready", reportFailedAt: null })

    return { userId, ranked: match.ranked.length, release, report_version }
}

const start = async () => {
    require("../config/MongoDBCon")

    const worker = jobQueue().createWorker(QUEUE_NAME, async (job) => runOne(job.data.userId), {
        // Deliberately low. Each job holds the whole profession set in memory and makes model
        // calls; four of these at once is plenty and keeps us inside the API's rate limits.
        concurrency: 2,
    })

    worker.on("completed", async (job, result) => {
        console.log(`${QUEUE_NAME} ${job.id} — ${result.ranked} professions ranked, release ${result.release}`)

        // A re-score that finished while this job ran could not queue a new report (this one was
        // still active). If the profile moved on, build again from the newer one.
        try {
            const [profile, report] = await Promise.all([
                Profile.findOne({ user: job.data.userId }, { sourceSubmittedAt: 1 }).lean(),
                Report.findOne({ user: job.data.userId }, { sourceSubmittedAt: 1 }).lean(),
            ])
            const scored = profile && profile.sourceSubmittedAt && new Date(profile.sourceSubmittedAt).getTime()
            const built = report && report.sourceSubmittedAt && new Date(report.sourceSubmittedAt).getTime()
            if (scored && (!built || built < scored)) {
                console.log(`${QUEUE_NAME} ${job.data.userId} — the profile changed while the report was being built, building again`)
                await enqueueGenerateReport(job.data.userId)
            }
        } catch (error) {
            console.error(`${QUEUE_NAME} ${job.data.userId}: could not check for a newer profile — ${error.message}`)
        }
    })

    worker.on("failed", async (job, error) => {
        console.error(`${QUEUE_NAME} ${job && job.id} FAILED (attempt ${job && job.attemptsMade}) — ${error.message}`)

        // Out of retries: mark it, so the student sees "something went wrong — try again" rather
        // than a spinner that never ends. See userModel `reportFailedAt`.
        if (job && job.attemptsMade >= (job.opts.attempts || 1)) {
            console.error(`${QUEUE_NAME} GAVE UP for student ${job.data.userId} — their report page now offers a retry`)
            try {
                await User.updateOne({ _id: job.data.userId }, { reportFailedAt: new Date() })
                // and the team hears about it — the student sees "Try again", the admin sees why
                await raiseIssue({ user: job.data.userId, module: "report", kind: "report_failed", detail: `${QUEUE_NAME}: ${error.message.slice(0, 300)}`, notify: true })
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
