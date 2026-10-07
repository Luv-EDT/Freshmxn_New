const express = require("express")
const Report = require("../model/reportsModel")
const Recommendation = require("../model/recommendationsModel")
const Submission = require("../model/submissionsModel")
const Profile = require("../model/profilesModel")
const authMiddleware = require("../middlewares/authMiddleware")
const requireDiscovery = require("../middlewares/requireDiscovery")
const User = require("../model/userModel")
const { directionUpdate } = require("../utils/direction")
const { FACTOR_LABELS } = require("../workers/reportComposer")
const { FACTOR_GUIDE, GUIDE_GROUPS, WHY_IT_MATTERS } = require("../utils/factorGuide")
const DEGREE_OPTIONS = require("../data/degree_options.json")
const DISABILITY_SUPPORT = require("../data/disability_support.json")

// The support section (owner, Round 10) — only for a student who declared a difficulty, and only
// once the owner has checked the file against its official sources (verified_by_owner). Until then
// nothing is shown: an unverified legal claim is worse than none.
const supportFor = (submission) => {
    if (!DISABILITY_SUPPORT.verified_by_owner || !DISABILITY_SUPPORT.checked_on) return null
    const declared = submission && submission.psychometric && submission.psychometric.accommodations
    if (!declared || !Array.isArray(declared.needs) || declared.needs.length === 0) return null
    return { checkedOn: DISABILITY_SUPPORT.checked_on, rows: DISABILITY_SUPPORT.rows }
}

// "B.Tech / B.E. (Civil)" — for the card's "your degree already counts" line
const degreeLabelFor = (detail) => {
    const family = detail && DEGREE_OPTIONS.families.find((option) => option.id === detail.degree)
    if (!family || family.id === "none") return null
    const subject = family.subjects.find((option) => option.id === detail.subject)
    return subject && subject.id !== "other" ? `${family.label} (${subject.label})` : family.label
}

const ABROAD_HOPES = ["no", "maybe", "yes"]
const ABROAD_COUNTRIES = ["CA", "US", "UK", "AU", "DE", "other"]
const abroadPlansFor = (submission) => {
    const background = (submission && submission.interest && submission.interest.backgroundInfo) || {}
    if (!ABROAD_HOPES.includes(background.abroadHope)) return null
    return { hope: background.abroadHope, countries: (background.abroadCountries || []).filter((code) => ABROAD_COUNTRIES.includes(code)) }
}

const router = express.Router()

// Round 11: what "Update my report" can improve — a report built by scoring or matching older than
// the code now running, or prose written before the ranking beside it was re-run.
const { SCORING_VERSION } = require("../scoring/scoreProfile")
const { MATCHING_VERSION } = require("../matching/matchProfile")

const updateIsAvailable = (report, recommendation) => Boolean(report) && (
    report.scoring_version !== SCORING_VERSION
    || report.matching_version !== MATCHING_VERSION
    || (Boolean(recommendation) && recommendation.matching_version !== report.matching_version)
)


// ========================
// Helpers
// ========================

// THE ONE PLACE match_confidence IS REMOVED, and it is here rather than in the page for a reason.
// It is computed on every ranked profession and stored deliberately — how much of a profession's
// weighted picture we could actually see is worth keeping. It is also the single number most likely
// to be misread: a student shown "0.62" reads a score out of one, when it means "we could see 62%
// of what this profession asks about". A frontend that simply never renders it is one careless
// `JSON.stringify` away from leaking it. Strip it at the boundary and the question cannot arise.
//
// data_quality is never on these records at all — it lives on the profile, which this route does
// not return.
const FORBIDDEN_FIELDS = ["match_confidence", "activity_match_confidence"]

