const express = require("express")
const DemoSession = require("../model/demoSessionsModel")
const Submission = require("../model/submissionsModel")
const User = require("../model/userModel")
const authMiddleware = require("../middlewares/authMiddleware")
const requirePaid = require("../middlewares/requirePaid")
const { keyOf } = require("../demo/runDemo")
const { grants } = require("../utils/plans")

// RESUME, DON'T RESTART (owner, Rounds 32-33). A visitor who did the demo and then registered and paid
// carries what they TOLD us into the real flow — never anything the demo's short tasks measured.
//
// EVERY WRITE HAPPENS HERE, ON THE REAL SIDE: a logged-in, paid account (authMiddleware + requirePaid),
// keyed on req.user._id, writing only that account. The /demo routes never touch a Submission or a User.
// The demo is linked by the account's VERIFIED email; the student sees what would be carried and chooses
// (Carry them forward / Start fresh). Either way the demo rows are then deleted.
//
// ONLY WHAT IS STILL EMPTY IS FILLED:
//   · the story answers → the real Virtual Career Counselling form (Career Discovery plans only): the life
//     stage for their journey gets each thing (under the reason they gave for why it stuck, or as an
//     interest of their own), "what still feels like you" is pre-ticked WITHOUT a confidence — they finish
//     it — and the profession they named goes into aspirations;
//   · the demo's two careers → User.demoCareers (any plan), offered first when they choose their mentor's
//     field — "go straight to a mentor in one of these" (owner, Round 33).
// The demo's statements, puzzles and SART are never carried (owner, Round 33): one question per factor
// says too little to stand in for the real assessment.
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
    const groups = { curiosityDriven: [], personalGrowth: [], socialRecognition: [], effortlessEngagement: [], individualInternalProblems: [], interpersonalInternalProblems: [], externalProblems: [] }
    const additionalInterests = []
    const stuckBy = new Map((interests.stuck || []).map((row) => [keyOf(row.text), row]))

    ;(interests.draws || []).forEach((draw) => {
        const stuck = stuckBy.get(keyOf(draw.text))
        const reasons = stuck ? (stuck.reasons || []).filter((reason) => groups[reason]) : []
        // a problem it helps with is a row in the real form's shape (Round 33)
        if (reasons.length > 0) reasons.forEach((reason) => groups[reason].push(DemoSession.PROBLEM_KEYS.includes(reason) ? { problem: draw.text, source: "typed", activities: [draw.text] } : draw.text))
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

// the two careers a finished demo pointed to
const careersOf = (session) => ((session.result && session.result.careers) || [])
    .map(({ entry }) => entry && entry.professionId ? { professionId: entry.professionId, profession: entry.profession } : null)
    .filter(Boolean)

// what can still be filled for this student, from their latest finished demo
const planFor = (user, submission, sessions) => {
    const latest = sessions[sessions.length - 1]
    const interestEmpty = grants(Number(user.currentTier)).discovery
        && (!submission || !submission.interest || Object.keys(submission.interest).length === 0)
        && (user.progress || {}).interestForm !== "done"
    const careers = (user.demoCareers || []).length ? [] : careersOf(latest)
    return { latest, interestEmpty, careers }
}

router.get("/getMine", authMiddleware, requirePaid, async (req, res) => {
    try {
        const sessions = await linkedSessions(req.user)
        if (sessions.length === 0) {
            return res.status(200).json({ success: true, message: "No demo to carry forward", data: null })
        }
        const submission = await Submission.findOne({ user: req.user._id }).select("interest").lean()
        const plan = planFor(req.user, submission, sessions)
        if (!plan.interestEmpty && plan.careers.length === 0) {
            return res.status(200).json({ success: true, message: "Nothing left to carry forward", data: null })
        }

        return res.status(200).json({
            success: true,
            message: "A demo to carry forward",
            data: {
                at: plan.latest.createdAt,
                things: (plan.latest.interests.draws || []).map((draw) => draw.text),
                aspiration: plan.latest.interests.aspiration ? plan.latest.interests.aspiration.text : null,
                careers: plan.careers,
                carries: { interests: plan.interestEmpty, careers: plan.careers.length > 0 },
            },
        })

    } catch (error) {
        return res.status(500).json({ success: false, message: "Could not check for a demo", error: error.message })
    }
})

router.post("/import", authMiddleware, requirePaid, async (req, res) => {
    try {
        const sessions = await linkedSessions(req.user)
        if (sessions.length === 0) {
            return res.status(404).json({ success: false, message: "No demo to carry forward" })
        }
        const submission = await Submission.findOne({ user: req.user._id }).select("interest").lean()
        const plan = planFor(req.user, submission, sessions)

        const set = {}
        const carried = []
        if (plan.interestEmpty) {
            set.interest = interestFrom(plan.latest.interests || {}, stageFor(req.user))
            carried.push("interests")
        }
        if (carried.length > 0) {
            set.lastSavedAt = new Date()
            await Submission.findOneAndUpdate({ user: req.user._id }, { $set: set }, { upsert: true })
            await User.updateOne({ _id: req.user._id }, { $set: { "progress.interestForm": "in_progress" } })
        }
        if (plan.careers.length > 0) {
            await User.updateOne({ _id: req.user._id }, { $set: { demoCareers: plan.careers } })
            carried.push("careers")
        }

        // carried (or nothing left to carry) — the demo rows go
        await DemoSession.deleteMany({ email: String(req.user.email).toLowerCase() })

        return res.status(200).json({ success: true, message: carried.length ? "Your demo answers are carried forward" : "Nothing left to carry forward", data: { carried } })

    } catch (error) {
        return res.status(500).json({ success: false, message: "Could not carry your demo forward", error: error.message })
    }
})

// "Start fresh" — nothing is carried, and the demo rows are deleted
router.post("/decline", authMiddleware, requirePaid, async (req, res) => {
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
