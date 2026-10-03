const express = require("express")
const rateLimit = require("express-rate-limit")
const Consent = require("../model/consentModel")
const authMiddleware = require("../middlewares/authMiddleware")
const { isMinor, isVerified, maskEmail, secondsUntilResend, sendParentCode, checkParentCode } = require("../utils/parentConsent")
const { POLICY_VERSION } = require("./userRouter")

const router = express.Router()

// Parent confirmation by an emailed code (Round 10) — see utils/parentConsent.js.
// API prefix /consent; the page is /parent-consent, so a refresh never hits an API route.

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// on top of the per-row limits: a burst of tries from one address is stopped here
const codeRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { success: false, message: "Too many tries — please wait a few minutes" },
})


// ========================
// Get My Consent
// ========================

router.get("/getMyConsent", authMiddleware, async (req, res) => {
    try {
        const consent = await Consent.findOne({ user: req.user._id }).lean()
        const required = isMinor(req.user)

        return res.status(200).json({
            success: true,
            message: "Consent fetched successfully",
            data: {
                required,
                status: !required ? "not_needed" : isVerified(consent) ? "verified" : consent ? "waiting_for_parent" : "missing",
                parentName: consent ? consent.parentName : null,
                parentEmail: consent ? maskEmail(consent.parentEmail) : null,
                hasParentEmail: Boolean(consent && consent.parentEmail),
                codeSent: Boolean(consent && consent.otpHash),
                resendInSeconds: secondsUntilResend(consent),
                verifiedAt: consent ? consent.verifiedAt : null,
            },
        })

    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to fetch consent", error: error.message })
    }
})


// ========================
// Send The Parent A Code
// ========================

// The student may give (or correct) the parent's email here until permission is confirmed. It must
// not be the student's own address — that would be the student confirming for themselves.
router.post("/sendParentOtp", codeRateLimiter, authMiddleware, async (req, res) => {
    try {
        if (!isMinor(req.user)) {
            return res.status(400).json({ success: false, message: "Parental permission is only needed under 18" })
        }

        const consent = await Consent.findOne({ user: req.user._id })

        if (!consent) {
            return res.status(400).json({ success: false, message: "Please add your parent's details on your profile first" })
        }

        if (isVerified(consent)) {
            return res.status(400).json({ success: false, message: "Your parent has already confirmed" })
        }

        const wait = secondsUntilResend(consent)
        if (wait > 0) {
            return res.status(429).json({ success: false, message: `Please wait ${wait} seconds before asking for another code`, data: { resendInSeconds: wait } })
        }

        const email = typeof req.body.parentEmail === "string" ? req.body.parentEmail.trim().toLowerCase() : consent.parentEmail
        if (!email || !emailRegex.test(email)) {
            return res.status(400).json({ success: false, message: "Please enter your parent's email address" })
        }
        if (email === String(req.user.email).toLowerCase()) {
            return res.status(400).json({ success: false, message: "This has to be your parent's email, not yours" })
        }

        consent.parentEmail = email
        const outcome = await sendParentCode(consent, req.user)

        if (!outcome.sent) {
            return res.status(502).json({ success: false, message: "The email could not be sent — please try again in a minute" })
        }

        return res.status(200).json({
            success: true,
            message: `We've emailed a code to ${maskEmail(email)}`,
            data: { parentEmail: maskEmail(email), resendInSeconds: secondsUntilResend(consent) },
        })

    } catch (error) {
        return res.status(500).json({ success: false, message: "Could not send the code", error: error.message })
    }
})


// ========================
// Verify The Parent's Code
// ========================

router.post("/verifyParentOtp", codeRateLimiter, authMiddleware, async (req, res) => {
    try {
        const consent = await Consent.findOne({ user: req.user._id })

        if (!consent) {
            return res.status(400).json({ success: false, message: "Ask for a code first" })
        }

        if (isVerified(consent)) {
            return res.status(200).json({ success: true, message: "Your parent has already confirmed", data: { status: "verified" } })
        }

        const outcome = await checkParentCode(consent, req.body.code, req.ip, POLICY_VERSION)

        if (!outcome.ok) {
            return res.status(400).json({ success: false, message: outcome.message })
        }

        return res.status(200).json({ success: true, message: outcome.message, data: { status: "verified" } })

    } catch (error) {
        return res.status(500).json({ success: false, message: "Could not check the code", error: error.message })
    }
})

module.exports = router
