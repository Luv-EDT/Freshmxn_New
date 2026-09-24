// Hand-built inputs for the matching fixtures. The assessment UI is Day 4, so there is no live
// data — and hand-built inputs are the right way to test a matching engine anyway, because they
// let the expected answer be computed from the spec by hand instead of from the code under test.
//
// TWO WORLDS, on purpose:
//
//   syntheticWorld()  four professions with deliberately simple weights, where every match score
//                     can be worked out on paper. This is what catches an arithmetic change.
//   realWorld()       the actual 223 professions and their real ratings. This is what catches a
//                     shape change — a slug that stopped existing, a weight block that went empty.
//
// A test that only used the real data would pass while computing the wrong number, and one that
// only used the synthetic world would pass while being incompatible with the data it ships with.

const fs = require("fs")
const path = require("path")

const scoreProfile = require("../../scoring/scoreProfile")
const { buildSubmission } = require("../../scoring/fixtures/buildSubmission")

const DATA = path.join(__dirname, "..", "..", "data")

const { MATCHING_FACTORS } = scoreProfile

// ── the synthetic world ─────────────────────────────────────────────────────────────────────────

const flatFactors = (value) => {
    const factors = {}
    MATCHING_FACTORS.forEach((slug) => { factors[slug] = value })
    factors.confidence = value
    return factors
}

// Everything at weight 0 except the named few, so the arithmetic stays on paper. A factor at
// weight 0 drops out of matching entirely rather than diluting it — that is what weights are for.
const weightsOn = (named) => {
    const weights = {}
    MATCHING_FACTORS.forEach((slug) => { weights[slug] = 0 })
    weights.confidence = 0
    Object.assign(weights, named)
    return weights
}

const syntheticProfession = (id, overrides) => ({
    id,
    profession: id.replace("tst-", "").replace(/^./, (character) => character.toUpperCase()),
    professional_sector_id: 99,
    professional_sector: "Test Sector",
    one_liner: "A profession that exists only in the fixtures.",
    job_roles: ["Test Role"],
    role_spread: { spread: "narrow", deviating_roles: [] },
    degree_dependency: "undergrad",
    mid_stream_entry: "restart_undergrad",
    class12_prerequisite: "any",
    entry_window: null,
    years_to_qualify: 4,
    economics: { early_earnings_lpa: "4.0-6.0", mid_career_midpoint: 10 },
    self_employment: { likelihood: "rare" },
    after_undergrad: "work_first",
    ai_exposure: { band: "low", exposure_raw: 20 },
    ...overrides,
})

const syntheticRating = (id, factors, weights, drivingReasons) => ({
    id,
    profession: id.replace("tst-", "").replace(/^./, (character) => character.toUpperCase()),
    professional_sector_id: 99,
    professional_sector: "Test Sector",
    factors: { ...flatFactors(5), ...factors },
    weights: weightsOn(weights),
    drivingReasons,
    samples: 3,
    sample_variance: {},
    version: "2.0",
    generated_on: "2026-09-21",
    review_status: "unreviewed",
    admin_review: { required: false, priority: "none", reason: null },
})

const syntheticWorld = () => {
    const professions = [
        // Matches a high-openness, high-logic student exactly.
        syntheticProfession("tst-alpha", { mid_stream_entry: "restart_undergrad" }),
        // The same two factors, at the opposite end.
        syntheticProfession("tst-beta", { mid_stream_entry: "restart_undergrad" }),
        // Identical to alpha but gated on PCM.
        syntheticProfession("tst-gamma", { class12_prerequisite: ["physics", "maths"] }),
        // Identical to alpha but open to any graduate — the §5 waste override applies.
        syntheticProfession("tst-delta", { mid_stream_entry: "after_any_degree" }),
        // One major and one differentiating minor, both at weight 1.0 — the minors damping test.
        syntheticProfession("tst-epsilon", { mid_stream_entry: "open" }),
    ]

    const ratings = [
        syntheticRating("tst-alpha", { openness: 8, logical_intelligence: 8 }, { openness: 1, logical_intelligence: 1 }, ["curiosityDriven"]),
        syntheticRating("tst-beta", { openness: 2, logical_intelligence: 2 }, { openness: 1, logical_intelligence: 1 }, ["socialRecognition"]),
        syntheticRating("tst-gamma", { openness: 8, logical_intelligence: 8 }, { openness: 1, logical_intelligence: 1 }, ["externalProblems"]),
        syntheticRating("tst-delta", { openness: 8, logical_intelligence: 8 }, { openness: 1, logical_intelligence: 1 }, ["curiosityDriven"]),
        syntheticRating("tst-epsilon", { openness: 8, collaboration: 0 }, { openness: 1, collaboration: 1 }, ["personalGrowth"]),
    ]

    return {
        professions,
        baseline: { schema_version: "2.0", rubric: "fixtures", ratings },
    }
}

