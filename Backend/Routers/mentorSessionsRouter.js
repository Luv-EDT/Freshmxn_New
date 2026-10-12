const express = require("express")
const User = require("../model/userModel")
const Mentor = require("../model/mentorsModel")
const MentorWaitlist = require("../model/mentorWaitlistModel")
const SessionReview = require("../model/sessionReviewsModel")
const MentorReport = require("../model/mentorReportsModel")
const authMiddleware = require("../middlewares/authMiddleware")
const adminAuthMiddleware = require("../middlewares/adminAuthMiddleware")
const mentorAuthMiddleware = require("../middlewares/mentorAuthMiddleware")
const { notifyStudent } = require("../utils/statusEmails")
const { notifyAdmin, escapeHtml } = require("../utils/mailer")
const { PRIVACY_RULES, inviteFacts } = require("../utils/mentorInvite")

const router = express.Router()

// WHAT HAPPENS AROUND A MENTOR SESSION (owner, Round 28). Mounted at /mentorSessions — the pages are
// /mentor and /mentorship/..., so no API prefix equals a page URL.
//
//   match (mentorWaitlistRouter) → the mentor is emailed the invite, the admin sends it on WhatsApp
//   → the mentor accepts our privacy rules on their page and only then sees how to reach the student
//   → they send their booking (Calendly) link and say so here → the session → the admin marks it done
//   → the student's review opens. At any point the student can report their mentor.

const cleanText = (value, max) => (typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : "")
const FRESH_MATCH_STEPS = { whatsappInviteAt: null, mentorPrivacyAcceptedAt: null, bookingLinkSentAt: null }


// ========================
// The mentor's side
// ========================

// The students matched with this mentor. The contact the student agreed to share appears only on a
// current match whose privacy rules the mentor has accepted — never before, never after it ends.
router.get("/getMyStudents", authMiddleware, mentorAuthMiddleware, async (req, res) => {
    try {
        const rows = await MentorWaitlist.find({ assignedMentor: req.user._id, matchStatus: { $in: ["matched", "completed"] } })
            .sort({ matchedAt: -1 })
            .lean()
        const students = new Map((await User.find({ _id: { $in: rows.map((row) => row.user) } }).select("name email phone").lean()).map((user) => [String(user._id), user]))

        const data = rows.map((row) => {
            const student = students.get(String(row.user)) || {}
            const current = row.matchStatus === "matched"
            const showContact = current && Boolean(row.mentorPrivacyAcceptedAt)
            return {
                id: row._id,
                ...inviteFacts(row, student),
                matchedAt: row.matchedAt,
                status: current ? "current" : "done",
                privacyAccepted: Boolean(row.mentorPrivacyAcceptedAt),
                bookingLinkSent: Boolean(row.bookingLinkSentAt),
                contact: showContact
                    ? { via: row.contactVia, value: row.contactVia === "email" ? student.email : student.phone }
                    : null,
            }
        })

        return res.status(200).json({ success: true, message: "Your students", data: { students: data, privacyRules: PRIVACY_RULES } })

    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to load your students", error: error.message })
    }
})

// the mentor's own current match, or nothing
const myCurrentMatch = (req) => MentorWaitlist.findOne({ _id: req.params.id, assignedMentor: req.user._id, matchStatus: "matched" })

router.put("/acceptPrivacy/:id", authMiddleware, mentorAuthMiddleware, async (req, res) => {
    try {
        const row = await myCurrentMatch(req)
        if (!row) {
            return res.status(404).json({ success: false, message: "This student isn't matched with you" })
        }

        if (req.body.accept !== true) {
            return res.status(400).json({ success: false, message: "Please tick that you'll keep the student's details private" })
        }

        row.mentorPrivacyAcceptedAt = row.mentorPrivacyAcceptedAt || new Date()
        await row.save()

        return res.status(200).json({ success: true, message: "Thank you — you can now see how to reach the student", data: { privacyAccepted: true } })

    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to save", error: error.message })
    }
})

router.put("/markBookingLinkSent/:id", authMiddleware, mentorAuthMiddleware, async (req, res) => {
    try {
        const row = await myCurrentMatch(req)
        if (!row) {
            return res.status(404).json({ success: false, message: "This student isn't matched with you" })
        }

        if (!row.mentorPrivacyAcceptedAt) {
            return res.status(400).json({ success: false, message: "Accept the privacy rules first" })
        }

        row.bookingLinkSentAt = row.bookingLinkSentAt || new Date()
        await row.save()

        return res.status(200).json({ success: true, message: "Thanks — we've noted that the student has your booking link", data: { bookingLinkSent: true } })

    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to save", error: error.message })
    }
})


