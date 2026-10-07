const express = require("express")
const User = require("../model/userModel")
const Submission = require("../model/submissionsModel")
const AssessmentIssue = require("../model/assessmentIssuesModel")
const authMiddleware = require("../middlewares/authMiddleware")
const adminAuthMiddleware = require("../middlewares/adminAuthMiddleware")
const requireDiscovery = require("../middlewares/requireDiscovery")
const { raiseIssue } = require("../utils/assessmentIssues")
const { sendEmail, escapeHtml } = require("../utils/mailer")

const router = express.Router()

// TECHNICAL PROBLEMS WITH A STUDENT'S TEST, AND THE ONE WAY TO A RETAKE (owner, Round 10).
//
// The tests that measure performance are ONE ATTEMPT: a second go scores higher from practice alone
// (Hausknecht et al. 2007, about a quarter of a standard deviation), which would make results unequal
// between students who did and did not get one. So nobody retakes because they would like a better
// score. A retake exists for one reason — the attempt did not measure the student, because something
// broke — and a person decides that, here.
//
// The API prefix is /assessmentIssues; no page lives at that address, so a refresh cannot 404.

// The tests a retake can apply to. The questionnaires are editable until Submit, so they never need one.
const RETAKEABLE = ["sartRaw", "digitSpan", "storyRecall", "reasoning", "wordRecall", "extReasoning", "extVerbal"]
const MODULE_NAMES = {
    sartRaw: "Staying focused",
    digitSpan: "Remembering numbers",
    storyRecall: "A short story",
    reasoning: "Reasoning",
    extReasoning: "Reasoning test (other website)",
    wordRecall: "Word memory",
    extVerbal: "Word memory test (other website)",
    report: "Your report",
}


// ========================
// Report An Issue (student)
// ========================

router.post("/reportIssue", authMiddleware, requireDiscovery, async (req, res) => {
    try {
        const { module, note } = req.body

        if (!RETAKEABLE.includes(module)) {
            return res.status(400).json({ success: false, message: "Unknown test" })
        }

        const text = typeof note === "string" ? note.trim().slice(0, 1000) : ""

        const issue = await raiseIssue({
            user: req.user._id,
            module,
            kind: "student_reported",
            detail: text || "The student reported a problem without a note.",
            raisedBy: "student",
            notify: true,
        })

        return res.status(201).json({
            success: true,
            message: "Thanks — our team will look at it and get back to you",
            data: { issueId: issue ? issue._id : null },
        })

    } catch (error) {
        return res.status(500).json({ success: false, message: "Could not send your report", error: error.message })
    }
})


// ========================
// Get All Issues (admin)
// ========================

router.get("/getAllForAdmin", authMiddleware, adminAuthMiddleware, async (req, res) => {
    try {
        const issues = await AssessmentIssue.find()
            .sort({ status: 1, createdAt: -1 })
            .limit(500)
            .populate("user", "name email phone")
            .lean()

        const order = { open: 0, retake_granted: 1, resolved: 2, dismissed: 3 }
        issues.sort((left, right) => (order[left.status] ?? 9) - (order[right.status] ?? 9))

        // THE JOB QUEUE'S HEALTH (Round 22), shown above the issues: a report job due for minutes that
        // nothing has picked up means the workers are not running
        let queues = null
        try {
            const { jobQueue } = require("../workers/jobQueue")
            queues = await jobQueue().health(["score_profile", "generate_report", "housekeeping"])
        } catch (error) {
            queues = { error: error.message }
        }

        return res.status(200).json({
            success: true,
            message: "Assessment issues fetched successfully",
            data: {
                openCount: issues.filter((issue) => issue.status === "open").length,
                queues,
                issues: issues.map((issue) => ({ ...issue, moduleName: MODULE_NAMES[issue.module] || issue.module, retakeable: RETAKEABLE.includes(issue.module) })),
            },
        })

    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to fetch assessment issues", error: error.message })
    }
})


// ========================
// Grant A Retake (admin)
// ========================

