const mongoose = require("mongoose")

// WHAT WE OWE A MENTOR (owner, Round 34). One row per paid piece of work — a main session (written
// when the student's feedback arrives, or when the student didn't show) or a later follow-up the admin
// adds. The amount is fixed when the row is written, from the mentor's tier and region on that day
// (utils/mentorTiers.js), so a later rate change never rewrites it.
//
// RECORD-ONLY FOR NOW: the admin pays outside the app (UPI, bank, Wise…) and presses "Mark paid" with
// the reference. RazorpayX one-click payouts can later turn that button into "Pay now".

const payoutSchema = new mongoose.Schema(
    {
        mentor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        mentorName: { type: String, default: null },
        student: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
        waitlist: { type: mongoose.Schema.Types.ObjectId, ref: "MentorWaitlist", default: null },
        sessionIndex: { type: Number, default: null },
        kind: { type: String, enum: ["main", "followup"], default: "main" },
        tier: { type: Number, required: true },
        region: { type: String, enum: ["indian", "international"], required: true },
        amountInr: { type: Number, required: true },
        amountUsd: { type: Number, default: null },
        rating: { type: Number, default: null },
        // Round 35 (owner): what happened with the student — the session held, or they didn't show (paid either way)
        studentStatus: { type: String, enum: ["completed", "no_show", null], default: null },
        // the mentor's first session: the admin reads the feedback and keeps them, or removes them
        // (the first session is paid either way)
        needsApproval: { type: Boolean, default: false },
        status: { type: String, enum: ["due", "paid", "cancelled"], default: "due" },
        reference: { type: String, default: "" },       // UPI ref, bank UTR, Wise id…
        paidAt: { type: Date, default: null },
        paidBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
        note: { type: String, default: "" },
    },
    { timestamps: true }
)

// one main payout per session — a resent feedback can never pay twice
payoutSchema.index({ waitlist: 1, sessionIndex: 1, kind: 1 }, { unique: true, partialFilterExpression: { kind: "main" } })
payoutSchema.index({ status: 1, createdAt: -1 })
payoutSchema.index({ mentor: 1, createdAt: -1 })

module.exports = mongoose.model("MentorPayout", payoutSchema)
