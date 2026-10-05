const express = require("express")
const Submission = require("../model/submissionsModel")
const User = require("../model/userModel")
const authMiddleware = require("../middlewares/authMiddleware")
const requireDiscovery = require("../middlewares/requireDiscovery")

const { raiseIssue } = require("../utils/assessmentIssues")
const { directionUpdate } = require("../utils/direction")
const { accommodationsFromInterest } = require("../assessment/accommodations")

const router = express.Router()


// ========================
// Helpers — strip the form's blank starter rows before saving
// ========================

// the form shows one empty box to start typing in (personalGrowth: [""], internal: [{}]).
// those blanks must never be saved as if they were answers.

// fields that describe a row rather than being an answer — they don't make a row "filled"
const ROW_METADATA_KEYS = ["source", "activityFailure", "confidence", "isSelected"]

const isBlank = (value) => {
    if (value === null || value === undefined) return true
    if (typeof value === "string") return value.trim() === ""
    if (Array.isArray(value)) return value.length === 0
    if (typeof value === "object") {
        return Object.entries(value)
            .filter(([key]) => !ROW_METADATA_KEYS.includes(key))
            .every(([, fieldValue]) => isBlank(fieldValue))
    }
    return false    // numbers and booleans are real answers
}

// trims strings everywhere, and drops blank items from every array (recursively)
const stripBlankRows = (value) => {
    if (Array.isArray(value)) {
        return value
            .map((item) => stripBlankRows(item))
            .filter((item) => !isBlank(item))
    }

    if (value && typeof value === "object") {
        const cleaned = {}
        Object.entries(value).forEach(([key, fieldValue]) => {
            cleaned[key] = stripBlankRows(fieldValue)
        })
        return cleaned
    }

    if (typeof value === "string") return value.trim()

    return value
}


// ========================
// Save Interest Form
// ========================

// called on every section change (isComplete false) and once on Finish (isComplete true).
// There is no separate submit page — a student who stops halfway has already been saved, so the
// form resumes on any device instead of living only in one browser's localStorage.
router.post("/saveInterest", authMiddleware, requireDiscovery, async (req, res) => {
    try {
        const { interest, isComplete } = req.body

        if (!interest || typeof interest !== "object" || Array.isArray(interest)) {
            return res.status(400).json({
                success: false,
                message: "Interest form data missing"
            })
        }

        // the form's sections depend on the journey, so it must be set first
        if (!req.user.journey) {
            return res.status(400).json({
                success: false,
                message: "Please complete your profile"
            })
        }

        const isFinished = isComplete === true

        // blanks are stripped on partial saves too, so a half-finished form never stores
        // the starter empty rows either
        const cleanedInterest = stripBlankRows(interest)

        const changes = {
            interest: cleanedInterest,
            lastSavedAt: new Date(),
            isComplete: isFinished,
        }

        if (isFinished) {
            changes.submittedAt = new Date()
        }

        // Round 13: a disability named here, with what it makes harder, sets the affected tests aside
        // on the assessment page (assessment/accommodations.js) — not measured, never low.
        const existing = await Submission.findOne({ user: req.user._id }).select("psychometric").lean()
        const accommodations = accommodationsFromInterest(cleanedInterest.backgroundInfo, (existing && existing.psychometric) || {})
        if (accommodations) changes["psychometric.accommodations"] = accommodations

        // interest is a Mixed field — always $set the whole object, never .push() + .save()
        const updatedSubmission = await Submission.findOneAndUpdate(
            { user: req.user._id },
            { $set: changes, ...(accommodations === null ? { $unset: { "psychometric.accommodations": "" } } : {}) },
            { returnDocument: "after", upsert: true }
        )

        // a student editing an already-finished form must not be demoted back to in_progress —
        // that would re-lock everything downstream that waits on "done"
        if (isFinished || req.user.progress.interestForm !== "done") {
            await User.findByIdAndUpdate(req.user._id, {
                "progress.interestForm": isFinished ? "done" : "in_progress",
            })
        }

        return res.status(isFinished ? 201 : 200).json({
            success: true,
            message: isFinished ? "Interest form submitted successfully" : "Progress saved",
            data: updatedSubmission,
        })

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to submit interest form",
            error: error.message,
        })
    }
})


// ========================
// Save one assessment module
// ========================

