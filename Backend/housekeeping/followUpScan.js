const crypto = require("crypto")
const Report = require("../model/reportsModel")
const User = require("../model/userModel")
const FollowUp = require("../model/followUpsModel")
const { sendEmail, escapeHtml } = require("../utils/mailer")

// THE DAILY FOLLOW-UP SCAN (Round 10) — run by the housekeeping worker every morning (IST).
//
// For each wave (6 and 12 months), every student whose FIRST report turned that old in the last
// CATCH_UP_DAYS and who has not had that wave yet gets one email with a link. A week later, one
// reminder if they have not answered. Nothing more: two emails per wave is the most a student
// should get from a follow-up they did not ask for, and they can opt out from the link.
//
// The catch-up window means a scan missed while the free server slept is made up the next morning,
// without ever reaching back to students whose six months passed long ago.
const WAVES = [6, 12]
const CATCH_UP_DAYS = 30
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

const runFollowUpScan = async (now = new Date()) => {
    const counts = { sent: 0, reminded: 0, skipped: 0 }

    for (const wave of WAVES) {
        const reportedBefore = monthsBefore(now, wave)
        const reportedAfter = new Date(reportedBefore.getTime() - CATCH_UP_DAYS * DAY)

        const reports = await Report.find({ generatedAt: { $gt: reportedAfter, $lte: reportedBefore } }).select("user").lean()

        for (const report of reports) {
            const already = await FollowUp.exists({ user: report.user, wave })
            if (already) continue

            const user = await User.findById(report.user).select("name email followUpOptOut").lean()
            if (!user || user.followUpOptOut || !user.email) {
                counts.skipped += 1
                continue
            }

            const token = crypto.randomBytes(24).toString("hex")
            try {
                await FollowUp.create({ user: user._id, wave, tokenHash: hashToken(token), expiresAt: new Date(now.getTime() + LINK_VALID_DAYS * DAY), sentAt: now })
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

module.exports = { runFollowUpScan, hashToken, WAVES, CATCH_UP_DAYS }
