const express = require("express")
const User = require("../model/userModel")
const Mentor = require("../model/mentorsModel")
const MentorPayout = require("../model/mentorPayoutsModel")
const authMiddleware = require("../middlewares/authMiddleware")
const adminAuthMiddleware = require("../middlewares/adminAuthMiddleware")
const mentorAuthMiddleware = require("../middlewares/mentorAuthMiddleware")
const { payoutAmount, regionOf, tierOf } = require("../utils/mentorTiers")
const { notifyStudent } = require("../utils/statusEmails")

const router = express.Router()

// WHAT WE OWE MENTORS (owner, Round 34). Mounted at /mentorPayouts. Record-only for now: the admin pays
// outside the app and presses "Mark paid" with the reference; the mentor sees each row on their
// Payouts tab. The rows are written when a student's feedback arrives (utils/mentorPayouts.js).

const clean = (value, max) => (typeof value === "string" ? value.trim().slice(0, max) : "")


// ========================
// The mentor's own
// ========================

router.get("/getMine", authMiddleware, mentorAuthMiddleware, async (req, res) => {
    try {
        const payouts = await MentorPayout.find({ mentor: req.user._id, status: { $ne: "cancelled" } })
            .select("kind tier region amountInr amountUsd status paidAt reference createdAt")
            .sort({ createdAt: -1 })
            .lean()
        return res.status(200).json({ success: true, message: "Your payouts", data: payouts })

    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to load your payouts", error: error.message })
    }
})


// ========================
// Admin
// ========================

router.get("/getAllForAdmin", authMiddleware, adminAuthMiddleware, async (req, res) => {
    try {
        const payouts = await MentorPayout.find().sort({ status: 1, createdAt: -1 }).populate("student", "name email").lean()
        // how to pay each mentor — admin-only, like the rest of the payout details
        const mentors = new Map((await Mentor.find({ user: { $in: [...new Set(payouts.map((payout) => String(payout.mentor)))] } }).select("user payout firstSessionApproved status").lean())
            .map((mentor) => [String(mentor.user), mentor]))
        const data = payouts.map((payout) => {
            const mentor = mentors.get(String(payout.mentor)) || {}
            return { ...payout, payTo: mentor.payout || null, mentorStatus: mentor.status || null, firstSessionApproved: mentor.firstSessionApproved ?? null }
        })
        return res.status(200).json({ success: true, message: "Mentor payouts", data })

    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to load payouts", error: error.message })
    }
})

router.put("/markPaidForAdmin/:id", authMiddleware, adminAuthMiddleware, async (req, res) => {
    try {
        const reference = clean(req.body.reference, 120)
        if (reference.length < 3) {
            return res.status(400).json({ success: false, message: "Please add the payment reference (UPI ref, bank UTR, Wise id…)" })
        }
        const payout = await MentorPayout.findOneAndUpdate(
            { _id: req.params.id, status: "due" },
            { $set: { status: "paid", reference, paidAt: new Date(), paidBy: req.user._id } },
            { returnDocument: "after" }
        )
        if (!payout) {
            return res.status(400).json({ success: false, message: "Only a due payout can be marked paid" })
        }
        notifyStudent(await User.findById(payout.mentor).select("email").lean(), "mentorPaid", { amountInr: payout.amountInr, amountUsd: payout.amountUsd, reference })
        return res.status(200).json({ success: true, message: "Marked paid — the mentor has been told", data: payout })

    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to mark paid", error: error.message })
    }
})

// AFTER A MENTOR'S FIRST SESSION: keep them, or remove them (never offered again). The first session is
// paid either way.
router.put("/decideFirstSessionForAdmin/:id", authMiddleware, adminAuthMiddleware, async (req, res) => {
    try {
        const payout = await MentorPayout.findById(req.params.id)
        if (!payout || !payout.needsApproval) {
            return res.status(400).json({ success: false, message: "This payout isn't a first session" })
        }
        const keep = req.body.keep === true
        await Mentor.updateOne({ user: payout.mentor }, { $set: keep ? { firstSessionApproved: true } : { firstSessionApproved: false, status: "removed" } })
        payout.needsApproval = false
        payout.note = keep ? "first session — mentor kept" : "first session — mentor removed"
        await payout.save()
        return res.status(200).json({ success: true, message: keep ? "Kept — they'll be offered to students again" : "Removed — they won't be matched again (this session is still paid)" })

    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to save", error: error.message })
    }
})

// A LATER FOLLOW-UP (owner, Round 34): coordinated on WhatsApp; it pays 30% of the mentor's main rate
router.post("/addFollowUpForAdmin", authMiddleware, adminAuthMiddleware, async (req, res) => {
    try {
        const mentor = await Mentor.findOne({ user: req.body.mentorUserId, status: "onboarded" }).lean()
        if (!mentor) {
            return res.status(400).json({ success: false, message: "Pick an approved mentor" })
        }
        const student = req.body.studentEmail ? await User.findOne({ email: String(req.body.studentEmail).trim().toLowerCase(), role: "student" }).select("_id").lean() : null
        const amount = payoutAmount(mentor, "followup")
        const payout = await MentorPayout.create({
            mentor: mentor.user,
            mentorName: mentor.name,
            student: student ? student._id : null,
            kind: "followup",
            tier: tierOf(mentor),
            region: regionOf(mentor),
            amountInr: amount.inr,
            amountUsd: amount.usd || null,
            note: clean(req.body.note, 300),
        })
        return res.status(201).json({ success: true, message: `Follow-up added — ₹${amount.inr} due`, data: payout })

    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to add the follow-up", error: error.message })
    }
})

module.exports = router
