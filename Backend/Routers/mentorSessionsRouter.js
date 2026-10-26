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
const Submission = require("../model/submissionsModel")
const MentorPayout = require("../model/mentorPayoutsModel")
const { studentBrief } = require("../utils/studentBrief")
const { writeSessionPayout, refreshTier } = require("../utils/mentorPayouts")

const router = express.Router()

// WHAT HAPPENS AROUND A MENTOR SESSION (owner, Rounds 28 and 34). Mounted at /mentorSessions — the
// pages are /mentor and /mentorship/..., so no API prefix equals a page URL.
//
//   the admin asks the mentor to open Calendly slots → match (mentorWaitlistRouter): the student sees the
//   links and books; the mentor gets the student brief and has 2.5 days to prepare → the session → the
//   mentor tells the admin on WhatsApp → the admin presses "Session done" → the student's feedback form
//   opens → feedback in = ticket closed, payout due. Students and mentors never message each other to
//   arrange it, and the mentor reports nothing on the platform. At any point the student can report
//   their mentor: a refund, or a new mentor.

const cleanText = (value, max) => (typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : "")
const FRESH_MATCH_STEPS = { whatsappInviteAt: null, mentorPrivacyAcceptedAt: null, bookingLinkSentAt: null, mainSessionAt: null, sessionDoneAt: null, sessionsBookedAt: null, bookedMainAt: null, bookedFollowUpAt: null }

// what a report changes on the ticket — kept on the report so "by mistake" can put it back (Round 35)
const TICKET_FIELDS = "matchStatus resolution chosenProfessionId chosenProfessionName chosenJobRole jobRoleIsOther chosenIndustryCode otherRequest choiceSentAt helpWanted helpFocus languages assignedMentor matchedAt matchBusinessDays sameFieldNewMentor adminNote whatsappInviteAt mentorPrivacyAcceptedAt sessionDoneAt sessionsBookedAt bookedMainAt bookedFollowUpAt".split(" ")
const ticketSnapshot = (row) => Object.fromEntries(TICKET_FIELDS.map((field) => [field, row[field] === undefined ? null : row[field]]))


// ========================
// The mentor's side
// ========================

