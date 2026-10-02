const crypto = require("crypto")
const Report = require("../model/reportsModel")
const User = require("../model/userModel")
const FollowUp = require("../model/followUpsModel")
const { sendEmail, escapeHtml } = require("../utils/mailer")

// THE MONTHLY FOLLOW-UP SCAN (Round 10; monthly and re-anchored in Round 11) — run by the housekeeping
// worker on the 1st of each month (IST).
//
// THE CLOCK is the student's own: User.followUpAnchorAt, set at their first submit and moved only
// when they say they are heading somewhere new (utils/direction.js). A report rebuilt for any other
// reason never moves it. Students from before Round 11 have no clock yet and count from the
// submission their report was built from, then from the report's date.
//
// For each wave (6 and 12 months), every student whose clock turned that old in the last
// CATCH_UP_DAYS and who has not had that wave on that clock gets one email with a link. One reminder,
// at the next run, if they have not answered. Nothing more: two emails per wave is the most a
// student should get from a follow-up they did not ask for, and they can opt out from the link.
//
// The catch-up window is longer than a month, so a monthly run — or one missed while the free server
// slept — never skips anyone, and it never reaches back to students whose six months passed long ago.
const WAVES = [6, 12]
const CATCH_UP_DAYS = 45
const REMINDER_AFTER_DAYS = 7
const LINK_VALID_DAYS = 60
const DAY = 24 * 60 * 60 * 1000

const monthsBefore = (date, months) => {
    const copy = new Date(date)
    copy.setMonth(copy.getMonth() - months)
    return copy
}

const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex")

const linkFor = (token) => `${process.env.FRONTEND_URL}/follow-up/${token}`

const emailFor = (user, wave, token, reminder) => ({
    to: user.email,
    subject: reminder ? "A quick reminder — how is it going?" : `${wave} months on — how is it going?`,
    html: `<p>Hi ${escapeHtml(user.name)},</p>
           <p>${reminder ? "Just a reminder: " : ""}it has been ${wave} months since your Freshmxn report. Four short questions — about a minute — on
           what you are doing now and whether the report helped.</p>
           <p><a href="${linkFor(token)}">${linkFor(token)}</a></p>
           <p>Your answers help us check whether our matches actually work, so the next student gets better advice. They are never shared,
           and you can stop these emails from the same link.</p>`,
})

// Every student whose clock started inside the window, as { userId, anchorAt }.
const dueAnchors = async (after, before) => {
    const window = { $gt: after, $lte: before }
    const users = await User.find({ followUpAnchorAt: window }).select("followUpAnchorAt").lean()
    const anchored = users.map((user) => ({ userId: user._id, anchorAt: user.followUpAnchorAt }))

    // before Round 11 there was no clock: count from the submission the report was built from, or
    // the report's own date — only for students who still have no clock of their own
    const reports = await Report.find({ $or: [{ sourceSubmittedAt: window }, { sourceSubmittedAt: null, generatedAt: window }] }).select("user sourceSubmittedAt generatedAt").lean()
    const withClock = new Set((await User.find({ _id: { $in: reports.map((report) => report.user) }, followUpAnchorAt: { $ne: null } }).select("_id").lean()).map((user) => String(user._id)))
    const legacy = reports
        .filter((report) => !withClock.has(String(report.user)))
        .map((report) => ({ userId: report.user, anchorAt: report.sourceSubmittedAt || report.generatedAt }))

    return [...anchored, ...legacy]
}

// The Round 10 index allowed one follow-up per wave per student, ever. Dropped once so a new clock
// can be asked again; harmless if it was never built.
let oldIndexDropped = false
const dropOldIndex = async () => {
    if (oldIndexDropped) return
    oldIndexDropped = true
    try {
        await FollowUp.collection.dropIndex("user_1_wave_1")
        console.log("followUpScan: dropped the old one-per-wave index")
    } catch (error) {
        // not there — nothing to do
    }
}

const runFollowUpScan = async (now = new Date()) => {
    await dropOldIndex()
    const counts = { sent: 0, reminded: 0, skipped: 0 }

    for (const wave of WAVES) {
        const reportedBefore = monthsBefore(now, wave)
        const reportedAfter = new Date(reportedBefore.getTime() - CATCH_UP_DAYS * DAY)

        for (const { userId, anchorAt } of await dueAnchors(reportedAfter, reportedBefore)) {
            const already = await FollowUp.exists({ user: userId, wave, anchorAt })
            if (already) continue

            const user = await User.findById(userId).select("name email followUpOptOut").lean()
            if (!user || user.followUpOptOut || !user.email) {
                counts.skipped += 1
                continue
            }

            const token = crypto.randomBytes(24).toString("hex")
            try {
                await FollowUp.create({ user: user._id, wave, anchorAt, tokenHash: hashToken(token), expiresAt: new Date(now.getTime() + LINK_VALID_DAYS * DAY), sentAt: now })
            } catch (error) {
                continue    // a second scan raced this one to the same student — theirs stands
            }
            await sendEmail(emailFor(user, wave, token, false))
            counts.sent += 1
        }
    }

    // ONE reminder, after a week, for anyone who has not answered. A new token, because the first is
    // only ever known as its hash.
    const due = await FollowUp.find({
        respondedAt: null,
        reminderSentAt: null,
        sentAt: { $lte: new Date(now.getTime() - REMINDER_AFTER_DAYS * DAY) },
        expiresAt: { $gt: now },
    })

    for (const followUp of due) {
        const user = await User.findById(followUp.user).select("name email followUpOptOut").lean()
        if (!user || user.followUpOptOut) continue
        const token = crypto.randomBytes(24).toString("hex")
        followUp.tokenHash = hashToken(token)
        followUp.reminderSentAt = now
        await followUp.save()
        await sendEmail(emailFor(user, followUp.wave, token, true))
        counts.reminded += 1
    }

    return counts
}

module.exports = { runFollowUpScan, hashToken, dueAnchors, WAVES, CATCH_UP_DAYS }
