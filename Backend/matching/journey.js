// §5 SWITCHING COST and §8.5 HARD FILTERS — everything that depends on where the student already
// is, kept apart from the psychometric maths so the two can be read and changed independently.
//
//     score = psychometric_fit × exp(−effective_waste / τ)
//
// The exponential is a time-discounting curve borrowed from economics, not from career-guidance
// research. τ and the weights are a starting calibration to tune against real outcomes.
//
// SWITCH COST = THE YEARS LOST OR REPEATED to get into this career (owner, Round 25): degree years a
// career won't count (a working professional's whole degree, a student's years so far), a Class 12
// subject added through open school, and work years in an unrelated field. Your own career costs 0.
// School students have waste 0 for everything, so the multiplier is exactly 1.0 for the primary
// audience — the exponential only activates for switchers, which is the intent, not an oversight.
//
// TIME TO GET THERE NOW is a second, separate number: the years ahead, not the years lost. It is
// shown on the card and sorts "Quickest to qualify"; it never ranks.
//
// GOVERNING PRINCIPLE, from §8.5: nothing is removed unless it is genuinely impossible. Everything
// else is a bounded nudge. Two things remove a profession and there is not a third.

const {
    WASTE_WEIGHTS,
    EMPLOYMENT_WASTE_CAP,
    OPEN_SCHOOL_SUBJECT_YEARS,
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
        // Round 25: asked as the year Class 12 was finished; an explicit count still wins (fixtures)
        yearsSinceClass12: typeof detail.yearsSinceClass12 === "number" ? detail.yearsSinceClass12
            : typeof detail.class12Year === "number" ? Math.max(0, new Date().getFullYear() - detail.class12Year) : null,
        degree: typeof detail.degree === "string" ? detail.degree : null,
        subject: typeof detail.subject === "string" ? detail.subject : null,
        currentProfessionId: typeof detail.currentProfessionId === "string" ? detail.currentProfessionId : null,
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

// a degree the student's family list names for this career — the specific test, without "any
// bachelor's": an MBA-style career takes any graduate, but it doesn't make their work experience its own
const degreeLeadsHere = (profession, journey) => {
    if (!journey || !journey.degree) return false
    const keys = [journey.degree, journey.subject ? `${journey.degree}:${journey.subject}` : null].filter(Boolean)
    return keys.some((key) => (DEGREE_FAMILIES.by_degree[key] || []).includes(profession.id))
}

// how long the student's degree is, for a working professional's switch cost (degree_options.json)
const degreeYears = (journey) => {
    const family = DEGREE_OPTIONS.families.find((entry) => entry.id === journey.degree)
    return family && typeof family.years === "number" ? family.years : 0
}

// WORK EXPERIENCE THAT CARRIES OVER (owner, Round 25): their own career, a career their degree leads
// to, or one on the reviewed "related careers" list for what they do now (related_careers.json —
// drafted from the career embeddings, then read by hand). Anything else costs 0.3 a year.
const RELATED = require("../data/related_careers.json").careers
const experienceCarriesOver = (profession, journey) => {
    if (journey.currentProfessionId === profession.id) return true
    if (degreeLeadsHere(profession, journey)) return true
    return Boolean(journey.currentProfessionId && (RELATED[journey.currentProfessionId] || []).includes(profession.id))
}

// years 1-2 at the early rate, each year from 3 on at the late one
const weightedDegreeYears = (years) => Math.min(years, 2) * WASTE_WEIGHTS.undergrad_early + Math.max(years - 2, 0) * WASTE_WEIGHTS.undergrad_late

const degreeCounts = (profession, journey) => {
    if (!journey || !journey.degree || (journey.stage !== "college" && journey.stage !== "early_professional")) return false
    const keys = [journey.degree, journey.subject ? `${journey.degree}:${journey.subject}` : null].filter(Boolean)
    if (keys.some((key) => (DEGREE_FAMILIES.by_degree[key] || []).includes(profession.id))) return true
    return BACHELOR.has(journey.degree) && DEGREE_FAMILIES.any_bachelors.includes(profession.id)
}

const wasteFor = (profession, journey) => {
    const breakdown = {}

    // your own career: nothing to lose, nothing to repeat
    if (journey.currentProfessionId && journey.currentProfessionId === profession.id) {
        return { years: 0, breakdown, studyWasteWaived: true, ownCareer: true }
    }

    const waived = studyWasteWaived(profession) || degreeCounts(profession, journey)
    const pastSchool = journey.stage === "college" || journey.stage === "early_professional"

    // A Class 12 subject they didn't take, added through open school — a step repeated. A class
    // 11-12 student is filtered out instead — see hardFilterReason.
    if (!waived && pastSchool && !class12Satisfied(profession, journey)) {
        breakdown.class_11_12 = OPEN_SCHOOL_SUBJECT_YEARS * WASTE_WEIGHTS.class_11_12
    }

    // Degree years this career won't count. PER YEAR, by the year it is: years 1-2 at the early rate,
    // each year from 3 on at the late one (backend review #16 — it only ever rises: 1, 2, 2.5, 3).
    if (journey.stage === "college" && !waived && !journey.preAdmission) {
        breakdown.undergrad = weightedDegreeYears(journey.courseYear || 0)
    }
    // Round 25 (owner): a working professional's finished degree counts too, in full, when the
    // career needs a different one — engineering → medicine repeats the undergraduate step
    if (journey.stage === "early_professional" && !waived && degreeYears(journey) > 0) {
        breakdown.undergrad = weightedDegreeYears(degreeYears(journey))
    }

    if (journey.stage === "early_professional" && !experienceCarriesOver(profession, journey)) {
        const years = journey.experienceYears || 0
        breakdown.employment = Math.min(years * WASTE_WEIGHTS.employment, EMPLOYMENT_WASTE_CAP)
    }

    const years = Object.values(breakdown).reduce((total, value) => total + value, 0)

    return { years: Math.round(years * 100) / 100, breakdown, studyWasteWaived: waived, ownCareer: false }
}

// TIME TO GET THERE FROM NOW (owner, Round 25), in years, or null when the record gives no length.
// Not a ranking input. A school student faces the whole road; past school it depends on the door.
const yearsToGetThere = (profession, journey) => {
    const full = typeof profession.years_to_qualify === "number" ? profession.years_to_qualify : null
    if (journey.currentProfessionId && journey.currentProfessionId === profession.id) return 0
    if (full === null) return null
    if (journey.stage !== "college" && journey.stage !== "early_professional") return full

    // a college student still finishing their own degree has those years ahead either way
    const ownDegreeLeft = journey.stage === "college" && !journey.preAdmission && journey.degree
        ? Math.max(0, degreeYears(journey) - (journey.courseYear || 0)) : 0
    const subject = !class12Satisfied(profession, journey) && !degreeCounts(profession, journey) ? OPEN_SCHOOL_SUBJECT_YEARS : 0
    const hasDegree = journey.stage === "early_professional" ? degreeYears(journey) > 0 : Boolean(journey.degree) && !journey.preAdmission
    let ahead

    if (degreeCounts(profession, journey)) ahead = ownDegreeLeft
    else if (profession.mid_stream_entry === "open") ahead = 0
    else if (profession.mid_stream_entry === "after_any_degree" && hasDegree) ahead = ownDegreeLeft + Math.max(1, full - 3)
    else ahead = full
    return Math.round((ahead + subject) * 10) / 10
}

// The usual entrance has closed for them (JEE: 3 years after Class 12). Not a removal — every such
// record names another way in — but the card says so.
const entryClosed = (profession, journey) => {
    const window = profession.entry_window
    if (!window || typeof window.max_years_since_class12 !== "number" || typeof journey.yearsSinceClass12 !== "number") return false
    return journey.yearsSinceClass12 > window.max_years_since_class12
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
        ownCareer: waste.ownCareer,
        yearsToGetThere: yearsToGetThere(profession, journey),
        entryClosed: entryClosed(profession, journey),
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

module.exports = { readJourney, tauFor, wasteFor, journeyMultiplier, hardFilterReason, class12Satisfied, degreeCounts, yearsToGetThere, entryClosed, experienceCarriesOver }
