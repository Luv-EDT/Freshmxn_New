const mongoose = require("mongoose")

// manual payment mode: a student asks for access, an admin collects payment offline and grants it

const accessRequestSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        requestedTier: {
            type: Number,
            required: true, // 1 | 2
        },
        isUpgrade: {
            type: Boolean,
            default: false, // true → finalAmountInr is the ₹3,500 difference, not the full ₹7,000
        },
        coupon: {
            type: String,
        },
        discountPct: {
            type: Number,
            default: 0,
        },
        finalAmountInr: {
            type: Number,
            required: true, // always computed by the server, never taken from the request body
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
            default: "pending", // pending | granted | declined
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
accessRequestSchema.index({ status: 1, createdAt: -1 })
// a student's own requests
accessRequestSchema.index({ user: 1 })

const AccessRequest = mongoose.model("AccessRequest", accessRequestSchema)

module.exports = AccessRequest
