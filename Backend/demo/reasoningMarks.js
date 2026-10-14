// THE REAL TEST'S MARKING AND CLOCK, COPIED (owner, Round 32: the demo reuses the real engines read-only).
//
// These two functions live inside Routers/submissionsRouter.js, which does not export them, and the demo
// must not change that file. So they are copied here word for word, and a fixture ("DEMO PARITY") checks
// the two copies are still identical — the demo's six puzzles must be marked and timed exactly as the
// real test marks and times them, because a student who buys carries those answers into it.
const reasoningBank = require("../assessment/reasoningBank")

// the demo's six: puzzles 1-6 of the real sixteen (one of each kind, then a second matrix and series)
const DEMO_REASONING_ITEMS = 6

const REASONING_GRACE_MS = 5000

const reasoningTimedOut = (item, pending, now = Date.now()) => now - new Date(pending.issuedAt).getTime() > item.timeLimitS * 1000 + REASONING_GRACE_MS

// one answer, marked here; `picked` null means skipped or out of time — not correct either way
const reasoningResponse = (item, picked, ms, timedOut) => ({
    id: item.id,
    type: item.type,
    level: item.level,
    choice: timedOut ? null : picked,
    correct: !timedOut && picked !== null && picked === item.answer,
    ms,
    timedOut,
})

module.exports = { DEMO_REASONING_ITEMS, REASONING_GRACE_MS, reasoningTimedOut, reasoningResponse, reasoningBank }
