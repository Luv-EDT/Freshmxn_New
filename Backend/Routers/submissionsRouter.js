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
