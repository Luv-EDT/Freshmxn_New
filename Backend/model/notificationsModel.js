const mongoose = require("mongoose")

// A STUDENT'S NOTIFICATIONS (owner, Round 29) — everything we email them also appears here, on their
// Profile (and as a count beside the menu bar's bell). They clear them themselves, and a cleared one
// is DELETED, not hidden. Written by utils/statusEmails.js (email + notification together) and
// utils/notify.js (in-app only, e.g. a reminder held back by the daily email cap).

const notificationSchema = new mongoose.Schema(
    {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        kind: { type: String, required: true },     // the statusEmails template name, e.g. "retakeGranted"
        title: { type: String, required: true },
        body: { type: String, default: "" },        // plain text, never HTML
        link: { type: String, default: null },      // a page on our site, e.g. "/assessment"
    },
    { timestamps: true }
)

notificationSchema.index({ user: 1, createdAt: -1 })

module.exports = mongoose.model("Notification", notificationSchema)
