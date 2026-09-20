const { likertOf, coverageOf, qualityFromCoverage, round2 } = require("./scoringHelpers")

// Multiple Intelligences — 35 in-house items, 5 per intelligence, SEVEN intelligences (04_Item_Bank
// §4b). Scale A–E = 1–5, no reverse-keyed items, mean of the five → (mean − 1) / 4 × 10.
//
// Seven, not nine. Part 6 of the frozen research mentions a "5+ of 9 scores at exactly 50%" gate;
// that describes the external instrument this block replaced, whose reference screenshot showed
// seven of nine at exactly 50%. The in-house block has its own straightline check below.
//
// These are SELF-REPORT. They measure affinity, not ability — the report must say "areas you feel
// drawn to", never "your spatial ability is 7/10". Real ability in this battery comes only from the
// performance tests: reasoning, memory, processing speed and sustained attention.

const INTELLIGENCES = {
    verbal_intelligence: "MI_V",
    spatial_intelligence: "MI_S",
    musical_intelligence: "MI_M",
    bodily_intelligence: "MI_B",
    naturalistic_intelligence: "MI_N",
    existential_intelligence: "MI_E",
    logical_intelligence: "MI_L",
}

const ITEMS_PER_INTELLIGENCE = 5
const STRAIGHTLINE_ITEM_COUNT = 30      // same option this many times out of 35
const FLAT_PROFILE_SPREAD = 0.5         // all seven means this close together

const itemIdsFor = (prefix) => {
    const ids = []

    for (let number = 1; number <= ITEMS_PER_INTELLIGENCE; number++) {
        ids.push(`${prefix}${number}`)
    }

    return ids
}

const scoreMi = (block) => {
    const answers = (block && block.answers) || {}
    const scores = {}
    const quality = {}
    const flags = {}
    const means = []
    const allItemIds = []

    Object.entries(INTELLIGENCES).forEach(([intelligence, prefix]) => {
        const itemIds = itemIdsFor(prefix)
        allItemIds.push(...itemIds)

        const ratio = coverageOf(answers, itemIds)
        const itemQuality = qualityFromCoverage(ratio)

        if (itemQuality === null) {
            scores[intelligence] = null
            quality[intelligence] = null
            return
        }

        const values = itemIds.map((id) => likertOf(answers[id])).filter((value) => value !== null)
        const mean = values.reduce((sum, value) => sum + value, 0) / values.length

        means.push(mean)
        scores[intelligence] = round2(((mean - 1) / 4) * 10)
        quality[intelligence] = itemQuality
    })

    // ── Straightlining: either the same option throughout, or no profile at all ──
    const answeredLetters = allItemIds
        .map((id) => likertOf(answers[id]))
        .filter((value) => value !== null)

    const counts = {}
    answeredLetters.forEach((value) => {
        counts[value] = (counts[value] || 0) + 1
    })

    const mostRepeated = Object.values(counts).reduce((highest, count) => Math.max(highest, count), 0)
    const isFlat = means.length === Object.keys(INTELLIGENCES).length
        && Math.max(...means) - Math.min(...means) < FLAT_PROFILE_SPREAD

    if (mostRepeated >= STRAIGHTLINE_ITEM_COUNT || isFlat) {
        flags.straightline_mi = true
    }

    return { scores, quality, flags }
}

module.exports = scoreMi
