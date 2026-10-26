// PAYOUT ROWS AND AUTOMATIC TIER 2 (owner, Round 34). Called when a student's feedback arrives (or the
// admin records a student no-show): one "due" payout row at the mentor's tier and region that day, then
// the mentor's standing is worked out again — and 7 sessions at 8/10 or more moves them to Tier 2.
//
// Never throws to its caller: a feedback that was saved must not fail because a payout row could not
// be written. A failure is logged loudly for the admin to fix by hand.

const Mentor = require("../model/mentorsModel")
const MentorPayout = require("../model/mentorPayoutsModel")
const SessionReview = require("../model/sessionReviewsModel")
const MentorReport = require("../model/mentorReportsModel")
const MentorReview = require("../model/mentorReviewsModel")
const User = require("../model/userModel")
const { payoutAmount, regionOf, tierOf, statsOf, tier2Due, tier3Missing } = require("./mentorTiers")
const { notifyStudent } = require("./statusEmails")
const { notifyAdmin, escapeHtml } = require("./mailer")

// how a mentor stands today — the numbers behind the tier rules
const standingOf = async (mentorUserId) => {
    const [reviews, upheldReports, dataReview] = await Promise.all([
        SessionReview.find({ mentor: mentorUserId }).select("rating").lean(),
        MentorReport.countDocuments({ mentor: mentorUserId, upheld: true }),
        MentorReview.findOne({ mentor: mentorUserId }).select("items roadmap submittedAt").lean(),
    ])
    const stats = statsOf(reviews)
    const roadmapSteps = dataReview && Array.isArray(dataReview.roadmap) ? dataReview.roadmap.length : 0
    const dataReviewed = Boolean(dataReview && dataReview.submittedAt && (dataReview.items || []).length > 0)
    return { ...stats, upheldReports, roadmapSteps, dataReviewed }
}

// 1 → 2 by itself; told to the mentor and the admin
const refreshTier = async (mentorUserId) => {
    const mentor = await Mentor.findOne({ user: mentorUserId })
    if (!mentor) return null
    const standing = await standingOf(mentorUserId)
    if (tier2Due(mentor, standing, standing.upheldReports)) {
        mentor.tier = 2
        mentor.tierHistory.push({ tier: 2, at: new Date(), by: "auto" })
        await mentor.save()
        const user = await User.findById(mentorUserId).select("email").lean()
        notifyStudent(user, "mentorTierUp", { tier: 2 })
        notifyAdmin(`${mentor.name} moved to Tier 2`, `<p>${escapeHtml(mentor.name)} reached ${standing.sessions} sessions with an average of ${standing.average}/10 and is now Tier 2.</p>`)
    }
    return { mentor, standing, tier3Missing: tier3Missing(mentor, standing, standing) }
}

// the payout for one session. kind "main"; the first one a mentor ever earns waits for the admin's
// "keep this mentor" (it is still paid either way).
const writeSessionPayout = async ({ row, sessionIndex, rating = null, note = "" }) => {
    try {
        const session = (row.sessions || [])[sessionIndex]
        const mentorUserId = session ? session.mentor : null
        if (!mentorUserId) return null
        const mentor = await Mentor.findOne({ user: mentorUserId }).lean()
        if (!mentor) return null
        const earlier = await MentorPayout.countDocuments({ mentor: mentorUserId, kind: "main" })
        const amount = payoutAmount(mentor, "main")
        const payout = await MentorPayout.create({
            mentor: mentorUserId,
            mentorName: mentor.name,
            student: row.user,
            waitlist: row._id,
            sessionIndex,
            kind: "main",
            tier: tierOf(mentor),
            region: regionOf(mentor),
            amountInr: amount.inr,
            amountUsd: amount.usd || null,
            rating,
            needsApproval: earlier === 0 && mentor.firstSessionApproved === null,
            note,
        })
        return payout
    } catch (error) {
        if (error.code === 11000) return null   // already written for this session
        console.error(`MENTOR PAYOUT NOT WRITTEN for waitlist ${row && row._id} session ${sessionIndex}: ${error.message}`)
        return null
    }
}

module.exports = { standingOf, refreshTier, writeSessionPayout }