// Stage 2. Called every time the student leaves a module, exactly like the interest form — a
// half-finished assessment is already saved, so it resumes on any device.
//
// ONE MODULE AT A TIME, written to its own key. `$set: { "psychometric.ipip50": {...} }` touches
// only that block, so a student who redoes IPIP-50 cannot wipe the SART data sitting beside it.
// Setting the whole `psychometric` object would do exactly that, and the bug would look like
// "the assessment lost my answers" three modules later.
//
// THE KEYS ARE THE CONTRACT. Backend/scoring/ reads `psychometric.ipip50.answers.IPIP_O1` and so
// on. This endpoint does not validate them against the item bank on purpose — the sub-scorers
// already refuse to score a block they do not recognise, and coverage below the gate nulls the
// factor rather than guessing. A second, looser copy of that rule here would drift from the first.
//
// `sartMeta` IS NOT SCORED AND THAT IS WHY IT EXISTS. `sartRaw` is a string — the PsyToolkit-format
// rows the scorer parses — so there is nowhere in it to record the things that decide whether those
// rows mean anything: the screen's refresh rate, the measured error against the intended 1150 ms
// trial, how many times the tab lost focus. 04_Item_Bank.md §6 requires all of them to be recorded.
// A session whose timing check failed writes `sartMeta` and NO `sartRaw`, which is the honest
// outcome: processing speed resolves to null rather than to a confident number produced by a
// browser that was dropping frames. scoreProfile reads named keys only, so this one passes it by.
// WHAT THE BROWSER MAY WRITE, module by module (backend review #9). Before this, any module key was
// accepted and the whole block overwritten, which let a save do three bad things:
//   - wipe server-owned results — a perspective save without `open` erased the written-answer
//     grades (and re-billed all four), and a save landing mid-scoring overwrote the worker's write;
//   - overwrite blocks only the server writes — the digit span's marked trials, the story recall's
//     facts, an external test's extracted score — with anything at all;
//   - replace a SART run, whose "one attempt" rule lived only in the UI.
//
// `null` means the whole block belongs to the browser (a questionnaire's answers). A list means
// only those fields do, and each is written by its own dotted path so everything else on the block
// — including grades the worker is writing right now — is left exactly where it is. Modules the
// server owns are not listed, and are refused.
const CLIENT_OWNED = {
    "ipip50": null,
    "mi": null,
    "rosenberg": null,
    "confidence": null,
    "accommodations": null,
    "perspective": ["answers", "narrative", "openText"],
    "sartMeta": null,
    "sartRaw": null,
}
const MODULE_KEYS = Object.keys(CLIENT_OWNED)

// Written ONCE. A second SART run only replaces the first through a sanctioned retry — the
// automatic one for a run that did not record properly, or one an admin grants (retakeGrants).
const WRITE_ONCE = ["sartRaw"]

const offerSartRetakeIfInvalid = async (userId, rawRows, submission) => {
    const scoreSart = require("../scoring/sartScoring")
    const result = scoreSart(rawRows)
    if (!result || result.valid || result.action !== "offer_retake") return false

    const used = (submission && submission.psychometric && submission.psychometric.sartRetakes) || 0
    const reasons = (result.invalid_reasons || result.problems || []).join(", ")

    if (used >= 1) {
        await raiseIssue({ user: userId, module: "sartRaw", kind: "sart_invalid", detail: `second run also invalid: ${reasons}` })
        return false
    }

    await Submission.updateOne(
        { user: userId },
        { $set: { "psychometric.retakeGrants.sartRaw": true, "psychometric.sartRetakes": used + 1 } }
    )
    await raiseIssue({ user: userId, module: "sartRaw", kind: "sart_invalid", detail: `automatic retry offered: ${reasons}`, status: "retake_granted" })
    return true
}

// A focus (SART) run is saved only when it ends, so a refresh in the middle would quietly hand the
// student a second run. The page reports the start of every run here (Round 17, owner): a run
// started while an earlier one never finished means the page was left or refreshed mid-run, and the
// admin is told. A recorded run (sartRaw) closes it.
router.post("/markTestStarted", authMiddleware, requireDiscovery, async (req, res) => {
    try {
        if (req.body.module !== "sartRaw") {
            return res.status(400).json({ success: false, message: "Unknown test" })
        }
        const submission = await Submission.findOne({ user: req.user._id }).select("psychometric.sartRunOpenedAt psychometric.sartRaw").lean()
        const psychometric = (submission && submission.psychometric) || {}
        const interrupted = Boolean(psychometric.sartRunOpenedAt) && !psychometric.sartRaw
        if (interrupted) {
            await raiseIssue({ user: req.user._id, module: "sartRaw", kind: "left_mid_test", detail: "a focus run was started and never finished — the page was left or refreshed mid-run" })
        }
        await Submission.findOneAndUpdate({ user: req.user._id }, { $set: { "psychometric.sartRunOpenedAt": new Date() } }, { upsert: true })
        return res.status(200).json({ success: true, message: "Run started", data: { interrupted } })

    } catch (error) {
        return res.status(500).json({ success: false, message: "Could not record the start", error: error.message })
    }
})

