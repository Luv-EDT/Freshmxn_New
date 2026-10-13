const AppSetting = require("../model/appSettingsModel")

// THE DAILY EMAIL CAP (owner, Round 29). Resend's free plan sends 100 emails a day and 3,000 a month.
// Every email we send is counted per day (AppSetting "email:YYYY-MM-DD"). Above EMAIL_DAILY_CAP
// (default 90) only REMINDERS are held back — their notification still appears on the student's
// Profile. Anything a student is waiting on (a code, a payment, a retake, a mentor) always goes.
// Move to Resend's paid plan once there are more than ~20 students a day (DEPLOY.md).

const REMINDERS = ["storyOpened", "storyFiveMinutes", "storyRecallOpen", "storyRecallClosing", "systemUpdate", "assessmentRetakeOffer"]

const dailyCap = () => Number(process.env.EMAIL_DAILY_CAP) || 90

const todayKey = (now = new Date()) => `email:${now.toISOString().slice(0, 10)}`

const sentToday = async () => {
    const row = await AppSetting.findOne({ key: todayKey() }).lean()
    return (row && row.value) || 0
}

// may this email go? (counts it when it may)
const mayEmail = async (kind) => {
    try {
        if (REMINDERS.includes(kind) && (await sentToday()) >= dailyCap()) return false
        await AppSetting.updateOne({ key: todayKey() }, { $inc: { value: 1 } }, { upsert: true })
        return true
    } catch (error) {
        return true   // counting must never stop an email
    }
}

module.exports = { mayEmail, sentToday, dailyCap, REMINDERS, todayKey }
