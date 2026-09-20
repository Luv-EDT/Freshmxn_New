const { round2 } = require("./scoringHelpers")

// Forward digit span — 04_Item_Bank.md §5. Two trials per length, advance on either correct,
// discontinue when both fail at the same length.
//
// Score: the longest length with at least one correct trial, 3–9 → (span − 3) / 6 × 10.

const MIN_LENGTH = 3
const MAX_LENGTH = 9
const FAST_SUBMIT_MS = 300

const scoreDigitSpan = (block) => {
    const trials = (block && block.trials) || []
    const flags = {}

    if (trials.length === 0) {
        return { score: null, quality: null, flags }
    }

    const correctLengths = trials
        .filter((trial) => trial.correct === true)
        .map((trial) => trial.length)

    // ── Validity: fast AND wrong is the only speed problem ───────────────────
    // A quick correct answer is a real result; a quick wrong one is someone clicking through.
    const fastAndWrong = trials.some((trial) => trial.ms < FAST_SUBMIT_MS && trial.correct !== true)
    const fastAndCorrect = trials.some((trial) => trial.ms < FAST_SUBMIT_MS && trial.correct === true)

    if (fastAndWrong) {
        flags.digit_span_rushed = true
    }

    if (fastAndCorrect) {
        flags.exceptional_speed = true
    }

    // one digit held down through a whole answer is not an attempt, however long they took
    const repeatedDigit = trials.some((trial) => {
        const response = String(trial.response || "")
        return response.length > 1 && new Set(response.split("")).size === 1
    })

    if (repeatedDigit) {
        flags.digit_span_repeated_digit = true
    }

    if (correctLengths.length === 0) {
        // they attempted and never cleared the starting length — a real floor result, not missing data
        return { score: 0, quality: "full", flags }
    }

    const span = Math.min(Math.max(...correctLengths), MAX_LENGTH)

    return {
        score: round2(((span - MIN_LENGTH) / (MAX_LENGTH - MIN_LENGTH)) * 10),
        quality: "full",
        span,
        flags,
    }
}

module.exports = scoreDigitSpan
