const express = require("express")
const bcrypt = require("bcrypt")
const { startSession } = require("../utils/sessionToken")
const User = require("../model/userModel")
const Mentor = require("../model/mentorsModel")
const MentorTest = require("../model/mentorTestsModel")
const MentorPayout = require("../model/mentorPayoutsModel")
const MentorAgreement = require("../model/mentorAgreementsModel")
const { agreementMeta } = require("./mentorAgreementsRouter")
const { standingOf } = require("../utils/mentorPayouts")
const { tier2Missing, tier3Missing, mainRate, payoutAmount } = require("../utils/mentorTiers")
const { notifyStudent } = require("../utils/statusEmails")
const authMiddleware = require("../middlewares/authMiddleware")
const adminAuthMiddleware = require("../middlewares/adminAuthMiddleware")
const mentorAuthMiddleware = require("../middlewares/mentorAuthMiddleware")

const { registerRateLimiter } = require("./userRouter")
const { checkName } = require("../utils/nameRules")
const { verifyTurnstile } = require("../utils/turnstile")

const router = express.Router()

// Mentors are users with role "mentor" (PRD §C.1: separate login page, same auth stack). They log in
// through the ordinary /user/login; only account creation needs its own endpoint, because the
// role is decided by WHICH endpoint was called — never by a field in the body.

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const TRANSITION_CATEGORIES = ["Category A", "Category B", "Category C", "Category D"]
const taxonomy = require("../data/ALL-professions.json")
const { industryByCode } = require("../utils/industries")
const professionById = new Map(taxonomy.professions.map((profession) => [profession.id, profession]))


// ========================
// Helpers
// ========================

// "Finance, Consulting" or ["Finance", "Consulting"] → ["Finance", "Consulting"]
const toList = (value) => {
    const items = Array.isArray(value) ? value : String(value || "").split(",")
    return items.map((item) => String(item).trim()).filter((item) => item !== "")
}

// Round 34: where we pay a mentor (admin-only). An Indian mentor gives a UPI ID or a bank account; an
// international one an Indian (NRE/NRO) account or how they'd like to be paid (Wise, PayPal email). PAN
// is asked for tax (TDS) and checked only for its shape.
const { REGIONS } = require("../utils/mentorTiers")
const cleanPayout = (raw, region) => {
    const text = (value, max) => (typeof value === "string" ? value.trim().slice(0, max) : "")
    const payout = {
        upiId: text(raw.upiId, 80),
        accountName: text(raw.accountName, 100),
        accountNumber: text(raw.accountNumber, 30).replace(/\s/g, ""),
        ifsc: text(raw.ifsc, 11).toUpperCase(),
        pan: text(raw.pan, 10).toUpperCase(),
        intlMethod: text(raw.intlMethod, 200),
    }
    const bank = payout.accountName && payout.accountNumber && payout.ifsc
    if (payout.upiId && !/^[\w.\-]{2,}@[a-zA-Z]{2,}$/.test(payout.upiId)) return { error: "That UPI ID doesn't look right (like name@okbank)" }
    if (payout.ifsc && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(payout.ifsc)) return { error: "That IFSC doesn't look right (like HDFC0001234)" }
    if (payout.accountNumber && !/^\d{6,18}$/.test(payout.accountNumber)) return { error: "Please enter the account number in digits" }
    if (payout.pan && !/^[A-Z]{5}\d{4}[A-Z]$/.test(payout.pan)) return { error: "That PAN doesn't look right (like ABCDE1234F)" }
    if (region === "indian" && !payout.upiId && !bank) return { error: "Please give a UPI ID, or your bank account name, number and IFSC, so we can pay you" }
    if (region === "international" && !bank && !payout.intlMethod) return { error: "Please tell us how to pay you — an Indian NRE/NRO account, or Wise / PayPal" }
    return { payout }
}