// ── the real world ──────────────────────────────────────────────────────────────────────────────

let realCache = null

const realWorld = () => {
    if (!realCache) {
        realCache = {
            professions: JSON.parse(fs.readFileSync(path.join(DATA, "ALL-professions.json"), "utf8")).professions,
            baseline: JSON.parse(fs.readFileSync(path.join(DATA, "baseline_rating.json"), "utf8")),
        }
    }
    return realCache
}

// ── students ────────────────────────────────────────────────────────────────────────────────────

// A profile is built by actually running the scoring engine, not by hand-writing raw_scores — that
// way a change to the scorer's output shape breaks these tests instead of sliding past them.
const buildProfile = (overrides) => scoreProfile(buildSubmission(overrides))

// A vector written directly, for the cases where the point is the matching arithmetic and not the
// scoring. Anything unnamed is null, which matching must drop rather than impute.
const buildVectorProfile = (named) => {
    const rawScores = {}
    MATCHING_FACTORS.forEach((slug) => { rawScores[slug] = slug in named ? named[slug] : null })

    return {
        scoring_version: "fixture@1.0.0",
        raw_scores: rawScores,
        components: {},
        completeness: { matching: null, overall: null, release: "release" },
    }
}

const buildUser = (journey, detail) => ({ journey, journeyDetail: detail || {} })

// ── the interest form ───────────────────────────────────────────────────────────────────────────

const buildInterest = ({
    persistentInterests = [],
    longTermPursuits = [],
    passion = [],
    achievementRelated = [],
    aspirationalProfessions = [],
    reasons = {},
} = {}) => ({
    highSchool: {
        personalGrowth: reasons.personalGrowth || [],
        curiosityDriven: reasons.curiosityDriven || [],
        socialRecognition: reasons.socialRecognition || [],
        effortlessEngagement: reasons.effortlessEngagement || [],
        individualInternalProblems: (reasons.individualInternalProblems || []).map((problem) => ({ problem, source: "typed", activities: [] })),
        interpersonalInternalProblems: (reasons.interpersonalInternalProblems || []).map((problem) => ({ problem, source: "typed", activities: [] })),
        externalProblems: (reasons.externalProblems || []).map((problem) => ({ problem, source: "typed", activities: [] })),
    },
    currentInterests: {
        // The interest form writes aspirations into persistentInterests itself, at Medium
        // confidence and never into longTermPursuits. These fixtures do the same rather than
        // inventing a shape the form does not produce.
        persistentInterests: [
            ...persistentInterests.map((row) => (typeof row === "string" ? { activity: row, confidence: "High", source: "activity" } : { source: "activity", ...row })),
            ...aspirationalProfessions
                .filter((row) => row.professionText)
                .map((row) => ({ activity: row.professionText.trim().toLowerCase(), confidence: "Medium", source: "aspiration" })),
        ],
        longTermPursuits,
        passion,
        achievementRelated: achievementRelated.map((row) => (typeof row === "string" ? { activity: row, achievement: "won something" } : row)),
        discontinuedPursuits: [],
    },
    aspirationalProfessions,
})

// ── resolved activities (what activityResolver.js produces at runtime) ──────────────────────────

const normalizeKey = (text) => String(text || "").trim().replace(/\s+/g, " ").toLowerCase()

const resolved = (activity, factors, candidateProfessionIds) => ({
    key: normalizeKey(activity),
    activity,
    canonicalActivity: normalizeKey(activity),
    factors,
    candidateProfessionIds,
})

module.exports = {
    syntheticWorld,
    realWorld,
    buildProfile,
    buildVectorProfile,
    buildUser,
    buildInterest,
    resolved,
    normalizeKey,
    flatFactors,
    weightsOn,
}
