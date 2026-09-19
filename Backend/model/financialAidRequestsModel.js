const mongoose = require("mongoose")

// a student who can't afford a tier asks for a subsidised rate. The admin calls them, agrees a
// figure, and approves it here — calculateQuote then charges that figure instead of the list price,
// which makes it work identically in manual and Razorpay mode.

const financialAidRequestSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        requestedTier: {
            type: Number,
            required: true, // 1 | 2 — an approval only applies to the tier it was granted for
        },
        reason: {
            type: String,
            required: true, // the student's own words, for the admin to judge
        },
        name: {
            type: String,
            required: true,
        },
        phone: {
            type: String,
            required: true,
        },
        callbackDay: {
            type: String,
            required: true, // today | tomorrow | day_after
        },
        callbackSlot: {
            type: String,
            required: true, // morning | afternoon | evening
        },
        status: {
            type: String,
            default: "pending", // pending | approved | declined
        },
        approvedAmountInr: {
            type: Number, // what the admin agreed on the call — overrides the list price
        },
        usedAt: {
            type: Date, // stamped by grantAccess, so one approval can't be spent twice
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
financialAidRequestSchema.index({ status: 1, createdAt: -1 })
// the quote lookup: does this student have an approved, unused aid for this tier?
financialAidRequestSchema.index({ user: 1 })

const FinancialAidRequest = mongoose.model("FinancialAidRequest", financialAidRequestSchema)

module.exports = FinancialAidRequest