// The students matched with this mentor, each with the brief to prepare from. The contact the student
// agreed to share appears only on a current match whose privacy rules the mentor has accepted — never
// before, never after it ends.
router.get("/getMyStudents", authMiddleware, mentorAuthMiddleware, async (req, res) => {
    try {
        const rows = await MentorWaitlist.find({ $or: [{ assignedMentor: req.user._id }, { "sessions.mentor": req.user._id }] })
            .sort({ matchedAt: -1 })
            .lean()
        const ids = rows.map((row) => row.user)
        const [users, submissions] = await Promise.all([
            User.find({ _id: { $in: ids } }).select("name email phone journey journeyDetail").lean(),
            Submission.find({ user: { $in: ids } }).select("user interest psychometric.accommodations").lean(),
        ])
        const students = new Map(users.map((user) => [String(user._id), user]))
        const subs = new Map(submissions.map((submission) => [String(submission.user), submission]))
        const { degreeLabelFor } = require("./reportsRouter")

        const current = []
        const history = []
        rows.forEach((row) => {
            const student = students.get(String(row.user)) || {}
            const mine = String(row.assignedMentor) === String(req.user._id)
            if (mine && row.matchStatus === "matched") {
                const showContact = Boolean(row.mentorPrivacyAcceptedAt)
                current.push({
                    id: row._id,
                    ...inviteFacts(row, student),
                    languages: row.languages || [],
                    matchedAt: row.matchedAt,
                    prepareBy: row.matchedAt ? new Date(new Date(row.matchedAt).getTime() + 2.5 * 864e5) : null,
                    // Round 35: logged by the admin once the mentor tells us the student booked
                    bookedMainAt: row.bookedMainAt || null,
                    bookedFollowUpAt: row.bookedFollowUpAt || null,
                    brief: studentBrief(student, subs.get(String(row.user)), degreeLabelFor),
                    privacyAccepted: Boolean(row.mentorPrivacyAcceptedAt),
                    contact: showContact ? { via: row.contactVia, value: row.contactVia === "email" ? student.email : student.phone } : null,
                })
            }
            ;(row.sessions || []).forEach((session) => {
                if (String(session.mentor) !== String(req.user._id)) return
                history.push({
                    firstName: inviteFacts(row, student).firstName,
                    profession: session.profession,
                    jobRole: session.jobRole,
                    completedAt: session.completedAt,
                    noShow: session.noShow || null,
                })
            })
        })
        history.sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))

        return res.status(200).json({ success: true, message: "Your students", data: { current, history, privacyRules: PRIVACY_RULES } })

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

        return res.status(200).json({ success: true, message: "Thank you — you can now see the student's contact", data: { privacyAccepted: true } })

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
    const last = sessions[lastIndex]
    if (lastIndex >= 0 && !last.noShow && !(await SessionReview.exists({ waitlist: row._id, sessionIndex: lastIndex }))) {
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

// THE FEEDBACK FORM (owner, Round 34): did the mentor cover the five parts of the session, how were
// they, did they stay within limits, and a rating out of 10. Submitting says both sessions are over —
// it closes the ticket and makes the mentor's payout due. A "no" on limits, or anything written about
// their behaviour, reaches the admin by email at once.
const COVER_ANSWERS = ["yes", "partly", "no"]
const QUALITY_ANSWERS = ["yes", "somewhat", "no"]

const cleanFeedback = (body) => {
    if (body.bothDone !== true) return { error: "Please send this only once your session (and follow-up, if you booked one) is over" }
    const rating = Number(body.rating)
    if (!Number.isInteger(rating) || rating < 1 || rating > 10) return { error: "Please rate your mentor from 1 to 10" }
    const covered = {}
    for (const key of SessionReview.COVERED) {
        const answer = body.covered && body.covered[key]
        if (!COVER_ANSWERS.includes(answer)) return { error: "Please answer every \"Did your mentor cover…\" question" }
        covered[key] = answer
    }
    const qualities = {}
    for (const key of SessionReview.QUALITIES) {
        const answer = body.qualities && body.qualities[key]
        if (!QUALITY_ANSWERS.includes(answer)) return { error: "Please answer every \"How was your mentor?\" question" }
        qualities[key] = answer
    }
    if (!["yes", "no"].includes(body.withinLimits)) return { error: "Please tell us whether your mentor stayed within limits" }
    return { rating, covered, qualities, withinLimits: body.withinLimits, concern: cleanText(body.concern, 600) }
}

router.post("/saveMyReview", authMiddleware, async (req, res) => {
    try {
        const row = await MentorWaitlist.findOne({ user: req.user._id }).lean()
        const owed = await reviewState(row)

        if (owed.state !== "open") {
            return res.status(400).json({
                success: false,
                message: owed.state === "waiting" ? "Your feedback form opens once your mentor tells us the session is done" : "There's no session waiting for feedback",
            })
        }

        const feedback = cleanFeedback(req.body || {})
        if (feedback.error) {
            return res.status(400).json({ success: false, message: feedback.error })
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
            ...feedback,
        })

        await MentorWaitlist.updateOne({ _id: row._id }, { $push: { history: { at: new Date(), event: "feedback_in", by: "student", profession: session.profession, jobRole: session.jobRole, mentorName: session.mentorName } } })
        await writeSessionPayout({ row, sessionIndex: owed.sessionIndex, rating: feedback.rating })
        await refreshTier(session.mentor)

        if (feedback.withinLimits === "no" || feedback.concern) {
            notifyAdmin("A student flagged their mentor's behaviour", `<p>${escapeHtml(req.user.email)} about ${escapeHtml(session.mentorName || "their mentor")}: stayed within limits — <strong>${feedback.withinLimits}</strong>.</p><p>${escapeHtml(feedback.concern)}</p><p>Admin → Mentors → Session feedback.</p>`)
        }

        return res.status(201).json({ success: true, message: "Thank you — your feedback is in and your mentor ticket is closed", data: { rating: review.rating } })

    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ success: false, message: "You've already sent feedback for this session" })
        }
        return res.status(500).json({ success: false, message: "Failed to save your feedback", error: error.message })
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
            ticketBefore: { ...ticketSnapshot(row), excludedBefore: (row.excludedMentors || []).some((id) => String(id) === String(row.assignedMentor)) },
        })

        // THE TICKET CHANGES AT ONCE (owner, Round 34). A refund: the choice is cleared and kept in the
        // ticket's history, and the admin sends the money from the ticket ("Refund the mentor part"). A
        // new mentor: the same career and role, the reported mentor kept away, within 15 business days.
        const snapshot = { at: new Date(), by: "student", profession: row.chosenProfessionName || row.otherRequest || null, jobRole: row.chosenJobRole || null, mentorName: report.mentorName }
        let refundInr = null
        if (wants === "refund") {
            refundInr = (await require("./paymentsRouter").mentorPartOf(req.user, row)).amountInr
            await MentorWaitlist.updateOne(
                { _id: row._id },
                {
                    $set: { matchStatus: "closed", resolution: "refund_requested", ...FRESH_MATCH_STEPS },
                    $unset: { chosenProfessionId: "", chosenProfessionName: "", chosenJobRole: "", jobRoleIsOther: "", chosenIndustryCode: "", otherRequest: "", choiceSentAt: "", helpWanted: "", helpFocus: "", languages: "" },
                    $addToSet: { excludedMentors: row.assignedMentor },
                    $push: { history: { ...snapshot, event: "refund_requested", note: `₹${refundInr}` } },
                }
            )
        } else {
            await MentorWaitlist.updateOne(
                { _id: row._id },
                {
                    $set: { matchStatus: "matching", choiceSentAt: new Date(), matchBusinessDays: 15, sameFieldNewMentor: true, resolution: null, adminNote: "Reported their mentor — find a DIFFERENT one", ...FRESH_MATCH_STEPS },
                    $unset: { assignedMentor: "", matchedAt: "" },
                    $addToSet: { excludedMentors: row.assignedMentor },
                    $push: { history: { ...snapshot, event: "new_mentor", note: "after a report" } },
                }
            )
        }

        notifyStudent(req.user, "mentorReportReceived", { wants, refundInr })
        notifyAdmin("A student reported their mentor", `<p>${escapeHtml(req.user.email)} reported ${escapeHtml(report.mentorName || "their mentor")} — ${escapeHtml(reason)}. They want: ${wants === "refund" ? "a refund" : "another mentor"}.</p><p>${escapeHtml(note)}</p><p>Admin → Mentor feedback.</p>`)

        return res.status(201).json({
            success: true,
            message: wants === "refund"
                ? `Thank you for telling us. You'll get a refund of the mentor part (₹${Number(refundInr || 0).toLocaleString("en-IN")}).`
                : "Thank you for telling us — and sorry. We'll give you a new mentor within 15 business days.",
            data: { wants: report.wants, refundInr },
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
            held.recommend += review.wouldRecommend === "yes" || (review.qualities && review.qualities.recommend === "yes") ? 1 : 0
            byMentor.set(key, held)
        })
        const averages = [...byMentor.values()].map((held) => ({ ...held, average: Math.round((held.total / held.count) * 10) / 10 }))

        return res.status(200).json({ success: true, message: "Mentor feedback", data: { reviews, reports, averages } })

    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to load feedback", error: error.message })
    }
})

