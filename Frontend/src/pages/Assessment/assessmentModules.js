// The item lists are imported for their LENGTHS, not their contents — see REQUIRED_ANSWERS below.
import { IPIP_ITEMS } from "./ipip50Items"
import { MI_ITEMS, ROSENBERG_ITEMS, CONFIDENCE_ITEMS } from "./moduleItems"
import { PERSPECTIVE_MCQ, VALUES_FULFILMENT, VALUES_IMPORTANCE } from "./perspectiveItems"

// The assessment's module registry — the analogue of interestFormState.js's ALL_STEPS.
//
// ONE ENTRY PER MODULE, and `key` is the server-side block name. `/savePsychometric` writes to
// `psychometric.<key>`, and Backend/scoring/scoreProfile.js reads the same names, so this list is
// where the UI, the save endpoint and the scorer agree on what a module is called.
//
// `built: false` modules are shown as locked rather than hidden. A student who can see that four
// more sections are coming understands a partial report; one who sees four sections and a finished
// report concludes the product is thin. The report itself says the same thing through
// `completeness.release`.
//
// ORDER MATTERS FOR STORY RECALL ONLY. 05_Story_Bank.md is explicit: the story is the first thing
// in the assessment, because its 24-hour clock starts when the student opens it and runs
// independently of everything else. It is registered first even though it is built later, so the
// order does not have to change when it lands.

export const ASSESSMENT_MODULES = [
    { key: "storyRecall", title: "A short story", minutes: 10, built: true, note: "Starts a one-hour clock. You are asked about it tomorrow, and the questions stay open for two days." },
    { key: "ipip50", title: "How you see yourself", minutes: 8, built: true },
    { key: "mi", title: "What you are drawn to", minutes: 6, built: true },
    { key: "rosenberg", title: "How you rate yourself", minutes: 3, built: true },
    { key: "confidence", title: "Confidence in six situations", minutes: 4, built: true },
    { key: "perspective", title: "How you think", minutes: 20, built: true },
    { key: "digitSpan", title: "Remembering numbers", minutes: 5, built: true },
    { key: "extReasoning", title: "Reasoning test", minutes: 15, built: true, external: true, note: "Taken on another website while ours is being built. One attempt only — you upload a screenshot of the result." },
    { key: "extVerbal", title: "Word memory test", minutes: 10, built: true, external: true, note: "Taken on another website while ours is being built. One attempt only — you upload a screenshot of the result." },
    { key: "sartRaw", title: "Staying focused", minutes: 6, built: true, note: "A fast, timed task. One attempt only." },
]

export const BUILT_MODULES = ASSESSMENT_MODULES.filter((module) => module.built)

export const moduleByKey = (key) => ASSESSMENT_MODULES.find((module) => module.key === key) || null

// Which modules a student has answered, from a saved submission. Used for the progress display and
// to decide whether "submit" is offered at all.
// How many scale answers each module needs before it is genuinely finished.
//
// "HAS ANY ANSWERS" IS NOT "IS COMPLETE", and treating them as the same is what made a module the
// student had barely started offer them "Review answers". Worse, it let them submit: `canSubmit`
// counts completed modules, so one answered item per module read as a finished assessment.
//
// COUNTED FROM THE ITEM LISTS, NEVER TYPED. The first version of this hardcoded the numbers and got
// Perspective wrong — 41 against a real total of 34 — which made the module impossible to finish:
// a student answered every question and the page still said "Continue", with no way to tell why.
// A hand-maintained count is a second source of truth that only ever drifts in the direction of
// being unreachable, and the failure is invisible until someone completes the module.
const REQUIRED_ANSWERS = {
    ipip50: IPIP_ITEMS.length,
    mi: MI_ITEMS.length,
    rosenberg: ROSENBERG_ITEMS.length,
    confidence: CONFIDENCE_ITEMS.length,
    perspective: PERSPECTIVE_MCQ.length + VALUES_FULFILMENT.length + VALUES_IMPORTANCE.length,
}

