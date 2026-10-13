// WHEN WE IMPROVE MATCHING OR SCORING, EVERY STUDENT IS TOLD (owner, Round 29). On start, the server
// compares the versions it runs with the last ones announced (AppSetting "announced_versions"). If
// either moved, each student whose report was built on an older version gets a notification and an
// email (a reminder under the daily cap) that a free update is waiting. The first start after this
// round only records the versions — nobody is told about changes from before it.
const AppSetting = require("../model/appSettingsModel")

const KEY = "announced_versions"

const versionsChanged = (announced, current) => Boolean(announced) && (announced.matching !== current.matching || announced.scoring !== current.scoring)

const announceVersionChanges = async () => {
    try {
        const { MATCHING_VERSION } = require("../matching/matchProfile")
        const { SCORING_VERSION } = require("../scoring/scoreProfile")
        const current = { matching: MATCHING_VERSION, scoring: SCORING_VERSION }
        const row = await AppSetting.findOne({ key: KEY }).lean()
        const announced = row && row.value

        await AppSetting.updateOne({ key: KEY }, { $set: { value: current } }, { upsert: true })
        if (!versionsChanged(announced, current)) return { announced: 0 }

        const Recommendation = require("../model/recommendationsModel")
        const User = require("../model/userModel")
        const { notifyStudent } = require("./statusEmails")
        const stale = await Recommendation.find({ $or: [{ matching_version: { $ne: current.matching } }, { scoring_version: { $ne: current.scoring } }] }).select("user").lean()
        let told = 0
        for (const row of stale) {
            const user = await User.findById(row.user).select("email").lean()
            if (user) {
                await notifyStudent(user, "systemUpdate")
                told += 1
            }
        }
        console.log(`version notices: ${JSON.stringify(announced)} → ${JSON.stringify(current)}, ${told} students told`)
        return { announced: told }
    } catch (error) {
        console.error(`version notices failed: ${error.message}`)
        return { failed: error.message }
    }
}

module.exports = { announceVersionChanges, versionsChanged }
