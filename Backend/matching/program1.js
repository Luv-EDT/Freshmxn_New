// PROGRAM 1 — read the student. No matching happens here; this only turns a filled-in interest
// form and a scored profile into the four things Programs 2 and 3 consume:
//
//   lpList          activities that are BOTH persistent AND long-pursued — the strongest evidence
//   pList           every persistent interest, aspirations included
//   dominantReasons which of the seven driving reasons this student's answers concentrate in
//   studentVector   the 27 matching factors, read from the profile and never recomputed
//
// ASPIRATIONS ARE ALREADY IN pList. The interest form writes each one into persistentInterests as
// { source: "aspiration", confidence: "Medium" } and deliberately does NOT add it to
// longTermPursuits — a profession someone names when asked is a real signal and a weaker one than
// a thing they have actually kept doing for years. So an aspiration counts in matching at Medium,
// seeds its own Program-2 candidates, and can never reach the LP list. Nothing here special-cases
// them; the shape does the work.

const scoreProfile = require("../scoring/scoreProfile")
const { DOMINANT_REASON_SHARE, MAX_DOMINANT_REASONS } = require("./constants")

const { MATCHING_FACTORS } = scoreProfile

const LIFE_STAGES = ["preHighSchool", "highSchool", "college", "postCollege"]

// The four activity groups and the three problem groups of the interest form are the same seven
// categories as baseline_rating.json's drivingReasons vocabulary. That is not a coincidence to be
// re-derived later — it is the join Program 2 splits BetaList on.
const ACTIVITY_REASONS = ["personalGrowth", "curiosityDriven", "socialRecognition", "effortlessEngagement"]
const PROBLEM_REASONS = ["individualInternalProblems", "interpersonalInternalProblems", "externalProblems"]

const normalizeActivity = (text) => String(text || "").trim().replace(/\s+/g, " ").toLowerCase()

const nonEmpty = (list) => (Array.isArray(list) ? list : []).filter((item) => String(item || "").trim() !== "")

// How many things the student attached to each of the seven reasons, across every life stage they
// answered. An activity group is a list of activity strings; a problem group is a list of rows,
// and a row counts once whether or not the student listed activities under it.
const countReasons = (interest) => {
    const counts = {}

    ;[...ACTIVITY_REASONS, ...PROBLEM_REASONS].forEach((reason) => { counts[reason] = 0 })

    LIFE_STAGES.forEach((stageName) => {
        const stage = interest[stageName]
        if (!stage || stage.skipped) return

        ACTIVITY_REASONS.forEach((reason) => {
            counts[reason] += nonEmpty(stage[reason]).length
        })

        PROBLEM_REASONS.forEach((reason) => {
            const rows = Array.isArray(stage[reason]) ? stage[reason] : []
            counts[reason] += rows.filter((row) => row && String(row.problem || "").trim() !== "").length
        })
    })

    return counts
}

// AN EMPTY RESULT IS VALID and means what it says: this student gave us nothing concentrated
// enough to call a motivation. Program 2 handles that by putting the whole BetaList into BList
// rather than inventing an overlap.
const findDominantReasons = (counts) => {
    const total = Object.values(counts).reduce((sum, count) => sum + count, 0)
    if (total === 0) return []

    return Object.entries(counts)
        .filter(([, count]) => count / total >= DOMINANT_REASON_SHARE)
        .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
        .slice(0, MAX_DOMINANT_REASONS)
        .map(([reason]) => reason)
}

// Part 7: a student flagged for inconsistent responding has their uncertainty-tolerance score
// pulled toward the mean before it is matched on. Both numbers are stored — raw for the record,
// adjusted for matching — and this is the one place that has to remember which is which.
const buildStudentVector = (profile) => {
    const vector = {}

    MATCHING_FACTORS.forEach((slug) => {
        const raw = profile.raw_scores ? profile.raw_scores[slug] : null
        vector[slug] = typeof raw === "number" ? raw : null
    })

    const adjusted = profile.components && profile.components.uncertainty_tolerance_matching
    if (typeof adjusted === "number") vector.uncertainty_tolerance = adjusted

    return vector
}

const runProgramOne = ({ interest, profile }) => {
    const currentInterests = (interest && interest.currentInterests) || {}

    const longTermKeys = new Set(nonEmpty(currentInterests.longTermPursuits).map(normalizeActivity))
    const passionKeys = new Set(nonEmpty(currentInterests.passion).map(normalizeActivity))

    const achievementKeys = new Set(
        (currentInterests.achievementRelated || [])
            .filter((row) => row && String(row.activity || "").trim() !== "")
            .map((row) => normalizeActivity(row.activity))
    )

    // An aspiration that already names one of our professions carries its id here. Program 2 then
    // seeds that profession directly instead of trying to retrieve it from the text.
    //
    // WITHOUT THIS, A NAMED ASPIRATION SILENTLY VANISHES. Program 2 reaches professions by rating
    // the student's ACTIVITY on the 27 factors, and "doctor" is not an activity — the rubric
    // scorer correctly refuses to rate a profession name, returns nothing, and the profession the
    // student explicitly asked about never becomes a candidate at all. Caught by running a real
    // student end to end; nothing short of that would have shown it.
    const aspirationIdByKey = new Map(
        ((interest && interest.aspirationalProfessions) || [])
            .filter((row) => row && row.professionId && String(row.professionText || "").trim() !== "")
            .map((row) => [normalizeActivity(row.professionText), row.professionId])
    )

    const pList = (currentInterests.persistentInterests || [])
        .filter((row) => row && String(row.activity || "").trim() !== "")
        .map((row) => {
            const key = normalizeActivity(row.activity)
            return {
                activity: String(row.activity).trim(),
                key,
                confidence: row.confidence || null,
                source: row.source || "activity",
                professionId: aspirationIdByKey.get(key) || null,
                longTerm: longTermKeys.has(key),
                passion: passionKeys.has(key),
                achievement: achievementKeys.has(key),
            }
        })

    // Two rows for the same activity — a student who typed it in two places — would double its
    // vote in Program 2. Keep the first and fold the evidence flags together.
    const byKey = new Map()
    pList.forEach((row) => {
        const existing = byKey.get(row.key)
        if (!existing) {
            byKey.set(row.key, row)
            return
        }
        existing.longTerm = existing.longTerm || row.longTerm
        existing.passion = existing.passion || row.passion
        existing.achievement = existing.achievement || row.achievement
        existing.professionId = existing.professionId || row.professionId
        if (existing.source === "aspiration" && row.source === "activity") existing.source = "activity"
    })

    const deduped = [...byKey.values()]

    const reasonCounts = countReasons(interest || {})

    return {
        pList: deduped,
        lpList: deduped.filter((row) => row.longTerm),
        dominantReasons: findDominantReasons(reasonCounts),
        reasonCounts,
        studentVector: buildStudentVector(profile),
        aspirations: (interest && interest.aspirationalProfessions) || [],
    }
}

module.exports = { runProgramOne, normalizeActivity, ACTIVITY_REASONS, PROBLEM_REASONS }
