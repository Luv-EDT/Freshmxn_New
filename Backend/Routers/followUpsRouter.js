const express = require("express")
const FollowUp = require("../model/followUpsModel")
const User = require("../model/userModel")
const Recommendation = require("../model/recommendationsModel")
const authMiddleware = require("../middlewares/authMiddleware")
const adminAuthMiddleware = require("../middlewares/adminAuthMiddleware")
const { hashToken } = require("../housekeeping/followUpScan")

const router = express.Router()

// The 6- and 12-month follow-up form (Round 10) — see housekeeping/followUpScan.js.
// Public routes, keyed only by the emailed token: the student answers from their inbox without
// logging in. The API prefix is /followUps; the page is /follow-up/:token, so they never collide.

const DOING_NOW = ["studying", "working", "preparing_for_exam", "between_things", "other"]
const FOLLOWED = ["yes", "partly", "no"]

const findByToken = async (token) => {
    if (typeof token !== "string" || token.length < 20) return null
    const followUp = await FollowUp.findOne({ tokenHash: hashToken(token) })
    if (!followUp || new Date(followUp.expiresAt).getTime() < Date.now()) return null
    return followUp
}


// ========================
// Get The Form
// ========================

router.get("/getForm/:token", async (req, res) => {
    try {
        const followUp = await findByToken(req.params.token)

        if (!followUp) {
            return res.status(404).json({ success: false, message: "This link has expired or is not valid" })
        }

        const [user, recommendation] = await Promise.all([
            User.findById(followUp.user).select("name").lean(),
            Recommendation.findOne({ user: followUp.user }).select("ranked_professions").lean(),
        ])

        // their own matches, so "which career?" is one tap; "something else" is always there
        const careers = ((recommendation && recommendation.ranked_professions) || [])
            .slice(0, 10)
            .map((entry) => ({ id: entry.professionId, name: entry.profession }))

        return res.status(200).json({
            success: true,
            message: "Form fetched successfully",
            data: {
                firstName: user ? String(user.name).split(" ")[0] : null,
                wave: followUp.wave,
                careers,
                responded: Boolean(followUp.respondedAt),
            },
        })

    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to load the form", error: error.message })
    }
})


// ========================
// Submit Answers
// ========================

router.post("/submit/:token", async (req, res) => {
    try {
        const followUp = await findByToken(req.params.token)

        if (!followUp) {
            return res.status(404).json({ success: false, message: "This link has expired or is not valid" })
        }

        const { doingNow, careerId, careerText, followedMatch, satisfaction, note } = req.body

        if (!DOING_NOW.includes(doingNow) || !FOLLOWED.includes(followedMatch)) {
            return res.status(400).json({ success: false, message: "Please answer the questions marked as needed" })
        }

        const rating = Number(satisfaction)
        if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
            return res.status(400).json({ success: false, message: "Please pick how satisfied you are, 1 to 5" })
        }

        followUp.answers = {
            doingNow,
            careerId: typeof careerId === "string" && careerId ? careerId.slice(0, 80) : null,
            careerText: typeof careerText === "string" ? careerText.trim().slice(0, 120) : null,
            followedMatch,
            satisfaction: rating,
            note: typeof note === "string" ? note.trim().slice(0, 1000) : null,
        }
        followUp.respondedAt = new Date()
        await followUp.save()

        return res.status(200).json({ success: true, message: "Thank you — that really helps", data: { responded: true } })

    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to save your answers", error: error.message })
    }
})


// ========================
// Stop These Emails
// ========================

router.post("/unsubscribe/:token", async (req, res) => {
    try {
        const followUp = await findByToken(req.params.token)

        if (!followUp) {
            return res.status(404).json({ success: false, message: "This link has expired or is not valid" })
        }

        await User.updateOne({ _id: followUp.user }, { followUpOptOut: true })

        return res.status(200).json({ success: true, message: "Done — we won't send these again", data: { unsubscribed: true } })

    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to unsubscribe", error: error.message })
    }
})


// ========================
// Follow-ups For Admin
// ========================

router.get("/getAllForAdmin", authMiddleware, adminAuthMiddleware, async (req, res) => {
    try {
        const followUps = await FollowUp.find()
            .sort({ createdAt: -1 })
            .limit(1000)
            .populate("user", "name email")
            .select("-tokenHash")
            .lean()

        const sent = followUps.length
        const answered = followUps.filter((followUp) => followUp.respondedAt).length

        return res.status(200).json({
            success: true,
            message: "Follow-ups fetched successfully",
            data: { followUps, summary: { sent, answered } },
        })

    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to fetch follow-ups", error: error.message })
    }
})

// The admin's "Run now" for any of the three calendar jobs (followup_scan, data_refresh,
// career_scout) — queued, not run in the request, because the refresh and the scout take minutes.
router.post("/runHousekeepingForAdmin", authMiddleware, adminAuthMiddleware, async (req, res) => {
    try {
        const { job } = req.body
        const { runNow, JOBS } = require("../workers/housekeepingWorker")
        const { withTimeout } = require("../workers/queueHelpers")

        if (!JOBS[job]) {
            return res.status(400).json({ success: false, message: "Unknown job" })
        }

        await withTimeout(runNow(job), "queueing the job")

        return res.status(202).json({ success: true, message: "Started — results appear here in a few minutes", data: { job } })

    } catch (error) {
        return res.status(500).json({ success: false, message: "Could not start the job", error: error.message })
    }
})

module.exports = router
