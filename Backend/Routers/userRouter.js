const express = require("express")
const bcrypt = require("bcrypt")
const jwt = require("jsonwebtoken")
const crypto = require("crypto")
const rateLimit = require("express-rate-limit")
const { Resend } = require("resend")
const User = require("../model/userModel")
const Consent = require("../model/consentModel")
const PasswordReset = require("../model/passwordResetsModel")
const EmailVerification = require("../model/emailVerificationsModel")
const authMiddleware = require("../middlewares/authMiddleware")
const adminAuthMiddleware = require("../middlewares/adminAuthMiddleware")
const mentorAuthMiddleware = require("../middlewares/mentorAuthMiddleware")

const router = express.Router()

const resend = new Resend(process.env.RESEND_API_KEY)

const JOURNEYS = ["class9_10", "class11_12", "college", "early_professional"]
const POLICY_VERSION = "v1.0"
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const phoneRegex = /^[0-9]{10}$/


// ========================
// Rate Limiters
// ========================

// 10 failed logins per IP per 15 minutes. Successful logins don't count.
const loginRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    skipSuccessfulRequests: true,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
        success: false,
        message: "Too many login attempts. Try again in 15 minutes"
    },
})

// 5 reset emails per IP per hour, so nobody can flood an inbox
const forgotPasswordRateLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 5,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
        success: false,
        message: "Too many reset requests. Try again in an hour"
    },
})

// same reasoning for the "resend my confirmation link" button
const resendVerificationRateLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 5,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
        success: false,
        message: "Too many emails requested. Try again in an hour"
    },
})


// ========================
// Helpers
// ========================

const signToken = (userId) => {
    return jwt.sign(
        {
            userId: userId
        },
        process.env.JWT_SECRET,
        {
            expiresIn: "7d"
        }
    )
}

// keep only the journeyDetail keys we know about, with the right types
const cleanJourneyDetail = (journeyDetail) => {
    const detail = journeyDetail || {}

    return {
        class: detail.class ? Number(detail.class) : undefined,
        stream: Array.isArray(detail.stream) ? detail.stream.filter((s) => typeof s === "string" && s.trim() !== "") : [],
        collegeStage: detail.collegeStage || undefined,
        preAdmission: detail.collegeStage === "pre_admission",
        courseYear: detail.courseYear ? Number(detail.courseYear) : undefined,
        experienceYears: detail.experienceYears !== undefined && detail.experienceYears !== "" ? Number(detail.experienceYears) : undefined,
    }
}

// issue a fresh "confirm your email" link and send it. Any older unused link stops working, so a
// resend can't leave two live tokens behind. Never throws — a signup must not fail because an
// email did, but the full error is logged so a misconfigured sender is visible in the terminal.
const sendVerificationEmail = async (user) => {
    const rawToken = crypto.randomBytes(32).toString("hex")
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex")

    await EmailVerification.updateMany(
        { user: user._id, usedAt: null },
        { usedAt: new Date() }
    )

    await EmailVerification.create({
        user: user._id,
        tokenHash,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),   // 24 hours
    })

    const verifyUrl = `${process.env.FRONTEND_URL}/verify-email/${rawToken}`

    try {
        const { error: emailError } = await resend.emails.send({
            from: process.env.EMAIL_FROM,
            to: user.email,
            subject: "Confirm your email for Freshmxn",
            html: `<p>Hi ${user.name},</p>
                   <p>Please confirm this is your email address. The link expires in 24 hours.</p>
                   <p><a href="${verifyUrl}">${verifyUrl}</a></p>
                   <p>If you didn't sign up for Freshmxn, you can ignore this email.</p>`,
        })

        if (emailError) {
            console.log("Verification email failed:", emailError)
        }

    } catch (error) {
        console.log("Verification email threw:", error)
    }
}

// TEMPORARY (V1): under 18 must tick "I have my parent's permission" + give one parent's name and mobile.
// returns an error message, or null when the details are fine
const checkParentConsent = (age, parentConsentChecked, parentName, parentPhone) => {
    if (age >= 18) return null

    if (parentConsentChecked !== true || !parentName || !parentName.trim() || !phoneRegex.test(parentPhone || "")) {
        return "Please confirm parental permission"
    }

    return null
}


// ========================
// Register
// ========================

