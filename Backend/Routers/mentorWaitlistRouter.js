const express = require("express")
const User = require("../model/userModel")
const Mentor = require("../model/mentorsModel")
const MentorWaitlist = require("../model/mentorWaitlistModel")
const Recommendation = require("../model/recommendationsModel")
const authMiddleware = require("../middlewares/authMiddleware")
const adminAuthMiddleware = require("../middlewares/adminAuthMiddleware")

const router = express.Router()

// The Tier-2 mentor waitlist, after payment. Flow (mentor_waitlist_page.md):
//   pay → place held (grantAccess, untouched) → student completes Step 1 and CHOOSES a career from
//   their own matches → we match a mentor within 20 BUSINESS DAYS OF THAT CHOICE → admin matches.
//
// The row is created lazily on the student's first visit rather than at payment, so no payment
// code changes: holding Tier 2 is what entitles you to a row, and the row only records the choice.

const MATCH_BUSINESS_DAYS = 20


// ========================
// Helpers
// ========================

// Mon–Fri only, no holiday calendar. Promised to the student as "within 20 business days".
const addBusinessDays = (start, days) => {
    const date = new Date(start)
    let added = 0

    while (added < days) {
        date.setDate(date.getDate() + 1)
        const weekday = date.getDay()
        if (weekday !== 0 && weekday !== 6) added += 1
    }

    return date
}

const dueByFor = (row) => (row && row.choiceSentAt ? addBusinessDays(row.choiceSentAt, MATCH_BUSINESS_DAYS) : null)

const isTier2 = (user) => user.paid === true && user.currentTier === 2

// what a student may see about their assigned mentor — the profile-visible name and role only.
// Contact details, currency and residence never leave the admin side.
const mentorSummary = async (mentorUserId) => {
    if (!mentorUserId) return null
    const profile = await Mentor.findOne({ user: mentorUserId }).select("name currentRole discipline")
    return profile ? { name: profile.name, currentRole: profile.currentRole, discipline: profile.discipline } : null
}


// ========================
// Get My Waitlist
// ========================

router.get("/getMyWaitlist", authMiddleware, async (req, res) => {
    try {
        if (!isTier2(req.user)) {
            return res.status(403).json({
                success: false,
                message: "The mentor waitlist comes with Tier 2"
            })
        }

        const row = await MentorWaitlist.findOneAndUpdate(
            { user: req.user._id },
            { $setOnInsert: { user: req.user._id, matchStatus: "awaiting_choice" } },
            { upsert: true, returnDocument: "after" }
        )

        return res.status(200).json({
            success: true,
            message: "Waitlist fetched successfully",
            data: {
                matchStatus: row.matchStatus,
                chosenProfessionId: row.chosenProfessionId,
                chosenProfessionName: row.chosenProfessionName,
                choiceSentAt: row.choiceSentAt,
                dueBy: dueByFor(row),
                matchedAt: row.matchedAt,
                resolution: row.resolution,
                mentor: await mentorSummary(row.assignedMentor),
            },
        })

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to fetch your waitlist place",
            error: error.message,
        })
    }
})


// ========================
// Choose A Profession
// ========================

// ONE-TIME. Sending the choice starts the 20-business-day clock and the search; a student who
// wants to change it asks us, and an admin resets it (resetChoiceForAdmin below).
router.post("/chooseProfession", authMiddleware, async (req, res) => {
    try {
        if (!isTier2(req.user)) {
            return res.status(403).json({
                success: false,
                message: "The mentor waitlist comes with Tier 2"
            })
        }

        const { professionId } = req.body

        // the choice must come from THIS student's own ranked matches — the id is checked against
        // their recommendation and the name is read from there, never from the request body
        const recommendation = await Recommendation.findOne({ user: req.user._id }).lean()
        const ranked = recommendation ? recommendation.ranked_professions || [] : []
        const match = ranked.find((entry) => String(entry.professionId) === String(professionId))

        if (!match) {
            return res.status(400).json({
                success: false,
                message: ranked.length === 0
                    ? "Your matches aren't ready yet — finish your assessment first"
                    : "Please choose a career from your matches"
            })
        }

        const existing = await MentorWaitlist.findOne({ user: req.user._id })

        if (existing && existing.choiceSentAt) {
            return res.status(400).json({
                success: false,
                message: "You've already sent your choice. To change it, message us on WhatsApp"
            })
        }

        const row = await MentorWaitlist.findOneAndUpdate(
            { user: req.user._id },
            {
                user: req.user._id,
                chosenProfessionId: String(match.professionId),
                chosenProfessionName: match.profession,
                choiceSentAt: new Date(),
                matchStatus: "matching",
            },
            { upsert: true, returnDocument: "after" }
        )

        return res.status(200).json({
            success: true,
            message: "Choice sent — your 20-business-day match has started",
            data: {
                matchStatus: row.matchStatus,
                chosenProfessionId: row.chosenProfessionId,
                chosenProfessionName: row.chosenProfessionName,
                choiceSentAt: row.choiceSentAt,
                dueBy: dueByFor(row),
            },
        })

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to send your choice",
            error: error.message,
        })
    }
})