// The earlier attempt is MOVED to psychometric.history, not deleted: kept for the record (and for
// anyone checking later what happened), never scored. The module's block is cleared, so the test
// opens fresh, and `retakeGranted` tells the student's page why. For a report failure the "retake"
// is running the pipeline again.
router.put("/grantRetakeForAdmin/:id", authMiddleware, adminAuthMiddleware, async (req, res) => {
    try {
        const issue = await AssessmentIssue.findById(req.params.id)

        if (!issue) {
            return res.status(404).json({ success: false, message: "Issue not found" })
        }

        if (issue.status !== "open") {
            return res.status(400).json({ success: false, message: "This issue has already been handled" })
        }

        const student = await User.findById(issue.user)

        if (!student) {
            return res.status(404).json({ success: false, message: "Student not found" })
        }

        if (issue.module === "report") {
            const { queueReport } = require("../workers/queueHelpers")
            await queueReport(student._id, "queueing the report")
            await User.updateOne({ _id: student._id }, { reportFailedAt: null })
        } else {
            if (!RETAKEABLE.includes(issue.module)) {
                return res.status(400).json({ success: false, message: "This test cannot be retaken" })
            }

            const submission = await Submission.findOne({ user: student._id }).lean()
            const psychometric = (submission && submission.psychometric) || {}
            const attempt = psychometric[issue.module]

            const set = {
                [`psychometric.retakeGranted.${issue.module}`]: { at: new Date(), issue: issue._id },
                lastSavedAt: new Date(),
            }
            const unset = { [`psychometric.${issue.module}`]: "" }

            // the SART's diagnostics belong to the run they describe
            if (issue.module === "sartRaw") {
                unset["psychometric.sartMeta"] = ""
                unset["psychometric.sartRunOpenedAt"] = ""   // the retake starts with no run left open
            }

            const update = { $set: set, $unset: unset }
            if (attempt !== undefined) {
                update.$push = {
                    [`psychometric.history.${issue.module}`]: {
                        attempt,
                        meta: issue.module === "sartRaw" ? psychometric.sartMeta || null : null,
                        replacedAt: new Date(),
                        issue: issue._id,
                    },
                }
            }

            await Submission.updateOne({ user: student._id }, update, { upsert: true })

            await sendEmail({
                to: student.email,
                subject: "You can take one of your Freshmxn tests again",
                html: `<p>Hi ${escapeHtml(student.name)},</p>
                       <p>Your earlier attempt at <strong>${escapeHtml(MODULE_NAMES[issue.module] || issue.module)}</strong> had a technical problem, so we have opened it again for you — one more attempt.</p>
                       <p>Open your assessment at <a href="${process.env.FRONTEND_URL}/assessment">${process.env.FRONTEND_URL}/assessment</a>, take the test, then press Submit again so your report is updated.</p>`,
            })
        }

        issue.status = issue.module === "report" ? "resolved" : "retake_granted"
        issue.handledByAdmin = req.user._id
        issue.handledAt = new Date()
        issue.adminNote = typeof req.body.adminNote === "string" ? req.body.adminNote.slice(0, 500) : issue.adminNote
        await issue.save()

        return res.status(200).json({
            success: true,
            message: issue.module === "report" ? "The report is being prepared again" : "Retake granted — the student has been emailed",
            data: issue,
        })

    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to grant the retake", error: error.message })
    }
})


// ========================
// Dismiss An Issue (admin)
// ========================

router.put("/dismissForAdmin/:id", authMiddleware, adminAuthMiddleware, async (req, res) => {
    try {
        const issue = await AssessmentIssue.findById(req.params.id)

        if (!issue) {
            return res.status(404).json({ success: false, message: "Issue not found" })
        }

        if (issue.status !== "open") {
            return res.status(400).json({ success: false, message: "This issue has already been handled" })
        }

        issue.status = "dismissed"
        issue.handledByAdmin = req.user._id
        issue.handledAt = new Date()
        issue.adminNote = typeof req.body.adminNote === "string" ? req.body.adminNote.slice(0, 500) : issue.adminNote
        await issue.save()

        return res.status(200).json({ success: true, message: "Issue dismissed", data: issue })

    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to dismiss the issue", error: error.message })
    }
})

module.exports = router
module.exports.RETAKEABLE = RETAKEABLE
