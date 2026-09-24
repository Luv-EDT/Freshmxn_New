// THE 16-TIER SORT. Sixteen buckets, top-down first match, every profession placeable.
// APPROVED by the owner on 2026-09-22 in this revised form.
//
// Priority inside each block is passion → achievement → confidence. Loved it beats won at it beats
// sure about it, and self-report ranks last because it is the softest of the three signals.
//
// WHAT CHANGED from the owner's original table, and why:
//   · Achievement now discriminates INSIDE passion (1/2 vs 5/6). Before, a student who had
//     actually won something at an activity they love ranked identically to one who merely said
//     they love it. Achievement is hard evidence; passion is self-report; the evidence should tell
//     them apart.
//   · The nonComfort block gained achievement (12/13). Testing only passion there, while the
//     comfort block tested both, read as an oversight rather than a decision.
//
// A/B STAY INTERLEAVED, deliberately: a B-list profession with passion outranks an A-list one
// without. That says expressed passion outweighs activity-evidence strength, which is a real
// claim, not a formatting choice.
//
// confidence_exp IS THE STUDENT'S OWN EXPRESSED CONFIDENCE on the persistent-interest rows — High,
// Medium or Low. It is the one "confidence" here that is neither match_confidence (never an input,
// by rule) nor the Confidence factor (a universal, excluded from the matching vector). Aspirations
// enter at Medium, so an aspiration with no passion and no achievement reaches tier 9/10 and no
// higher. That is a decision, not a side-effect: a profession someone named when asked is weaker
// evidence than one they have pursued.

const { WORTH_THE_SWITCH_COUNT } = require("./constants")

const TIERS = [
    { tier: 1, list: "A", comfort: true, test: (entry) => entry.passion && entry.achievement },
    { tier: 2, list: "B", comfort: true, test: (entry) => entry.passion && entry.achievement },
    { tier: 3, list: "A", comfort: true, test: (entry) => entry.passion && entry.confidenceExp === "High" },
    { tier: 4, list: "B", comfort: true, test: (entry) => entry.passion && entry.confidenceExp === "High" },
    { tier: 5, list: "A", comfort: true, test: (entry) => entry.passion },
    { tier: 6, list: "B", comfort: true, test: (entry) => entry.passion },
    { tier: 7, list: "A", comfort: true, test: (entry) => entry.achievement },
    { tier: 8, list: "B", comfort: true, test: (entry) => entry.achievement },
    { tier: 9, list: "A", comfort: true, test: () => true },
    { tier: 10, list: "B", comfort: true, test: () => true },
    { tier: 11, list: "C", comfort: true, test: () => true },
    { tier: 12, list: "A", comfort: false, test: (entry) => entry.passion || entry.achievement },
    { tier: 13, list: "B", comfort: false, test: (entry) => entry.passion || entry.achievement },
    { tier: 14, list: "A", comfort: false, test: () => true },
    { tier: 15, list: "B", comfort: false, test: () => true },
    { tier: 16, list: "C", comfort: false, test: () => true },
]

const tierFor = (entry) => {
    const match = TIERS.find((rule) => rule.list === entry.list && rule.comfort === entry.comfort && rule.test(entry))
    return match ? match.tier : null
}

// WITHIN A TIER, order by the §5 score — fit × exp(−waste/τ) — then by the activity match, then by
// comfort, then by id.
//
// This is a change from the plan, which put matchScore first. The tier already encodes the
// activity evidence: which of A, B and C a profession is in IS Program 2's result. Leading on
// matchScore inside a tier therefore re-reads the same signal, and it leaves the switching cost
// nowhere to act, because the exponential never changes a tier. Ordering on score is the only
// arrangement where a college student in year 3 actually sees the cheap switches first. For school
// students the multiplier is 1.0 throughout, so this orders on comfort, and nothing moves.
//
// The final tie-break on id is not cosmetic: without it two equal entries can swap places between
// runs and the output stops being reproducible.
const compareWithinTier = (left, right) => (
    (right.score || 0) - (left.score || 0)
    || (right.matchScore || 0) - (left.matchScore || 0)
    || (right.comfortScore || 0) - (left.comfortScore || 0)
    || left.professionId.localeCompare(right.professionId)
)

const sortIntoTiers = (entries) => {
    const placed = entries.map((entry) => ({ ...entry, tier: tierFor(entry) }))

    placed.sort((left, right) => (left.tier - right.tier) || compareWithinTier(left, right))

    return placed.map((entry, index) => ({ ...entry, rankedPosition: index + 1 }))
}

// THE GUARD AGAINST CONSERVATISM (§5). fit × cost makes the engine structurally timid: it will
// never tell anyone to make the hard change, even when that is the true answer. So a second list
// is always produced, ranked on RAW FIT with the cost shown but not applied — and drawn from every
// profession, including ones no activity reached, because the whole point is to surface what the
// cost-weighting hides.
const worthTheSwitch = (universe, rankedIds) => (
    [...universe]
        .filter((entry) => entry.comfortScore !== null)
        .sort((left, right) => right.comfortScore - left.comfortScore || left.professionId.localeCompare(right.professionId))
        .slice(0, WORTH_THE_SWITCH_COUNT)
        .map((entry) => ({
            professionId: entry.professionId,
            profession: entry.profession,
            comfortScore: entry.comfortScore,
            wastedYears: entry.wastedYears,
            yearsToQualify: entry.display.yearsToQualify,
            alreadyRanked: rankedIds.has(entry.professionId),
            supportingFactors: entry.supportingFactors,
        }))
)

// ai_exposure IS A USER-CONTROLLED SORT, NEVER A MATCHING INPUT. It reorders and never removes —
// the fixtures assert that the set before and after is identical. Two documents make it a capped
// score multiplier instead; the owner has twice said sort-only, and the dedicated section in the
// Master Plan agrees, so sort-only it is.
const SORTS = {
    default: null,
    ai_exposure: (left, right) => {
        const leftRaw = left.display.aiExposure ? left.display.aiExposure.raw : 101
        const rightRaw = right.display.aiExposure ? right.display.aiExposure.raw : 101
        return leftRaw - rightRaw || left.rankedPosition - right.rankedPosition
    },
    years_to_qualify: (left, right) => (
        (left.display.yearsToQualify === null ? 99 : left.display.yearsToQualify)
        - (right.display.yearsToQualify === null ? 99 : right.display.yearsToQualify)
        || left.rankedPosition - right.rankedPosition
    ),
}

const applySort = (ranked, sortKey) => {
    const comparator = SORTS[sortKey]
    if (!comparator) return ranked
    return [...ranked].sort(comparator)
}

module.exports = { TIERS, tierFor, sortIntoTiers, worthTheSwitch, applySort, compareWithinTier, SORTS }
