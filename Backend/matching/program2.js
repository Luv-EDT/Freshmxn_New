// PROGRAM 2 — activity to profession. Every activity the student named is itself rated on the 27
// factors, then compared against each candidate profession's demands:
//
//     similarity(f) = 1 − |profession[f] − activity[f]| / 10
//     match         = Σ(weight_f · similarity_f) / Σ(weight_f)
//
// Retrieval and the rubric-scoring of activities happen OUTSIDE this file, in activityResolver.js,
// and arrive here already resolved. That is the same discipline the scoring engine keeps with
// llmScorer.js: the maths does no I/O, so it is testable, reproducible and free to run.
//
// THE THREE LISTS
//   AList  professions reached by an activity that is persistent AND long-pursued
//   BList  reached only by a persistent interest, and the profession is pursued for a reason this
//          student's answers concentrate in
//   CList  reached only by a persistent interest, with no reason in common
//
// The split is on the profession's drivingReasons, which come from the same closed set of seven as
// the interest form's own categories. When the student has no dominant reason there is nothing to
// intersect, so BetaList becomes BList whole — inventing an overlap to fill CList would be making
// up a finding.

const { weightedMatch } = require("./similarity")
const { ACTIVITY_MATCH_FLOOR } = require("./constants")

const CONFIDENCE_RANK = { High: 3, Medium: 2, Low: 1 }

const strongerConfidence = (left, right) => {
    if (!left) return right
    if (!right) return left
    return (CONFIDENCE_RANK[left] || 0) >= (CONFIDENCE_RANK[right] || 0) ? left : right
}

const blankCandidate = (professionId) => ({
    professionId,
    matchScore: 0,
    activity_match_confidence: 0,
    matchedBy: [],
    longTerm: false,
    passion: false,
    achievement: false,
    confidenceExp: null,
    fromAspiration: false,
    namedDirectly: false,
})

const runProgramTwo = ({ pList, resolvedActivities, baselineById, dominantReasons }) => {
    const rowByKey = new Map(pList.map((row) => [row.key, row]))
    const byProfession = new Map()

    // A NAMED ASPIRATION IS ITS OWN CANDIDATE. When the student has already told us which
    // profession they mean, retrieval has nothing to add — and the rubric scorer cannot help,
    // because a profession name is not an activity to rate. So the profession is seeded straight
    // in, and everything downstream treats it like any other candidate: it still has to pass the
    // hard filters, it still gets a comfort score, and it still lands in the tier its evidence
    // earns. What it does NOT do any more is disappear.
    //
    // matchScore stays null rather than 1.0. The activity and the profession are the same thing
    // here, so a similarity would be circular — and a 1.0 would outrank real activity evidence
    // inside its tier on the strength of having been typed into a box.
    pList.forEach((row) => {
        if (!row.professionId || !baselineById[row.professionId]) return

        const candidate = byProfession.get(row.professionId) || blankCandidate(row.professionId)

        candidate.matchedBy.push({ activity: row.activity, key: row.key, source: row.source, matchScore: null, longTerm: row.longTerm })
        candidate.namedDirectly = true
        candidate.longTerm = candidate.longTerm || row.longTerm
        candidate.passion = candidate.passion || row.passion
        candidate.achievement = candidate.achievement || row.achievement
        candidate.fromAspiration = candidate.fromAspiration || row.source === "aspiration"
        candidate.confidenceExp = strongerConfidence(candidate.confidenceExp, row.confidence)

        byProfession.set(row.professionId, candidate)
    })

    ;(resolvedActivities || []).forEach((resolved) => {
        const row = rowByKey.get(resolved.key)
        if (!row) return

        ;(resolved.candidateProfessionIds || []).forEach((professionId) => {
            const rating = baselineById[professionId]
            if (!rating) return

            const result = weightedMatch(rating.factors, rating.weights, resolved.factors || {})
            if (result.score === null || result.score < ACTIVITY_MATCH_FLOOR) return

            // A FLOOR, NOT A WINDOW — 0.95 lands here exactly like 0.81, and ranks above it.
            const existing = byProfession.get(professionId) || blankCandidate(professionId)

            existing.matchedBy.push({
                activity: row.activity,
                key: row.key,
                source: row.source,
                matchScore: result.score,
                longTerm: row.longTerm,
            })

            if (result.score > existing.matchScore) {
                existing.matchScore = result.score
                existing.activity_match_confidence = result.match_confidence
            }

            existing.longTerm = existing.longTerm || row.longTerm
            existing.passion = existing.passion || row.passion
            existing.achievement = existing.achievement || row.achievement
            existing.fromAspiration = existing.fromAspiration || row.source === "aspiration"
            existing.confidenceExp = strongerConfidence(existing.confidenceExp, row.confidence)

            byProfession.set(professionId, existing)
        })
    })

    const candidates = [...byProfession.values()].map((candidate) => {
        candidate.matchedBy.sort((left, right) => (right.matchScore || 0) - (left.matchScore || 0) || left.key.localeCompare(right.key))

        // A profession reached only by being named has no activity match, and null says that
        // plainly. Leaving it at 0 would read as "matched, badly".
        if (candidate.matchScore === 0 && candidate.namedDirectly) {
            candidate.matchScore = null
            candidate.activity_match_confidence = null
        }

        if (candidate.longTerm) {
            candidate.list = "A"
            candidate.reasonOverlap = []
            return candidate
        }

        const professionReasons = baselineById[candidate.professionId].drivingReasons || []
        const overlap = professionReasons.filter((reason) => (dominantReasons || []).includes(reason))

        candidate.reasonOverlap = overlap
        candidate.list = (dominantReasons || []).length === 0 || overlap.length > 0 ? "B" : "C"

        return candidate
    })

    candidates.sort((left, right) => left.professionId.localeCompare(right.professionId))

    return {
        candidates,
        counts: {
            A: candidates.filter((candidate) => candidate.list === "A").length,
            B: candidates.filter((candidate) => candidate.list === "B").length,
            C: candidates.filter((candidate) => candidate.list === "C").length,
        },
    }
}

module.exports = { runProgramTwo, strongerConfidence, CONFIDENCE_RANK }
