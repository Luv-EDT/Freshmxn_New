const express = require("express")
const DemoSession = require("../model/demoSessionsModel")
const Submission = require("../model/submissionsModel")
const User = require("../model/userModel")
const authMiddleware = require("../middlewares/authMiddleware")
const requireDiscovery = require("../middlewares/requireDiscovery")
const { OPENNESS_ITEMS, keyOf } = require("../demo/runDemo")

// RESUME, DON'T RESTART (owner, Round 32). A visitor who did the demo and then registered and bought
// Career Discovery carries their demo ANSWERS into the real flow — never a demo-grade score.
//
// EVERY WRITE HAPPENS HERE, ON THE REAL SIDE: a logged-in, paid account (authMiddleware +
// requireDiscovery), keyed on req.user._id, writing only that account's own submission. The /demo routes
// never touch a Submission. The demo is linked by the account's VERIFIED email; the student sees what
// would be carried and chooses (Carry them forward / Start fresh). Either way the demo rows are then
// deleted.
//
// ONLY WHAT IS STILL EMPTY IS FILLED:
//   · the two interest answers → the real Virtual Career Counselling form: the life stage for their
//     journey gets each thing (under the reason they gave for why it stuck, or as an interest of their
//     own), "what still feels like you" is pre-ticked WITHOUT a confidence — they finish it — and the
//     profession they named goes into aspirations;
//   · the eight Openness answers → the same eight items of the real IPIP-50 (they answer the other 44);
//   · the six reasoning answers → puzzles 1-6 of the real reasoning test, under the same seed, so the real
//     test serves puzzles 7-16 and the real scorer scores all sixteen with its own clocks and checks.
//     Carried only from the email's FIRST finished demo (owner: no best-of-several), and only when the
//     real test hasn't been started or retaken.
const router = express.Router()

const STAGE_FOR = { class9_10: "highSchool", class11_12: "highSchool", college: "college", early_professional: "postCollege" }
const WHEN_WORDS = { past: "I loved it when I was younger", present: "I enjoy it now", future: "I'd love to do this one day" }

const linkedSessions = async (user) => {
    if (!user.isEmailVerified || !user.email) return []
    return DemoSession.find({ email: String(user.email).toLowerCase(), status: "done" }).sort({ createdAt: 1 }).lean()
}

const stageFor = (user) => {
    if (user.journey === "college" && user.journeyDetail && user.journeyDetail.collegeStage === "pre_admission") return "highSchool"
    return STAGE_FOR[user.journey] || "highSchool"
}

// what the real form stores (interestFormState.buildSubmissionInterest), from the demo's two answers
const interestFrom = (interests, stage) => {
    const groups = { curiosityDriven: [], personalGrowth: [], socialRecognition: [], effortlessEngagement: [] }
    const additionalInterests = []
    const stuckBy = new Map((interests.stuck || []).map((row) => [keyOf(row.text), row]))

    ;(interests.draws || []).forEach((draw) => {
        const stuck = stuckBy.get(keyOf(draw.text))
        const reasons = stuck ? (stuck.reasons || []).filter((reason) => groups[reason]) : []
        if (reasons.length > 0) reasons.forEach((reason) => groups[reason].push(draw.text))
        else additionalInterests.push({ activity: draw.text, reason: (stuck && stuck.why) || WHEN_WORDS[draw.when] || "" })
    })

    const aspiration = interests.aspiration && interests.aspiration.text ? interests.aspiration : null
    return {
        [stage]: { ...groups, additionalInterests },
        currentInterests: {
            // pre-ticked, no confidence: the form asks for it before they move on
            persistentInterests: (interests.draws || []).map((draw) => ({ activity: keyOf(draw.text), confidence: "", source: "activity" })),
            longTermPursuits: (interests.stuck || []).map((row) => keyOf(row.text)),
            passion: [],
            discontinuedPursuits: [],
            achievementRelated: [],
        },
        aspirationalProfessions: aspiration ? [{ professionText: aspiration.text, professionId: aspiration.professionId || null }] : [],
    }
}

// what can still be filled for this student, and from which demo
const planFor = (user, submission, sessions) => {
    const latest = sessions[sessions.length - 1]
    const first = sessions[0]
    const psychometric = (submission && submission.psychometric) || {}
    const interestEmpty = (!submission || !submission.interest || Object.keys(submission.interest).length === 0) && (user.progress || {}).interestForm !== "done"
    const opennessEmpty = !psychometric.ipip50 && Boolean(latest.openness)
    const reasoningEmpty = !psychometric.reasoning && !((psychometric.history || {}).reasoning || []).length
        && Boolean(first.reasoning && (first.reasoning.responses || []).length > 0)
    return { latest, first, interestEmpty, opennessEmpty, reasoningEmpty }
}

