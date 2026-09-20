const { letterOf, qualityFromCoverage, round2 } = require("./scoringHelpers")

// Rosenberg Self-Esteem Scale (Rosenberg, 1965) — 04_Item_Bank.md §3.
// Attribution must appear in the flow or the report footer.
//
// FOUR points, no neutral: A) Strongly agree  B) Agree  C) Disagree  D) Strongly disagree.
// "+" items score SA=3 A=2 D=1 SD=0; "−" items score the reverse.
// Item order below is the standard published order, because every reference to this scale says
// "reverse items 3, 5, 8, 9, 10" — a different order invites someone to apply the published key to
// the wrong items and silently invert half the scale.

const ITEM_COUNT = 10
const REVERSED = [3, 5, 8, 9, 10]
const MAX_PER_ITEM = 3

const POSITIVE_VALUE = { A: 3, B: 2, C: 1, D: 0 }
const REVERSED_VALUE = { A: 0, B: 1, C: 2, D: 3 }

const scoreRosenberg = (block) => {
    const answers = (block && block.answers) || {}
    const values = []

    for (let number = 1; number <= ITEM_COUNT; number++) {
        const letter = letterOf(answers[`RSE${number}`])
        const key = REVERSED.includes(number) ? REVERSED_VALUE : POSITIVE_VALUE
        const value = letter === null ? undefined : key[letter]

        // E is not on this scale — an answer outside A–D is not scored
        if (value !== undefined) {
            values.push(value)
        }
    }

    const quality = qualityFromCoverage(values.length / ITEM_COUNT)

    if (quality === null) {
        return { score: null, quality: null, flags: {} }
    }

    const mean = values.reduce((sum, value) => sum + value, 0) / values.length

    return { score: round2((mean / MAX_PER_ITEM) * 10), quality, flags: {} }
}

module.exports = scoreRosenberg