// THE SLUGS ARE TRANSLATED HERE FOR THE SAME REASON match_confidence IS REMOVED HERE: the page
// cannot leak what it never receives.
//
// The ranking carries factor names as engine identifiers — `propensity_to_go_deep`,
// `emotional_stability`, `firmness`. The page used to render them with the underscores swapped for
// spaces, which produces "firmness" and "propensity to go deep" on a fifteen-year-old's screen.
// That is not a translation; it is an identifier with its punctuation changed.
//
// reportComposer.js already owns the canonical map — it was built so no identifier ever reaches the
// model that writes the prose. Reusing it means the sentence a student reads and the sentence the
// model writes name the same factor the same way, and there is one place to change it. A second
// copy in the frontend would drift, and the drift would be invisible: both would still render
// SOMETHING.
const labelFactor = (entry) => ({
    ...entry,
    factor: FACTOR_LABELS[entry.factor] || String(entry.factor).replace(/_/g, " "),
    slug: entry.factor,
})

const withLabels = (list) => (Array.isArray(list) ? list.map(labelFactor) : [])

const stripInternal = (entry) => {
    // Round 13 (owner): the "Partial · N% measured" coverage line moved off the careers to the
    // assessment page and profile only, so nothing about coverage goes out with a career any more.
    const clean = { ...entry }
    FORBIDDEN_FIELDS.forEach((field) => { delete clean[field] })

    clean.supportingFactors = withLabels(clean.supportingFactors)
    clean.divergingFactors = withLabels(clean.divergingFactors)

    return clean
}

// Aspiration signals carry the same factor lists, and 4D renders them — "you said you want X; it
// ranked #4 because your profile shows Y". Same translation, same reason.
const cleanSignal = (signal) => ({
    ...signal,
    supportingFactors: withLabels(signal.supportingFactors),
    divergingFactors: withLabels(signal.divergingFactors),
})


// WHAT TO WORK ON (owner, Round 18): the qualities this career leans on (weight 0.3 or more in
// baseline_rating.json) where the student sits more than 1.5 below what the work asks. Sent as NAMES
// ONLY — never the gap, the weight or either score. A factor not measured is never listed (missing is
// not low), and uncertainty tolerance is a position, so it is never something to "work on".
const BASELINE = new Map(require("../data/baseline_rating.json").ratings.map((row) => [row.id, row]))
const WORK_ON_WEIGHT = 0.3
const WORK_ON_GAP = 1.5
const WORK_ON_SHOWN = 4

const workOnFor = (professionId, raw = {}) => {
    const rating = BASELINE.get(professionId)
    if (!rating) return []
    return Object.entries(rating.weights || {})
        .filter(([slug, weight]) => weight >= WORK_ON_WEIGHT && slug !== "uncertainty_tolerance" && FACTOR_GUIDE[slug])
        .filter(([slug]) => typeof raw[slug] === "number" && typeof rating.factors[slug] === "number")
        .map(([slug, weight]) => ({ slug, weight, gap: rating.factors[slug] - raw[slug] }))
        .filter((row) => row.gap > WORK_ON_GAP)
        .sort((left, right) => right.gap * right.weight - left.gap * left.weight || left.slug.localeCompare(right.slug))
        .slice(0, WORK_ON_SHOWN)
        .map((row) => FACTOR_GUIDE[row.slug].name)
}

// THE FOUR FUNDAMENTALS (owner, Round 18) — words and meanings, never the score
const fundamentalsFor = (raw = {}) => GUIDE_GROUPS[0].factors.map((slug) => ({
    slug,
    name: FACTOR_GUIDE[slug].name,
    meaning: FACTOR_GUIDE[slug].meaning,
    why: WHY_IT_MATTERS[slug],
    level: levelFor(raw[slug]),
}))

// An aspiration that names no career on our list still fed matching — as an activity (Round 17's
// naming step). The report says what it was read as ("long distance running").
const sameText = (left, right) => String(left || "").trim().toLowerCase() === String(right || "").trim().toLowerCase()
const readAsFor = (signal, readings) => {
    const hit = (readings || []).find((reading) => sameText(reading.said, signal.professionText))
    return hit && hit.readAs && !sameText(hit.readAs, signal.professionText) ? hit.readAs : null
}

// ========================
// Get My Report
// ========================