router.post("/savePsychometric", authMiddleware, requireDiscovery, async (req, res) => {
    try {
        const { module, block } = req.body

        if (!module || !MODULE_KEYS.includes(module)) {
            return res.status(400).json({
                success: false,
                message: "Unknown assessment module",
            })
        }

        if (block === undefined || block === null) {
            return res.status(400).json({
                success: false,
                message: "Assessment answers missing",
            })
        }

        const fields = CLIENT_OWNED[module]
        if (fields && (typeof block !== "object" || Array.isArray(block))) {
            return res.status(400).json({ success: false, message: "Assessment answers are in the wrong shape" })
        }

        const changes = { lastSavedAt: new Date() }
        const unset = {}

        if (WRITE_ONCE.includes(module)) {
            const existing = await Submission.findOne({ user: req.user._id }).select(`psychometric.${module} psychometric.retakeGrants`).lean()
            const psychometric = (existing && existing.psychometric) || {}
            const already = psychometric[module]
            const granted = psychometric.retakeGrants && psychometric.retakeGrants[module]

            if (already && !granted) {
                return res.status(409).json({ success: false, message: "This test has already been recorded" })
            }
            if (granted) unset[`psychometric.retakeGrants.${module}`] = ""
        }
        // a recorded focus run closes the run opened by /markTestStarted
        if (module === "sartRaw") unset["psychometric.sartRunOpenedAt"] = ""

        if (fields) {
            fields.forEach((field) => {
                if (block[field] !== undefined) changes[`psychometric.${module}.${field}`] = block[field]
            })
        } else {
            changes[`psychometric.${module}`] = block
        }

        const update = { $set: changes }
        if (Object.keys(unset).length > 0) update.$unset = unset

        const updatedSubmission = await Submission.findOneAndUpdate(
            { user: req.user._id },
            update,
            { returnDocument: "after", upsert: true }
        )

        if (req.user.progress.psychometric === "not_started") {
            await User.findByIdAndUpdate(req.user._id, { "progress.psychometric": "in_progress" })
        }

        // A SART RUN THAT DID NOT MEASURE ANYTHING GETS ONE MORE TRY, automatically. The scorer can
        // tell (sartScoring's `offer_retake`: too few responses, a key held down, a session that
        // never really ran) — and until now nothing read that answer, so the run was simply lost.
        // Once only: a second invalid run is recorded as it is, and the admin sees both.
        let retakeOffered = false
        if (module === "sartRaw") {
            retakeOffered = await offerSartRetakeIfInvalid(req.user._id, block, updatedSubmission)
        }

        return res.status(200).json({
            success: true,
            message: retakeOffered ? "That run did not record properly — you can take it once more" : "Progress saved",
            data: { module, savedAt: updatedSubmission.lastSavedAt, retakeOffered },
        })

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to save assessment progress",
            error: error.message,
        })
    }
})


// ========================
// Digit span — the server owns the sequences
// ========================

// 04_Item_Bank.md §5: "sequences generated server-side and never sent ahead of presentation".
//
// TWO THINGS THE SERVER HAS TO OWN, and they are different.
//
// 1. THE SEQUENCE. One trial is issued at a time and the next is not generated until the current
//    one is answered. A client that received all fourteen up front could read them out of the
//    network tab, and the whole module would measure nothing.
//
// 2. THE MARKING. The client reports what the student typed; it never reports whether that was
//    right. `correct` is computed here against the stored sequence. If the browser decided it, a
//    student would not even need to cheat deliberately — a well-meaning bug in the front end would
//    quietly hand everyone a perfect span.
//
// The in-progress sequence lives on the submission rather than in memory, so a dropped connection
// or a refreshed tab resumes instead of restarting. Nothing about it is secret once presented —
// the student has just watched it — so storing it is not a leak.

