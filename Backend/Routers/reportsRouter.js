const express = require("express")
const Report = require("../model/reportsModel")
const Recommendation = require("../model/recommendationsModel")
const Submission = require("../model/submissionsModel")
const Profile = require("../model/profilesModel")
const authMiddleware = require("../middlewares/authMiddleware")
const requirePaid = require("../middlewares/requirePaid")
const { FACTOR_LABELS } = require("../workers/reportComposer")

const router = express.Router()


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


// ========================
// Get My Report
// ========================

// Returns the prose AND the ranking it describes, together. They live in separate collections
// because they are regenerated independently, but a student asking for their report wants both,
// and fetching them in one round trip means the page can never render prose against a ranking that
// has since moved.
router.get("/getMyReport", authMiddleware, requirePaid, async (req, res) => {
    try {
        const [report, recommendation, submission] = await Promise.all([
            Report.findOne({ user: req.user._id }).lean(),
            Recommendation.findOne({ user: req.user._id }).lean(),
            Submission.findOne({ user: req.user._id }).select("psychometricSubmittedAt").lean(),
        ])

        // A REPORT OLDER THAN THE LAST SUBMIT IS BEING REPLACED, not the answer.
        //
        // This is what made a resubmit look broken: a student who finished more modules and pressed
        // Submit again kept seeing their previous report — often the "not enough to go on yet"
        // screen — with nothing to say a new one was on its way. The pipeline takes a minute or two,
        // and for that minute the page was actively misleading.
        const submittedAt = submission && submission.psychometricSubmittedAt
        const isRegenerating = Boolean(report && submittedAt && report.generatedAt < submittedAt)

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

        // Generated from a different ranking than the one we hold: the match was re-run after this
        // prose was written. Say so rather than showing prose that describes professions the
        // student can no longer see in the list beside it.
        const stale = Boolean(recommendation) && recommendation.matching_version !== report.matching_version

        return res.status(200).json({
            success: true,
            message: "Report fetched successfully",
            data: {
                status: stale ? "stale" : "ready",
                release: report.release,
                journey: report.journey,
                generatedAt: report.generatedAt,
                sections: report.sections,
                ranked: recommendation ? recommendation.ranked_professions.map(stripInternal) : [],
                // ROUTED THROUGH THE SAME CLEANER, which it was not before. worth_the_switch
                // carries `supportingFactors` exactly like the ranking does, and it was the one
                // array that skipped this — so its factors reached the page as raw engine slugs
                // (`propensity_to_go_deep`) while the ranking beside it showed proper labels. A
                // latent bug until the redesign gave this list its own card.
                worthTheSwitch: recommendation ? (recommendation.worth_the_switch || []).map(stripInternal) : [],
                filtered: recommendation ? recommendation.filtered : [],
                aspirationSignals: recommendation ? (recommendation.aspiration_signals || []).map(cleanSignal) : [],
                dominantReasons: recommendation ? (recommendation.dominant_reasons || []) : [],
                readiness: recommendation ? recommendation.readiness_layer : {},
                valuesProfile: recommendation ? recommendation.values_profile : {},
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
//   confidence            — left out entirely. It is never shown to a student as "your confidence
//                           score" (profilesModel.js; PRD §B.4).
//   uncertainty_tolerance — a POSITION, not a level (Master Plan rule 4), so it goes out as where the
//                           student sits between two ways of working, never as high or low.
// data_quality, flags, banks and components are never sent.
//
// Grouped and labelled with FACTOR_LABELS, the same map the report uses, so a factor has one name
// everywhere a student sees it.
const SCORE_GROUPS = [
    { title: "Personality", factors: ["openness", "conscientiousness", "agreeableness", "extraversion", "emotional_stability"] },
    { title: "Thinking and memory", factors: ["reasoning", "short_term_memory", "long_term_memory", "processing_speed", "focus", "learning_capacity"] },
    {
        title: "Ways of being smart",
        factors: [
            "logical_intelligence", "verbal_intelligence", "spatial_intelligence", "musical_intelligence",
            "bodily_intelligence", "naturalistic_intelligence", "existential_intelligence",
            "intrapersonal_intelligence", "interpersonal_intelligence", "emotional_intelligence", "practical_intelligence",
        ],
    },
    {
        title: "How you work",
        factors: [
            "firmness", "collaboration", "consistency_grit", "divergent_thinking", "convergent_thinking",
            "propensity_to_go_deep", "informed_decision_making",
        ],
    },
]

const levelFor = (score) => {
    if (typeof score !== "number" || Number.isNaN(score)) return null
    if (score >= 6.7) return "High"
    if (score >= 3.4) return "Medium"
    return "Low"
}

const uncertaintyPosition = (score) => {
    if (typeof score !== "number" || Number.isNaN(score)) return null
    if (score >= 6.7) return "comfortable not knowing"
    if (score >= 3.4) return "somewhere in between"
    return "prefers a clear plan"
}

router.get("/getMyScores", authMiddleware, requirePaid, async (req, res) => {
    try {
        const profile = await Profile.findOne({ user: req.user._id }).select("raw_scores computed_at").lean()

        if (!profile) {
            return res.status(200).json({
                success: true,
                message: "No scores yet",
                data: null,
            })
        }

        const raw = profile.raw_scores || {}

        return res.status(200).json({
            success: true,
            message: "Scores fetched successfully",
            data: {
                computedAt: profile.computed_at,
                groups: SCORE_GROUPS.map((group) => ({
                    title: group.title,
                    factors: group.factors.map((slug) => ({
                        slug,
                        label: FACTOR_LABELS[slug] || String(slug).replace(/_/g, " "),
                        level: levelFor(raw[slug]),   // null → "not measured yet" on the page
                    })),
                })),
                uncertainty: {
                    label: FACTOR_LABELS.uncertainty_tolerance,
                    position: uncertaintyPosition(raw.uncertainty_tolerance),
                },
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
