// Every tunable number the matching engine uses, in one place, each with the reason it has that
// value. Scattering these through the code is how a threshold becomes folklore.
//
// WEIGHTS_PROVISIONAL. The source documents specify the SHAPE of this engine precisely and the
// numbers barely at all. Where a figure below is invented it says so. None of them is fitted to
// outcome data, because no outcome data exists yet — the first cohort produces it.
//
// The owner approved these as a starting calibration on 2026-09-22. That is a decision to ship
// them, not evidence that they are right, and the distinction matters: an approved guess and a
// fitted number look identical in the code, so the reasoning under each one stays written down.

// ── Program 2: activity → profession ────────────────────────────────────────────────────────────

// A FLOOR, NOT A WINDOW. 0.95 is a better match than 0.80 and is never discarded for being too
// good — a mistake worth naming because "80% match" reads like a band.
const ACTIVITY_MATCH_FLOOR = 0.8

// ── Program 3: student → profession ─────────────────────────────────────────────────────────────

// INVENTED. Deliberately below the 0.80 activity floor, and the two measure different things: the
// floor compares an ACTIVITY against a profession, where a close match is reasonable to demand,
// while comfort compares a PERSON against one, where nobody scores 8/10 on twenty-seven factors at
// once. An 0.80 bar here empties the comfort tiers and pushes real matches into the nonComfort
// block, which is the opposite of what the tiers are for.
const COMFORT_THRESHOLD = 0.7

// The six differentiating minors are re-mixes of majors already in the vector — Practical
// Intelligence is built from Agreeableness, Extraversion, Short-term Memory, Reasoning and
// Confidence, four of which are scored separately alongside it. At equal weight the engine counts
// the same evidence twice and professions bunch together, the failure the research doc warns about.
// Halving the group keeps their discrimination without the double count, and also damps the
// Confidence leak: Confidence is a universal excluded from matching, yet it enters through
// Practical Intelligence (0.20) and Collaboration (1/6). INVENTED, and the first thing to refit
// when outcome data exists.
const MINOR_GROUP_WEIGHT = 0.5

// ── Program 1: which motivations count as dominant ──────────────────────────────────────────────

// INVENTED. A reason is dominant if it carries at least this share of everything the student
// tagged, and at most the top three count. Too generous and every profession overlaps, so BList
// swallows CList; too strict and the reverse. Share rather than a raw count, because a thorough
// student and a terse one should not get different rules.
const DOMINANT_REASON_SHARE = 0.15
const MAX_DOMINANT_REASONS = 3

// ── §5 switching cost: score = fit × exp(−effective_waste / τ) ──────────────────────────────────
//
// A completed qualification is never waste. Only abandoned study is.

const WASTE_WEIGHTS = {
    class_11_12: 1,       // wrong stream must be redone
    undergrad_early: 1,   // years 1-2: credits do not transfer, and it is cheap to leave early
    undergrad_late: 0.5,  // year 3+: close to done, skills and maturity carry
    employment: 0.3,      // income, network and work skills transfer
}

// What stops a twenty-year veteran being penalised into oblivion.
const EMPLOYMENT_WASTE_CAP = 3

// Years of class 11-12 a post-school student would have to redo for a stream they did not take.
const CLASS_12_REDO_YEARS = 2

// τ — how much a year costs you *now*. Infinity for pre-10 makes the multiplier exactly 1.0:
// school students have waste 0 for everything, so the exponential is inert for the primary
// audience. It only activates for switchers, which is the intent.
const TAU = {
    class9_10: Infinity,
    class11_12: 20,
    college: 8,
    working_1_3: 4,
    working_4_plus: 2.5,
}

const WORKING_YEARS_BEFORE_SHORT_TAU = 4

// ── The guard against conservatism (§5) ─────────────────────────────────────────────────────────
// Fit × cost makes the engine structurally timid — it will never tell anyone to make the hard
// change even when that is the true answer. So a second list is always produced, ranked on raw fit
// with the cost shown but not applied.
const WORTH_THE_SWITCH_COUNT = 3

// ── The report's explanation of a match ─────────────────────────────────────────────────────────
const EXPLAIN_FACTOR_COUNT = 3

// A factor only counts as supporting or diverging if it carries real weight for the profession;
// below this it is noise dressed as a reason. INVENTED.
const EXPLAIN_MIN_WEIGHT = 0.3
const SUPPORTING_SIMILARITY = 0.85
const DIVERGING_SIMILARITY = 0.6

module.exports = {
    ACTIVITY_MATCH_FLOOR,
    COMFORT_THRESHOLD,
    MINOR_GROUP_WEIGHT,
    DOMINANT_REASON_SHARE,
    MAX_DOMINANT_REASONS,
    WASTE_WEIGHTS,
    EMPLOYMENT_WASTE_CAP,
    CLASS_12_REDO_YEARS,
    TAU,
    WORKING_YEARS_BEFORE_SHORT_TAU,
    WORTH_THE_SWITCH_COUNT,
    EXPLAIN_FACTOR_COUNT,
    EXPLAIN_MIN_WEIGHT,
    SUPPORTING_SIMILARITY,
    DIVERGING_SIMILARITY,
}