const DIGIT_SPAN_MIN = 3
const DIGIT_SPAN_MAX = 9
const TRIALS_PER_LENGTH = 2

// 1-9, NO IMMEDIATE REPEATS. A repeated digit makes a sequence easier to hold and would inflate the
// span for whoever happened to be dealt one.
const makeSequence = (length) => {
    const digits = []

    while (digits.length < length) {
        const next = 1 + Math.floor(Math.random() * 9)
        if (digits[digits.length - 1] !== next) digits.push(next)
    }

    return digits.join("")
}

// Given what has been answered so far, what should be presented next?
const nextTrialFor = (trials) => {
    let length = DIGIT_SPAN_MIN

    // Walk up the lengths: two trials each, advance on either correct, stop when both fail.
    for (; length <= DIGIT_SPAN_MAX; length += 1) {
        const atLength = trials.filter((trial) => trial.length === length)

        if (atLength.length < TRIALS_PER_LENGTH) {
            // Either trial correct ends this length early — no point asking the second.
            if (atLength.some((trial) => trial.correct)) continue
            return length
        }

        if (!atLength.some((trial) => trial.correct)) return null   // both wrong: discontinue
    }

    return null   // cleared 9 digits
}

router.post("/digitSpanNext", authMiddleware, requireDiscovery, async (req, res) => {
    try {
        const submission = await Submission.findOne({ user: req.user._id })
        const block = (submission && submission.psychometric && submission.psychometric.digitSpan) || {}
        const trials = block.trials || []

        const length = nextTrialFor(trials)

        if (length === null) {
            return res.status(200).json({ success: true, message: "Digit span complete", data: { done: true, trials: trials.length } })
        }

        // A sequence already shown and not yet answered is NOT replaced (a fresh one would be a free
        // reroll) and, since Round 17, NOT shown again either (that was a second look). The page was
        // left or refreshed mid-sequence: the student types what they remember, the trial is marked
        // interrupted, and the admin is told so they can allow a retake if something went wrong.
        if (block.pending && block.pending.length === length && block.pending.digits) {
            if (!block.pending.interrupted) {
                await Submission.updateOne({ user: req.user._id }, { $set: { "psychometric.digitSpan.pending.interrupted": true } })
                await raiseIssue({ user: req.user._id, module: "digitSpan", kind: "left_mid_test", detail: `a ${length}-digit sequence: the page was left or refreshed before it was answered` })
            }
            return res.status(200).json({
                success: true,
                message: "Type what you remember",
                data: { done: false, length, interrupted: true },
            })
        }

        const digits = makeSequence(length)

        await Submission.findOneAndUpdate(
            { user: req.user._id },
            { $set: { "psychometric.digitSpan.pending": { digits, length, issuedAt: new Date() }, "psychometric.digitSpan.trials": trials } },
            { upsert: true }
        )

        return res.status(200).json({
            success: true,
            message: "Next sequence",
            data: { done: false, length, digits },
        })

    } catch (error) {
        return res.status(500).json({ success: false, message: "Could not start the next sequence", error: error.message })
    }
})

router.post("/digitSpanAnswer", authMiddleware, requireDiscovery, async (req, res) => {
    try {
        const { response, ms } = req.body

        const submission = await Submission.findOne({ user: req.user._id })
        const block = (submission && submission.psychometric && submission.psychometric.digitSpan) || {}
        const pending = block.pending

        if (!pending) {
            return res.status(400).json({ success: false, message: "No sequence is currently presented" })
        }

        const typed = String(response === undefined || response === null ? "" : response).replace(/\D/g, "")

        // Marked HERE, against the stored sequence. The client never gets a say.
        const trial = {
            length: pending.length,
            presented: pending.digits,
            response: typed,
            correct: typed === pending.digits,
            ms: typeof ms === "number" && ms >= 0 ? ms : 0,
            ...(pending.interrupted ? { interrupted: true } : {}),
        }

        const trials = [...(block.trials || []), trial]
        const finished = nextTrialFor(trials) === null

        // `completedAt` is what marks the module done, not "has any trials". The task stops when
        // both trials at a length fail, which can be after four trials or after fourteen — there is
        // no fixed count to compare against, so the server stamps it at the moment the discontinue
        // rule fires and the UI simply reads the stamp.
        const changes = {
            "psychometric.digitSpan.trials": trials,
            "psychometric.digitSpan.pending": null,
            lastSavedAt: new Date(),
        }

        if (finished) changes["psychometric.digitSpan.completedAt"] = new Date()
        if (typeof req.body.blurCount === "number") changes["psychometric.digitSpan.blurCount"] = req.body.blurCount

        await Submission.findOneAndUpdate({ user: req.user._id }, { $set: changes })

        if (req.user.progress.psychometric === "not_started") {
            await User.findByIdAndUpdate(req.user._id, { "progress.psychometric": "in_progress" })
        }

        return res.status(200).json({
            success: true,
            message: "Answer recorded",
            // `correct` is returned for the practice trial's feedback only. The scored trials give
            // the student no feedback — knowing you got one wrong changes how you attempt the next.
            data: { correct: trial.correct, done: finished },
        })

    } catch (error) {
        return res.status(500).json({ success: false, message: "Could not record the answer", error: error.message })
    }
})


