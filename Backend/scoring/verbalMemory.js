const { round2, clamp } = require("./scoringHelpers")

// Verbal memory — MindCrowd, an external test the student uploads a screenshot of
// (04_Item_Bank.md §7.2). What arrives here is the already-extracted result object, not a picture.
//
// Score: your_score / 36 × 10.

const MAX_SCORE = 36
const MIN_EXTRACTION_CONFIDENCE = 0.8
const IMPLAUSIBLE_MARGIN = 15

const scoreVerbalMemory = (block) => {
    const flags = {}

    if (!block || typeof block.your_score !== "number") {
        return { score: null, quality: null, flags }
    }

    // outside the instrument's own range means the extraction is wrong, not that the student is
    if (block.your_score < 0 || block.your_score > MAX_SCORE) {
        flags.verbal_memory_out_of_range = true
        return { score: null, quality: null, flags }
    }

    if (typeof block.extraction_confidence === "number" && block.extraction_confidence < MIN_EXTRACTION_CONFIDENCE) {
        flags.verbal_memory_needs_verification = true
    }

    if (typeof block.peer_average === "number" && block.your_score > block.peer_average + IMPLAUSIBLE_MARGIN) {
        flags.verbal_memory_implausible = true
    }

    return {
        score: round2(clamp(block.your_score / MAX_SCORE, 0, 1) * 10),
        quality: "full",
        flags,
    }
}

module.exports = scoreVerbalMemory
