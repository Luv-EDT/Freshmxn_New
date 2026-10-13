const Submission = require("../model/submissionsModel")

// OPENING A TEST AGAIN — one place for the admin's "Allow one retake", a retake the student accepts
// from an offer to everyone (Round 29), and a new short story. The earlier attempt moves to
// psychometric.history (kept for audit, never scored) and the test unlocks.
const reopenModule = async (userId, module, issueId = null) => {
    const submission = await Submission.findOne({ user: userId }).lean()
    const psychometric = (submission && submission.psychometric) || {}
    const attempt = psychometric[module]

    const set = {
        [`psychometric.retakeGranted.${module}`]: { at: new Date(), issue: issueId },
        lastSavedAt: new Date(),
    }
    const unset = { [`psychometric.${module}`]: "", [`psychometric.retakeOffers.${module}`]: "" }

    // the SART's diagnostics belong to the run they describe
    if (module === "sartRaw") {
        unset["psychometric.sartMeta"] = ""
        unset["psychometric.sartRunOpenedAt"] = ""   // the retake starts with no run left open
    }

    const update = { $set: set, $unset: unset }
    if (attempt !== undefined) {
        update.$push = {
            [`psychometric.history.${module}`]: {
                attempt,
                meta: module === "sartRaw" ? psychometric.sartMeta || null : null,
                replacedAt: new Date(),
                issue: issueId,
            },
        }
    }

    await Submission.updateOne({ user: userId }, update, { upsert: true })
    return submission
}

module.exports = { reopenModule }