// ========================
// Reasoning — the in-house test, served one item at a time
// ========================

// Same two rules as the digit span, for the same reasons (Round 10). THE ITEMS: built from a seed
// stored on the block, one at a time, never ahead of presentation, and never with the answer
// (reasoningBank.publicItem). THE MARKING: here, against the item rebuilt from the seed — the browser
// only ever says which option was picked.
//
// One attempt. EVERY PUZZLE HAS ITS OWN CLOCK (owner, Round 13): 60 seconds for word and series
// puzzles, 90 for the picture ones (reasoningBank.TIME_LIMIT_S). The clock runs from when the puzzle
// was issued, here on the server, so a refresh never buys time. An answer arriving after the limit
// (plus a few seconds' grace for a slow phone) counts as not answered. Three timeouts in a row
// usually mean the device or the connection, not the student — and the admin is told.
//
// A retake the admin granted (an earlier attempt in psychometric.history) is dealt verbal form B
// and a new seed, so no puzzle repeats.
const reasoningBank = require("../assessment/reasoningBank")
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

// the block after one more response, and whether three timeouts in a row should be reported
const recordReasoning = async (userId, block, response) => {
    const all = [...(block.responses || []), response]
    const changes = {
        "psychometric.reasoning.responses": all,
        "psychometric.reasoning.pending": null,
        lastSavedAt: new Date(),
    }
    if (all.length >= reasoningBank.ITEM_COUNT) changes["psychometric.reasoning.completedAt"] = new Date()
    await Submission.findOneAndUpdate({ user: userId }, { $set: changes })

    const lastThree = all.slice(-3)
    if (response.timedOut && lastThree.length === 3 && lastThree.every((entry) => entry.timedOut)) {
        await raiseIssue({ user: userId, module: "reasoning", kind: "reasoning_timeouts", detail: `three puzzles in a row ran out of time (up to ${response.id})` })
    }
    return all
}

router.post("/reasoningNext", authMiddleware, requireDiscovery, async (req, res) => {
    try {
        const submission = await Submission.findOne({ user: req.user._id }).lean()
        const psychometric = (submission && submission.psychometric) || {}
        let block = psychometric.reasoning || {}

        const seed = typeof block.seed === "number" ? block.seed : Math.floor(Math.random() * 2 ** 31)
        // a block with a seed and no form was dealt before forms existed — form A, even on a retake
        const form = block.form || (typeof block.seed !== "number" && psychometric.history && (psychometric.history.reasoning || []).length > 0 ? "B" : "A")

        // a puzzle left on screen past its clock (a closed tab, a refresh) is recorded as out of
        // time before the next one is dealt
        if (block.pending && typeof block.seed === "number" && block.pending.index === (block.responses || []).length) {
            const shown = reasoningBank.itemFor(block.seed, block.pending.index, form)
            if (reasoningTimedOut(shown, block.pending)) {
                const all = await recordReasoning(req.user._id, block, reasoningResponse(shown, null, Date.now() - new Date(block.pending.issuedAt).getTime(), true))
                block = { ...block, responses: all, pending: null, completedAt: all.length >= reasoningBank.ITEM_COUNT ? new Date() : null }
            }
        }

        const responses = block.responses || []
        if (block.completedAt || responses.length >= reasoningBank.ITEM_COUNT) {
            return res.status(200).json({ success: true, message: "Reasoning complete", data: { done: true, answered: responses.length } })
        }

        const index = responses.length

        // an item already shown and not yet answered is shown again — a refresh is not a reroll,
        // and its clock keeps running from when it was first issued
        const pending = block.pending && block.pending.index === index ? block.pending : { index, issuedAt: new Date() }

        // the same puzzle asked for again means the page was left or refreshed with it open (Round 17):
        // the admin is told once per puzzle
        if (block.pending && block.pending.index === index && !block.pending.reopened) {
            pending.reopened = true
            await raiseIssue({ user: req.user._id, module: "reasoning", kind: "left_mid_test", detail: `puzzle ${index + 1}: the page was left or refreshed while it was open (its clock kept running)` })
        }

        await Submission.findOneAndUpdate(
            { user: req.user._id },
            { $set: {
                "psychometric.reasoning.seed": seed,
                "psychometric.reasoning.form": form,
                "psychometric.reasoning.startedAt": block.startedAt || new Date(),
                "psychometric.reasoning.responses": responses,
                "psychometric.reasoning.pending": pending,
                lastSavedAt: new Date(),
            } },
            { upsert: true }
        )

        if (req.user.progress.psychometric === "not_started") {
            await User.findByIdAndUpdate(req.user._id, { "progress.psychometric": "in_progress" })
        }

        const item = reasoningBank.itemFor(seed, index, form)
        const secondsLeft = Math.max(Math.ceil((item.timeLimitS * 1000 - (Date.now() - new Date(pending.issuedAt).getTime())) / 1000), 0)

        return res.status(200).json({
            success: true,
            message: "Next item",
            data: { done: false, number: index + 1, of: reasoningBank.ITEM_COUNT, item: reasoningBank.publicItem(item), secondsLeft },
        })

    } catch (error) {
        return res.status(500).json({ success: false, message: "Could not load the next puzzle", error: error.message })
    }
})

