const { round2 } = require("./scoringHelpers")

// The in-house word-memory test (Round 11, assessment/wordBank.js): words recalled across the two
// lists of fifteen, 0-10. It replaces the outside upload (verbalMemory.js) as the verbal half of
// short-term memory; the in-house result wins when a student has both (scoreProfile).
//
// PROVISIONAL, like the in-house reasoning: a raw share, flagged `word_recall_provisional_norms`
// until there are norms. AN UNFINISHED RUN IS NOT MEASURED — an abandoned test is not a low score.
// Intrusions (words typed that were never shown) are kept on the block for review and never
// subtracted: the score is what was remembered.
const LISTS = 2
const PER_LIST = 15

const scoreWordRecall = (block) => {
    const flags = {}
    const trials = (block && block.trials) || []

    if (trials.length === 0) return { score: null, quality: null, flags }

    if (!block.completedAt || trials.length < LISTS) {
        flags.word_recall_unfinished = true
        return { score: null, quality: null, flags }
    }

    flags.word_recall_provisional_norms = true

    const correct = trials.reduce((sum, trial) => sum + (Number.isInteger(trial.correct) ? trial.correct : 0), 0)

    // many words that were never shown usually means the list was copied from somewhere else, or
    // the instructions were misread — worth a human look, not a penalty
    const intrusions = trials.reduce((sum, trial) => sum + ((trial.intrusions || []).length), 0)
    if (intrusions >= 10) {
        flags.word_recall_review = true
        flags.admin_review = true
    }

    return { score: round2((correct / (LISTS * PER_LIST)) * 10), quality: "full", flags }
}

module.exports = scoreWordRecall
module.exports.LISTS = LISTS
module.exports.PER_LIST = PER_LIST
