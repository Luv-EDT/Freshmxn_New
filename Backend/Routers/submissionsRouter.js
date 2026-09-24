const express = require("express")
const Submission = require("../model/submissionsModel")
const User = require("../model/userModel")
const authMiddleware = require("../middlewares/authMiddleware")
const requirePaid = require("../middlewares/requirePaid")

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
router.post("/saveInterest", authMiddleware, requirePaid, async (req, res) => {
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

        // interest is a Mixed field — always $set the whole object, never .push() + .save()
        const updatedSubmission = await Submission.findOneAndUpdate(
            { user: req.user._id },
            { $set: changes },
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
const MODULE_KEYS = ["ipip50", "mi", "rosenberg", "confidence", "perspective", "digitSpan", "sartRaw", "sartMeta", "extReasoning", "extVerbal", "storyRecall"]

router.post("/savePsychometric", authMiddleware, requirePaid, async (req, res) => {
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

        const updatedSubmission = await Submission.findOneAndUpdate(
            { user: req.user._id },
            { $set: { [`psychometric.${module}`]: block, lastSavedAt: new Date() } },
            { returnDocument: "after", upsert: true }
        )

        if (req.user.progress.psychometric === "not_started") {
            await User.findByIdAndUpdate(req.user._id, { "progress.psychometric": "in_progress" })
        }

        return res.status(200).json({
            success: true,
            message: "Progress saved",
            data: { module, savedAt: updatedSubmission.lastSavedAt },
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

router.post("/digitSpanNext", authMiddleware, requirePaid, async (req, res) => {
    try {
        const submission = await Submission.findOne({ user: req.user._id })
        const block = (submission && submission.psychometric && submission.psychometric.digitSpan) || {}
        const trials = block.trials || []

        const length = nextTrialFor(trials)

        if (length === null) {
            return res.status(200).json({ success: true, message: "Digit span complete", data: { done: true, trials: trials.length } })
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

router.post("/digitSpanAnswer", authMiddleware, requirePaid, async (req, res) => {
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
// Submit the assessment — starts the pipeline
// ========================

// SAFE TO CALL TWICE. The job id is the user id, so a student who double-taps, or retries after a
// dropped connection, gets one job rather than two racing writes to the same profile. That matters
// more than it sounds: the answers are already saved by /savePsychometric, so a failed enqueue
// loses nothing and retrying this endpoint is always the right move.
router.post("/submitPsychometric", authMiddleware, requirePaid, async (req, res) => {
    try {
        const submission = await Submission.findOne({ user: req.user._id })

        if (!submission || !submission.psychometric || Object.keys(submission.psychometric).length === 0) {
            return res.status(400).json({
                success: false,
                message: "No assessment answers to submit",
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

        await User.findByIdAndUpdate(req.user._id, { "progress.psychometric": "done" })

        // Required here rather than at the top of the file: the queue is built lazily, and a
        // machine with no REDIS_URL must still be able to load this router and serve every other
        // route on it.
        const { enqueueScoreProfile } = require("../workers/scoreProfileWorker")
        await enqueueScoreProfile(req.user._id)

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

router.get("/getMySubmission", authMiddleware, requirePaid, async (req, res) => {
    try {
        const submission = await Submission.findOne({ user: req.user._id })  // ← filter by logged in user

        return res.status(200).json({
            success: true,
            message: "Submission fetched successfully",
            data: submission,
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