router.post("/reasoningAnswer", authMiddleware, requireDiscovery, async (req, res) => {
    try {
        const { choice } = req.body

        const submission = await Submission.findOne({ user: req.user._id }).lean()
        const block = (submission && submission.psychometric && submission.psychometric.reasoning) || {}
        const responses = block.responses || []
        const pending = block.pending

        if (!pending || typeof block.seed !== "number" || pending.index !== responses.length) {
            return res.status(400).json({ success: false, message: "No puzzle is currently shown" })
        }

        const item = reasoningBank.itemFor(block.seed, pending.index, block.form || "A")
        const picked = Number.isInteger(choice) && choice >= 0 && choice < item.options.length ? choice : null
        const ms = Math.max(Date.now() - new Date(pending.issuedAt).getTime(), 0)

        // Marked HERE. A skipped item (no choice) or one answered after its clock counts as not
        // correct: it was shown.
        const all = await recordReasoning(req.user._id, block, reasoningResponse(item, picked, ms, reasoningTimedOut(item, pending)))

        // No right/wrong back to the page: knowing you got one wrong changes how you attempt the next.
        return res.status(200).json({ success: true, message: "Answer recorded", data: { done: all.length >= reasoningBank.ITEM_COUNT, answered: all.length } })

    } catch (error) {
        return res.status(500).json({ success: false, message: "Could not record the answer", error: error.message })
    }
})


// ========================
// Word memory — the in-house test (Round 11)
// ========================

// Same shape as the reasoning test, one difference forced by the task: the answer key IS the word
// list, and the student has to see it. So it is hidden by TIME instead. A list is handed over once,
// at the moment it is shown, and recorded as shown; asking again before writing it down returns
// "write what you remember", never the words — a refresh mid-list is not a second look.
// The page shows each word for wordBank.WORD_MS; the recall is typed, any order, and marked here.
const wordBank = require("../assessment/wordBank")

