const express = require("express")
const Submission = require("../model/submissionsModel")
const User = require("../model/userModel")
const Verification = require("../model/verificationsModel")
const authMiddleware = require("../middlewares/authMiddleware")
const requirePaid = require("../middlewares/requirePaid")
const { extractTestResult, createExtractionClient, INSTRUMENTS } = require("../workers/extractTestResult")

const router = express.Router()

// The two external tests — 04_Item_Bank.md §7. The student takes them on somebody else's website
// and brings back a screenshot; this reads the numbers off it.
//
// "ONE ATTEMPT ONLY" IS ABOUT THE TEST, NOT THE PHOTO. §7 and D1 say the student may not retake the
// reasoning or verbal test, and that rule is real: both have a fixed item set, and a second sitting
// measures how well the questions are remembered. It says nothing about the picture. A blurry
// photo, a cropped screenshot or a wrong page are all ordinary things that happen on a phone, and
// locking a student out of their own result because the first upload was out of focus would throw
// away a genuine measurement to enforce a rule that was never about uploading. So re-uploading is
// open until the student confirms the numbers, and shut afterwards.
//
// THE IMAGE IS NEVER STORED. It goes to the model, the numbers come out, and it is gone when the
// request ends. A screenshot of a test result belonging to a fifteen-year-old is personal data with
// no further use once the three integers are out of it, and the verification queue only needs the
// numbers and the student's own word on whether they are right.
//
// WHY THE STUDENT CONFIRMS. Range checks catch 140%. They cannot catch 71 when the screen said 17,
// and `extraction_confidence` is the model's opinion of its own reading, which is exactly the thing
// in doubt. The student is looking at the same screen the model was. That makes them the only check
// that can catch a plausible misread, so the flow shows the numbers back and asks.

// Anthropic accepts images up to 5 MB once base64-encoded. The browser downsizes before uploading,
// so anything near this ceiling means the resize did not run — reject it with a message that says
// what to do rather than letting the API return a wall of JSON.
const MAX_IMAGE_BYTES = 4_500_000
const ALLOWED_MEDIA = ["image/jpeg", "image/png", "image/webp", "image/gif"]

// express.json()'s own limit is raised in server.js for this route; this is the semantic limit.
const parseImage = (image, mediaType) => {
    if (typeof image !== "string" || image.trim() === "") {
        return { error: "No image was received" }
    }

    // Accepts either a bare base64 string or the data URL a canvas produces, because the browser
    // sends one and a retry from a script sends the other.
    const match = image.match(/^data:([^;]+);base64,(.*)$/)
    const media = (match ? match[1] : mediaType || "").toLowerCase()
    const data = match ? match[2] : image

    if (!ALLOWED_MEDIA.includes(media)) {
        return { error: "That file type is not supported — a JPEG or PNG screenshot works best" }
    }

    if (data.length > MAX_IMAGE_BYTES) {
        return { error: "That image is too large — take a screenshot rather than a photo of the screen, or crop it to the results" }
    }

    return { data, media, bytes: data.length }
}

const blockOf = (submission, moduleKey) => (submission && submission.psychometric && submission.psychometric[moduleKey]) || {}


// ========================
// What has been uploaded so far
// ========================

router.get("/externalState", authMiddleware, requirePaid, async (req, res) => {
    try {
        const submission = await Submission.findOne({ user: req.user._id })

        const state = {}

        Object.keys(INSTRUMENTS).forEach((moduleKey) => {
            const block = blockOf(submission, moduleKey)

            // The stored numbers go back to the student because they are the student's own numbers,
            // read off the student's own screen. `extraction_confidence` goes with them — it is the
            // model's opinion of its reading, not a judgement of the student, and hiding it would
            // make "please check this" look like an accusation rather than an admission.
            state[moduleKey] = {
                uploaded: Boolean(block.extractedAt),
                confirmed: Boolean(block.studentConfirmedAt),
                locked: Boolean(block.studentConfirmedAt),
                attempts: block.uploadAttempts || 0,
                values: block.extractedAt ? { ...block } : null,
            }
        })

        return res.status(200).json({ success: true, message: "External test state", data: state })

    } catch (error) {
        return res.status(500).json({ success: false, message: "Could not read your uploads", error: error.message })
    }
})


// ========================
// Upload a screenshot
// ========================