// ========================
// Get All For Admin
// ========================

// every Tier-2 student, with their row — or a virtual "awaiting_choice" one if they have never
// opened the page. Admin actions below are keyed on the STUDENT's user id for the same reason.
router.get("/getAllForAdmin", authMiddleware, adminAuthMiddleware, async (req, res) => {
    try {
        const students = await User.find({ role: "student", paid: true, currentTier: 2 })
            .select("name email phone createdAt")
            .sort({ createdAt: -1 })
            .lean()

        const rows = await MentorWaitlist.find({ user: { $in: students.map((s) => s._id) } })
            .populate("assignedMentor", "name email")
            .lean()

        const rowByUser = new Map(rows.map((row) => [String(row.user), row]))

        const data = students.map((student) => {
            const row = rowByUser.get(String(student._id)) || { matchStatus: "awaiting_choice" }
            return { student, ...row, user: student._id, dueBy: dueByFor(row) }
        })

        return res.status(200).json({
            success: true,
            message: "Waitlist fetched successfully",
            data,
        })

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to fetch the waitlist",
            error: error.message,
        })
    }
})


// ========================
// Match For Admin
// ========================

router.put("/matchForAdmin/:id", authMiddleware, adminAuthMiddleware, async (req, res) => {
    try {
        const { id } = req.params   // :id is the STUDENT's user id
        const { mentorUserId } = req.body

        const row = await MentorWaitlist.findOne({ user: id })

        if (!row || !row.choiceSentAt) {
            return res.status(400).json({
                success: false,
                message: "This student hasn't chosen a career yet"
            })
        }

        const mentor = await Mentor.findOne({ user: mentorUserId, status: "onboarded" })

        if (!mentor) {
            return res.status(400).json({
                success: false,
                message: "Pick an approved mentor"
            })
        }

        const updated = await MentorWaitlist.findOneAndUpdate(
            { user: id },
            { assignedMentor: mentor.user, matchedAt: new Date(), matchStatus: "matched", resolution: "matched" },
            { returnDocument: "after" }
        )

        return res.status(200).json({
            success: true,
            message: `Matched with ${mentor.name}`,
            data: updated,
        })

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to match",
            error: error.message,
        })
    }
})


// ========================
// Resolve For Admin
// ========================

// When no mentor can be found in 20 business days: rollover first, refund on request
// (mentor_waitlist_page.md). This RECORDS the outcome — an actual refund still goes through the
// Refund Requests tab, so the money trail stays in one place.
router.put("/resolveForAdmin/:id", authMiddleware, adminAuthMiddleware, async (req, res) => {
    try {
        const { id } = req.params   // :id is the STUDENT's user id
        const { resolution, adminNote } = req.body

        if (!["rolled_over", "refunded"].includes(resolution)) {
            return res.status(400).json({
                success: false,
                message: "Resolution must be rolled_over or refunded"
            })
        }

        const updated = await MentorWaitlist.findOneAndUpdate(
            { user: id },
            { matchStatus: "unmatchable", resolution, adminNote: (adminNote || "").trim() },
            { returnDocument: "after" }
        )

        if (!updated) {
            return res.status(404).json({
                success: false,
                message: "No waitlist place for this student"
            })
        }

        return res.status(200).json({
            success: true,
            message: "Resolution recorded",
            data: updated,
        })

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to record the resolution",
            error: error.message,
        })
    }
})


// ========================
// Reset Choice For Admin
// ========================

// the student asked (over WhatsApp) to change their career choice. Clears the choice, the clock and
// any match, back to awaiting_choice — the next choice starts a fresh 20 business days.
router.put("/resetChoiceForAdmin/:id", authMiddleware, adminAuthMiddleware, async (req, res) => {
    try {
        const { id } = req.params   // :id is the STUDENT's user id
        const { adminNote } = req.body

        const updated = await MentorWaitlist.findOneAndUpdate(
            { user: id },
            {
                $set: { matchStatus: "awaiting_choice", adminNote: (adminNote || "").trim() },
                $unset: { chosenProfessionId: "", chosenProfessionName: "", choiceSentAt: "", assignedMentor: "", matchedAt: "", resolution: "" },
            },
            { returnDocument: "after" }
        )

        if (!updated) {
            return res.status(404).json({
                success: false,
                message: "No waitlist place for this student"
            })
        }

        return res.status(200).json({
            success: true,
            message: "Choice reset — the student can choose again",
            data: updated,
        })

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to reset the choice",
            error: error.message,
        })
    }
})


module.exports = router
