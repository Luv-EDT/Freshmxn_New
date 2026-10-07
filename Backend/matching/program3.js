// PROGRAM 3 — the student against the profession. Program 2 asked whether the WORK resembles what
// this person already does; this asks whether the PERSON resembles what the work demands. Same
// arithmetic, same weights, different subject.
//
// Then §5's switching cost is applied and the two hard filters are run, and every entry carries
// the numbers the report needs to explain itself.

const { weightedMatch } = require("./similarity")
const { journeyMultiplier, hardFilterReason, degreeCounts } = require("./journey")
const {
    COMFORT_THRESHOLD,
    EXPLAIN_FACTOR_COUNT,
    EXPLAIN_MIN_WEIGHT,
    SUPPORTING_SIMILARITY,
    DIVERGING_SIMILARITY,
    ROLE_SHIFT,
} = require("./constants")

const round4 = (value) => Math.round(value * 10000) / 10000

// Why this profession sits where it sits, in the engine's own terms. The report turns these into
// sentences; it never invents a reason the maths did not produce.
const explainFactors = (perFactor) => {
    const entries = Object.entries(perFactor).filter(([, detail]) => detail.weight >= EXPLAIN_MIN_WEIGHT)

    const supporting = entries
        .filter(([, detail]) => detail.similarity >= SUPPORTING_SIMILARITY)
        .sort((left, right) => right[1].weight * right[1].similarity - left[1].weight * left[1].similarity || left[0].localeCompare(right[0]))
        .slice(0, EXPLAIN_FACTOR_COUNT)
        .map(([slug, detail]) => ({ factor: slug, demand: detail.demand, held: detail.held, similarity: detail.similarity }))

    const diverging = entries
        .filter(([, detail]) => detail.similarity <= DIVERGING_SIMILARITY)
        .sort((left, right) => right[1].weight * (1 - right[1].similarity) - left[1].weight * (1 - left[1].similarity) || left[0].localeCompare(right[0]))
        .slice(0, EXPLAIN_FACTOR_COUNT)
        .map(([slug, detail]) => ({ factor: slug, demand: detail.demand, held: detail.held, similarity: detail.similarity }))

    return { supporting, diverging }
}

// Everything the report displays beside a result. years_to_qualify is here because §5 is explicit
// about it: sunk cost cannot tell a 3-year path from a 9-year one, so the runway is always shown
// next to the ranking rather than folded into it.
const displayFields = (profession) => ({
    yearsToQualify: profession.years_to_qualify,
    degreeDependency: profession.degree_dependency,
    class12Prerequisite: profession.class12_prerequisite,
    afterUndergrad: profession.after_undergrad,
    selfEmployment: profession.self_employment ? profession.self_employment.likelihood : null,
    economics: profession.economics
        ? { earlyEarningsLpa: profession.economics.early_earnings_lpa, midCareerMidpoint: profession.economics.mid_career_midpoint }
        : null,
    aiExposure: profession.ai_exposure
        ? { band: profession.ai_exposure.band, raw: profession.ai_exposure.exposure_raw }
        : null,
    // Carried so the report's filter bar can work on the ranked list alone. Without it a student
    // toggling "high demand" would have to fetch all 223 records before a single row could dim.
    // Display only — nothing in this engine reads it, and demand is not a matching input.
    demand: profession.demand_signal ? profession.demand_signal.india_demand : null,
    entryWindowBypass: profession.entry_window ? profession.entry_window.bypass || [] : [],
})

// THE ROLES IN A CAREER THAT SUIT THIS STUDENT BEST (owner, Round 10: "I hope we are using role
// spread for matching a job role"). Until now role_spread was only displayed. Each role group is
// scored like the career itself, with its `higher` factors raised and `lower` ones lowered by
// ROLE_SHIFT; the career's fit is the better of the whole and its best group — the career really
// does contain that role — so a fit can only rise. `bestRoles` says which roles did it.
const clamp10 = (value) => Math.min(Math.max(value, 0), 10)