// Everything a module needs, not just its scale answers.
const isModuleComplete = (key, block) => {
    if (!block) return false

    // Digit span has no fixed number of trials — it stops when both attempts at a length fail,
    // which can be after four trials or after fourteen. The server stamps `completedAt` the moment
    // the discontinue rule fires, and that stamp is the only honest signal.
    if (key === "digitSpan") return Boolean(block.completedAt)

    // Story recall is finished only once the recall answers are IN — opening the story starts a
    // 24-hour wait, and a block that merely exists would otherwise read as done from the moment it
    // was opened.
    if (key === "storyRecall") return Boolean(block.submittedAt)

    // The external tests are finished when the student has AGREED with the numbers read off their
    // screenshot, not when a screenshot has been uploaded. A model reading 71 where the screen said
    // 17 produces a block that looks complete in every way, and the student's confirmation is the
    // only check that ever catches it — so it is the thing that counts as done.
    if (key === "extReasoning" || key === "extVerbal") return Boolean(block.studentConfirmedAt)

    // SART saves the PsyToolkit rows as a plain string, and saves NOTHING when the device failed
    // its timing check. So a non-empty string here means a session that is actually scoreable, and
    // a student whose phone could not hold 1150ms is honestly incomplete rather than falsely done.
    if (typeof block === "string") return block.trim() !== ""

    const required = REQUIRED_ANSWERS[key]
    const answered = Object.keys(block.answers || {}).length

    if (required !== undefined && answered < required) return false

    // Perspective additionally needs both narrative labels. Its four written answers are
    // deliberately NOT required — forcing text produces a sentence written to get past the button,
    // which is worse than an honest null, and the scorer already treats a blank as missing.
    if (key === "perspective") return Object.keys(block.narrative || {}).length >= 2

    return required !== undefined ? true : Object.keys(block).length > 0
}

export const completedModules = (psychometric) => {
    const saved = psychometric || {}
    return BUILT_MODULES.filter((module) => isModuleComplete(module.key, saved[module.key])).map((module) => module.key)
}

// Started but not finished — the state that needs "Continue", not "Review answers".
export const startedModules = (psychometric) => {
    const saved = psychometric || {}
    return BUILT_MODULES.filter((module) => {
        const block = saved[module.key]
        if (!block || isModuleComplete(module.key, block)) return false
        const answered = Object.keys(block.answers || {}).length + (block.trials || []).length
        return answered > 0
    }).map((module) => module.key)
}

// FOUR MODULES DO NOT GATE SUBMISSION. This is a SAFETY VALVE, NOT A FEATURE — nothing in the UI
// says which sections these are, because a section students are told is skippable is a section most
// of them skip, and a report built without the reasoning test is measurably worse at its only job.
// See the note at the top of AssessmentIntro.js.
//
// Each one would otherwise trap somebody with no way out:
//
// STORY RECALL — the spec's own rule, not a shortcut. 05_Story_Bank.md: "Recall is on its own
// clock, not a step in the sequence", and beyond 72 hours it is simply not scored while "everything
// else releases normally". Gating on it would mean nobody could submit for at least 24 hours after
// opening the story, which inverts the design.
//
// THE TWO EXTERNAL TESTS — they live on somebody else's website, are one attempt only, and can be
// unreachable for a day for reasons nobody here controls. Requiring them would mean a student who
// finished forty minutes of work here cannot see anything until a third party cooperates.
//
// SART — a student whose phone fails the 50Hz or the timing gate CANNOT complete it, ever. Making
// it a requirement would lock exactly the students on the cheapest devices out of the product
// entirely, which is the opposite of what refusing to fake their score was for.
//
// The gap is never silent. The scoring engine nulls a missing factor and renormalises, the report
// says which parts of the picture are missing, and `completeness.release` decides whether that is
// worth a note or a hold.
const NON_BLOCKING = ["storyRecall", "extReasoning", "extVerbal", "sartRaw"]

const BLOCKS_SUBMIT = BUILT_MODULES.filter((module) => !NON_BLOCKING.includes(module.key))

// The student can submit once every other BUILT module is answered. Unbuilt ones are not required —
// that is the whole reason the scoring engine nulls missing factors rather than refusing to score.
export const canSubmit = (psychometric) => {
    const done = completedModules(psychometric)
    return BLOCKS_SUBMIT.every((module) => done.includes(module.key))
}

export const TOTAL_MINUTES = BUILT_MODULES.reduce((total, module) => total + module.minutes, 0)
