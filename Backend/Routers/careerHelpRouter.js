const express = require("express")
const CareerHelp = require("../model/careerHelpModel")
const { WANTS } = require("../model/careerHelpModel")
const Recommendation = require("../model/recommendationsModel")
const MentorWaitlist = require("../model/mentorWaitlistModel")
const authMiddleware = require("../middlewares/authMiddleware")
const requirePaid = require("../middlewares/requirePaid")
const adminAuthMiddleware = require("../middlewares/adminAuthMiddleware")
const { POLICY_VERSION } = require("./userRouter")

const router = express.Router()

// "HOW ELSE CAN WE HELP?" (owner, Round 25) — the one waitlist behind the box on the dashboard and on
// /mentorship/choose: a starter skill kit, internships/jobs/fellowships, a master's or settling abroad,
// anything else. Mounted at /careerHelp; no page lives at that URL.

const OTHER_MAX = 300
const CAREER_CHOICES = 20

// the career it is for must be the student's own: one of their matches, or the career they chose for a mentor
const careerFor = async (userId, careerId) => {
    if (!careerId) return { careerId: null, careerName: "" }
    const recommendation = await Recommendation.findOne({ user: userId }).select("ranked_professions").lean()
    const ranked = recommendation ? recommendation.ranked_professions || [] : []
    const match = ranked.find((entry) => String(entry.professionId) === String(careerId))
    if (match) return { careerId: String(match.professionId), careerName: match.profession }
    const waitlist = await MentorWaitlist.findOne({ user: userId }).select("chosenProfessionId chosenProfessionName").lean()
    if (waitlist && String(waitlist.chosenProfessionId) === String(careerId)) return { careerId: String(careerId), careerName: waitlist.chosenProfessionName }
    return null
}


// ========================
// The student's own
// ========================

// the row, plus the student's top matches for "For which career?" (names from the server)
router.get("/getMine", authMiddleware, requirePaid, async (req, res) => {
    try {
        const [row, recommendation] = await Promise.all([
            CareerHelp.findOne({ user: req.user._id }).select("careerId careerName wants otherText consentAt").lean(),
            Recommendation.findOne({ user: req.user._id }).select("ranked_professions").lean(),
        ])
        const careers = (recommendation ? recommendation.ranked_professions || [] : [])
            .slice(0, CAREER_CHOICES)
            .map((entry) => ({ id: String(entry.professionId), name: entry.profession }))

        return res.status(200).json({ success: true, message: "Fetched", data: { row: row || null, careers } })

    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to fetch", error: error.message })
    }
})

router.put("/saveMine", authMiddleware, requirePaid, async (req, res) => {
    try {
        if (req.body.consent !== true) {
            return res.status(400).json({ success: false, message: "Please tick the box so we can contact you" })
        }

        const wants = Array.isArray(req.body.wants) ? [...new Set(req.body.wants.filter((want) => WANTS.includes(want)))] : []
        if (wants.length === 0) {
            return res.status(400).json({ success: false, message: "Pick at least one thing we can help with" })
        }

        const otherText = wants.includes("other") ? String(req.body.otherText || "").trim().slice(0, OTHER_MAX) : ""
        if (wants.includes("other") && !otherText) {
            return res.status(400).json({ success: false, message: "Tell us what else we can help with" })
        }

        const career = await careerFor(req.user._id, req.body.careerId)
        if (!career) {
            return res.status(400).json({ success: false, message: "That career isn't one of yours" })
        }

        const row = await CareerHelp.findOneAndUpdate(
            { user: req.user._id },
            { ...career, wants, otherText, planTier: req.user.currentTier || null, consentAt: new Date(), policyVersion: POLICY_VERSION },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        ).lean()

        return res.status(200).json({
            success: true,
            message: "You're on the waitlist — we'll call you",
            data: { careerId: row.careerId, careerName: row.careerName, wants: row.wants, otherText: row.otherText, consentAt: row.consentAt },
        })

    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to save", error: error.message })
    }
})


// ========================
// Admin
// ========================

router.get("/getAllForAdmin", authMiddleware, adminAuthMiddleware, async (req, res) => {
    try {
        const rows = await CareerHelp.find({}).sort({ createdAt: -1 }).populate("user", "name email phone").lean()

        return res.status(200).json({ success: true, message: "Fetched", data: rows })

    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to fetch", error: error.message })
    }
})

router.put("/updateForAdmin/:id", authMiddleware, adminAuthMiddleware, async (req, res) => {
    try {
        const update = {}
        if (["new", "called", "closed"].includes(req.body.status)) update.status = req.body.status
        if (typeof req.body.adminNote === "string") update.adminNote = req.body.adminNote.slice(0, 1000)

        const row = await CareerHelp.findByIdAndUpdate(req.params.id, update, { new: true }).lean()
        if (!row) {
            return res.status(404).json({ success: false, message: "Not found" })
        }

        return res.status(200).json({ success: true, message: "Saved", data: row })

    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to save", error: error.message })
    }
})

module.exports = router