// the 12 onboarding fields, whitelisted and checked. Returns { fields } or { error }.
// status, user and approval fields are never read from the body.
const cleanOnboarding = (body) => {
    const text = (value) => (typeof value === "string" ? value.trim() : "")

    const fields = {
        name: text(body.name),
        email: text(body.email).toLowerCase(),
        phone: text(body.phone),
        yearsExperience: Number(body.yearsExperience),
        languages: toList(body.languages),
        motivation: text(body.motivation),
        transitionCategory: text(body.transitionCategory),
        preferredCurrency: text(body.preferredCurrency),
        residenceCitizenship: text(body.residenceCitizenship),
        region: REGIONS.includes(body.region) ? body.region : null,
    }
    // Round 35 (owner): the Calendly links are not part of the profile — they're asked in the test
    // (mentorTestRouter), so a profile save never touches them

    if (!fields.name) return { error: "Please enter your full name" }
    if (!emailRegex.test(fields.email)) return { error: "Please enter a valid email" }
    // country code + number: at least 8 digits, an optional leading +, spaces and dashes allowed
    if (!/^\+?[0-9][0-9\s-]{7,19}$/.test(fields.phone)) return { error: "Please enter your contact number with country code" }
    // 4–6 from our lists (Round 12): the profession by id, a job role in it or their own words for
    // one, and at least one industry. The readable fields are written from these, never typed.
    const profession = professionById.get(text(body.professionId))
    if (!profession) return { error: "Please choose your profession from the list" }
    let role = (profession.job_roles || []).find((name) => name === body.jobRole)
    let roleOther = ""
    if (body.jobRole === "other") {
        roleOther = text(body.jobRoleOther).slice(0, 120)
        if (roleOther.length < 2) return { error: "Please tell us your job role" }
        role = roleOther
    }
    if (!role) return { error: "Please choose your job role from that profession" }
    const industries = (Array.isArray(body.industryCodes) ? body.industryCodes : []).map(String).filter((code) => industryByCode.has(code))
    if (industries.length === 0) return { error: "Please choose at least one industry from the list" }
    Object.assign(fields, {
        professionId: profession.id,
        professionName: profession.profession,
        jobRole: role,
        jobRoleOther: roleOther,
        industryCodes: [...new Set(industries)],
        currentRole: role,
        discipline: profession.profession,
        sectors: [...new Set(industries)].map((code) => industryByCode.get(code).name),
    })
    if (!Number.isFinite(fields.yearsExperience) || fields.yearsExperience < 0 || fields.yearsExperience > 60) {
        return { error: "Please enter your years of experience" }
    }
    if (fields.languages.length === 0) return { error: "Please list at least one language" }
    if (!fields.motivation) return { error: "Please tell us why you want to mentor" }
    if (!TRANSITION_CATEGORIES.includes(fields.transitionCategory)) return { error: "Please choose how you approached high school to college" }
    // Round 34 (owner): where they live sets their pay — India, or abroad (an Indian living abroad)
    if (!fields.region) return { error: "Please tell us whether you live in India or abroad" }
    if (!fields.residenceCitizenship) return { error: "Please enter the country you live in" }
    const payout = cleanPayout(body.payout || {}, fields.region)
    if (payout.error) return { error: payout.error }
    fields.payout = payout.payout
    return { fields }
}


// ========================
// Register A Mentor
// ========================

