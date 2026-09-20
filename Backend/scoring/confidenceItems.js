const { letterOf, qualityFromCoverage, round2 } = require("./scoringHelpers")

// The six situational confidence items — 04_Item_Bank.md §4. Each 0–4, mean × 2.5 → 0–10.
// Feeds `own_confidence_items` at 0.15 of the confidence composite.
//
// Keys are per-item and deliberately NOT a uniform A=4…E=0 ladder. CF3 scores B and C both 3 (one
// is emotional resilience, the other motivational redirection — neither is better) and CF4 scores
// A and B both 4. Applying a uniform descending key would silently mis-score both.

const KEYS = {
    CF1: { A: 4, B: 3, C: 2, D: 1, E: 0 },
    CF2: { A: 4, B: 3, C: 2, D: 1, E: 0 },
    CF3: { A: 4, B: 3, C: 3, D: 1, E: 0 },
    CF4: { A: 4, B: 4, C: 3, D: 1, E: 0 },
    CF5: { A: 4, B: 3, C: 2, D: 1, E: 0 },
    CF6: { A: 4, B: 3, C: 2, D: 1, E: 0 },
}

const MAX_PER_ITEM = 4

const scoreConfidenceItems = (block) => {
    const answers = (block && block.answers) || {}
    const itemIds = Object.keys(KEYS)

    const values = itemIds
        .map((id) => {
            const letter = letterOf(answers[id])
            return letter === null ? undefined : KEYS[id][letter]
        })
        .filter((value) => value !== undefined)

    const quality = qualityFromCoverage(values.length / itemIds.length)

    if (quality === null) {
        return { score: null, quality: null, flags: {} }
    }

    const mean = values.reduce((sum, value) => sum + value, 0) / values.length

    return { score: round2((mean / MAX_PER_ITEM) * 10), quality, flags: {} }
}

module.exports = scoreConfidenceItems