// ========================
// The student's side
// ========================

// the session a review is owed for: the latest logged one, if it has none yet
const reviewState = async (row) => {
    if (!row) return { state: "none" }
    const sessions = row.sessions || []
    const lastIndex = sessions.length - 1
    if (lastIndex >= 0 && !(await SessionReview.exists({ waitlist: row._id, sessionIndex: lastIndex }))) {
        const session = sessions[lastIndex]
        return { state: "open", sessionIndex: lastIndex, session: { profession: session.profession, jobRole: session.jobRole, mentorName: session.mentorName } }
    }
    if (row.matchStatus === "matched") return { state: "waiting" }
    return { state: sessions.length > 0 ? "done" : "none" }
}

router.get("/getMine", authMiddleware, async (req, res) => {
    try {
        const row = await MentorWaitlist.findOne({ user: req.user._id }).lean()
        const openReport = await MentorReport.findOne({ user: req.user._id, status: "open" }).select("reason wants createdAt").lean()

        return res.status(200).json({
            success: true,
            message: "Your mentor sessions",
            data: {
                review: await reviewState(row),
                openReport,
                canReport: Boolean(row && row.assignedMentor && ["matched", "completed"].includes(row.matchStatus)),
            },
        })

    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to load", error: error.message })
    }
})

const HELPED = ["yes", "somewhat", "no"]

router.post("/saveMyReview", authMiddleware, async (req, res) => {
    try {
        const row = await MentorWaitlist.findOne({ user: req.user._id }).lean()
        const owed = await reviewState(row)

        if (owed.state !== "open") {
            return res.status(400).json({
                success: false,
                message: owed.state === "waiting" ? "Your review opens once we've marked your session done" : "There's no session waiting for a review",
            })
        }

        const rating = Number(req.body.rating)
        const { helpedDecide, wouldRecommend } = req.body
        if (!Number.isInteger(rating) || rating < 1 || rating > 10 || !HELPED.includes(helpedDecide) || !["yes", "no"].includes(wouldRecommend)) {
            return res.status(400).json({ success: false, message: "Please give a rating from 1 to 10 and answer both questions" })
        }

        const session = row.sessions[owed.sessionIndex]
        const review = await SessionReview.create({
            user: req.user._id,
            waitlist: row._id,
            sessionIndex: owed.sessionIndex,
            mentor: session.mentor,
            mentorName: session.mentorName,
            profession: session.profession,
            jobRole: session.jobRole,
            rating,
            helpedDecide,
            wouldRecommend,
            comment: cleanText(req.body.comment, 600),
        })

        return res.status(201).json({ success: true, message: "Thank you for your review", data: { rating: review.rating } })

    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ success: false, message: "You've already reviewed this session" })
        }
        return res.status(500).json({ success: false, message: "Failed to save your review", error: error.message })
    }
})

router.post("/reportMentor", authMiddleware, async (req, res) => {
    try {
        const row = await MentorWaitlist.findOne({ user: req.user._id }).lean()

        if (!row || !row.assignedMentor || !["matched", "completed"].includes(row.matchStatus)) {
            return res.status(400).json({ success: false, message: "You don't have a mentor to report" })
        }

        if (await MentorReport.exists({ user: req.user._id, status: "open" })) {
            return res.status(400).json({ success: false, message: "We already have your report and will come back to you within 2 working days" })
        }

        const { reason, wants } = req.body
        const note = cleanText(req.body.note, 600)
        if (!MentorReport.REASONS.includes(reason) || !["refund", "new_mentor"].includes(wants)) {
            return res.status(400).json({ success: false, message: "Please choose what happened and what you'd like us to do" })
        }
        if (reason === "other" && note.length < 3) {
            return res.status(400).json({ success: false, message: "Please tell us what happened" })
        }

        const mentor = await Mentor.findOne({ user: row.assignedMentor }).select("name").lean()
        const report = await MentorReport.create({
            user: req.user._id,
            waitlist: row._id,
            mentor: row.assignedMentor,
            mentorName: mentor ? mentor.name : null,
            reason,
            note,
            wants,
        })

        notifyStudent(req.user, "mentorReportReceived")
        notifyAdmin("A student reported their mentor", `<p>${escapeHtml(req.user.email)} reported ${escapeHtml(report.mentorName || "their mentor")} — ${escapeHtml(reason)}. They want: ${wants === "refund" ? "a refund" : "another mentor"}.</p><p>${escapeHtml(note)}</p><p>Admin → Mentor feedback.</p>`)

        return res.status(201).json({
            success: true,
            message: "Thank you for telling us. Please block your mentor's number on WhatsApp now. We'll come back to you within 2 working days.",
            data: { wants: report.wants },
        })

    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to send your report", error: error.message })
    }
})


