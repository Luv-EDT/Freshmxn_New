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
        age: typeof detail.age === "number" ? detail.age : null,
        yearsSinceClass12: typeof detail.yearsSinceClass12 === "number" ? detail.yearsSinceClass12 : null,
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

const wasteFor = (profession, journey) => {
    const breakdown = {}
    const waived = studyWasteWaived(profession)

    // Class 11-12 in the wrong stream, for someone already past it. A class 11-12 student is
    // filtered out instead — see hardFilterReason.
    if (!waived && (journey.stage === "college" || journey.stage === "early_professional") && !class12Satisfied(profession, journey)) {
        breakdown.class_11_12 = CLASS_12_REDO_YEARS * WASTE_WEIGHTS.class_11_12
    }

    if (journey.stage === "college" && !waived) {
        // Nothing has been invested yet, so there is nothing to abandon.
        if (!journey.preAdmission) {
            const year = journey.courseYear || 0
            breakdown.undergrad = year >= 3
                ? year * WASTE_WEIGHTS.undergrad_late
                : year * WASTE_WEIGHTS.undergrad_early
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

    // A bypass named on the record is the record saying the door is not actually shut.
    if (Array.isArray(window.bypass) && window.bypass.length > 0) return null

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

module.exports = { readJourney, tauFor, wasteFor, journeyMultiplier, hardFilterReason, class12Satisfied }
