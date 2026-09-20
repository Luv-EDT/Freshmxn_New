const { round2, clamp } = require("./scoringHelpers")

// Logical reasoning — AssessmentDay, an external test the student uploads a screenshot of
// (04_Item_Bank.md §7.1). What arrives here is the already-extracted result object.
//
// Score: percentile / 100 × 10.
//
// VALIDITY GATE — the item bank's conditional table, not the flat "under 20 s is invalid" line in
// Part 6 of the frozen research. The item bank is the later and more specific spec and its
// principle is the right one: "Time alone is never the gate. Time combined with accuracy is."
// A genuinely fast high scorer is not a cheat. A fast near-chance scorer did not read the questions.
// The 20 s figure is kept as a soft review flag so the stricter reading is not silently lost.

const FAST_SECONDS = 10
const SLOW_REVIEW_SECONDS = 20
const CHANCE_SCORE = 3          // out of 10 — at or below this, fast means "did not read"
const STRONG_SCORE = 7          // at or above this, fast means genuinely quick
const MIN_EXTRACTION_CONFIDENCE = 0.8

const scoreReasoning = (block) => {
    const flags = {}

    if (!block || typeof block.percentile !== "number") {
        return { score: null, quality: null, flags }
    }

    if (block.percentile < 0 || block.percentile > 100) {
        flags.reasoning_out_of_range = true
        return { score: null, quality: null, flags }
    }

    if (typeof block.extraction_confidence === "number" && block.extraction_confidence < MIN_EXTRACTION_CONFIDENCE) {
        flags.reasoning_needs_verification = true
    }

    const seconds = block.seconds_per_question
    const raw = block.score_raw

    if (typeof seconds === "number" && seconds < FAST_SECONDS) {
        if (typeof raw === "number" && raw <= CHANCE_SCORE) {
            // fast and near chance — the session is not a measurement of reasoning
            flags.reasoning_invalid = true
            flags.admin_review = true
            return { score: null, quality: null, flags }
        }

        if (typeof raw === "number" && raw >= STRONG_SCORE) {
            flags.exceptional_speed = true
        } else {
            flags.reasoning_review = true
        }
    } else if (typeof seconds === "number" && seconds < SLOW_REVIEW_SECONDS) {
        // between the item bank's gate and the research doc's stricter line — scored, but noted
        flags.reasoning_brisk = true
    }

    return {
        score: round2(clamp(block.percentile / 100, 0, 1) * 10),
        quality: "full",
        flags,
    }
}

module.exports = scoreReasoning
