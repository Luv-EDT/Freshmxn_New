const express = require("express")
const bcrypt = require("bcrypt")
const crypto = require("crypto")
const rateLimit = require("express-rate-limit")
const User = require("../model/userModel")
const { startSession } = require("../utils/sessionToken")
const { sendEmail, escapeHtml } = require("../utils/mailer")
const { verifyTurnstile } = require("../utils/turnstile")
const { validateRegistration, createStudentAccount, withoutPassword } = require("./userRouter")
const { finishDemo, sessionFor, demoRateLimiter } = require("./demoRouter")

// THE DEMO'S ACCOUNT STEP (owner, Round 36) — mounted at /demoAccount (the page is /try-demo). The result is
// shown only to someone with an account: before it, the visitor registers properly and proves the email
// with a 6-digit code we send, or logs in if the email already has an account. Either way they leave the
// demo logged in, the demo is linked to the account by its (now confirmed) email, and the category they
// gave (their stage) decides what the site shows them next. Someone who never registers sees no result
// and no account is made.
//
// This is the ONLY demo code that touches a User — the rest of the demo (demoRouter, Backend/demo/) stays
// isolated, and the DEMO ISOLATION fixture still holds it to that.
const router = express.Router()

const CODE_MINUTES = 15
const MAX_TRIES = 5
const hash = (value) => crypto.createHash("sha256").update(String(value)).digest("hex")
const newCode = () => String(crypto.randomInt(0, 1000000)).padStart(6, "0")

// a handful of sign-ups and codes per hour from one address
const accountRateLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 15,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { success: false, message: "Too many tries from here. Try again in an hour" },
})

const sendCode = (email, code) => sendEmail({
    to: email,
    subject: `${code} is your Freshmxn code`,
    html: `<p>Hi,</p><p>Your code to finish signing up and see your demo result is:</p><p style="font-size:24px;font-weight:700;letter-spacing:4px">${escapeHtml(code)}</p><p>It works for ${CODE_MINUTES} minutes. If you didn't ask for this, ignore this email.</p><p>— Freshmxn</p>`,
})

// the result, the session pass and the account — what the page needs to carry on logged in
const finish = async (res, session, user, message) => {
    const result = await finishDemo(session, {
        email: user.email,
        adult: Number(user.age) >= 18,
        parentConsent: Number(user.age) < 18,
        stage: { journey: user.journey, years: user.journeyDetail && user.journeyDetail.experienceYears },
    })
    session.user = user._id
    await session.save()
    await User.findByIdAndUpdate(user._id, { lastLoginAt: new Date() })
    const token = await startSession(user._id)
    return res.status(200).json({ success: true, message, data: { result, token, userData: withoutPassword(user.toObject ? user.toObject() : user) } })
}

const ready = async (req, res) => {
    const session = await sessionFor(req)
    if (!session) {
        res.status(404).json({ success: false, message: "This demo has ended — start a new one" })
        return null
    }
    if (!session.tastes || !((session.interests || {}).draws || []).length) {
        res.status(400).json({ success: false, message: "Finish the questions and the three tasks first" })
        return null
    }
    return session
}


// ========================
// Register — send the code
// ========================

router.post("/register", accountRateLimiter, demoRateLimiter, async (req, res) => {
    try {
        // the hidden box only a bot fills (as on the register page)
        if (typeof req.body.website === "string" && req.body.website.trim() !== "") {
            return res.status(200).json({ success: true, message: "Code sent" })
        }
        const session = await ready(req, res)
        if (!session) return

        const { fields, error } = validateRegistration(req.body)
        if (error) {
            return res.status(400).json({ success: false, message: error })
        }
        if (await User.exists({ email: fields.email })) {
            return res.status(409).json({ success: false, message: "This email already has a Freshmxn account — log in to see your result", data: { exists: true } })
        }
        if (!(await verifyTurnstile(req.body.turnstileToken, req.ip))) {
            return res.status(400).json({ success: false, message: "Please complete the check that you're a person, then try again" })
        }

        const code = newCode()
        const { password, ...rest } = fields
        session.pendingAccount = {
            fields: rest,
            passwordHash: await bcrypt.hash(password, await bcrypt.genSalt(10)),
            codeHash: hash(code),
            expiresAt: new Date(Date.now() + CODE_MINUTES * 60 * 1000),
            attempts: 0,
            sentAt: new Date(),
        }
        session.markModified("pendingAccount")
        await session.save()
        await sendCode(fields.email, code)

        return res.status(200).json({ success: true, message: `We've sent a 6-digit code to ${fields.email}`, data: { email: fields.email } })

    } catch (error) {
        return res.status(500).json({ success: false, message: "Could not start your sign-up", error: error.message })
    }
})

