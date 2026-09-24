// The report's filter bar — AI exposure, demand and pay, over the already-ranked list.
//
// ⚠ FILTERS DIM. THEY DO NOT DELETE. Everything below computes a "matches / does not match" flag
// per row; the page fades and collapses the ones that do not match and never removes them. Three
// separate reasons, and any one of them would be enough:
//
//   1. A DELETED ROW CANNOT BE RECONSIDERED. Dimming tells the student what their filter excluded
//      and lets them change their mind; removal tells them nothing and looks like the career was
//      never there. (This once had a second reason — the prose named the top eight by name — which
//      no longer applies: the prompt now forbids naming professions, and that is also why nothing
//      on the page is pinned against fading any more.)
//
//   2. THE SELECTIVITY IS BRUTAL AND CLUSTERED. Across the taxonomy `high` AI exposure is 13 of
//      223 and `declining` demand is 2. A ranked list is activity-linked and sector-clustered, so
//      a student's rows tend to share AI and demand values — the realistic outcome of a filter is
//      "everything or nothing", rarely something in between.
//
//   3. DECISIONS.md's 17th correction settles the direction: "a gate that is too loose shows a
//      student something they must then check, while a gate that is too tight shows them nothing
//      at all and they never learn it was open."
//
// The student still gets what they asked for — set a filter and the list visibly changes — without
// anything being taken away from them.

export const AI_BANDS = [
    { value: "low", label: "Low AI exposure" },
    { value: "medium", label: "Medium" },
    { value: "high", label: "High" },
]

export const DEMAND_LEVELS = [
    { value: "high", label: "High demand" },
    { value: "moderate", label: "Moderate" },
    { value: "low", label: "Low" },
]

export const PAY_BASIS = [
    { value: "early", label: "Starting pay" },
    { value: "mid", label: "Mid-career pay" },
]

// Bands in lakh per annum. Deliberately coarse — the underlying numbers do not support finer.
export const PAY_BANDS = [
    { value: "under6", label: "Under ₹6L", min: 0, max: 6 },
    { value: "6to10", label: "₹6–10L", min: 6, max: 10 },
    { value: "10to20", label: "₹10–20L", min: 10, max: 20 },
    { value: "over20", label: "₹20L+", min: 20, max: Infinity },
]

// ⚠ NINE PROFESSIONS ARE EXEMPT FROM EVERY PAY FILTER, and this is the record's own instruction
// rather than a kindness.
//
// `distribution` is `power_law` or `bimodal` for nine professions, and DECISIONS.md §8.4 says of
// them: a midpoint "describes almost nobody", and "deleting a profession on the strength of a
// midpoint that describes nobody is worse than showing it."
//
// The nine are Doctor and School Teacher (bimodal), and Entrepreneur, Digital Content Creator,
// Actor, Model, Professional Athlete, Esports Professional and Coaching Faculty (power law). That
// is close to a list of what a fifteen-year-old most wants to be. A naive "₹20L+" filter would fade
// out Actor, Athlete and Content Creator on a number their own record calls meaningless, and
// "under ₹6L" would fade out Doctor.
//
// 155 of 223 earnings blocks are judgment rather than verified, and 106 professions carry a written
// caveat about their own money. Those caveats travel with the profession — so the profession has to
// stay on screen for the caveat to be read.
const payExempt = (distribution) => distribution === "power_law" || distribution === "bimodal"

// "3-10" → 3, "3.0-6.5" → 3.0. A bare "12" → 12. Verified to parse across all 223 with no
// exceptions, but a NaN falls through as null and never as zero — a profession whose pay cannot be
// read must not sink to the bottom of a pay band as if it paid nothing.
export const parseLpa = (value) => {
    if (typeof value === "number") return Number.isFinite(value) ? value : null
    if (typeof value !== "string") return null

    const first = value.split("-")[0].trim()
    const parsed = Number.parseFloat(first)

    return Number.isFinite(parsed) ? parsed : null
}

export const EMPTY_FILTERS = { ai: [], demand: [], payBasis: "early", payBands: [] }