router.post("/wordRecallNext", authMiddleware, requireDiscovery, async (req, res) => {
    try {
        const submission = await Submission.findOne({ user: req.user._id }).lean()
        const block = (submission && submission.psychometric && submission.psychometric.wordRecall) || {}
        const trials = block.trials || []

        if (block.completedAt || trials.length >= wordBank.LIST_COUNT) {
            return res.status(200).json({ success: true, message: "Word memory complete", data: { done: true } })
        }

        const index = trials.length

        // already shown and not yet written down: straight to writing, no second look. The page was
        // left or refreshed in between, so the list is marked interrupted and the admin is told
        // (Round 17, owner) — they can allow a retake if something went wrong.
        if (block.pending && block.pending.index === index) {
            if (!block.pending.interrupted) {
                await Submission.updateOne({ user: req.user._id }, { $set: { "psychometric.wordRecall.pending.interrupted": true } })
                await raiseIssue({ user: req.user._id, module: "wordRecall", kind: "left_mid_test", detail: `list ${index + 1}: the page was left or refreshed after the list was shown` })
            }
            return res.status(200).json({ success: true, message: "Write what you remember", data: { done: false, phase: "recall", interrupted: true, number: index + 1, of: wordBank.LIST_COUNT } })
        }

        const seed = typeof block.seed === "number" ? block.seed : Math.floor(Math.random() * 2 ** 31)

        await Submission.findOneAndUpdate(
            { user: req.user._id },
            { $set: {
                "psychometric.wordRecall.seed": seed,
                "psychometric.wordRecall.startedAt": block.startedAt || new Date(),
                "psychometric.wordRecall.trials": trials,
                "psychometric.wordRecall.pending": { index, shownAt: new Date() },
                lastSavedAt: new Date(),
            } },
            { upsert: true }
        )

        if (req.user.progress.psychometric === "not_started") {
            await User.findByIdAndUpdate(req.user._id, { "progress.psychometric": "in_progress" })
        }

        return res.status(200).json({
            success: true,
            message: "Next list",
            data: { done: false, phase: "study", number: index + 1, of: wordBank.LIST_COUNT, words: wordBank.listsFor(seed)[index], msPerWord: wordBank.WORD_MS },
        })

    } catch (error) {
        return res.status(500).json({ success: false, message: "Could not load the list", error: error.message })
    }
})

router.post("/wordRecallAnswer", authMiddleware, requireDiscovery, async (req, res) => {
    try {
        const text = typeof req.body.text === "string" ? req.body.text.slice(0, 600) : ""

        const submission = await Submission.findOne({ user: req.user._id }).lean()
        const block = (submission && submission.psychometric && submission.psychometric.wordRecall) || {}
        const trials = block.trials || []
        const pending = block.pending

        if (!pending || typeof block.seed !== "number" || pending.index !== trials.length) {
            return res.status(400).json({ success: false, message: "No list is waiting to be written down" })
        }

        // Marked HERE, against the list rebuilt from the seed. Nothing about the result goes back.
        const marked = wordBank.markRecall(text, wordBank.listsFor(block.seed)[pending.index])
        const trial = {
            list: pending.index + 1,
            text,
            correct: marked.correct,
            recalled: marked.recalled,
            intrusions: marked.intrusions,
            ms: Math.max(Date.now() - new Date(pending.shownAt).getTime(), 0),
            ...(pending.interrupted ? { interrupted: true } : {}),
        }

        const all = [...trials, trial]
        const finished = all.length >= wordBank.LIST_COUNT
        const changes = {
            "psychometric.wordRecall.trials": all,
            "psychometric.wordRecall.pending": null,
            lastSavedAt: new Date(),
        }
        if (finished) changes["psychometric.wordRecall.completedAt"] = new Date()

        await Submission.findOneAndUpdate({ user: req.user._id }, { $set: changes })

        return res.status(200).json({ success: true, message: "Saved", data: { done: finished, written: all.length } })

    } catch (error) {
        return res.status(500).json({ success: false, message: "Could not save what you wrote", error: error.message })
    }
})


// ========================
// Submit the assessment — starts the pipeline
// ========================

