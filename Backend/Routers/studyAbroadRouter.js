const express = require("express")
const StudyAbroadLead = require("../model/studyAbroadLeadsModel")
const Recommendation = require("../model/recommendationsModel")
const authMiddleware = require("../middlewares/authMiddleware")
const adminAuthMiddleware = require("../middlewares/adminAuthMiddleware")
const requirePaid = require("../middlewares/requirePaid")
const abroad = require("../data/abroad.json")
const { POLICY_VERSION } = require("./userRouter")

const router = express.Router()

// STUDYING ABROAD (owner, Round 11): not university data — only whether a career needs it
// (data/abroad.json), and, for a student who asks, a connection to a study-abroad partner.
// Nothing is shared without the consent box ticked; the admin passes leads on by hand.
//
// Mounted at /studyAbroad; the report lives at /report, so no page URL is shadowed.

const TOP_N = 10
const qualifies = (id) => Boolean(abroad.careers[id] && abroad.careers[id].need !== "not_needed")


// ========================
// Express Interest
// ========================

router.post("/expressInterest", authMiddleware, requirePaid, async (req, res) => {
    try {
        if (req.body.consent !== true) {
            return res.status(400).json({ success: false, message: "Please tick the box to agree before we share your details" })
        }

        // Only careers from the student's own top matches that the data says abroad helps for —
        // the names come from the server, never from the request.
        const recommendation = await Recommendation.findOne({ user: req.user._id }).select("ranked_professions").lean()
        const top = recommendation ? (recommendation.ranked_professions || []).slice(0, TOP_N) : []
        const asked = Array.isArray(req.body.careerIds) ? req.body.careerIds.map(String) : []
        const chosen = top.filter((entry) => qualifies(String(entry.professionId)) && (asked.length === 0 || asked.includes(String(entry.professionId))))

        if (chosen.length === 0) {
            return res.status(400).json({ success: false, message: "None of your top matches usually needs study abroad" })
        }

        const lead = await StudyAbroadLead.findOneAndUpdate(
            { user: req.user._id },
            {
                careerIds: chosen.map((entry) => String(entry.professionId)),
                careers: chosen.map((entry) => entry.profession),
                consentAt: new Date(),
                policyVersion: POLICY_VERSION,
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        ).lean()

        return res.status(200).json({ success: true, message: "Thanks — we'll be in touch", data: { careers: lead.careers, consentAt: lead.consentAt } })

    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to save your interest", error: error.message })
    }
})

router.get("/getMyInterest", authMiddleware, requirePaid, async (req, res) => {
    try {
        const lead = await StudyAbroadLead.findOne({ user: req.user._id }).select("careers consentAt").lean()

        return res.status(200).json({ success: true, message: "Fetched", data: { lead: lead || null } })

    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to fetch", error: error.message })
    }
})


// ========================
// Leads For Admin
// ========================

router.get("/getLeadsForAdmin", authMiddleware, adminAuthMiddleware, async (req, res) => {
    try {
        const leads = await StudyAbroadLead.find()
            .populate("user", "name email phone")
            .sort({ createdAt: -1 })
            .limit(500)
            .lean()

        return res.status(200).json({ success: true, message: "Leads fetched successfully", data: { leads } })

    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to fetch leads", error: error.message })
    }
})

router.put("/updateLeadForAdmin/:id", authMiddleware, adminAuthMiddleware, async (req, res) => {
    try {
        const { status, adminNote } = req.body

        if (!["new", "shared", "closed"].includes(status)) {
            return res.status(400).json({ success: false, message: "Status must be new, shared or closed" })
        }

        const lead = await StudyAbroadLead.findByIdAndUpdate(
            req.params.id,
            { status, adminNote: typeof adminNote === "string" ? adminNote.trim().slice(0, 500) : "" },
            { new: true }
        ).lean()

        if (!lead) {
            return res.status(404).json({ success: false, message: "Lead not found" })
        }

        return res.status(200).json({ success: true, message: "Saved", data: { lead } })

    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to save", error: error.message })
    }
})

module.exports = router
module.exports.qualifies = qualifies
