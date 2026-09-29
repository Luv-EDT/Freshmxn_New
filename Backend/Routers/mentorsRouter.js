const express = require("express")
const bcrypt = require("bcrypt")
const jwt = require("jsonwebtoken")
const User = require("../model/userModel")
const Mentor = require("../model/mentorsModel")
const authMiddleware = require("../middlewares/authMiddleware")
const adminAuthMiddleware = require("../middlewares/adminAuthMiddleware")
const mentorAuthMiddleware = require("../middlewares/mentorAuthMiddleware")

const router = express.Router()

// Mentors are users with role "mentor" (PRD §C.1: separate login page, same auth stack). They log in
// through the ordinary /user/login; only account creation needs its own endpoint, because the
// role is decided by WHICH endpoint was called — never by a field in the body.

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const TRANSITION_CATEGORIES = ["Category A", "Category B", "Category C", "Category D"]


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

// "Finance, Consulting" or ["Finance", "Consulting"] → ["Finance", "Consulting"]
const toList = (value) => {
    const items = Array.isArray(value) ? value : String(value || "").split(",")
    return items.map((item) => String(item).trim()).filter((item) => item !== "")
}

// the 12 onboarding fields, whitelisted and checked. Returns { fields } or { error }.
// status, user and approval fields are never read from the body.
const cleanOnboarding = (body) => {
    const text = (value) => (typeof value === "string" ? value.trim() : "")

    const fields = {
        name: text(body.name),
        email: text(body.email).toLowerCase(),
        phone: text(body.phone),
        currentRole: text(body.currentRole),
        discipline: text(body.discipline),
        sectors: toList(body.sectors),
        yearsExperience: Number(body.yearsExperience),
        languages: toList(body.languages),
        motivation: text(body.motivation),
        transitionCategory: text(body.transitionCategory),
        preferredCurrency: text(body.preferredCurrency),
        residenceCitizenship: text(body.residenceCitizenship),
    }

    if (!fields.name) return { error: "Please enter your full name" }
    if (!emailRegex.test(fields.email)) return { error: "Please enter a valid email" }
    // country code + number: at least 8 digits, an optional leading +, spaces and dashes allowed
    if (!/^\+?[0-9][0-9\s-]{7,19}$/.test(fields.phone)) return { error: "Please enter your contact number with country code" }
    if (!fields.currentRole) return { error: "Please enter your current role" }
    if (!fields.discipline) return { error: "Please enter your discipline or profession" }
    if (fields.sectors.length === 0) return { error: "Please list at least one industry or sector" }
    if (!Number.isFinite(fields.yearsExperience) || fields.yearsExperience < 0 || fields.yearsExperience > 60) {
        return { error: "Please enter your years of experience" }
    }
    if (fields.languages.length === 0) return { error: "Please list at least one language" }
    if (!fields.motivation) return { error: "Please tell us why you want to mentor" }
    if (!TRANSITION_CATEGORIES.includes(fields.transitionCategory)) return { error: "Please choose how you approached high school to college" }
    if (!fields.preferredCurrency) return { error: "Please enter your preferred payment currency" }
    if (!fields.residenceCitizenship) return { error: "Please enter your country of residence / citizenship" }

    return { fields }
}


// ========================
// Register A Mentor
// ========================

router.post("/register", async (req, res) => {
    try {
        const { name, email, password } = req.body

        if (!name || !name.trim()) {
            return res.status(400).json({
                success: false,
                message: "Please enter your name"
            })
        }

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

        const normalizedEmail = email.trim().toLowerCase()

        const existingUser = await User.findOne({ email: normalizedEmail })

        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: "User already exists"
            })
        }

        const salt = await bcrypt.genSalt(10)
        const hashedPassword = await bcrypt.hash(password, salt)

        // No confirmation email: every mentor is reviewed by an admin before being matched with a
        // student, and that review is the gate — not a clicked link.
        const newUser = await User.create({
            name: name.trim(),
            email: normalizedEmail,
            password: hashedPassword,
            role: "mentor",         // decided by this endpoint, never taken from the body
            paid: false,
            currentTier: 0,
            lastLoginAt: new Date(),
        })

        const userData = newUser.toObject()
        delete userData.password

        return res.status(201).json({
            success: true,
            message: "Registered Successfully",
            token: signToken(newUser._id),
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
// Onboard (first submission of the form)
// ========================

router.post("/onboard", authMiddleware, mentorAuthMiddleware, async (req, res) => {
    try {
        const existingProfile = await Mentor.findOne({ user: req.user._id })

        if (existingProfile) {
            return res.status(400).json({
                success: false,
                message: "You have already onboarded — edit your profile instead"
            })
        }

        const { fields, error } = cleanOnboarding(req.body)

        if (error) {
            return res.status(400).json({
                success: false,
                message: error
            })
        }

        const profile = await Mentor.create({
            ...fields,
            user: req.user._id,
            status: "pending_review",
        })

        return res.status(201).json({
            success: true,
            message: "Thanks — we'll review your profile",
            data: profile,
        })

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to save your profile",
            error: error.message,
        })
    }
})


// ========================
// Get My Mentor Profile
// ========================

// the mentor's OWN profile, so it does include their own currency / residence answers
router.get("/getMyMentorProfile", authMiddleware, mentorAuthMiddleware, async (req, res) => {
    try {
        const profile = await Mentor.findOne({ user: req.user._id })

        return res.status(200).json({
            success: true,
            message: profile ? "Profile fetched successfully" : "No profile yet",
            data: profile,
        })

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to fetch your profile",
            error: error.message,
        })
    }
})


// ========================
// Update My Mentor Profile
// ========================

// status is left exactly as it was — an approved mentor fixing a typo stays approved
router.put("/updateMyMentorProfile", authMiddleware, mentorAuthMiddleware, async (req, res) => {
    try {
        const { fields, error } = cleanOnboarding(req.body)

        if (error) {
            return res.status(400).json({
                success: false,
                message: error
            })
        }

        const profile = await Mentor.findOneAndUpdate(
            { user: req.user._id },
            fields,
            { returnDocument: "after" }
        )

        if (!profile) {
            return res.status(404).json({
                success: false,
                message: "No profile yet — please complete onboarding first"
            })
        }

        return res.status(200).json({
            success: true,
            message: "Profile updated",
            data: profile,
        })

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to update your profile",
            error: error.message,
        })
    }
})


// ========================
// Get All Mentors For Admin
// ========================

// the only route that returns preferredCurrency / residenceCitizenship to someone other than the
// mentor themself
router.get("/getAllForAdmin", authMiddleware, adminAuthMiddleware, async (req, res) => {
    try {
        const mentors = await Mentor.find({}).sort({ status: -1, createdAt: -1 })

        return res.status(200).json({
            success: true,
            message: "Mentors fetched successfully",
            data: mentors,
        })

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to fetch mentors",
            error: error.message,
        })
    }
})


// ========================
// Approve A Mentor For Admin
// ========================

router.put("/approveForAdmin/:id", authMiddleware, adminAuthMiddleware, async (req, res) => {
    try {
        const { id } = req.params   // :id is a MENTOR PROFILE id

        const profile = await Mentor.findByIdAndUpdate(
            id,
            { status: "onboarded", approvedByAdmin: req.user._id, approvedAt: new Date() },
            { returnDocument: "after" }
        )

        if (!profile) {
            return res.status(404).json({
                success: false,
                message: "Mentor not found"
            })
        }

        return res.status(200).json({
            success: true,
            message: "Mentor approved",
            data: profile,
        })

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to approve mentor",
            error: error.message,
        })
    }
})


module.exports = router