// ⚠ EVERY ATTRIBUTE IS READ FROM THE RANKING **OR** FROM THE FETCHED PROFESSION, and that fallback
// is not belt-and-braces — without it the demand filter is dead for everybody.
//
// `ranked_professions` is written once, at generation time, and stored. `display.demand` was only
// added to the engine today, so EVERY REPORT GENERATED BEFORE TODAY has no demand on any row: all
// three demand buttons render disabled at (0) and a student concludes the control is broken. That
// is exactly what happened.
//
// The report already fetches the full taxonomy record for every ranked profession to fill the
// expanded cards, and that record always has demand, AI and earnings. So the filters read the
// stored value when it is there and the live one when it is not — which also means a taxonomy
// correction reaches the filters without regenerating anybody's recommendations.
const attributes = (entry, detail) => {
    const display = entry.display || {}

    return {
        aiBand: (display.aiExposure && display.aiExposure.band)
            || (detail && detail.aiExposure && detail.aiExposure.band)
            || null,
        aiRaw: (display.aiExposure && typeof display.aiExposure.raw === "number" ? display.aiExposure.raw : null)
            ?? (detail && detail.aiExposure ? detail.aiExposure.raw : null),
        demand: display.demand || (detail && detail.demand ? detail.demand.india : null) || null,
        years: typeof display.yearsToQualify === "number"
            ? display.yearsToQualify
            : (detail ? detail.yearsToQualify : null),
        early: (display.economics && display.economics.earlyEarningsLpa)
            || (detail && detail.economics ? detail.economics.earlyEarningsLpa : null),
        midpoint: (display.economics && typeof display.economics.midCareerMidpoint === "number"
            ? display.economics.midCareerMidpoint
            : null)
            ?? (detail && detail.economics ? detail.economics.midCareerMidpoint : null),
        distribution: (display.economics && display.economics.distribution)
            || (detail && detail.economics ? detail.economics.distribution : null)
            || null,
    }
}

export const attributesOf = attributes

// Does this row satisfy the active filters? Returns the reasons it does not, so the row can say
// which control faded it rather than just going grey.
export const missedBy = (entry, filters, detail) => {
    const missed = []
    const facts = attributes(entry, detail)

    if (filters.ai.length > 0) {
        if (!facts.aiBand || !filters.ai.includes(facts.aiBand)) missed.push("AI exposure")
    }

    if (filters.demand.length > 0) {
        if (!facts.demand || !filters.demand.includes(facts.demand)) missed.push("demand")
    }

    // The nine exempt professions are never marked on pay — see payExempt above for why.
    if (filters.payBands.length > 0 && !payExempt(facts.distribution)) {
        const pay = filters.payBasis === "mid" ? facts.midpoint : parseLpa(facts.early)
        const inBand = pay !== null && pay !== undefined && PAY_BANDS
            .filter((band) => filters.payBands.includes(band.value))
            .some((band) => pay >= band.min && pay < band.max)

        if (!inBand) missed.push("pay")
    }

    return missed
}

// How many rows each option would still match, given everything else currently set. Printed on the
// control so a student can see that "High AI exposure (0)" is empty BEFORE pressing it — which is
// what stops a filter bar from ever producing a blank screen.
export const optionCounts = (ranked, filters, details = {}) => {
    const count = (override) => ranked.filter(
        (entry) => missedBy(entry, { ...filters, ...override }, details[entry.professionId]).length === 0
    ).length

    return {
        ai: Object.fromEntries(AI_BANDS.map((band) => [band.value, count({ ai: [band.value] })])),
        demand: Object.fromEntries(DEMAND_LEVELS.map((level) => [level.value, count({ demand: [level.value] })])),
        pay: Object.fromEntries(PAY_BANDS.map((band) => [band.value, count({ payBands: [band.value] })])),
    }
}

