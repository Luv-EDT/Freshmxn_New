// WHAT WENT WRONG IN A FOCUS (SART) RUN, IN PLAIN WORDS (owner, Round 29). The scorer's reasons
// (scoring/sartScoring.js invalid_reasons) are written for us: "anticipatory responses 42% (limit
// 15%) - responding before reading". A student was once told "very few key presses came through"
// when the trouble was the opposite, and ran the test the same way twice. These are what they read.

const RULES = [
    { match: /anticipatory/, student: "Many of your presses came before the number had appeared — wait until you see each number, then press." },
    { match: /commission/, student: "You pressed on most of the 3s — when you see a 3, don't press." },
    { match: /omission/, student: "Many numbers went by without a press — press for every number except 3." },
    { match: /usable go-trials|real trials/, student: "Too few presses came through to measure — press for every number except 3." },
]

const sartReasonWords = (reasons = []) => {
    const words = []
    ;(reasons || []).forEach((reason) => {
        const rule = RULES.find((item) => item.match.test(String(reason)))
        if (rule && !words.includes(rule.student)) words.push(rule.student)
    })
    return words.length ? words : ["The run didn't record properly on this device — close other apps and tabs, then try again."]
}

module.exports = { sartReasonWords }

// Why a retake was given, for the student's email and notification (owner, Round 29) — from the issue
// the system or the student raised
const ISSUE_WORDS = {
    left_mid_test: "The test was left or the page was refreshed partway through, so it couldn't finish.",
    reasoning_timeouts: "Several puzzles ran out of time in a row — usually a device or connection problem, not you.",
    digit_span_unfinished: "The number test stopped before it finished.",
    word_recall_unfinished: "The word test stopped before it finished.",
    story_unmarked: "Your story answers couldn't be marked.",
    result_disputed: "You told us the result didn't look right.",
}

const retakeReasons = (issue) => {
    if (!issue) return []
    if (issue.kind === "sart_invalid") return sartReasonWords(String(issue.detail || "").split(/,|·/))
    if (issue.raisedBy === "student") return ["You told us something went wrong with this test."]
    return ISSUE_WORDS[issue.kind] ? [ISSUE_WORDS[issue.kind]] : []
}

module.exports.retakeReasons = retakeReasons
