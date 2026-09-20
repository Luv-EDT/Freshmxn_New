// Builds assessment submissions for the golden fixtures. Everything here is hand-constructed —
// the Day-4 assessment UI does not exist yet, so there is no live data to test against, and
// hand-built inputs are the correct way to test a scoring engine anyway: they let the expected
// output be computed from the spec by hand rather than from the code being tested.

const IPIP_PREFIXES = ["O", "C", "E", "A", "ES"]
const MI_PREFIXES = ["V", "S", "M", "B", "N", "E", "L"]

// A–E Likert, same letter throughout a block
const fillIpip = (letter) => {
    const answers = {}

    IPIP_PREFIXES.forEach((prefix) => {
        for (let number = 1; number <= 10; number++) {
            answers[`IPIP_${prefix}${number}`] = letter
        }
    })

    answers.IPIP_QC1 = "A"      // "I have never used a computer or phone" → Very inaccurate
    answers.IPIP_QC2 = "D"      // instructed choice: Moderately accurate

    return answers
}

const fillMi = (letters) => {
    const answers = {}

    MI_PREFIXES.forEach((prefix, index) => {
        const letter = Array.isArray(letters) ? letters[index] : letters

        for (let number = 1; number <= 5; number++) {
            answers[`MI_${prefix}${number}`] = letter
        }
    })

    return answers
}

const fillRosenberg = (high) => {
    const answers = {}
    const reversed = [3, 5, 8, 9, 10]

    for (let number = 1; number <= 10; number++) {
        const agrees = reversed.includes(number) ? !high : high
        answers[`RSE${number}`] = agrees ? "A" : "D"
    }

    return answers
}

const fillConfidence = (letter) => ({ CF1: letter, CF2: letter, CF3: letter, CF4: letter, CF5: letter, CF6: letter })

// The perspective block. Letters are rendered as the student sees them — "A) …" — because the
// ported scorer reads only the leading character, exactly as the real form will submit them.
const fillPerspective = (letter, overrides = {}) => {
    const answers = {}

    for (let number = 1; number <= 6; number++) answers[`P${number}`] = `${letter}) option`
    for (let number = 8; number <= 12; number++) answers[`P${number}`] = `${letter}) option`
    for (let number = 14; number <= 21; number++) answers[`P${number}`] = `${letter}) option`
    for (let number = 1; number <= 7; number++) answers[`U${number}`] = `${letter}) option`
    for (let number = 1; number <= 4; number++) answers[`PS${number}`] = `${letter}) option`

    // values: 4 fulfilment then 4 importance, 1–5 Likert
    for (let number = 23; number <= 26; number++) answers[`P${number}`] = 3
    for (let number = 27; number <= 30; number++) answers[`P${number}`] = 5

    return {
        answers: { ...answers, ...(overrides.answers || {}) },
        open: overrides.open === undefined
            ? {
                P7: { reasons: 3, evidence: 3, revisability: 3 },
                P13: { criteria: { deep_work_first: true, urgency_order: true, messages_batched: true, fixed_respected: true, recovery: true } },
                P22: { granularity: 2, complexity: 1, perspective: 1 },
                P33: { specificity: 2, causal_insight: 2, integration: 2 },
            }
            : overrides.open,
        narrative: overrides.narrative === undefined
            ? { P31: "Hard work compounds.", P32: "I lose momentum when a task has no clear next step." }
            : overrides.narrative,
    }
}

// digits 1–9 with no immediate repeats, per the instrument spec — and no single repeated digit,
// which the scorer correctly treats as someone holding a key down rather than answering
const DIGIT_POOL = "492715836"

const buildDigitSpan = (span) => {
    const trials = []

    for (let length = 3; length <= span; length++) {
        const sequence = DIGIT_POOL.slice(0, length)
        trials.push({ length, presented: sequence, response: sequence, correct: true, ms: 1500 + length * 300 })
    }

    if (span < 9) {
        const failed = span + 1
        trials.push({ length: failed, presented: DIGIT_POOL.slice(0, failed), response: DIGIT_POOL.slice(1, failed + 1), correct: false, ms: 3000 })
        trials.push({ length: failed, presented: DIGIT_POOL.slice(0, failed), response: DIGIT_POOL.slice(2, failed + 2), correct: false, ms: 3100 })
    }

    return { trials }
}