router.post("/register", async (req, res) => {
    try {
        const { name, email, password, age, journey, journeyDetail, parentConsentChecked, parentName, parentPhone } = req.body

        if (!name || !name.trim()) {
            return res.status(400).json({
                success: false,
                message: "Please enter your name"
            })
        }

        // Validate Email
        if (!emailRegex.test(email || "")) {
            return res.status(400).json({
                success: false,
                message: "Invalid Email"
            })
        }

        if (!password || password.length < 8) {
            return res.status(400).json({
                success: false,
                message: "Password must be at least 8 characters"
            })
        }

        const ageNumber = Number(age)

        if (!Number.isInteger(ageNumber) || ageNumber < 8 || ageNumber > 100) {
            return res.status(400).json({
                success: false,
                message: "Please enter a valid age"
            })
        }

        if (!JOURNEYS.includes(journey)) {
            return res.status(400).json({
                success: false,
                message: "Please select your current stage"
            })
        }

        // TEMPORARY (V1) parent permission checkbox
        const consentError = checkParentConsent(ageNumber, parentConsentChecked, parentName, parentPhone)

        if (consentError) {
            return res.status(400).json({
                success: false,
                message: consentError
            })
        }

        const normalizedEmail = email.trim().toLowerCase()

        const existingUser = await User.findOne({ email: normalizedEmail })

        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: "User already exists"
            })
        }

        // Hash Password
        const salt = await bcrypt.genSalt(10)
        const hashedPassword = await bcrypt.hash(password, salt)

        const newUser = await User.create({
            name: name.trim(),
            email: normalizedEmail,
            password: hashedPassword,
            age: ageNumber,
            journey,
            journeyDetail: cleanJourneyDetail(journeyDetail),
            role: "student",        // never taken from the body
            paid: false,
            currentTier: 0,
            lastLoginAt: new Date(),
        })

        // TEMPORARY (V1): record the self-declared parent permission
        if (ageNumber < 18) {
            await Consent.create({
                user: newUser._id,
                parentName: parentName.trim(),
                parentPhone,
                isParentPermissionChecked: true,
                consentMethod: "self_declared_checkbox",
                isTemporary: true,
                consentGivenAt: new Date(),
                ipAtConsent: req.ip,
                policyVersion: POLICY_VERSION,
            })
        }

        // they can log in and look around straight away; paying is what waits for the link
        await sendVerificationEmail(newUser)

        const jwtToken = signToken(newUser._id)

        const userData = newUser.toObject()
        delete userData.password

        return res.status(201).json({
            success: true,
            message: "Registered Successfully",
            token: jwtToken,
            userData,
        })

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to register",
            error: error.message,
        })
    }
})


// ========================
// Login
// ========================

router.post("/login", loginRateLimiter, async (req, res) => {
    try {
        const { email, password } = req.body

        if (!emailRegex.test(email || "")) {
            return res.status(400).json({
                success: false,
                message: "Invalid Email"
            })
        }

        const user = await User.findOne({ email: email.trim().toLowerCase() })

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            })
        }

        // a Google-only account has no password to compare against
        if (!user.password) {
            return res.status(400).json({
                success: false,
                message: "This account uses Google Sign-In"
            })
        }

        const isPasswordCorrect = await bcrypt.compare(password || "", user.password)

        if (!isPasswordCorrect) {
            return res.status(400).json({
                success: false,
                message: "Invalid Password"
            })
        }

        await User.findByIdAndUpdate(user._id, { lastLoginAt: new Date() })

        const jwtToken = signToken(user._id)

        const userData = user.toObject()
        delete userData.password

        return res.status(200).json({
            success: true,
            message: "User Logged In",
            token: jwtToken,
            userData,
        })

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to login",
            error: error.message,
        })
    }
})


// ========================
// Forgot Password
// ========================

router.post("/forgotPassword", forgotPasswordRateLimiter, async (req, res) => {
    try {
        const { email } = req.body

        if (!emailRegex.test(email || "")) {
            return res.status(400).json({
                success: false,
                message: "Invalid Email"
            })
        }

        const user = await User.findOne({ email: email.trim().toLowerCase() })

        // Same answer either way — a different message would reveal who has an account
        if (!user) {
            return res.status(200).json({
                success: true,
                message: "If that email exists, a reset link has been sent"
            })
        }

        // Generate Token: the raw token goes in the email, only its hash goes in the DB
        const rawToken = crypto.randomBytes(32).toString("hex")
        const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex")

        // any older unused link stops working the moment a new one is issued
        await PasswordReset.updateMany(
            { user: user._id, usedAt: null },
            { usedAt: new Date() }
        )

        await PasswordReset.create({
            user: user._id,
            tokenHash,
            expiresAt: new Date(Date.now() + 30 * 60 * 1000),   // 30 minutes
        })

        const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${rawToken}`

        const { error: emailError } = await resend.emails.send({
            from: process.env.EMAIL_FROM,
            to: user.email,
            subject: "Reset your Freshmxn password",
            html: `<p>Hi ${user.name},</p>
                   <p>Click the link below to set a new password. It expires in 30 minutes.</p>
                   <p><a href="${resetUrl}">${resetUrl}</a></p>
                   <p>If you didn't ask for this, you can ignore this email.</p>`,
        })

        // the student always sees the same generic reply, so the full error has to surface here
        // or a misconfigured sending domain is invisible
        if (emailError) {
            console.log("Reset email failed:", emailError)
        }

        return res.status(200).json({
            success: true,
            message: "If that email exists, a reset link has been sent"
        })

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to send reset link",
            error: error.message,
        })
    }
})


