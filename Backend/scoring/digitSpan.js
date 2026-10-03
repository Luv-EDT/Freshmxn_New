const { round2 } = require("./scoringHelpers")

// Forward digit span — 04_Item_Bank.md §5. Two trials per length, advance on either correct,
// discontinue when both fail at the same length.
//
// Score: the longest length with at least one correct trial, 3–9 → (span − 3) / 6 × 10.

const MIN_LENGTH = 3
const MAX_LENGTH = 9
const FAST_SUBMIT_MS = 300

// A RUN THAT WAS ABANDONED IS NOT A RESULT (backend review #8). One correct trial at length 3 and
// then closing the tab used to score as a full-quality 0 — a "floor" the student never reached.
// A run counts only once it actually ended: the server stamped completedAt, or the trials
// themselves show the end — both trials failed at one length, or 9 digits were cleared. Anything
// else is "not measured", which the profile drops and renormalises rather than reading as low.
const runEnded = (block, trials) => {
    if (block && block.completedAt) return true
    if (trials.some((trial) => trial.length >= MAX_LENGTH && trial.correct === true)) return true

    const failsAt = {}
    trials.forEach((trial) => {
        if (trial.correct !== true) failsAt[trial.length] = (failsAt[trial.length] || 0) + 1
    })
    return Object.values(failsAt).some((count) => count >= 2)
}

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

    // flags are recorded above even for an unfinished run — rushing is worth knowing either way
    if (!runEnded(block, trials)) {
        flags.digit_span_unfinished = true
        return { score: null, quality: null, flags }
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
