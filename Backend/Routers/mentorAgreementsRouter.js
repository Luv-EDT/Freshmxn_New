const express = require("express")
const MentorAgreement = require("../model/mentorAgreementsModel")
const authMiddleware = require("../middlewares/authMiddleware")
const adminAuthMiddleware = require("../middlewares/adminAuthMiddleware")
const mentorAuthMiddleware = require("../middlewares/mentorAuthMiddleware")

const router = express.Router()

// THE SIGNED MENTOR AGREEMENT (owner, Round 38) — step 2 of a mentor's onboarding: download the agreement,
// print it, sign it, scan it and upload it here. The file arrives as base64 inside a JSON body, so server.js
// mounts this router with its own 8 MB parser (like /resumeReader). The page is /mentor; this prefix differs.

const MAX_BYTES = 5 * 1024 * 1024
const TYPES = ["application/pdf", "image/jpeg", "image/png"]

const meta = (agreement) => (agreement ? {
    fileName: agreement.fileName,
    contentType: agreement.contentType,
    size: agreement.size,
    version: agreement.version,
    uploadedAt: agreement.uploadedAt,
} : null)


// ========================
// Upload My Signed Agreement
// ========================

router.post("/upload", authMiddleware, mentorAuthMiddleware, async (req, res) => {
    try {
        const contentType = String(req.body.contentType || "").toLowerCase()
        const fileName = String(req.body.fileName || "").slice(0, 120)
        const base64 = String(req.body.data || "").replace(/^data:[^;]+;base64,/, "")

        if (!TYPES.includes(contentType)) {
            return res.status(400).json({ success: false, message: "Please upload a PDF, JPG or PNG of the signed agreement" })
        }

        const data = Buffer.from(base64, "base64")

        if (data.length === 0) {
            return res.status(400).json({ success: false, message: "That file is empty — please scan it again" })
        }

        if (data.length > MAX_BYTES) {
            return res.status(400).json({ success: false, message: "That file is over 5 MB — please scan it at a lower resolution" })
        }

        const agreement = await MentorAgreement.findOneAndUpdate(
            { mentor: req.user._id },
            { fileName, contentType, size: data.length, data, version: MentorAgreement.AGREEMENT_VERSION, uploadedAt: new Date() },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        )

        return res.status(200).json({ success: true, message: "Thanks — your signed agreement is in", data: meta(agreement) })

    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to upload your agreement", error: error.message })
    }
})


// ========================
// Get My Agreement
// ========================

router.get("/getMine", authMiddleware, mentorAuthMiddleware, async (req, res) => {
    try {
        const agreement = await MentorAgreement.findOne({ mentor: req.user._id }).lean()

        return res.status(200).json({ success: true, message: agreement ? "Agreement found" : "No agreement yet", data: meta(agreement) })

    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to fetch your agreement", error: error.message })
    }
})


// ========================
// Open A Mentor's Agreement For Admin
// ========================

// the file itself, for the admin's browser to open
router.get("/fileForAdmin/:mentorUserId", authMiddleware, adminAuthMiddleware, async (req, res) => {
    try {
        const agreement = await MentorAgreement.findOne({ mentor: req.params.mentorUserId }).select("+data").lean()

        if (!agreement) {
            return res.status(404).json({ success: false, message: "No signed agreement from this mentor yet" })
        }

        res.set("Content-Type", agreement.contentType)
        res.set("Content-Disposition", `inline; filename="${(agreement.fileName || "agreement").replace(/[^\w.-]/g, "_")}"`)
        return res.status(200).send(Buffer.from(agreement.data.buffer || agreement.data))

    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to open the agreement", error: error.message })
    }
})

module.exports = router
module.exports.agreementMeta = meta