// SAFE TO CALL TWICE. The job id is the user id, so a student who double-taps, or retries after a
// dropped connection, gets one job rather than two racing writes to the same profile. That matters
// more than it sounds: the answers are already saved by /savePsychometric, so a failed enqueue
// loses nothing and retrying this endpoint is always the right move.
router.post("/submitPsychometric", authMiddleware, requireDiscovery, async (req, res) => {
    try {
        const submission = await Submission.findOne({ user: req.user._id })

        if (!submission || !submission.psychometric || Object.keys(submission.psychometric).length === 0) {
            return res.status(400).json({
                success: false,
                message: "No assessment answers to submit",
            })
        }

        // An abandoned number-memory run is not scored (it would read as a floor), and the admin is
        // told, so they can open it again if something broke.
        const span = submission.psychometric.digitSpan
        if (span && (span.trials || []).length > 0 && !span.completedAt) {
            await raiseIssue({ user: req.user._id, module: "digitSpan", kind: "digit_span_unfinished", detail: `${span.trials.length} sequences answered, then stopped` })
        }

        // the same for the word lists (Round 11)
        const words = submission.psychometric.wordRecall
        if (words && words.startedAt && !words.completedAt) {
            await raiseIssue({ user: req.user._id, module: "wordRecall", kind: "word_recall_unfinished", detail: `${(words.trials || []).length} of 2 lists written down, then stopped` })
        }

        // A RESUBMIT says which way the student is heading (Round 11, utils/direction.js): only "new"
        // restarts the follow-up clock. The first submit starts it and asks nothing.
        const firstTime = !submission.psychometricSubmittedAt
        const direction = directionUpdate({ via: "resubmit", direction: req.body.direction, firstTime })
        if (!direction) {
            return res.status(400).json({
                success: false,
                message: "Tell us whether you're heading the same way or looking for something new",
            })
        }

        // Stamped so the report page can tell a FRESH report from a stale one. Without it, a
        // student who completes more modules and resubmits keeps seeing the old report — including
        // an old "not enough to go on yet" — with no sign that a new one is on its way, which reads
        // exactly like the resubmit having done nothing.
        await Submission.findOneAndUpdate(
            { user: req.user._id },
            { $set: { psychometricSubmittedAt: new Date() } }
        )

        // A new submit starts a fresh attempt, so any earlier "your report failed" is cleared.
        await User.findByIdAndUpdate(req.user._id, {
            ...direction,
            $set: { ...(direction.$set || {}), "progress.psychometric": "done", reportFailedAt: null },
        })

        // Required here rather than at the top of the file: the queue is built lazily, and a
        // machine with no REDIS_URL must still be able to load this router and serve every other
        // route on it.
        const { enqueueScoreProfile } = require("../workers/scoreProfileWorker")
        const { withTimeout } = require("../workers/queueHelpers")

        try {
            await withTimeout(enqueueScoreProfile(req.user._id), "queueing the report")
        } catch (queueError) {
            // The answers and "done" are committed, but nothing is working on them. Without this the
            // student's page would say "generating" forever (backend review #17); marked as failed,
            // it offers "Try again" instead, which re-queues.
            await User.findByIdAndUpdate(req.user._id, { reportFailedAt: new Date() })
            throw queueError
        }

        return res.status(201).json({
            success: true,
            message: "Assessment submitted — your report is being prepared",
            data: { queued: true },
        })

    } catch (error) {
        // The answers and the "done" flag are already committed, so this is recoverable by calling
        // the endpoint again. Say so, rather than leaving the student staring at a generic failure.
        return res.status(500).json({
            success: false,
            message: "Your answers are saved, but the report could not be queued. Please try again.",
            error: error.message,
        })
    }
})


// ========================
// Get My Submission
// ========================

// What the student's own browser gets back. Grades, the graders' notes and answer keys stay on the
// server: they are not the student's to see, and a page that never receives the written-answer
// grades can never send them back in a save (backend review #9, the root of that round-trip).
const forStudent = (submission) => {
    if (!submission || !submission.psychometric) return submission
    const psychometric = { ...submission.psychometric }

    if (psychometric.perspective) {
        const { open, openMeta, ...perspective } = psychometric.perspective
        psychometric.perspective = perspective
    }
    if (psychometric.storyRecall) {
        const { free, freeMeta, facts, ...story } = psychometric.storyRecall
        psychometric.storyRecall = story
    }
    if (psychometric.digitSpan) {
        const { pending, ...span } = psychometric.digitSpan
        psychometric.digitSpan = { ...span, trials: (span.trials || []).map(({ correct, ...trial }) => trial) }
    }
    if (psychometric.reasoning) {
        // the seed rebuilds every item WITH its answer, so it never leaves the server either
        const { seed, pending, responses, ...reasoning } = psychometric.reasoning
        psychometric.reasoning = { ...reasoning, answered: (responses || []).length }
    }
    if (psychometric.wordRecall) {
        // the seed rebuilds the lists, and the marked trials say which words they held
        const { seed, pending, trials, ...words } = psychometric.wordRecall
        psychometric.wordRecall = { ...words, written: (trials || []).length }
    }
    delete psychometric.history

    return { ...submission, psychometric }
}

router.get("/getMySubmission", authMiddleware, requireDiscovery, async (req, res) => {
    try {
        const submission = await Submission.findOne({ user: req.user._id }).lean()  // ← filter by logged in user

        return res.status(200).json({
            success: true,
            message: "Submission fetched successfully",
            data: forStudent(submission),
        })

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to fetch submission",
            error: error.message,
        })
    }
})

module.exports = router
