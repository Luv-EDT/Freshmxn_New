const express = require("express")
const Notification = require("../model/notificationsModel")
const User = require("../model/userModel")
const authMiddleware = require("../middlewares/authMiddleware")

const router = express.Router()

// A STUDENT'S NOTIFICATIONS (owner, Round 29) — mounted at /notifications; the page that shows them is
// /profile, so the prefix is never a page URL. Clearing one deletes it from the database. Round 35
// (owner): opening them marks them seen — the bell then counts only what arrives after.

router.get("/getMine", authMiddleware, async (req, res) => {
    try {
        const rows = await Notification.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(50).lean()
        const seenAt = req.user.notificationsSeenAt ? new Date(req.user.notificationsSeenAt) : null
        return res.status(200).json({
            success: true,
            message: "Notifications fetched",
            data: rows.map((row) => ({ id: row._id, kind: row.kind, title: row.title, body: row.body, link: row.link, createdAt: row.createdAt, seen: Boolean(seenAt && new Date(row.createdAt) <= seenAt) })),
        })

    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to fetch notifications", error: error.message })
    }
})

router.put("/markAllSeen", authMiddleware, async (req, res) => {
    try {
        const seenAt = new Date()
        await User.updateOne({ _id: req.user._id }, { $set: { notificationsSeenAt: seenAt } })
        return res.status(200).json({ success: true, message: "Seen", data: { seenAt } })

    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to mark seen", error: error.message })
    }
})

router.delete("/clearMine/:id", authMiddleware, async (req, res) => {
    try {
        const result = await Notification.deleteOne({ _id: req.params.id, user: req.user._id })
        return res.status(200).json({ success: true, message: "Cleared", data: { cleared: result.deletedCount } })

    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to clear", error: error.message })
    }
})

router.delete("/clearAllMine", authMiddleware, async (req, res) => {
    try {
        const result = await Notification.deleteMany({ user: req.user._id })
        return res.status(200).json({ success: true, message: "All cleared", data: { cleared: result.deletedCount } })

    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to clear", error: error.message })
    }
})

module.exports = router
