const { round2 } = require("./scoringHelpers")

// Delayed story recall → long-term memory (05_Story_Bank.md).
//
// Every story fills the same 12 slots: 1 year · 2–4 three people · 5–6 two professions ·
// 7–8 two numbers · 9 an unusual ability · 10–12 problem / cause / resolution.
// Slots 1–9 are asked as 7 structured questions and auto-scored here; slots 10–12 are free recall,
// scored 0–2 each by the LLM before this function is called.
//
// ── A documented interpretation ──────────────────────────────────────────────
// The source states the total three ways that do not quite agree:
//   "Total 12 points → /12 × 10"                                        (line 25, and again at 371)
//   "Structured (7 slots) + free recall (3 items x 2 = 6 points, mapped to 5 slots) = 12 total"
// Read literally, 7 structured points + 6 free-recall points is 13, not 12. The only reading in
// which EVERY stated figure holds is the one implemented here: structured contributes 7 points
// (one per question, LR9's two numbers all-or-nothing), and free recall's 0–6 is mapped onto a
// 5-point contribution — which is exactly what "6 points, mapped to 5 slots" says. 7 + 5 = 12.
// Flagged for review: if the intent was 13 points, change FREE_RECALL_SLOTS and TOTAL_POINTS.

const STRUCTURED_POINTS = 7
const FREE_RECALL_RAW_MAX = 6      // 3 items x 0–2
const FREE_RECALL_SLOTS = 5        // "mapped to 5 slots"
const TOTAL_POINTS = STRUCTURED_POINTS + FREE_RECALL_SLOTS

const RECALL_OPENS_HOURS = 24
const RECALL_CLOSES_HOURS = 72
const NAME_EDIT_DISTANCE = 2

// Levenshtein, so spelling and transliteration do not cost a student the point:
// Devraj / Menon / Devraaj all score against "Devraj Menon".
const editDistance = (left, right) => {
    const rows = left.length + 1
    const columns = right.length + 1
    const distance = Array.from({ length: rows }, () => new Array(columns).fill(0))

    for (let row = 0; row < rows; row++) distance[row][0] = row
    for (let column = 0; column < columns; column++) distance[0][column] = column

    for (let row = 1; row < rows; row++) {
        for (let column = 1; column < columns; column++) {
            const cost = left[row - 1] === right[column - 1] ? 0 : 1
            distance[row][column] = Math.min(
                distance[row - 1][column] + 1,
                distance[row][column - 1] + 1,
                distance[row - 1][column - 1] + cost
            )
        }
    }

    return distance[rows - 1][columns - 1]
}

const normalise = (text) => String(text === undefined || text === null ? "" : text).trim().toLowerCase()

// a full name matches on either part alone, within an edit distance of 2
const namesMatch = (answer, expected) => {
    const given = normalise(answer)

    if (given === "") return false

    return normalise(expected)
        .split(/\s+/)
        .concat(normalise(expected))
        .some((part) => part !== "" && editDistance(given, part) <= NAME_EDIT_DISTANCE)
}

const exactMatch = (answer, expected) => normalise(answer) !== "" && normalise(answer) === normalise(expected)

const numbersMatch = (answer, expected) => Number(answer) === Number(expected)

const scoreStoryRecall = (block, freeRecallResult) => {
    const flags = {}

    if (!block || !block.facts) {
        return { score: null, quality: null, flags }
    }

    const { facts, structured = {}, delayHours } = block

    // ── Timing gate — recall is on its own clock, not a step in the sequence ──
    if (typeof delayHours === "number") {
        if (delayHours > RECALL_CLOSES_HOURS) {
            flags.story_recall_expired = true
            flags.admin_review = true
            return { score: null, quality: null, flags }
        }

        if (delayHours < RECALL_OPENS_HOURS) {
            // scored, but the delay was shorter than the instrument assumes, so it is not comparable
            flags.story_recall_early = true
        }
    }

    // ── Part B: structured, auto-scored ──────────────────────────────────────
    let structuredPoints = 0
    let numericPoints = 0

    if (numbersMatch(structured.LR4, facts.year)) structuredPoints += 1
    if (namesMatch(structured.LR5, facts.personA)) structuredPoints += 1

    // LR6 accepts EITHER of the other two people
    if (namesMatch(structured.LR6, facts.personB) || namesMatch(structured.LR6, facts.personC)) {
        structuredPoints += 1
    }

    if (exactMatch(structured.LR7, facts.profession1)) structuredPoints += 1
    if (exactMatch(structured.LR8, facts.profession2)) structuredPoints += 1

    // LR9 is two numeric fields covering slots 7 and 8 — both or nothing
    const numbers = structured.LR9 || []
    if (numbersMatch(numbers[0], facts.number1) && numbersMatch(numbers[1], facts.number2)) {
        structuredPoints += 1
        numericPoints += 1
    }

    if (exactMatch(structured.LR10, facts.ability)) structuredPoints += 1

    // ── Part A: free recall, already scored 0–2 per fact by the LLM ──────────
    let freeRecallPoints = 0
    let freeRecallQuality = "full"

    if (freeRecallResult && freeRecallResult.score !== null && freeRecallResult.score !== undefined) {
        freeRecallPoints = (freeRecallResult.score / FREE_RECALL_RAW_MAX) * FREE_RECALL_SLOTS
    } else {
        // the LLM could not score it — the structured half still stands, marked partial
        freeRecallQuality = "partial"
        flags.llm_unscoreable = true
    }

    const total = structuredPoints + freeRecallPoints

    return {
        score: round2((total / TOTAL_POINTS) * 10),
        quality: freeRecallQuality,
        numeric_recall: round2(numericPoints * 10),
        verbal_recall: round2(((structuredPoints - numericPoints + freeRecallPoints) / (TOTAL_POINTS - 1)) * 10),
        structured_points: structuredPoints,
        free_recall_points: round2(freeRecallPoints),
        flags,
    }
}

module.exports = scoreStoryRecall
