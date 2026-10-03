// §5 SWITCHING COST and §8.5 HARD FILTERS — everything that depends on where the student already
// is, kept apart from the psychometric maths so the two can be read and changed independently.
//
//     score = psychometric_fit × exp(−effective_waste / τ)
//
// The exponential is a time-discounting curve borrowed from economics, not from career-guidance
// research. τ and the weights are a starting calibration to tune against real outcomes.
//
// A COMPLETED QUALIFICATION IS NEVER WASTE. Only abandoned study is. And school students have
// waste 0 for everything, so the multiplier is exactly 1.0 for the primary audience — the
// exponential only activates for switchers, which is the intent, not an oversight.
//
// GOVERNING PRINCIPLE, from §8.5: nothing is removed unless it is genuinely impossible. Everything
// else is a bounded nudge. Two things remove a profession and there is not a third.

const {
    WASTE_WEIGHTS,
    EMPLOYMENT_WASTE_CAP,
    CLASS_12_REDO_YEARS,
    TAU,
    WORKING_YEARS_BEFORE_SHORT_TAU,
} = require("./constants")

// The user record already carries this; matching reads it rather than asking the student again.
const readJourney = (user) => {
    const detail = (user && user.journeyDetail) || {}

    return {
        stage: (user && user.journey) || null,
        class: detail.class || null,
        stream: Array.isArray(detail.stream) ? detail.stream : [],
        collegeStage: detail.collegeStage || null,
        preAdmission: Boolean(detail.preAdmission) || detail.collegeStage === "pre_admission",
        courseYear: typeof detail.courseYear === "number" ? detail.courseYear : null,
        experienceYears: typeof detail.experienceYears === "number" ? detail.experienceYears : null,
        // Age lives on the user, not in journeyDetail — reading it from journeyDetail meant the
        // age limit could never fire (backend review #15). Both are accepted, user first.
        age: typeof (user && user.age) === "number" ? user.age : (typeof detail.age === "number" ? detail.age : null),
        yearsSinceClass12: typeof detail.yearsSinceClass12 === "number" ? detail.yearsSinceClass12 : null,
        degree: typeof detail.degree === "string" ? detail.degree : null,
        subject: typeof detail.subject === "string" ? detail.subject : null,
    }
}

const tauFor = (journey) => {
    if (journey.stage === "class9_10") return TAU.class9_10
    if (journey.stage === "class11_12") return TAU.class11_12
    if (journey.stage === "college") return TAU.college
    if (journey.stage === "early_professional") {
        const years = journey.experienceYears || 0
        return years >= WORKING_YEARS_BEFORE_SHORT_TAU ? TAU.working_4_plus : TAU.working_1_3
    }
    // An unknown stage discounts nothing. Guessing would penalise someone for a blank field.
    return Infinity
}

// "any" satisfies everyone. An undeclared stream satisfies everyone too — never remove a
// profession because a field is blank.
const class12Satisfied = (profession, journey) => {
    const required = profession.class12_prerequisite

    if (!Array.isArray(required)) return true
    if (journey.stage === "class9_10") return true
    if (journey.stream.length === 0) return true

    return required.every((subject) => journey.stream.includes(subject))
}

// Don't abandon — finish, then switch. If the target admits any graduate, or has no degree
// requirement at all, the degree in progress is not wasted and neither is the class 12 behind it.
// The override covers STUDY only: an employed person switching careers has already finished, so
// their employment years still count at 0.3. Both the table and the override then hold.
const studyWasteWaived = (profession) => profession.mid_stream_entry === "after_any_degree" || profession.mid_stream_entry === "open"

// THE STUDENT'S OWN DEGREE ALREADY LEADS HERE (Round 10). A B.Tech Civil student is not "abandoning"
// anything to become a Civil Engineer, though the record says civil engineering means restarting
// for everyone else. degree_families.json (owner-approved) lists which degree — family, or family
// and subject — leads to which careers; any bachelor's counts for the "any graduate" ones.
// Read once, as data: the function stays pure.
const DEGREE_FAMILIES = require("../data/degree_families.json")
const DEGREE_OPTIONS = require("../data/degree_options.json")
const BACHELOR = new Set(DEGREE_OPTIONS.families.filter((family) => family.bachelor).map((family) => family.id))

