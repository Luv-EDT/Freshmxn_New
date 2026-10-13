const express = require("express")
const User = require("../model/userModel")
const Submission = require("../model/submissionsModel")
const AssessmentIssue = require("../model/assessmentIssuesModel")
const authMiddleware = require("../middlewares/authMiddleware")
const adminAuthMiddleware = require("../middlewares/adminAuthMiddleware")
const requireDiscovery = require("../middlewares/requireDiscovery")
const { raiseIssue } = require("../utils/assessmentIssues")
const { notifyStudent } = require("../utils/statusEmails")

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
// ========================
// Offer a retake to everyone (admin, Round 29)
// ========================

// "We've improved this test": everyone who took it may take it again, if they want to. Runs as a job,
// so a long list never holds the request and the emails go out within the daily cap.
router.post("/offerRetakeToAllForAdmin", authMiddleware, adminAuthMiddleware, async (req, res) => {
    try {
        const { module } = req.body
        const reason = typeof req.body.reason === "string" ? req.body.reason.trim().slice(0, 300) : ""
        if (!RETAKEABLE.includes(module)) {
            return res.status(400).json({ success: false, message: "Choose a test that can be retaken" })
        }
        if (reason.length < 5) {
            return res.status(400).json({ success: false, message: "Say what improved — the students are told" })
        }
        await require("../workers/housekeepingWorker").runNow("retake_offer", { module, reason, testName: MODULE_NAMES[module] })
        return res.status(202).json({ success: true, message: `Offering ${MODULE_NAMES[module]} again to everyone who took it — the students are told`, data: { module } })

    } catch (error) {
        return res.status(500).json({ success: false, message: "Could not offer the retake", error: error.message })
    }
})


// ========================
// SART run details (admin, Round 29)
// ========================

// What a focus run actually looked like, so the admin can tell a student pressing in a rhythm (many
// presses under 150 ms, most 3s pressed) from a device fault (dropped trials, a low refresh rate,
// interruptions). Read from the stored rows and the run's own meta; nothing is re-scored.
const sartRunDetails = (rawText, meta) => {
    const rows = String(rawText || "").trim().split(/\r?\n/)
        .map((line) => line.split(/\t|\s{2,}/))
        .filter((fields) => fields.length >= 7 && String(fields[0]).trim().toLowerCase() === "realtest")
        .map((fields) => ({ isGo: fields[2] === "1", correct: fields[5] === "1", rt: Number(fields[6]) }))
    const pressed = rows.filter((row) => (row.isGo ? row.correct : !row.correct))
    const bucket = (low, high) => pressed.filter((row) => row.rt >= low && row.rt < high).length
    const threes = rows.filter((row) => !row.isGo)
    return {
        trials: rows.length,
        presses: pressed.length,
        rtSpread: { under150: bucket(0, 150), from150to300: bucket(150, 300), from300to600: bucket(300, 600), over600: bucket(600, 10000) },
        threesPressed: `${threes.filter((row) => !row.correct).length} of ${threes.length}`,
        droppedTrials: meta && meta.sessionTiming ? meta.sessionTiming.droppedTrials : null,
        refreshHz: meta && meta.device ? meta.device.refreshHz : null,
        device: meta && meta.device ? (meta.device.isTouch ? "touch screen" : "keyboard / mouse") : null,
        input: meta && meta.presses ? meta.presses : null,   // recorded from Round 29
        interruptions: meta ? meta.interruptions || null : null,
    }
}

router.get("/getSartRunForAdmin/:userId", authMiddleware, adminAuthMiddleware, async (req, res) => {
    try {
        const submission = await Submission.findOne({ user: req.params.userId }).select("psychometric.sartRaw psychometric.sartMeta psychometric.history.sartRaw").lean()
        const psychometric = (submission && submission.psychometric) || {}
        const runs = [
            ...((psychometric.history && psychometric.history.sartRaw) || []).map((past) => ({ when: past.replacedAt, ...sartRunDetails(past.attempt, past.meta) })),
            ...(psychometric.sartRaw ? [{ when: psychometric.sartMeta && psychometric.sartMeta.completedAt, current: true, ...sartRunDetails(psychometric.sartRaw, psychometric.sartMeta) }] : []),
        ]
        return res.status(200).json({ success: true, message: "Run details", data: runs })

    } catch (error) {
        return res.status(500).json({ success: false, message: "Could not read the run", error: error.message })
    }
})


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
            notifyStudent(student, "reportRerun")
        } else {
            if (!RETAKEABLE.includes(issue.module)) {
                return res.status(400).json({ success: false, message: "This test cannot be retaken" })
            }

            const submission = await require("../utils/retakes").reopenModule(student._id, issue.module, issue._id)

            // Round 29 (owner): the reason in plain words, and a free update for after the retake when a
            // report already exists — a retake we asked for never costs one of the three
            const { retakeReasons } = require("../utils/sartReasons")
            await notifyStudent(student, "retakeGranted", { testName: MODULE_NAMES[issue.module] || issue.module, reasons: retakeReasons(issue) })
            if (submission && submission.psychometricSubmittedAt) {
                await require("../utils/selfUpdates").grantFreeUpdate(student._id, `retake:${issue.module}`)
            }
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

        // Round 28 (owner): a student who asked always hears back. Their request can only be turned
        // down with a reason, which is emailed to them; issues the system raised need none.
        const reason = typeof req.body.adminNote === "string" ? req.body.adminNote.trim().slice(0, 500) : ""
        const askedByStudent = issue.raisedBy === "student"
        if (askedByStudent && !reason) {
            return res.status(400).json({ success: false, message: "Please write the reason — the student is emailed it" })
        }

        issue.status = "dismissed"
        issue.handledByAdmin = req.user._id
        issue.handledAt = new Date()
        issue.adminNote = reason || issue.adminNote
        await issue.save()

        if (askedByStudent) {
            notifyStudent(await User.findById(issue.user).lean(), "retakeDeclined", { testName: MODULE_NAMES[issue.module] || issue.module, reason })
        }

        return res.status(200).json({ success: true, message: askedByStudent ? "Dismissed — the student has been emailed" : "Issue dismissed", data: issue })

    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to dismiss the issue", error: error.message })
    }
})

module.exports = router
module.exports.sartRunDetails = sartRunDetails
module.exports.RETAKEABLE = RETAKEABLE
module.exports.MODULE_NAMES = MODULE_NAMES