// Whether a control has ANY data behind it on this list. A group with nothing is hidden entirely
// rather than rendered as three dead buttons — which is how the demand filter looked before the
// fallback above existed, and it reads as a broken product rather than a missing attribute.
export const hasData = (ranked, details, key) => ranked.some((entry) => {
    const facts = attributes(entry, details[entry.professionId])
    if (key === "ai") return Boolean(facts.aiBand)
    if (key === "demand") return Boolean(facts.demand)
    if (key === "pay") return facts.midpoint !== null && facts.midpoint !== undefined
    return false
})

// ── sorting ─────────────────────────────────────────────────────────────────────────────────────
//
// TWO OF THESE MIRROR THE ENGINE AND TWO DO NOT, and the line matters.
//
// `ai_exposure` and `years_to_qualify` exist in Backend/matching/tiers.js as SORTS, approved and
// fixture-covered. They are reproduced here rather than round-tripped because the list is already
// in memory, and a pipeline fixture drives both implementations over the same input so they cannot
// drift.
//
// `pay` and `demand` have no engine equivalent. Sorting by pay is what DECISIONS.md §8.5 actually
// sanctions — it classifies earnings as "display + user sort", in contrast to years_to_qualify and
// degree_dependency which it classifies as "user filter". So the sort is the blessed form of the
// control, and the pay FILTER is the one that had to be softened to a dim.
//
// NO SORT EVER REMOVES ANYTHING. Every one of them is a permutation of the same list.
export const SORTS = [
    { value: "best", label: "Best match" },
    { value: "ai", label: "Least AI-exposed" },
    { value: "fastest", label: "Quickest to qualify" },
    { value: "pay", label: "Highest mid-career pay" },
    { value: "demand", label: "Most in demand" },
]

const DEMAND_ORDER = { high: 0, moderate: 1, low: 2, declining: 3 }

// THE TIEBREAK MUST NEVER BE NaN. `worth_the_switch` entries carry seven keys and `rankedPosition`
// is not one of them, so `left.rankedPosition - right.rankedPosition` evaluates to NaN for that
// whole list.
//
// MEASURED, NOT ASSUMED, because the obvious claim here is wrong: this is not currently producing a
// visibly wrong order. V8 coerces a NaN comparator result to 0 and its sort is stable, so ties keep
// arrival order — which is exactly what the fallback below produces. On today's two lists the two
// versions are indistinguishable.
//
// It is fixed anyway for two reasons. The spec calls a NaN comparator implementation-defined, so
// the current behaviour is luck rather than guarantee; and the moment any list mixes entries that
// have a `rankedPosition` with entries that do not, the two genuinely diverge — verified, and
// that is the case the fixture pins.
const positionOf = (entry, index) => (typeof entry.rankedPosition === "number" ? entry.rankedPosition : index + 1)

export const sortRanked = (ranked, sort, details = {}) => {
    if (!sort || sort === "best") return ranked

    const facts = (entry) => attributes(entry, details[entry.professionId])

    // Decorated with the arrival position first, so the tiebreak is stable whichever list this is.
    const decorated = ranked.map((entry, index) => ({ entry, position: positionOf(entry, index) }))

    // Every comparator falls back to that position, so ties keep the order the engine produced and
    // a missing attribute sinks rather than jumping to the top.
    const by = {
        ai: (left, right) => (facts(left.entry).aiRaw ?? 101) - (facts(right.entry).aiRaw ?? 101) || left.position - right.position,
        fastest: (left, right) => (facts(left.entry).years ?? 99) - (facts(right.entry).years ?? 99) || left.position - right.position,
        pay: (left, right) => (facts(right.entry).midpoint ?? -1) - (facts(left.entry).midpoint ?? -1) || left.position - right.position,
        demand: (left, right) => (
            (DEMAND_ORDER[facts(left.entry).demand] ?? 9) - (DEMAND_ORDER[facts(right.entry).demand] ?? 9)
            || left.position - right.position
        ),
    }

    if (!by[sort]) return ranked

    return [...decorated].sort(by[sort]).map((row) => row.entry)
}

// Kept as its own export because a pipeline fixture drives it against the engine's comparator.
export const sortByAiExposure = (ranked) => sortRanked(ranked, "ai")