// Returns the prose AND the ranking it describes, together. They live in separate collections
// because they are regenerated independently, but a student asking for their report wants both,
// and fetching them in one round trip means the page can never render prose against a ranking that
// has since moved.
router.get("/getMyReport", authMiddleware, requireDiscovery, async (req, res) => {
    try {
        const [report, recommendation, submission, profile] = await Promise.all([
            Report.findOne({ user: req.user._id }).lean(),
            Recommendation.findOne({ user: req.user._id }).lean(),
            Submission.findOne({ user: req.user._id }).select("psychometricSubmittedAt psychometric.accommodations interest.backgroundInfo.abroadHope interest.backgroundInfo.abroadCountries").lean(),
            Profile.findOne({ user: req.user._id }).select("raw_scores").lean(),
        ])
        const raw = (profile && profile.raw_scores) || {}
        const withWorkOn = (entry) => ({ ...entry, workOn: workOnFor(entry.professionId, raw) })

        // A REPORT OLDER THAN THE LAST SUBMIT IS BEING REPLACED, not the answer.
        //
        // This is what made a resubmit look broken: a student who finished more modules and pressed
        // Submit again kept seeing their previous report — often the "not enough to go on yet"
        // screen — with nothing to say a new one was on its way. The pipeline takes a minute or two,
        // and for that minute the page was actively misleading.
        //
        // Compared against the submit the report was BUILT FROM (sourceSubmittedAt), not the time it
        // was written: a submit that lands while a report is being built is newer than the build's
        // source even though the report is written after it. Reports from before that field existed
        // fall back to when they were last written.
        const submittedAt = submission && submission.psychometricSubmittedAt
        const builtFrom = report && (report.sourceSubmittedAt || report.lastGeneratedAt || report.generatedAt)
        const isRegenerating = Boolean(report && submittedAt && builtFrom && new Date(builtFrom).getTime() < new Date(submittedAt).getTime())
            // ...or the student pressed "Update my report" and the new one is not written yet
            || Boolean(report && req.user.reportUpdateRequestedAt && new Date(report.lastGeneratedAt || report.generatedAt).getTime() < new Date(req.user.reportUpdateRequestedAt).getTime())

        // THE PIPELINE GAVE UP (see userModel `reportFailedAt`). Without this a first-time student
        // saw "generating" and a resubmitter "being rebuilt" — forever, with the page polling every
        // five seconds. With no usable report the page offers a retry; with an older report it
        // shows that report plus a banner (`rebuildFailed` below).
        const failed = Boolean(req.user.reportFailedAt) && req.user.progress.psychometric === "done"

        if (failed && (!report || isRegenerating)) {
            return res.status(200).json({
                success: true,
                message: "Report generation failed",
                data: { status: "failed", report: null },
            })
        }

        if (isRegenerating) {
            return res.status(200).json({
                success: true,
                message: "Report is being rebuilt",
                data: { status: "generating", report: null },
            })
        }

        if (!report) {
            // Not an error. The assessment may be unfinished, or the pipeline may still be running
            // — the page shows progress rather than a failure.
            return res.status(200).json({
                success: true,
                message: "No report yet",
                data: { status: req.user.progress.psychometric === "done" ? "generating" : "not_started", report: null },
            })
        }

        // A REPORT CHANGES ONLY WHEN THE STUDENT ACTS (owner, Round 11). Built by older scoring or
        // matching than the code now runs — or prose older than the ranking beside it — it is still
        // their report, shown as it is, with an offer: "Update my report". Nothing is queued here.
        const updateAvailable = updateIsAvailable(report, recommendation)

        return res.status(200).json({
            success: true,
            message: "Report fetched successfully",
            data: {
                status: "ready",
                updateAvailable,
                rebuildFailed: failed,
                release: report.release,
                journey: report.journey,
                degree: degreeLabelFor(req.user.journeyDetail),
                support: supportFor(submission),
                // Round 13: does the student hope to study or work abroad, and where — the report shows
                // its "Going abroad" parts only for "maybe" or "yes"
                abroadPlans: abroadPlansFor(submission),
                generatedAt: report.lastGeneratedAt || report.generatedAt,
                sections: report.sections,
                ranked: recommendation ? recommendation.ranked_professions.map((entry) => withWorkOn(stripInternal(entry))) : [],
                combined: recommendation ? (recommendation.combined_careers || []).map(stripInternal) : [],
                filtered: recommendation ? recommendation.filtered : [],
                aspirationSignals: recommendation
                    ? (recommendation.aspiration_signals || []).map((signal) => ({ ...cleanSignal(signal), readAs: readAsFor(signal, recommendation.activity_readings) }))
                    : [],
                // the four fundamentals, as words (owner, Round 18)
                fundamentals: profile ? fundamentalsFor(raw) : null,
                dominantReasons: recommendation ? (recommendation.dominant_reasons || []) : [],
                // The raw readiness and values numbers are NOT sent: the page never used them, and
                // a 0-10 confidence score is exactly what a student must never be shown.
            },
        })

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to fetch report",
            error: error.message,
        })
    }
})