router.post("/uploadResult", authMiddleware, requirePaid, async (req, res) => {
    try {
        const { module: moduleKey, image, mediaType, secondsPerQuestion } = req.body

        if (!moduleKey || !INSTRUMENTS[moduleKey]) {
            return res.status(400).json({ success: false, message: "Unknown external test" })
        }

        const submission = await Submission.findOne({ user: req.user._id })
        const existing = blockOf(submission, moduleKey)

        if (existing.studentConfirmedAt) {
            return res.status(409).json({
                success: false,
                message: "You have already confirmed this result. It cannot be replaced.",
            })
        }

        const parsed = parseImage(image, mediaType)
        if (parsed.error) return res.status(400).json({ success: false, message: parsed.error })

        if (!process.env.ANTHROPIC_API_KEY) {
            return res.status(503).json({ success: false, message: "Result reading is unavailable right now — please try again shortly" })
        }

        const outcome = await extractTestResult({
            moduleKey,
            imageBase64: parsed.data,
            mediaType: parsed.media,
            typedSecondsPerQuestion: typeof secondsPerQuestion === "number" ? secondsPerQuestion : null,
            callLlm: createExtractionClient(),
        })

        // A REJECTED EXTRACTION IS NOT STORED. §7: "reject extraction, request re-upload". The
        // scorer has its own identical range guard, but relying on it would mean a number that
        // already failed one check sits on the submission waiting for a second one to catch it.
        if (!outcome.accepted) {
            if (outcome.queue) {
                await Verification.create({
                    user: req.user._id,
                    module: moduleKey,
                    instrument: INSTRUMENTS[moduleKey].instrument,
                    reason: outcome.queue,
                    extracted: outcome.extracted || {},
                    extraction_confidence: outcome.extracted ? outcome.extracted.extraction_confidence : null,
                    imageReceived: { bytes: parsed.bytes, mediaType: parsed.media },
                })
            }

            return res.status(422).json({
                success: false,
                message: outcome.problems[0] || "The numbers could not be read from that image",
                data: { problems: outcome.problems, retry: true },
            })
        }

        const stored = {
            ...outcome.block,
            extractedAt: new Date(),
            uploadAttempts: (existing.uploadAttempts || 0) + 1,
        }

        await Submission.findOneAndUpdate(
            { user: req.user._id },
            { $set: { [`psychometric.${moduleKey}`]: stored, lastSavedAt: new Date() } },
            { upsert: true }
        )

        if (outcome.queue) {
            await Verification.create({
                user: req.user._id,
                module: moduleKey,
                instrument: INSTRUMENTS[moduleKey].instrument,
                reason: outcome.queue,
                extracted: outcome.extracted || {},
                extraction_confidence: outcome.block.extraction_confidence === undefined ? null : outcome.block.extraction_confidence,
                imageReceived: { bytes: parsed.bytes, mediaType: parsed.media },
            })
        }

        if (req.user.progress.psychometric === "not_started") {
            await User.findByIdAndUpdate(req.user._id, { "progress.psychometric": "in_progress" })
        }

        return res.status(201).json({
            success: true,
            message: "Result read",
            data: { values: stored, problems: outcome.problems, needsReview: Boolean(outcome.queue) },
        })

    } catch (error) {
        return res.status(500).json({ success: false, message: "Could not read that screenshot", error: error.message })
    }
})


// ========================
// The student confirms — or disputes — what was read
// ========================

router.post("/confirmResult", authMiddleware, requirePaid, async (req, res) => {
    try {
        const { module: moduleKey, agrees } = req.body

        if (!moduleKey || !INSTRUMENTS[moduleKey]) {
            return res.status(400).json({ success: false, message: "Unknown external test" })
        }

        const submission = await Submission.findOne({ user: req.user._id })
        const existing = blockOf(submission, moduleKey)

        if (!existing.extractedAt) {
            return res.status(400).json({ success: false, message: "Nothing has been uploaded for this test yet" })
        }

        // DISAGREEING DOES NOT DELETE THE NUMBERS, it queues them. A student who says "that is not
        // my score" is usually right about a misread digit and occasionally wrong about which line
        // of the results page matters, and only a person looking at both can tell those apart.
        // Clearing the block instead would also hand anyone a way to erase a low score by pressing
        // "no", so the honest version is: it stays, it is flagged, and it is re-uploadable.
        if (agrees === false) {
            await Verification.create({
                user: req.user._id,
                module: moduleKey,
                instrument: INSTRUMENTS[moduleKey].instrument,
                reason: "student_disputed",
                extracted: { ...existing },
                extraction_confidence: existing.extraction_confidence === undefined ? null : existing.extraction_confidence,
                studentConfirmed: false,
            })

            return res.status(200).json({
                success: true,
                message: "Thanks — we will check it",
                data: { locked: false, disputed: true },
            })
        }

        await Submission.findOneAndUpdate(
            { user: req.user._id },
            { $set: { [`psychometric.${moduleKey}.studentConfirmedAt`]: new Date(), lastSavedAt: new Date() } }
        )

        return res.status(200).json({ success: true, message: "Confirmed", data: { locked: true, disputed: false } })

    } catch (error) {
        return res.status(500).json({ success: false, message: "Could not save your confirmation", error: error.message })
    }
})

module.exports = router