const bestRoleGroup = (profession, rating, studentVector, base) => {
    const groups = (profession.role_spread && Array.isArray(profession.role_spread.deviating_roles)) ? profession.role_spread.deviating_roles : []
    let best = null

    groups.forEach((group) => {
        if (!Array.isArray(group.roles) || group.roles.length === 0) return
        const factors = { ...rating.factors }
        ;(group.higher || []).forEach((slug) => { if (typeof factors[slug] === "number") factors[slug] = clamp10(factors[slug] + ROLE_SHIFT) })
        ;(group.lower || []).forEach((slug) => { if (typeof factors[slug] === "number") factors[slug] = clamp10(factors[slug] - ROLE_SHIFT) })

        const fit = weightedMatch(factors, rating.weights, studentVector, { oneSided: true })
        if (fit.score === null) return
        if (!best || fit.score > best.fit.score) best = { fit, group }
    })

    if (!best || base.score === null || best.fit.score <= base.score) return null
    return best
}

const scoreOne = ({ profession, rating, studentVector, journey, candidate }) => {
    const whole = weightedMatch(rating.factors, rating.weights, studentVector, { oneSided: true })
    const role = bestRoleGroup(profession, rating, studentVector, whole)
    const comfort = role ? role.fit : whole
    const cost = journeyMultiplier(profession, journey)

    // fit × exp(−effective_waste / τ). fit is the comfort match — the person against the work.
    const score = comfort.score === null ? null : round4(comfort.score * cost.multiplier)
    const explanation = explainFactors(comfort.perFactor)

    return {
        professionId: profession.id,
        profession: profession.profession,
        professional_sector_id: profession.professional_sector_id,
        professional_sector: profession.professional_sector,

        list: candidate ? candidate.list : null,
        activityLinked: Boolean(candidate),
        matchScore: candidate ? candidate.matchScore : null,
        // True when the student named this profession outright rather than reaching it through an
        // activity. The report needs the distinction: "you asked about this" is a different
        // sentence from "your activities pointed here".
        namedDirectly: candidate ? Boolean(candidate.namedDirectly) : false,
        matchedBy: candidate ? candidate.matchedBy : [],
        reasonOverlap: candidate ? candidate.reasonOverlap : [],
        drivingReasons: rating.drivingReasons || [],

        passion: candidate ? candidate.passion : false,
        achievement: candidate ? candidate.achievement : false,
        confidenceExp: candidate ? candidate.confidenceExp : null,
        fromAspiration: candidate ? candidate.fromAspiration : false,

        comfortScore: comfort.score,
        comfort: comfort.score !== null && comfort.score >= COMFORT_THRESHOLD,
        // the role group that fits better than the career as a whole, when one does
        bestRoles: role ? { roles: role.group.roles, why: role.group.why || null, wholeCareerFit: whole.score } : null,
        // the student's degree already leads here (degree_families.json) — no restart, and the
        // card says so
        degreeCounts: degreeCounts(profession, journey),

        // Stored, never displayed, never an input. See similarity.js.
        match_confidence: comfort.match_confidence,
        activity_match_confidence: candidate ? candidate.activity_match_confidence : null,

        score,
        journeyMultiplier: cost.multiplier,
        wastedYears: cost.wastedYears,
        wasteBreakdown: cost.wasteBreakdown,
        tau: cost.tau,

        supportingFactors: explanation.supporting,
        divergingFactors: explanation.diverging,

        display: displayFields(profession),

        baselineReviewStatus: rating.review_status,
        baselineNeedsReview: Boolean(rating.admin_review && rating.admin_review.required),
    }
}

const runProgramThree = ({ candidates, studentVector, professions, baselineById, journey }) => {
    const candidateById = new Map((candidates || []).map((candidate) => [candidate.professionId, candidate]))

    const ranked = []
    const universe = []
    const filtered = []

    professions.forEach((profession) => {
        const rating = baselineById[profession.id]
        if (!rating) return

        const blocked = hardFilterReason(profession, journey)
        const candidate = candidateById.get(profession.id) || null

        if (blocked) {
            // Only worth reporting for professions the student had a reason to see.
            if (candidate) filtered.push({ professionId: profession.id, profession: profession.profession, reason: blocked })
            return
        }

        const entry = scoreOne({ profession, rating, studentVector, journey, candidate })

        universe.push(entry)
        if (candidate) ranked.push(entry)
    })

    return { ranked, universe, filtered }
}

module.exports = { runProgramThree, explainFactors }
