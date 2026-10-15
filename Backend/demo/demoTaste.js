// THE DEMO'S TASTES (owner, Round 33) — what three short tasks say, worked out here and kept only as a small
// result inside the demo. Nothing raw is stored: not the statements' answers, not the puzzles, not one
// SART row.
//
//   7 "what you're drawn to" statements, one real MI item per intelligence → 0-10 each (the real MI rule
//     for one item: A-E = 1-5, (value − 1) / 4 × 10)
//   4 demo puzzles → right ÷ 4 × 10 as reasoning
//   90 seconds of SART (~78 digits, nine 3s) → processing speed and focus, on the real scorer's anchors
//
// WHY NOT THE REAL SCORERS. Each refuses a run this short on purpose: the MI scorer wants most of an
// intelligence's items, the SART scorer wants 150+ trials. A demo taste is honestly partial, and the result
// says how partial ("N% measured"). The SART anchors below are copied from scoring/sartScoring.js and a
// fixture holds them equal, so a demo press is read exactly the way a real one is.

// one real statement per intelligence — the plainest of each set (Frontend/src/pages/Assessment/moduleItems.js)
const MI_DEMO_ITEMS = {
    verbal_intelligence: "MI_V1",
    logical_intelligence: "MI_L1",
    spatial_intelligence: "MI_S3",
    musical_intelligence: "MI_M2",
    bodily_intelligence: "MI_B3",
    naturalistic_intelligence: "MI_N2",
    existential_intelligence: "MI_E1",
}
const LETTER_VALUE = { A: 1, B: 2, C: 3, D: 4, E: 5 }

// copied from scoring/sartScoring.js (THRESHOLDS) — a fixture compares them
const SART_ANCHORS = {
    ANTICIPATORY_MS: 150,
    COMMISSION_BEST: 0.10, COMMISSION_WORST: 0.60,
    CV_BEST: 0.20, CV_WORST: 0.60,
    RT_FAST: 220, RT_SLOW: 520,
}
const DEMO_SART_TRIALS = 78      // 78 × 1.15 s ≈ 90 seconds
const DEMO_SART_NO_GO = 9        // ~11%, the real block's share
const MIN_CLEAN_GO = 20          // fewer clean presses than this and speed isn't read
const MAX_ANTICIPATORY = 0.15    // the real scorer's line: more early presses than this and the run says nothing

const round1 = (value) => (value === null ? null : Math.round(value * 10) / 10)
const band = (value, worst, best) => (value === null || Number.isNaN(value) ? null : Math.max(0, Math.min(10, ((worst - value) / (worst - best)) * 10)))

const miTaste = (answers = {}) => Object.fromEntries(Object.entries(MI_DEMO_ITEMS).map(([factor, id]) => {
    const value = LETTER_VALUE[answers[id]]
    return [factor, value ? round1(((value - 1) / 4) * 10) : null]
}))

const puzzleTaste = (right, of = 4) => round1((right / of) * 10)

// rows: [{ isGo, correct, rt, dropped }] as the page's runBlock records them
const sartTaste = (rows = []) => {
    const shown = rows.filter((row) => row && !row.dropped)
    const go = shown.filter((row) => row.isGo === true)
    const noGo = shown.filter((row) => row.isGo === false)
    const pressedGo = go.map((row) => row.rt).filter((rt) => typeof rt === "number")
    const clean = pressedGo.filter((rt) => rt >= SART_ANCHORS.ANTICIPATORY_MS)
    const early = pressedGo.length ? (pressedGo.length - clean.length) / pressedGo.length : 0
    const pressesOnThree = noGo.filter((row) => row.correct === false).length

    const result = { meanMs: null, speed: null, focus: null, pressesOnThree, threes: noGo.length, tooEarly: early > MAX_ANTICIPATORY }
    if (result.tooEarly || clean.length < MIN_CLEAN_GO || noGo.length === 0) return result

    const mean = clean.reduce((sum, rt) => sum + rt, 0) / clean.length
    const sd = Math.sqrt(clean.reduce((sum, rt) => sum + (rt - mean) ** 2, 0) / clean.length)
    const commission = pressesOnThree / noGo.length
    const attention = 0.60 * band(commission, SART_ANCHORS.COMMISSION_WORST, SART_ANCHORS.COMMISSION_BEST)
        + 0.40 * band(sd / mean, SART_ANCHORS.CV_WORST, SART_ANCHORS.CV_BEST)

    return { ...result, meanMs: Math.round(mean), speed: round1(band(mean, SART_ANCHORS.RT_SLOW, SART_ANCHORS.RT_FAST)), focus: round1(attention) }
}

// HOW MUCH OF EACH FACTOR THE DEMO MEASURED — the share of the real assessment's evidence it saw:
// one of 4-5 statements per intelligence, 4 of 16 puzzles, 78 of 225 SART digits, and for focus the SART
// part (0.30 of the real focus score) of that share.
const MEASURED_PCT = {
    verbal_intelligence: 20,
    logical_intelligence: 25,
    spatial_intelligence: 20,
    musical_intelligence: 20,
    bodily_intelligence: 20,
    naturalistic_intelligence: 25,
    existential_intelligence: 25,
    reasoning: 25,
    processing_speed: 35,
    focus: 10,
}

module.exports = { MI_DEMO_ITEMS, SART_ANCHORS, DEMO_SART_TRIALS, DEMO_SART_NO_GO, MEASURED_PCT, miTaste, puzzleTaste, sartTaste }