router.post("/resendCode", accountRateLimiter, demoRateLimiter, async (req, res) => {
    try {
        const session = await ready(req, res)
        if (!session) return
        const pending = session.pendingAccount
        if (!pending) {
            return res.status(400).json({ success: false, message: "Fill in the sign-up first" })
        }
        if (pending.sentAt && Date.now() - new Date(pending.sentAt).getTime() < 30 * 1000) {
            return res.status(429).json({ success: false, message: "Please wait a few seconds before asking again" })
        }
        const code = newCode()
        session.pendingAccount = { ...pending, codeHash: hash(code), expiresAt: new Date(Date.now() + CODE_MINUTES * 60 * 1000), attempts: 0, sentAt: new Date() }
        session.markModified("pendingAccount")
        await session.save()
        await sendCode(pending.fields.email, code)
        return res.status(200).json({ success: true, message: "A new code is on its way" })

    } catch (error) {
        return res.status(500).json({ success: false, message: "Could not send the code", error: error.message })
    }
})


// ========================
// Verify — make the account, show the result
// ========================

router.post("/verify", accountRateLimiter, demoRateLimiter, async (req, res) => {
    try {
        const session = await ready(req, res)
        if (!session) return
        const pending = session.pendingAccount
        if (!pending) {
            return res.status(400).json({ success: false, message: "Fill in the sign-up first" })
        }
        if (new Date(pending.expiresAt) < new Date()) {
            return res.status(400).json({ success: false, message: "That code has expired — ask for a new one" })
        }
        if (pending.attempts >= MAX_TRIES) {
            return res.status(400).json({ success: false, message: "Too many wrong codes — ask for a new one" })
        }
        const code = String(req.body.code || "").replace(/\D/g, "")
        if (hash(code) !== pending.codeHash) {
            session.pendingAccount = { ...pending, attempts: (pending.attempts || 0) + 1 }
            session.markModified("pendingAccount")
            await session.save()
            return res.status(400).json({ success: false, message: "That code isn't right — check the email and try again" })
        }

        // someone registered this email in the meantime: they log in instead
        if (await User.exists({ email: pending.fields.email })) {
            return res.status(409).json({ success: false, message: "This email already has a Freshmxn account — log in to see your result", data: { exists: true } })
        }

        const user = await createStudentAccount({ fields: pending.fields, passwordHash: pending.passwordHash, verified: true, ip: req.ip })
        session.pendingAccount = null
        return await finish(res, session, user, "Your account is ready")

    } catch (error) {
        return res.status(error.status || 500).json({ success: false, message: error.status ? error.message : "Could not finish your sign-up", error: error.message })
    }
})


// ========================
// Log in — an email that already has an account
// ========================

router.post("/login", accountRateLimiter, demoRateLimiter, async (req, res) => {
    try {
        const session = await ready(req, res)
        if (!session) return
        const email = String(req.body.email || "").trim().toLowerCase()
        const user = await User.findOne({ email })
        // the same answer for a wrong email and a wrong password
        if (!user || !user.password || !(await bcrypt.compare(String(req.body.password || ""), user.password))) {
            return res.status(400).json({ success: false, message: "Wrong email or password" })
        }
        if (user.role !== "student") {
            return res.status(400).json({ success: false, message: "Please use a student account for the demo" })
        }
        return await finish(res, session, user, "Welcome back")

    } catch (error) {
        return res.status(error.status || 500).json({ success: false, message: error.status ? error.message : "Could not log you in", error: error.message })
    }
})

module.exports = router
