const mongoose = require("mongoose")

// a student asks for a full refund and says why; an admin reads the reason and decides

const refundRequestSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        reason: {
            type: String,
            required: true, // the student's own words, any length — for admin review
        },
        tierAtRequest: {
            type: Number,
            required: true, // 1 | 2
        },
        refundType: {
            type: String,
            default: "full", // full = all access ends | rollover = Tier 2 → Tier 1, differential back
        },
        initiatedBy: {
            type: String,
            default: "student", // student | admin (an admin downgrade writes one of these too)
        },
        amountInr: {
            type: Number,
            required: true, // server-computed: Σ purchase + upgrade − Σ non-failed refunds
        },
        status: {
            type: String,
            default: "pending", // pending | refund_pending | refunded | refund_failed | declined
        },
        failureMessage: {
            type: String, // Razorpay's error, shown on the admin page when a refund fails
        },
        adminNote: {
            type: String,
        },
        handledByAdmin: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
        handledAt: {
            type: Date,
        },
    },
    {
        timestamps: true,
    }
)

// admin pending list, newest first
refundRequestSchema.index({ status: 1, createdAt: -1 })
// "already has a request open?" check
refundRequestSchema.index({ user: 1 })

const RefundRequest = mongoose.model("RefundRequest", refundRequestSchema)

module.exports = RefundRequest