router.get("/getMine", authMiddleware, requireDiscovery, async (req, res) => {
    try {
        const sessions = await linkedSessions(req.user)
        if (sessions.length === 0) {
            return res.status(200).json({ success: true, message: "No demo to carry forward", data: null })
        }
        const submission = await Submission.findOne({ user: req.user._id }).select("interest psychometric.ipip50 psychometric.reasoning psychometric.history").lean()
        const plan = planFor(req.user, submission, sessions)
        if (!plan.interestEmpty && !plan.opennessEmpty && !plan.reasoningEmpty) {
            return res.status(200).json({ success: true, message: "Nothing left to carry forward", data: null })
        }

        return res.status(200).json({
            success: true,
            message: "A demo to carry forward",
            data: {
                at: plan.latest.createdAt,
                things: (plan.latest.interests.draws || []).map((draw) => draw.text),
                aspiration: plan.latest.interests.aspiration ? plan.latest.interests.aspiration.text : null,
                carries: {
                    interests: plan.interestEmpty,
                    openness: plan.opennessEmpty,
                    reasoning: plan.reasoningEmpty ? (plan.first.reasoning.responses || []).length : 0,
                },
            },
        })

    } catch (error) {
        return res.status(500).json({ success: false, message: "Could not check for a demo", error: error.message })
    }
})

router.post("/import", authMiddleware, requireDiscovery, async (req, res) => {
    try {
        const sessions = await linkedSessions(req.user)
        if (sessions.length === 0) {
            return res.status(404).json({ success: false, message: "No demo to carry forward" })
        }
        const submission = await Submission.findOne({ user: req.user._id }).lean()
        const plan = planFor(req.user, submission, sessions)

        const set = {}
        const carried = []
        if (plan.interestEmpty) {
            set.interest = interestFrom(plan.latest.interests || {}, stageFor(req.user))
            carried.push("interests")
        }
        if (plan.opennessEmpty) {
            const answers = {}
            OPENNESS_ITEMS.forEach((id) => { if (plan.latest.openness[id]) answers[id] = plan.latest.openness[id] })
            set["psychometric.ipip50"] = { answers }
            carried.push("openness")
        }
        if (plan.reasoningEmpty) {
            // the real test's own block — seed, form, when it started, the answers so far, nothing open
            const block = plan.first.reasoning
            set["psychometric.reasoning"] = { seed: block.seed, form: "A", startedAt: block.startedAt || plan.first.createdAt, responses: block.responses, pending: null }
            carried.push("reasoning")
        }

        if (carried.length > 0) {
            set.lastSavedAt = new Date()
            await Submission.findOneAndUpdate({ user: req.user._id }, { $set: set }, { upsert: true })
            const progress = {}
            if (set.interest) progress["progress.interestForm"] = "in_progress"
            if ((set["psychometric.ipip50"] || set["psychometric.reasoning"]) && (req.user.progress || {}).psychometric === "not_started") progress["progress.psychometric"] = "in_progress"
            if (Object.keys(progress).length) await User.updateOne({ _id: req.user._id }, { $set: progress })
        }

        // carried (or nothing left to carry) — the demo rows go
        await DemoSession.deleteMany({ email: String(req.user.email).toLowerCase() })

        return res.status(200).json({ success: true, message: carried.length ? "Your demo answers are carried forward" : "Nothing left to carry forward", data: { carried } })

    } catch (error) {
        return res.status(500).json({ success: false, message: "Could not carry your demo forward", error: error.message })
    }
})

// "Start fresh" — nothing is carried, and the demo rows are deleted
router.post("/decline", authMiddleware, requireDiscovery, async (req, res) => {
    try {
        if (req.user.isEmailVerified && req.user.email) await DemoSession.deleteMany({ email: String(req.user.email).toLowerCase() })
        return res.status(200).json({ success: true, message: "Starting fresh", data: null })

    } catch (error) {
        return res.status(500).json({ success: false, message: "Could not clear your demo", error: error.message })
    }
})

module.exports = router
module.exports.interestFrom = interestFrom
module.exports.planFor = planFor