// THE ADMIN'S LOOK AT A REPORT (Round 34). The student's ticket already changed when they reported
// (a refund asked for, or a new mentor on the way), so this records the verdict: upheld means a strike
// on the mentor, no payout for that session, and no automatic Tier 2; the mentor can also be paused.
// A refund the student asked for is sent from the ticket ("Refund the mentor part").
router.put("/resolveReportForAdmin/:id", authMiddleware, adminAuthMiddleware, async (req, res) => {
    try {
        const report = await MentorReport.findById(req.params.id)
        if (!report) {
            return res.status(404).json({ success: false, message: "Report not found" })
        }
        if (report.status !== "open") {
            return res.status(400).json({ success: false, message: "This report has already been handled" })
        }

        // Round 35 (owner): THE REPORT WAS A MISTAKE — closed with nothing against the mentor, and the ticket
        // put back as it was if nothing has happened to it since (no refund sent, no new mentor matched)
        if (req.body.mistake === true) {
            const row = report.waitlist ? await MentorWaitlist.findById(report.waitlist).lean() : null
            const before = report.ticketBefore
            const untouched = row && before && (
                (report.wants === "refund" && row.matchStatus === "closed" && row.resolution === "refund_requested")
                || (report.wants === "new_mentor" && row.matchStatus === "matching" && !row.assignedMentor)
            )
            if (untouched) {
                const restore = Object.fromEntries(TICKET_FIELDS.map((field) => [field, before[field] === undefined ? null : before[field]]))
                await MentorWaitlist.updateOne(
                    { _id: row._id },
                    {
                        $set: restore,
                        ...(before.excludedBefore ? {} : { $pull: { excludedMentors: report.mentor } }),
                        $push: { history: { at: new Date(), event: "report_withdrawn", by: "admin", note: "the report was a mistake — ticket put back", profession: before.chosenProfessionName || null, jobRole: before.chosenJobRole || null, mentorName: report.mentorName } },
                    }
                )
            }
            report.status = "resolved"
            report.outcome = "mistake"
            report.upheld = false
            report.adminNote = cleanText(req.body.adminNote, 500)
            report.handledAt = new Date()
            await report.save()
            notifyStudent(await User.findById(report.user).select("email").lean(), "mentorReportResolved", { outcome: "mistake", note: report.adminNote })
            return res.status(200).json({
                success: true,
                message: untouched
                    ? "Closed as a mistake — nothing against the mentor, and the student's ticket is back as it was"
                    : "Closed as a mistake — nothing against the mentor. The ticket had already moved on (a refund sent or a new mentor matched), so it was left as it is",
                data: report,
            })
        }

        const upheld = req.body.upheld === true
        report.upheld = upheld
        if (upheld) {
            await Mentor.updateOne({ user: report.mentor }, { $push: { strikes: { at: new Date(), reason: `report upheld: ${report.reason}`, student: report.user } } })
            // nothing is paid for a session the report was about
            await MentorPayout.updateMany({ mentor: report.mentor, waitlist: report.waitlist, status: "due" }, { $set: { status: "cancelled", note: "report upheld" } })
        }

        if (req.body.pauseMentor === true) {
            await Mentor.updateOne({ user: report.mentor }, { $set: { status: "paused" } })
            report.mentorPaused = true
        }

        report.status = "resolved"
        report.outcome = report.wants
        report.adminNote = cleanText(req.body.adminNote, 500)
        report.handledAt = new Date()
        await report.save()

        notifyStudent(await User.findById(report.user).select("email").lean(), "mentorReportResolved", { outcome: report.wants, note: report.adminNote })

        return res.status(200).json({
            success: true,
            message: report.wants === "refund"
                ? "Recorded — send the refund from the student's ticket (Refund the mentor part). The student has been emailed."
                : "Recorded — the student is already back in matching. They have been emailed.",
            data: report,
        })

    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to resolve the report", error: error.message })
    }
})

module.exports = router
module.exports.reviewState = reviewState
module.exports.cleanFeedback = cleanFeedback
