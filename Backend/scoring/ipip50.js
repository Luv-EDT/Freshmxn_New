const { likertOf, coverageOf, qualityFromCoverage, round2 } = require("./scoringHelpers")

// IPIP-50 → the Big Five. Item set and +/- keys verified against Goldberg's official list
// (04_Item_Bank.md §2). Scale A–E = 1–5, "+" scored as answered, "−" scored 6 − response.
//
// The output of the ES block is EMOTIONAL STABILITY, already reversed: high means calm and stable.
// It is used directly everywhere in the model. There is no (10 − x) here or anywhere downstream.

const TRAITS = {
    openness: { prefix: "O", reversed: ["O2", "O4", "O6"] },
    conscientiousness: { prefix: "C", reversed: ["C2", "C4", "C6", "C8"] },
    extraversion: { prefix: "E", reversed: ["E2", "E4", "E6", "E8", "E10"] },
    agreeableness: { prefix: "A", reversed: ["A1", "A3", "A5", "A7"] },
    emotional_stability: { prefix: "ES", reversed: ["ES1", "ES3", "ES5", "ES6", "ES7", "ES8", "ES9", "ES10"] },
}

const ITEMS_PER_TRAIT = 10

// answers are keyed IPIP_E1 … IPIP_ES10 so nothing collides with the MI block's MI_E1 … MI_E5
const itemIdsFor = (prefix) => {
    const ids = []

    for (let number = 1; number <= ITEMS_PER_TRAIT; number++) {
        ids.push(`${prefix}${number}`)
    }

    return ids
}

const scoreIpip50 = (block) => {
    const answers = (block && block.answers) || {}
    const scores = {}
    const quality = {}
    const flags = {}

    Object.entries(TRAITS).forEach(([trait, { prefix, reversed }]) => {
        const itemIds = itemIdsFor(prefix)
        const prefixed = itemIds.map((id) => `IPIP_${id}`)
        const ratio = coverageOf(answers, prefixed)
        const traitQuality = qualityFromCoverage(ratio)

        if (traitQuality === null) {
            scores[trait] = null
            quality[trait] = null
            return
        }

        // mean of what was answered, so a 9-of-10 block prorates instead of scoring as if the
        // missing item were a zero. Identical to (sum − 10) / 40 × 10 when all ten are present.
        const values = itemIds
            .map((id) => ({ id, value: likertOf(answers[`IPIP_${id}`]) }))
            .filter((item) => item.value !== null)
            .map((item) => (reversed.includes(item.id) ? 6 - item.value : item.value))

        const mean = values.reduce((sum, value) => sum + value, 0) / values.length

        scores[trait] = round2(((mean - 1) / 4) * 10)
        quality[trait] = traitQuality
    })

    // ── Embedded quality checks — never scored into a factor ─────────────────
    const qc1 = likertOf(answers.IPIP_QC1)
    const qc2 = likertOf(answers.IPIP_QC2)

    // "I have never used a computer or phone" — anything but Very inaccurate is not credible
    if (qc1 !== null && qc1 !== 1) {
        flags.infrequency = true
    }

    // "Please select 'Moderately accurate' for this item"
    if (qc2 !== null && qc2 !== 4) {
        flags.attention_check = true
    }

    // E2 "Don't talk a lot" and E6 "Have little to say" should agree within 2 points
    const e2 = likertOf(answers.IPIP_E2)
    const e6 = likertOf(answers.IPIP_E6)

    if (e2 !== null && e6 !== null && Math.abs(e2 - e6) >= 3) {
        flags.careless_responding = true
    }

    return { scores, quality, flags }
}

module.exports = scoreIpip50
