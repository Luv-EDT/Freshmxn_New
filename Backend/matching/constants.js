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

// "FITS HOW YOU THINK AND WORK" (tiers 1-11 vs 12-16). 0.85 since Round 20 (owner). Measured on
// sample profiles: fit scores bunch between about 0.65 and 0.95, so the old 0.7 was cleared by
// nearly every career and separated nothing — and once a student's surplus stopped counting against
// them (one-sided fit, below) it was cleared by all 223. At 0.85 most sample profiles kept roughly
// 7-90 careers on the "fits" side. Still a judgement: retune it on real students' scores.
const COMFORT_THRESHOLD = 0.85

// The factors where a career can rightly want EITHER end, so being above what it asks is a mismatch
// too (owner, Round 20): uncertainty tolerance ("it's a tag") and firmness ("how open you are to
// changing a belief" — some work wants it high, some wants flexibility). Every other factor is
// one-sided for a student: having more than the work asks is a full fit.
const TWO_SIDED_FACTORS = ["uncertainty_tolerance", "firmness"]

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
// change even when that is the true answer. Since Round 20 (owner) the cost no longer reorders the
// list at all: careers stay in their tiers, ordered by fit, and the report's "Best match" moves the
// ones that would leave this many years or more behind into a last group of their own (least
// affected first). "Best fit, ignoring switching cost" leaves them in their tiers. Judgement, tunable.
const SWITCH_COST_GROUP_YEARS = 2

// ── The report's explanation of a match ─────────────────────────────────────────────────────────
const EXPLAIN_FACTOR_COUNT = 3

// A factor only counts as supporting or diverging if it carries real weight for the profession;
// below this it is noise dressed as a reason. INVENTED.
const EXPLAIN_MIN_WEIGHT = 0.3
const SUPPORTING_SIMILARITY = 0.85
const DIVERGING_SIMILARITY = 0.6

// ROLE GROUPS (Round 10). A "wide" career lists role groups that ask for more or less of a few
// factors than the career as a whole (role_spread.deviating_roles: `higher` / `lower`). A group's
// demand is the career's, moved by this much on those factors (0-10 scale, clamped) — a judgement,
// like every number here: big enough to tell an AR developer from a game developer, small enough
// that a group never becomes a different career.
const ROLE_SHIFT = 1.5

module.exports = {
    ROLE_SHIFT,
    ACTIVITY_MATCH_FLOOR,
    COMFORT_THRESHOLD,
    TWO_SIDED_FACTORS,
    MINOR_GROUP_WEIGHT,
    DOMINANT_REASON_SHARE,
    MAX_DOMINANT_REASONS,
    WASTE_WEIGHTS,
    EMPLOYMENT_WASTE_CAP,
    CLASS_12_REDO_YEARS,
    TAU,
    WORKING_YEARS_BEFORE_SHORT_TAU,
    SWITCH_COST_GROUP_YEARS,
    EXPLAIN_FACTOR_COUNT,
    EXPLAIN_MIN_WEIGHT,
    SUPPORTING_SIMILARITY,
    DIVERGING_SIMILARITY,
}
