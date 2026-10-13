const Submission = require("../model/submissionsModel")
const User = require("../model/userModel")
const { notifyStudent } = require("../utils/statusEmails")

// "WE'VE IMPROVED A TEST — YOU CAN TAKE IT AGAIN" (owner, Round 29). The admin offers one test again
// to everyone who took it. Nothing is reset: each student sees "You can take this again" on their
// assessment page, with the reason, and only if they choose it does the earlier attempt move to
// history (POST /submissions/acceptRetakeOffer). The update afterwards is free. The emails count as
// reminders under the daily cap (utils/emailBudget.js); the notification always appears.
const runRetakeOffer = async ({ module, reason = "", testName = module } = {}) => {
    if (!module) return { skipped: "no test named" }

    const submissions = await Submission.find({ [`psychometric.${module}`]: { $exists: true } }).select("user").lean()
    let offered = 0
    for (const submission of submissions) {
        await Submission.updateOne({ _id: submission._id }, { $set: { [`psychometric.retakeOffers.${module}`]: { reason: String(reason).slice(0, 300), at: new Date() } } })
        const user = await User.findById(submission.user).select("email").lean()
        if (user) {
            await notifyStudent(user, "assessmentRetakeOffer", { testName, reason })
            offered += 1
        }
    }
    return { module, offered }
}

module.exports = { runRetakeOffer }