// Round 25 (spam sign-ups): the same shields as a student sign-up — 5 an hour per IP, a hidden box
// only bots fill, and a name that has to look like one. Round 27: and Cloudflare's check, once its
// keys are set — the bots of 6–10 Oct arrived through this form
router.post("/register", registerRateLimiter, async (req, res) => {
    try {
        const { name, email, password } = req.body

        if (typeof req.body.website === "string" && req.body.website.trim() !== "") {
            return res.status(201).json({ success: true, message: "Registered Successfully" })
        }

        const nameError = checkName(name)
        if (nameError) {
            return res.status(400).json({
                success: false,
                message: nameError
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

        // checked last: its token works once (Round 28)
        if (!(await verifyTurnstile(req.body.turnstileToken, req.ip))) {
            return res.status(400).json({
                success: false,
                message: "Please complete the check that you're a person, then try again"
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
            token: await startSession(newUser._id),
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

        // Round 38 (owner): the signed Mentor Agreement comes first
        if (!(await MentorAgreement.exists({ mentor: req.user._id }))) {
            return res.status(400).json({
                success: false,
                message: "Please upload your signed Mentor Agreement first"
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
        const profile = await Mentor.findOne({ user: req.user._id }).lean()

        // Round 34: their tier, what a session pays them now, and how they stand against the next tier
        let standing = null
        if (profile) {
            const numbers = await standingOf(req.user._id)
            standing = {
                sessions: numbers.sessions,
                average: numbers.average,
                roadmapSteps: numbers.roadmapSteps,
                dataReviewed: numbers.dataReviewed,
                tier2Missing: tier2Missing(profile, numbers, numbers),
                tier3Missing: tier3Missing(profile, numbers, numbers),
                mainRate: mainRate(profile),
                followUpRate: payoutAmount(profile, "followup"),
                strikes: (profile.strikes || []).length,
            }
        }

        const agreement = profile ? agreementMeta(await MentorAgreement.findOne({ mentor: req.user._id }).lean()) : null

        return res.status(200).json({
            success: true,
            message: profile ? "Profile fetched successfully" : "No profile yet",
            data: profile ? { ...profile, strikes: undefined, standing, agreement } : null,
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

        // where they live sets their pay: once approved, only the admin changes it
        const existing = await Mentor.findOne({ user: req.user._id }).select("status region").lean()
        if (existing && existing.status === "onboarded" && existing.region) fields.region = existing.region

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
        const mentors = await Mentor.find({}).sort({ status: -1, createdAt: -1 }).lean()
        const tests = new Map((await MentorTest.find({ mentor: { $in: mentors.map((mentor) => mentor.user) } }).select("mentor submittedAt decision autoScore").lean()).map((test) => [String(test.mentor), test]))
        // Round 35 (owner): what each has earned — paid so far, and due
        const earnings = new Map((await MentorPayout.aggregate([
            { $match: { status: { $in: ["paid", "due"] } } },
            { $group: { _id: "$mentor", paidInr: { $sum: { $cond: [{ $eq: ["$status", "paid"] }, "$amountInr", 0] } }, dueInr: { $sum: { $cond: [{ $eq: ["$status", "due"] }, "$amountInr", 0] } }, noShows: { $sum: { $cond: [{ $eq: ["$studentStatus", "no_show"] }, 1, 0] } } } },
        ])).map((row) => [String(row._id), row]))

        // Round 38: whose signed agreement is in
        const agreements = new Map((await MentorAgreement.find({ mentor: { $in: mentors.map((mentor) => mentor.user) } }).lean()).map((agreement) => [String(agreement.mentor), agreementMeta(agreement)]))

        // Round 34: how each stands against the tier rules — sessions with feedback, average, strikes
        const data = await Promise.all(mentors.map(async (mentor) => {
            const standing = await standingOf(mentor.user)
            return {
                ...mentor,
                standing: { sessions: standing.sessions, average: standing.average, upheldReports: standing.upheldReports, roadmapSteps: standing.roadmapSteps, dataReviewed: standing.dataReviewed },
                tier3Missing: tier3Missing(mentor, standing, standing),
                mainRate: mainRate(mentor),
                test: tests.get(String(mentor.user)) || null,
                earnings: earnings.get(String(mentor.user)) || { paidInr: 0, dueInr: 0, noShows: 0 },
                agreement: agreements.get(String(mentor.user)) || null,
            }
        }))

        return res.status(200).json({
            success: true,
            message: "Mentors fetched successfully",
            data,
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

// Round 34: a NEW mentor is approved through their test (mentorTestRouter decideForAdmin). This is for
// bringing back a paused mentor, or one approved before the test existed.
router.put("/approveForAdmin/:id", authMiddleware, adminAuthMiddleware, async (req, res) => {
    try {
        const { id } = req.params   // :id is a MENTOR PROFILE id

        const current = await Mentor.findById(id).select("status").lean()
        if (current && ["pending_review", "test_submitted"].includes(current.status)) {
            return res.status(400).json({ success: false, message: "A new mentor is approved from their test — open Review test" })
        }

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


// ========================
// Tier 3, region and rate (owner, Round 34)
// ========================

// TIER 3 IS THE ADMIN'S CALL, and only once the mentor meets the rule (utils/mentorTiers.js)
router.put("/setTier3ForAdmin/:id", authMiddleware, adminAuthMiddleware, async (req, res) => {
    try {
        const mentor = await Mentor.findById(req.params.id)   // :id is a MENTOR PROFILE id
        if (!mentor) {
            return res.status(404).json({ success: false, message: "Mentor not found" })
        }
        const standing = await standingOf(mentor.user)
        const missing = tier3Missing(mentor, standing, standing)
        if (missing.length > 0) {
            return res.status(400).json({ success: false, message: `Not yet — still needs ${missing.join(", ")}` })
        }
        mentor.tier = 3
        mentor.tierHistory.push({ tier: 3, at: new Date(), by: "admin" })
        await mentor.save()
        notifyStudent(await User.findById(mentor.user).select("email").lean(), "mentorTierUp", { tier: 3 })
        return res.status(200).json({ success: true, message: `${mentor.name} is now Tier 3`, data: mentor })

    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to move to Tier 3", error: error.message })
    }
})

// where they live (sets their pay) and a Tier-3 rate above the table's
router.put("/updateTermsForAdmin/:id", authMiddleware, adminAuthMiddleware, async (req, res) => {
    try {
        const update = {}
        if (req.body.region !== undefined) {
            if (!REGIONS.includes(req.body.region)) {
                return res.status(400).json({ success: false, message: "Region must be indian or international" })
            }
            update.region = req.body.region
        }
        for (const key of ["customRateInr", "customRateUsd"]) {
            if (req.body[key] === undefined) continue
            const value = req.body[key] === null || req.body[key] === "" ? null : Number(req.body[key])
            if (value !== null && (!Number.isFinite(value) || value <= 0 || value > 100000)) {
                return res.status(400).json({ success: false, message: "Please enter a rate as a number" })
            }
            update[key] = value
        }
        const mentor = await Mentor.findByIdAndUpdate(req.params.id, { $set: update }, { returnDocument: "after" })
        if (!mentor) {
            return res.status(404).json({ success: false, message: "Mentor not found" })
        }
        return res.status(200).json({ success: true, message: "Saved", data: mentor })

    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to save", error: error.message })
    }
})


module.exports = router
module.exports.cleanOnboarding = cleanOnboarding
