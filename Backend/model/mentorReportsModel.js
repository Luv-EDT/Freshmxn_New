const mongoose = require("mongoose")

// A STUDENT REPORTING THEIR MENTOR (owner, Round 28). The student is told to block the mentor on
// WhatsApp straight away and chooses what they want next — their money back, or another mentor. The
// admin acts on it (Mentor feedback tab): another mentor sends the row back to matching with this
// mentor kept out; a refund goes through the refund tools; the mentor can be paused.

const REASONS = ["inappropriate", "privacy", "no_show", "other"]

const reportSchema = new mongoose.Schema(
    {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        waitlist: { type: mongoose.Schema.Types.ObjectId, ref: "MentorWaitlist" },
        mentor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        mentorName: { type: String, default: null },
        reason: { type: String, enum: REASONS, required: true },
        note: { type: String, default: "" },
        wants: { type: String, enum: ["refund", "new_mentor"], required: true },
        status: { type: String, enum: ["open", "resolved"], default: "open" },
        outcome: { type: String, default: null },   // new_mentor | refund | no_action
        mentorPaused: { type: Boolean, default: false },
        adminNote: { type: String, default: "" },
        handledAt: { type: Date, default: null },
    },
    { timestamps: true }
)

reportSchema.index({ status: 1, createdAt: -1 })

module.exports = mongoose.model("MentorReport", reportSchema)
module.exports.REASONS = REASONS
