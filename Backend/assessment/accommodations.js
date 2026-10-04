// WHICH TESTS A DECLARED DIFFICULTY CAN AFFECT (Round 10; the server copy, Round 13). The page's copy
// is Frontend/src/pages/Assessment/accommodations.js — a fixture checks the two agree.
//
// Round 13 (owner): the student tells us in the INTEREST FORM (Background → Disability → "which of
// these can it make harder?"). When that form is saved, the tests those difficulties affect are set
// aside — `psychometric.accommodations.skipped[module] = true` — and the scorer drops them exactly as
// for a section never taken: NOT MEASURED, never low. Nothing here ranks or removes a career.

const NEEDS = ["vision", "hearing", "motor", "reading", "attention"]

const AFFECTS = {
    vision: ["sartRaw", "digitSpan", "reasoning"],
    hearing: [],
    motor: ["sartRaw", "digitSpan"],
    reading: ["storyRecall", "reasoning", "wordRecall", "extVerbal"],
    attention: ["sartRaw", "wordRecall"],
}

const affectedModules = (needs) => [...new Set((needs || []).flatMap((need) => AFFECTS[need] || []))]

// a module the student has already finished is never set aside — their result stands
const isFinished = (psychometric, key) => {
    const block = psychometric && psychometric[key]
    if (!block) return false
    if (typeof block === "string") return block.trim() !== ""      // SART stores its rows as text
    if (key === "storyRecall") return Boolean(block.submittedAt)
    if (key === "extVerbal") return Boolean(block.studentConfirmedAt)
    return Boolean(block.completedAt)
}

// The accommodations block an interest-form answer implies, or undefined to leave things as they
// are. An explicit "I'd like to try it anyway" (skipped[key] === false) is kept on every re-save.
// A block the student declared on the assessment page before Round 13 is never overwritten.
const accommodationsFromInterest = (background, psychometric = {}) => {
    const previous = psychometric.accommodations || null
    if (previous && previous.source !== "interest_form" && previous.declaredAt) return undefined

    const needs = background && background.disability === "Yes" && Array.isArray(background.disabilityNeeds)
        ? background.disabilityNeeds.filter((need) => NEEDS.includes(need))
        : []
    if (needs.length === 0) return previous && previous.source === "interest_form" ? null : undefined

    const before = (previous && previous.skipped) || {}
    const skipped = {}
    affectedModules(needs).forEach((key) => {
        if (before[key] === false) skipped[key] = false
        else if (!isFinished(psychometric, key)) skipped[key] = true
    })
    return {
        source: "interest_form",
        needs,
        shareWithMentor: Boolean(background.disabilityShareWithMentor),
        declaredAt: (previous && previous.declaredAt) || new Date().toISOString(),
        skipped,
    }
}

module.exports = { NEEDS, AFFECTS, affectedModules, accommodationsFromInterest }
