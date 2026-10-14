// WHEN WE IMPROVE MATCHING OR SCORING, EVERY STUDENT IS TOLD (owner, Round 29). On start, the server
// compares the versions it runs with the last ones announced (AppSetting "announced_versions"). If
// either moved, each student whose report was built on an older version gets a notification and an
// email (a reminder under the daily cap) that a free update is waiting. The first start after this
// round only records the versions — nobody is told about changes from before it.
//
// AND WHEN WE CHANGE A TEST (owner, Round 31). The same check covers the one-attempt tests
// (assessment/testVersions.js): a test whose version moved is offered again to everyone who took the
// older one — queued as the "retake_offer" housekeeping job, which tells them and makes their next
// update free.
const AppSetting = require("../model/appSettingsModel")

const KEY = "announced_versions"

const versionsChanged = (announced, current) => Boolean(announced) && (announced.matching !== current.matching || announced.scoring !== current.scoring)

const announceVersionChanges = async () => {
    try {
        const { MATCHING_VERSION } = require("../matching/matchProfile")
        const { SCORING_VERSION } = require("../scoring/scoreProfile")
        const { TEST_VERSIONS, testsChanged, currentTestVersions } = require("../assessment/testVersions")
        const current = { matching: MATCHING_VERSION, scoring: SCORING_VERSION, tests: currentTestVersions() }
        const row = await AppSetting.findOne({ key: KEY }).lean()
        const announced = row && row.value

        await AppSetting.updateOne({ key: KEY }, { $set: { value: current } }, { upsert: true })

        // a changed test is offered again to those who took the older one (not on a brand-new database)
        const offered = announced ? testsChanged(announced.tests) : []
        for (const module of offered) {
            const { MODULE_NAMES } = require("../Routers/assessmentIssuesRouter")
            await require("../workers/housekeepingWorker").runNow("retake_offer", { module, reason: TEST_VERSIONS[module].reason, testName: MODULE_NAMES[module] || module, olderOnly: true })
        }
        if (offered.length) console.log(`version notices: tests changed — ${offered.join(", ")} offered again`)

        if (!versionsChanged(announced, current)) return { announced: 0, offered }

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
        return { announced: told, offered }
    } catch (error) {
        console.error(`version notices failed: ${error.message}`)
        return { failed: error.message }
    }
}

module.exports = { announceVersionChanges, versionsChanged }