// ========================
// Reset Password
// ========================

router.post("/resetPassword/:token", async (req, res) => {
    try {
        const { token } = req.params
        const { password } = req.body

        if (!password || password.length < 8) {
            return res.status(400).json({
                success: false,
                message: "Password must be at least 8 characters"
            })
        }

        // hash the incoming token the same way and look it up — the raw token was never stored
        const tokenHash = crypto.createHash("sha256").update(token).digest("hex")

        const passwordReset = await PasswordReset.findOne({
            tokenHash,
            usedAt: null,
            expiresAt: { $gt: new Date() },
        })

        if (!passwordReset) {
            return res.status(400).json({
                success: false,
                message: "Reset link is invalid or expired"
            })
        }

        // Hash Password
        const salt = await bcrypt.genSalt(10)
        const hashedPassword = await bcrypt.hash(password, salt)

        await User.findByIdAndUpdate(passwordReset.user, { password: hashedPassword })

        await PasswordReset.findByIdAndUpdate(passwordReset._id, { usedAt: new Date() })

        return res.status(200).json({
            success: true,
            message: "Password reset successfully"
        })

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to reset password",
            error: error.message,
        })
    }
})


// ========================
// Verify Email
// ========================

// a signup email that doesn't exist can never be confirmed, which is exactly the point:
// an unconfirmed account is blocked from paying, so nobody loses money behind an inbox
// they can't open. Also the reason a forgotten password can always reach them.
router.post("/verifyEmail/:token", async (req, res) => {
    try {
        const { token } = req.params

        // hash the incoming token the same way and look it up — the raw token was never stored
        const tokenHash = crypto.createHash("sha256").update(token).digest("hex")

        const emailVerification = await EmailVerification.findOne({
            tokenHash,
            usedAt: null,
            expiresAt: { $gt: new Date() },
        })

        if (!emailVerification) {
            return res.status(400).json({
                success: false,
                message: "Confirmation link is invalid or expired"
            })
        }

        await User.findByIdAndUpdate(emailVerification.user, { isEmailVerified: true })

        await EmailVerification.findByIdAndUpdate(emailVerification._id, { usedAt: new Date() })

        return res.status(200).json({
            success: true,
            message: "Email confirmed successfully"
        })

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to confirm email",
            error: error.message,
        })
    }
})


// ========================
// Resend Verification
// ========================

router.post("/resendVerification", resendVerificationRateLimiter, authMiddleware, async (req, res) => {
    try {
        if (req.user.isEmailVerified === true) {
            return res.status(400).json({
                success: false,
                message: "Your email is already confirmed"
            })
        }

        await sendVerificationEmail(req.user)

        return res.status(200).json({
            success: true,
            message: "Confirmation email sent"
        })

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to send confirmation email",
            error: error.message,
        })
    }
})


// ========================
// Get Current User
// ========================

router.get("/getCurrentUser", authMiddleware, async (req, res) => {
    try {
        return res.status(200).json({
            success: true,
            message: "User fetched successfully",
            userData: req.user,
        })

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to fetch user",
            error: error.message,
        })
    }
})


// ========================
// Get Current Admin
// ========================

router.get(
    "/getCurrentAdmin",
    authMiddleware,
    adminAuthMiddleware,
    async (req, res) => {
        try {
            return res.status(200).json({
                success: true,
                message: "Admin fetched successfully",
                userData: req.user,
            })

        } catch (error) {
            return res.status(500).json({
                success: false,
                message: "Failed to fetch admin",
                error: error.message,
            })
        }
    }
)


// ========================
// Get Current Mentor
// ========================

router.get(
    "/getCurrentMentor",
    authMiddleware,
    mentorAuthMiddleware,
    async (req, res) => {
        try {
            return res.status(200).json({
                success: true,
                message: "Mentor fetched successfully",
                userData: req.user,
            })

        } catch (error) {
            return res.status(500).json({
                success: false,
                message: "Failed to fetch mentor",
                error: error.message,
            })
        }
    }
)


// ========================
// Update Profile
// ========================

