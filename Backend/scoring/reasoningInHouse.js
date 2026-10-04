const { round2 } = require("./scoringHelpers")

// The in-house reasoning test (Round 10) — the share of the sixteen answered correctly, 0-10, plus
// the three parts the multiple-intelligence composites take:
//
//     logical   matrices + letter–number series (8 items)
//     verbal    verbal reasoning (4)
//     spatial   3D rotation (4)
//
// PROVISIONAL. Raw shares, not percentiles: there are no norms for these items yet, so the score is
// flagged `reasoning_provisional_norms` and reads as provisional wherever it is explained. The old
// external test was a percentile; the two are on different scales, and the in-house one wins when a
// student has both (scoreProfile).
//
// AN UNFINISHED RUN IS NOT MEASURED, the same rule as the digit span: an abandoned test is not a
// low score. A finished run counts every item that was shown — a skipped one is simply not correct.
const ITEM_COUNT = 16
const PARTS = { logical: ["matrix", "series"], verbal: ["verbal"], spatial: ["rotation"] }

const share = (responses) => (responses.length === 0 ? null : round2((responses.filter((response) => response.correct === true).length / responses.length) * 10))

const scoreReasoningInHouse = (block) => {
    const flags = {}
    const responses = (block && block.responses) || []

    if (responses.length === 0) return { score: null, quality: null, parts: {}, flags }

    if (!block.completedAt || responses.length < ITEM_COUNT) {
        flags.reasoning_unfinished = true
        return { score: null, quality: null, parts: {}, flags }
    }

    flags.reasoning_provisional_norms = true

    // three puzzles in a row that ran out of time (Round 13: every puzzle has a clock) usually mean
    // the device or the connection, not the student — the admin looks before the score is trusted.
    // Older runs, before the clock, were flagged for three puzzles over five minutes.
    let run = 0
    let inARow = 0
    responses.forEach((response) => {
        run = response.timedOut ? run + 1 : 0
        inARow = Math.max(inARow, run)
    })
    if (inARow >= 3 || responses.filter((response) => response.slow).length >= 3) {
        flags.reasoning_review = true
        flags.admin_review = true
    }

    const parts = {}
    Object.entries(PARTS).forEach(([part, types]) => {
        parts[part] = share(responses.filter((response) => types.includes(response.type)))
    })

    return { score: share(responses), quality: "full", parts, flags }
}

module.exports = scoreReasoningInHouse
module.exports.ITEM_COUNT = ITEM_COUNT