// ========================
// Get My Scores (the Profile page's "Your psychometric profile")
// ========================

// WORDS, NEVER NUMBERS. V1 has no norms (PRD §B.4: normed_scores and bands stay empty until 500+
// per age band), so a raw "3/10" has nothing to be compared against — and most readers are minors,
// who read any number as a grade. The raw 0–10 score is turned into High / Medium / Low HERE, and
// the number itself never leaves the server.
//
// Two factors are deliberately special:
//   confidence            — shown as a WORD LEVEL only, never a number (owner, Round 18; it was left
//                           out entirely before). It is one of the four fundamentals.
//   uncertainty_tolerance — a POSITION, not a level (Master Plan rule 4), so it goes out as where the
//                           student sits between two ways of working, never as high or low.
// data_quality, flags, banks and components are never sent.
//
// Grouped, named and explained with utils/factorGuide.js — the same table the report's fundamentals
// use, so a factor has one name and one meaning everywhere a student sees it (owner, Round 18).

// THIRDS, with a rounding tolerance. Scores are stored to two decimals, so the top third starts at
// 6.67 (20/3) — the old 6.7 cut put a digit span of 7, a verbal memory of 24/36 and a story recall
// of 8/12 (all exactly 6.67) in Medium, and 3.33 in Low.
const HIGH_FROM = 20 / 3 - 0.005
const MEDIUM_FROM = 10 / 3 - 0.005

const levelFor = (score) => {
    if (typeof score !== "number" || Number.isNaN(score)) return null
    if (score >= HIGH_FROM) return "High"
    if (score >= MEDIUM_FROM) return "Medium"
    return "Low"
}

const uncertaintyPosition = (score) => {
    if (typeof score !== "number" || Number.isNaN(score)) return null
    if (score >= HIGH_FROM) return "comfortable not knowing"
    if (score >= MEDIUM_FROM) return "somewhere in between"
    return "prefers a clear plan"
}

// Coverage below 100%, as a whole number, for the Profile's "Partial · N%" (owner, Round 10).
// Complete factors and unmeasured ones get nothing — the level already says "not measured yet".
const coveragePctOf = (coverage, score) => {
    if (typeof score !== "number" || typeof coverage !== "number") return null
    const pct = Math.round(coverage * 100)
    return pct < 100 ? pct : null
}

// The Profile's groups, built from the raw scores — words out, numbers never (pure, for the fixture)
const scoreGroupsFor = (raw = {}, coverage = {}) => GUIDE_GROUPS.map((group) => ({
    key: group.key,
    title: group.title,
    meaning: group.meaning,
    factors: group.factors.map((slug) => ({
        slug,
        name: FACTOR_GUIDE[slug].name,
        meaning: FACTOR_GUIDE[slug].meaning,
        // null → "not measured yet" on the page
        ...(slug === "uncertainty_tolerance" ? { position: uncertaintyPosition(raw[slug]) } : { level: levelFor(raw[slug]) }),
        partialPct: coveragePctOf(coverage[slug], raw[slug]),
    })),
}))

// ========================
// Retry My Report
// ========================