// used by Complete Profile (Google sign-ins have no age or journey yet)
router.put("/updateProfile", authMiddleware, async (req, res) => {
    try {
        // never spread req.body here — role, paid and currentTier are server-owned
        const { name, age, journey, journeyDetail, preferredLanguage, parentConsentChecked, parentName, parentPhone } = req.body

        const updates = {}

        if (name !== undefined) {
            if (!name.trim()) {
                return res.status(400).json({
                    success: false,
                    message: "Please enter your name"
                })
            }
            updates.name = name.trim()
        }

        if (age !== undefined) {
            const ageNumber = Number(age)

            if (!Number.isInteger(ageNumber) || ageNumber < 8 || ageNumber > 100) {
                return res.status(400).json({
                    success: false,
                    message: "Please enter a valid age"
                })
            }
            updates.age = ageNumber
        }

        if (journey !== undefined) {
            if (!JOURNEYS.includes(journey)) {
                return res.status(400).json({
                    success: false,
                    message: "Please select your current stage"
                })
            }
            updates.journey = journey
            updates.journeyDetail = cleanJourneyDetail(journeyDetail)
        }

        if (preferredLanguage === "en" || preferredLanguage === "hi") {
            updates.preferredLanguage = preferredLanguage
        }

        // TEMPORARY (V1): a student under 18 without a consent record must give parent permission now
        const finalAge = updates.age !== undefined ? updates.age : req.user.age
        const existingConsent = await Consent.findOne({ user: req.user._id })

        if (finalAge !== undefined && finalAge < 18 && !existingConsent) {
            const consentError = checkParentConsent(finalAge, parentConsentChecked, parentName, parentPhone)

            if (consentError) {
                return res.status(400).json({
                    success: false,
                    message: consentError
                })
            }

            await Consent.create({
                user: req.user._id,
                parentName: parentName.trim(),
                parentPhone,
                isParentPermissionChecked: true,
                consentMethod: "self_declared_checkbox",
                isTemporary: true,
                consentGivenAt: new Date(),
                ipAtConsent: req.ip,
                policyVersion: POLICY_VERSION,
            })
        }

        const updatedUser = await User.findByIdAndUpdate(
            req.user._id,
            updates,
            { returnDocument: "after" }  // returns the updated document, not the old one
        ).select("-password")

        return res.status(200).json({
            success: true,
            message: "Profile updated successfully",
            userData: updatedUser,
        })

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to update profile",
            error: error.message,
        })
    }
})


// ========================
// Get All Users For Admin
// ========================

router.get("/getAllForAdmin", authMiddleware, adminAuthMiddleware, async (req, res) => {
    try {
        const users = await User.find({})
            .select("-password")
            .sort({ createdAt: -1 })

        return res.status(200).json({
            success: true,
            message: "Users fetched successfully",
            data: users,
        })

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to fetch users",
            error: error.message,
        })
    }
})


// ========================
// Update A Student For Admin
// ========================

// the user document is the single copy every admin table displays, so correcting a name or phone
// here fixes it on the Students, Access Requests and Refund Requests tabs at once.
// Contact details only: paid, currentTier, role and every amount stay server-owned and can change
// only through Grant / Refund / Downgrade, so an edit can never contradict the payment trail.
router.put("/updateForAdmin/:id", authMiddleware, adminAuthMiddleware, async (req, res) => {
    try {
        const { id } = req.params   // :id is a USER id

        // never spread req.body here — an admin edit must not be able to set role or paid
        const { name, phone, age, journey, journeyDetail } = req.body

        const student = await User.findById(id)

        if (!student) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            })
        }

        const updates = {}

        if (name !== undefined) {
            if (!name.trim()) {
                return res.status(400).json({
                    success: false,
                    message: "Please enter a name"
                })
            }
            updates.name = name.trim()
        }

        // blank clears the number rather than storing an empty string
        if (phone !== undefined) {
            if (phone === "" || phone === null) {
                updates.phone = undefined
            } else if (!phoneRegex.test(phone)) {
                return res.status(400).json({
                    success: false,
                    message: "Enter a valid 10-digit phone number"
                })
            } else {
                updates.phone = phone
            }
        }

        if (age !== undefined) {
            const ageNumber = Number(age)

            if (!Number.isInteger(ageNumber) || ageNumber < 8 || ageNumber > 100) {
                return res.status(400).json({
                    success: false,
                    message: "Please enter a valid age"
                })
            }
            updates.age = ageNumber
        }

        if (journey !== undefined) {
            if (!JOURNEYS.includes(journey)) {
                return res.status(400).json({
                    success: false,
                    message: "Please select a valid stage"
                })
            }
            updates.journey = journey
            updates.journeyDetail = cleanJourneyDetail(journeyDetail)
        }

        const updatedUser = await User.findByIdAndUpdate(
            id,
            updates,
            { returnDocument: "after" }
        ).select("-password")

        return res.status(200).json({
            success: true,
            message: "Student updated successfully",
            data: updatedUser,
        })

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to update student",
            error: error.message,
        })
    }
})

module.exports = router