const degreeCounts = (profession, journey) => {
    if (!journey || !journey.degree || (journey.stage !== "college" && journey.stage !== "early_professional")) return false
    const keys = [journey.degree, journey.subject ? `${journey.degree}:${journey.subject}` : null].filter(Boolean)
    if (keys.some((key) => (DEGREE_FAMILIES.by_degree[key] || []).includes(profession.id))) return true
    return BACHELOR.has(journey.degree) && DEGREE_FAMILIES.any_bachelors.includes(profession.id)
}

const wasteFor = (profession, journey) => {
    const breakdown = {}
    const waived = studyWasteWaived(profession) || degreeCounts(profession, journey)

    // Class 11-12 in the wrong stream, for someone already past it. A class 11-12 student is
    // filtered out instead — see hardFilterReason.
    if (!waived && (journey.stage === "college" || journey.stage === "early_professional") && !class12Satisfied(profession, journey)) {
        breakdown.class_11_12 = CLASS_12_REDO_YEARS * WASTE_WEIGHTS.class_11_12
    }

    if (journey.stage === "college" && !waived) {
        // Nothing has been invested yet, so there is nothing to abandon.
        if (!journey.preAdmission) {
            // PER YEAR, by the year it is: years 1-2 at the early rate, each year from 3 on at the
            // late one (DECISIONS §5's table read as marginal rates). Applying the late rate to ALL
            // years made a third-year student look less invested than a second-year one — 1.5
            // against 2 (backend review #16). Now it only ever rises: 1, 2, 2.5, 3.
            const year = journey.courseYear || 0
            const early = Math.min(year, 2)
            const late = Math.max(year - 2, 0)
            breakdown.undergrad = early * WASTE_WEIGHTS.undergrad_early + late * WASTE_WEIGHTS.undergrad_late
        }
    }

    if (journey.stage === "early_professional") {
        const years = journey.experienceYears || 0
        breakdown.employment = Math.min(years * WASTE_WEIGHTS.employment, EMPLOYMENT_WASTE_CAP)
    }

    const years = Object.values(breakdown).reduce((total, value) => total + value, 0)

    return { years: Math.round(years * 100) / 100, breakdown, studyWasteWaived: waived }
}

const journeyMultiplier = (profession, journey) => {
    const waste = wasteFor(profession, journey)
    const tau = tauFor(journey)
    const multiplier = tau === Infinity || waste.years === 0 ? 1 : Math.exp(-waste.years / tau)

    return {
        multiplier: Math.round(multiplier * 10000) / 10000,
        wastedYears: waste.years,
        wasteBreakdown: waste.breakdown,
        studyWasteWaived: waste.studyWasteWaived,
        tau: tau === Infinity ? null : tau,
    }
}

// The only two reasons a profession leaves the list, and both mean "genuinely impossible", not
// "unlikely" or "expensive".
const hardFilterReason = (profession, journey) => {
    if (journey.stage === "class11_12" && !class12Satisfied(profession, journey)) {
        // KNOWN REFINEMENT: a student early in class 11 can still change stream, which would make
        // this a one-year waste rather than a removal. journeyDetail.class would support that
        // distinction; it is deliberately not used yet, because "you can still switch if you do it
        // this term" is advice the report has no way to qualify.
        return `needs class 12 ${profession.class12_prerequisite.join(" + ")}, which this stream does not cover`
    }

    const window = profession.entry_window
    if (!window || !window.is_hard_block) return null

    // A bypass named on the record is the record saying the door is not actually shut. Three
    // records store it as a sentence rather than a list; a non-empty sentence is a bypass too.
    const bypass = Array.isArray(window.bypass) ? window.bypass : (typeof window.bypass === "string" && window.bypass.trim() !== "" ? [window.bypass] : [])
    if (bypass.length > 0) return null

    if (typeof window.max_age === "number" && typeof journey.age === "number" && journey.age > window.max_age) {
        return `entry closes at age ${window.max_age}`
    }

    if (typeof window.max_years_since_class12 === "number" && typeof journey.yearsSinceClass12 === "number"
        && journey.yearsSinceClass12 > window.max_years_since_class12) {
        return `entry closes ${window.max_years_since_class12} years after class 12`
    }

    // The block exists but we cannot show it has been hit. Keep the profession.
    return null
}

module.exports = { readJourney, tauFor, wasteFor, journeyMultiplier, hardFilterReason, class12Satisfied, degreeCounts }
