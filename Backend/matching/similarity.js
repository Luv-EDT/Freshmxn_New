// The one weighted-match calculation. Program 2 uses it to compare an ACTIVITY against a
// profession and Program 3 to compare a STUDENT against one.
//
//     similarity(f) = 1 − gap_f / 10
//     match         = Σ(weight_f · similarity_f) / Σ(weight_f)
//
// THE GAP DEPENDS ON WHAT IS BEING COMPARED (owner, Round 20).
//   · A STUDENT against a profession (`oneSided: true`): having MORE of a quality than the work asks
//     is a full fit — only a shortfall counts, gap = max(0, demand − held). The exceptions are the
//     factors in TWO_SIDED_FACTORS (uncertainty tolerance and firmness): a career can rightly want
//     either end of them, so a gap either way counts, |demand − held|.
//   · An ACTIVITY against a profession (Program 2): two-sided throughout. That compares the nature
//     of two things — an intense physical activity rated high on bodily skill is not "like" a desk
//     career just because the desk career asks for less.
//
// A NULL IS AN ABSENCE, NEVER A ZERO. A factor the subject has no score for is dropped and the
// remaining weights renormalise. Substituting a middle value would invent a 5.0 the student never
// produced and then match them on it; dropping it says "we do not know", which is true. What the
// absence costs is recorded as match_confidence rather than hidden.

const scoreProfile = require("../scoring/scoreProfile")
const { MINOR_GROUP_WEIGHT, TWO_SIDED_FACTORS } = require("./constants")

const { MATCHING_FACTORS, MINOR_FACTORS, UNIVERSAL_FACTORS } = scoreProfile

// The six differentiating minors: MINOR_FACTORS without the universals, which never enter matching.
const DIFFERENTIATING_MINORS = MINOR_FACTORS.filter((slug) => !UNIVERSAL_FACTORS.includes(slug))

// A profession's stated weight, damped for the minors group. Kept here rather than baked into
// baseline_rating.json so the decision stays reversible without a re-rating run.
const effectiveWeight = (slug, professionWeights) => {
    const stated = professionWeights[slug]
    if (typeof stated !== "number" || Number.isNaN(stated)) return 0
    return DIFFERENTIATING_MINORS.includes(slug) ? stated * MINOR_GROUP_WEIGHT : stated
}

const round4 = (value) => Math.round(value * 10000) / 10000

// professionFactors / professionWeights come from baseline_rating.json; subjectVector is either an
// activity's rubric-scored factors or the student's own.
const weightedMatch = (professionFactors, professionWeights, subjectVector, { oneSided = false } = {}) => {
    let weightedSimilarity = 0
    let usedWeight = 0
    let missingWeight = 0
    const perFactor = {}

    MATCHING_FACTORS.forEach((slug) => {
        const weight = effectiveWeight(slug, professionWeights)
        if (weight === 0) return

        const demand = professionFactors[slug]
        const held = subjectVector[slug]

        if (typeof demand !== "number" || typeof held !== "number" || Number.isNaN(held)) {
            missingWeight += weight
            return
        }

        const gap = oneSided && !TWO_SIDED_FACTORS.includes(slug) ? Math.max(0, demand - held) : Math.abs(demand - held)
        const similarity = 1 - gap / 10

        perFactor[slug] = { demand, held, similarity: round4(similarity), weight: round4(weight) }
        weightedSimilarity += weight * similarity
        usedWeight += weight
    })

    const totalWeight = usedWeight + missingWeight

    return {
        // null, not 0, when nothing could be compared — no shared factor carries any weight, which
        // is a different statement from "they do not match".
        score: usedWeight === 0 ? null : round4(weightedSimilarity / usedWeight),

        // STORED, NEVER DISPLAYED, NEVER AN INPUT to the maths. How much of the profession's
        // weighted picture we could actually see. A 0.9 match on a third of the weight is not the
        // same claim as a 0.9 match on all of it, and this is where that difference lives.
        match_confidence: totalWeight === 0 ? 0 : round4(usedWeight / totalWeight),

        usedWeight: round4(usedWeight),
        missingWeight: round4(missingWeight),
        perFactor,
    }
}

module.exports = { weightedMatch, effectiveWeight, DIFFERENTIATING_MINORS }