// Offered only after the pipeline gave up (reportFailedAt is set), so it cannot be used to run up
// model calls. It re-runs the whole pipeline from score_profile; grading only re-sends the written
// answers that never got a grade, so a retry costs little.
router.post("/retryMyReport", authMiddleware, requireDiscovery, async (req, res) => {
    try {
        if (!req.user.reportFailedAt || req.user.progress.psychometric !== "done") {
            return res.status(400).json({
                success: false,
                message: "There is nothing to retry",
            })
        }

        // Queued FIRST, flag cleared after: if the queue cannot be reached the student still sees
        // the retry screen rather than a "generating" that nothing is working on.
        // Required here, as in submissionsRouter: the queue is built lazily, and this router must
        // load on a machine with no REDIS_URL.
        const { enqueueScoreProfile } = require("../workers/scoreProfileWorker")
        const { withTimeout } = require("../workers/queueHelpers")
        await withTimeout(enqueueScoreProfile(req.user._id), "queueing the report")

        await req.user.updateOne({ reportFailedAt: null })

        return res.status(200).json({
            success: true,
            message: "Your report is being prepared again",
            data: { status: "generating" },
        })

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Could not restart your report — please try again in a minute",
            error: error.message,
        })
    }
})


// ========================
// Update My Report — only ever on the student's word (Round 11)
// ========================

// Re-scores from the answers already saved (written answers already graded are not sent again) and
// rebuilds the report with today's scoring and matching. Allowed only when there is something to
// update, so it cannot be used to spend model calls on demand. The direction answer decides whether
// the 6/12-month follow-up clock restarts (utils/direction.js).
router.post("/updateMyReport", authMiddleware, requireDiscovery, async (req, res) => {
    try {
        const [report, recommendation] = await Promise.all([
            Report.findOne({ user: req.user._id }).lean(),
            Recommendation.findOne({ user: req.user._id }).select("matching_version").lean(),
        ])

        if (!report || req.user.progress.psychometric !== "done" || !updateIsAvailable(report, recommendation)) {
            return res.status(400).json({ success: false, message: "Your report is already up to date" })
        }

        const direction = directionUpdate({ via: "update", direction: req.body.direction, firstTime: false })
        if (!direction) {
            return res.status(400).json({ success: false, message: "Tell us whether you're heading the same way or looking for something new" })
        }

        const { enqueueScoreProfile } = require("../workers/scoreProfileWorker")
        const { withTimeout } = require("../workers/queueHelpers")
        await withTimeout(enqueueScoreProfile(req.user._id), "queueing the update")

        await User.updateOne({ _id: req.user._id }, {
            ...direction,
            $set: { ...(direction.$set || {}), reportUpdateRequestedAt: new Date(), reportFailedAt: null },
        })

        return res.status(200).json({ success: true, message: "Your report is being updated", data: { status: "generating" } })

    } catch (error) {
        return res.status(500).json({ success: false, message: "Could not start the update — please try again in a minute", error: error.message })
    }
})


router.get("/getMyScores", authMiddleware, requireDiscovery, async (req, res) => {
    try {
        const profile = await Profile.findOne({ user: req.user._id }).select("raw_scores factor_coverage computed_at").lean()

        if (!profile) {
            return res.status(200).json({
                success: true,
                message: "No scores yet",
                data: null,
            })
        }

        const raw = profile.raw_scores || {}
        const coverage = profile.factor_coverage || {}

        return res.status(200).json({
            success: true,
            message: "Scores fetched successfully",
            data: {
                computedAt: profile.computed_at,
                // Round 13: a profile scored before Round 10 stored no coverage, so it can show no
                // "Partial · N%" until it is scored again ("Update my report")
                coverageKnown: Object.keys(coverage).length > 0,
                groups: scoreGroupsFor(raw, coverage),
            },
        })

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to fetch your scores",
            error: error.message,
        })
    }
})

module.exports = router
module.exports.levelFor = levelFor
module.exports.scoreGroupsFor = scoreGroupsFor
module.exports.workOnFor = workOnFor
module.exports.fundamentalsFor = fundamentalsFor
