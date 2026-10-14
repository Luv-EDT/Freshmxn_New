const Submission = require("../model/submissionsModel")
const User = require("../model/userModel")
const { notifyStudent } = require("../utils/statusEmails")

// "WE'VE IMPROVED A TEST — YOU CAN TAKE IT AGAIN" (owner, Round 29). Offered to everyone who took the
// test — by the admin, or automatically when its version moves (Round 31, `olderOnly`: only students
// whose attempt predates the new version, assessment/testVersions.js). Nothing is reset: each student
// sees the test first on their assessment page with the reason, and only if they choose it does the
// earlier attempt move aside (POST /submissions/acceptRetakeOffer) — kept until the new one is
// finished. A student who has already submitted gets their next update free at once (Round 31: the
// admin's Students tab shows it straight away). The emails count as reminders under the daily cap
// (utils/emailBudget.js); the notification always appears.
const runRetakeOffer = async ({ module, reason = "", testName = module, olderOnly = false } = {}) => {
    if (!module) return { skipped: "no test named" }
    const { TEST_VERSIONS } = require("../assessment/testVersions")
    const { grantFreeUpdate } = require("../utils/selfUpdates")
    const isCurrent = olderOnly && TEST_VERSIONS[module] ? TEST_VERSIONS[module].isCurrent : () => false

    const submissions = await Submission.find({ [`psychometric.${module}`]: { $exists: true } }).select(`user psychometricSubmittedAt psychometric.sartMeta psychometric.retakeOffers`).lean()
    let offered = 0
    for (const submission of submissions) {
        const psychometric = submission.psychometric || {}
        // already took the new version, or already offered it — nothing to tell
        if (isCurrent(psychometric) || (olderOnly && psychometric.retakeOffers && psychometric.retakeOffers[module])) continue
        await Submission.updateOne({ _id: submission._id }, { $set: { [`psychometric.retakeOffers.${module}`]: { reason: String(reason).slice(0, 300), at: new Date() } } })
        if (submission.psychometricSubmittedAt) await grantFreeUpdate(submission.user, `offer:${module}`)
        const user = await User.findById(submission.user).select("email").lean()
        if (user) {
            await notifyStudent(user, "assessmentRetakeOffer", { testName, reason })
            offered += 1
        }
    }
    return { module, offered }
}

module.exports = { runRetakeOffer }