// ========================
// Admin
// ========================

// the admin pressed "Send invite on WhatsApp" — the button opens WhatsApp with the invite typed in
router.put("/markWhatsappInviteForAdmin/:userId", authMiddleware, adminAuthMiddleware, async (req, res) => {
    try {
        const row = await MentorWaitlist.findOneAndUpdate(
            { user: req.params.userId, matchStatus: "matched" },
            { $set: { whatsappInviteAt: new Date() } },
            { returnDocument: "after" }
        )
        if (!row) {
            return res.status(404).json({ success: false, message: "No current match for this student" })
        }
        return res.status(200).json({ success: true, message: "Noted — invite sent on WhatsApp", data: { whatsappInviteAt: row.whatsappInviteAt } })

    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to save", error: error.message })
    }
})

router.get("/getFeedbackForAdmin", authMiddleware, adminAuthMiddleware, async (req, res) => {
    try {
        const reviews = await SessionReview.find().sort({ createdAt: -1 }).populate("user", "name email").lean()
        const reports = await MentorReport.find().sort({ status: -1, createdAt: -1 }).populate("user", "name email").lean()

        // each mentor's average rating, from every review they have
        const byMentor = new Map()
        reviews.forEach((review) => {
            const key = String(review.mentor)
            const held = byMentor.get(key) || { mentor: review.mentor, mentorName: review.mentorName, count: 0, total: 0, recommend: 0 }
            held.count += 1
            held.total += review.rating
            held.recommend += review.wouldRecommend === "yes" ? 1 : 0
            byMentor.set(key, held)
        })
        const averages = [...byMentor.values()].map((held) => ({ ...held, average: Math.round((held.total / held.count) * 10) / 10 }))

        return res.status(200).json({ success: true, message: "Mentor feedback", data: { reviews, reports, averages } })

    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to load feedback", error: error.message })
    }
})

const OUTCOMES = ["new_mentor", "refund", "no_action"]

router.put("/resolveReportForAdmin/:id", authMiddleware, adminAuthMiddleware, async (req, res) => {
    try {
        const report = await MentorReport.findById(req.params.id)
        if (!report) {
            return res.status(404).json({ success: false, message: "Report not found" })
        }
        if (report.status !== "open") {
            return res.status(400).json({ success: false, message: "This report has already been handled" })
        }

        const { outcome } = req.body
        if (!OUTCOMES.includes(outcome)) {
            return res.status(400).json({ success: false, message: "Choose what to do" })
        }

        // another mentor, free: back to matching on a new clock, the reported mentor kept away for good
        if (outcome === "new_mentor") {
            await MentorWaitlist.updateOne(
                { user: report.user },
                {
                    $set: { matchStatus: "matching", choiceSentAt: new Date(), sameFieldNewMentor: true, resolution: null, adminNote: "Reported their mentor — find a DIFFERENT one", ...FRESH_MATCH_STEPS },
                    $unset: { assignedMentor: "", matchedAt: "" },
                    $addToSet: { excludedMentors: report.mentor },
                }
            )
        }

        if (req.body.pauseMentor === true) {
            await Mentor.updateOne({ user: report.mentor }, { $set: { status: "paused" } })
            report.mentorPaused = true
        }

        report.status = "resolved"
        report.outcome = outcome
        report.adminNote = cleanText(req.body.adminNote, 500)
        report.handledAt = new Date()
        await report.save()

        notifyStudent(await User.findById(report.user).select("email").lean(), "mentorReportResolved", { outcome, note: report.adminNote })

        return res.status(200).json({
            success: true,
            message: outcome === "refund"
                ? "Resolved — now issue the refund from the student's payments (the student has been emailed)"
                : "Resolved — the student has been emailed",
            data: report,
        })

    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to resolve the report", error: error.message })
    }
})

module.exports = router
module.exports.reviewState = reviewState