// PsyToolkit SART2 output: block · blockNumber · trialType(1=GO,0=NO-GO) · digit · fontSize ·
// correct(1/0) · RT ms (900 = no response). Only "realtest" rows are scored.
// In SART the no-go digit is 3 — the trial-type column must agree with the digit or the scorer
// rightly refuses the file as a changed export format.
const GO_DIGITS = [1, 2, 4, 5, 6, 7, 8, 9]
const NO_GO_DIGIT = 3

const buildSartRaw = ({ trials = 225, meanRt = 340, commissionRate = 0.3, anticipatoryRate = 0 } = {}) => {
    const rows = []

    // a few training rows, which the scorer drops itself
    for (let index = 0; index < 4; index++) {
        rows.push(`training\t1\t1\t${GO_DIGITS[index % GO_DIGITS.length]}\t48\t1\t${meanRt}`)
    }

    let noGoIndex = 0
    let goIndex = 0

    for (let index = 0; index < trials; index++) {
        const isNoGo = index % 9 === 8
        // deterministic spread around the mean so the RT distribution is not a single value
        const jitter = ((index % 11) - 5) * 12
        let rt = meanRt + jitter

        if (isNoGo) {
            noGoIndex += 1
            const commits = commissionRate > 0 && noGoIndex % Math.max(Math.round(1 / commissionRate), 1) === 0
            rows.push(`realtest\t1\t0\t${NO_GO_DIGIT}\t48\t${commits ? 0 : 1}\t${commits ? rt : 900}`)
        } else {
            goIndex += 1
            if (anticipatoryRate > 0 && goIndex % Math.max(Math.round(1 / anticipatoryRate), 1) === 0) {
                rt = 120
            }
            rows.push(`realtest\t1\t1\t${GO_DIGITS[goIndex % GO_DIGITS.length]}\t48\t1\t${rt}`)
        }
    }

    return rows.join("\n")
}

const STORY_FACTS = {
    year: 1984,
    personA: "Devraj Menon",
    personB: "Asha Pillai",
    personC: "Ravi Nair",
    profession1: "engineer",
    profession2: "ornithologist",
    number1: 1200,
    number2: 7,
    ability: "perfect pitch",
}

const buildStoryRecall = (overrides = {}) => ({
    storyId: "s3",
    delayHours: overrides.delayHours === undefined ? 30 : overrides.delayHours,
    facts: STORY_FACTS,
    structured: overrides.structured === undefined
        ? { LR4: 1984, LR5: "Devraj", LR6: "Pillai", LR7: "engineer", LR8: "ornithologist", LR9: [1200, 7], LR10: "perfect pitch" }
        : overrides.structured,
    free: overrides.free === undefined
        ? { score: 6, subScores: { problem: 2, cause: 2, resolution: 2 } }
        : overrides.free,
})

// A complete, valid, high-scoring session. Every fixture starts here and overrides one thing, so a
// failure points at the thing that changed rather than at a wall of unrelated data.
const buildSubmission = (overrides = {}) => {
    const base = {
        ipip50: { answers: fillIpip("D") },
        mi: { answers: fillMi(["E", "D", "C", "C", "B", "D", "E"]) },
        rosenberg: { answers: fillRosenberg(true) },
        confidence: { answers: fillConfidence("A") },
        perspective: fillPerspective("A"),
        digitSpan: buildDigitSpan(6),
        sartRaw: buildSartRaw(),
        extReasoning: { instrument: "assessmentday_logical_v1", percentile: 72, score_raw: 7, questions_total: 10, seconds_per_question: 34, extraction_confidence: 0.95 },
        extVerbal: { instrument: "mindcrowd_verbal_v1", your_score: 28, peer_average: 24, extraction_confidence: 0.92 },
        storyRecall: buildStoryRecall(),
    }

    return { ...base, ...overrides }
}

module.exports = {
    buildSubmission,
    fillIpip,
    fillMi,
    fillRosenberg,
    fillConfidence,
    fillPerspective,
    buildDigitSpan,
    buildSartRaw,
    buildStoryRecall,
    STORY_FACTS,
}
