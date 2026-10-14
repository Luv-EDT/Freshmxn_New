const Submission = require("../model/submissionsModel")

// OPENING A TEST AGAIN — one place for the admin's "Allow one retake", a retake the student accepts
// from an offer to everyone (Round 29), and a new short story. The earlier attempt moves to
// psychometric.history (kept for audit, never scored) and the test unlocks.
// `fromOffer` (Round 31): a retake the student chose from an offer — their earlier attempt is kept
// aside, and until the new one is finished they can put it back (POST /submissions/keepEarlierResult).
const reopenModule = async (userId, module, issueId = null, { fromOffer = false } = {}) => {
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
    // every new short story counts towards the three a student may have after the first (Round 29)
    if (module === "storyRecall") update.$inc = { "psychometric.storyRetakes": 1 }
    if (attempt !== undefined) {
        update.$push = {
            [`psychometric.history.${module}`]: {
                attempt,
                meta: module === "sartRaw" ? psychometric.sartMeta || null : null,
                replacedAt: new Date(),
                issue: issueId,
                fromOffer,
            },
        }
    }

    await Submission.updateOne({ user: userId }, update, { upsert: true })
    return submission
}

// a test's attempt is finished — the server's own stamp, as assessmentModules.isModuleComplete reads it
const attemptFinished = (module, block) => {
    if (!block) return false
    if (module === "sartRaw") return true
    if (module === "storyRecall") return Boolean(block.submittedAt)
    return Boolean(block.completedAt)
}

// the earlier attempt a student set aside from an offer, while the new one isn't finished (or null)
const keptEarlierFor = (psychometric, module) => {
    const list = ((psychometric && psychometric.history) || {})[module] || []
    const last = list[list.length - 1]
    return last && last.fromOffer && !attemptFinished(module, psychometric[module]) ? last : null
}

module.exports = { reopenModule, attemptFinished, keptEarlierFor }
