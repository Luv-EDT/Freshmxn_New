const mongoose = require("mongoose")

const couponSchema = new mongoose.Schema(
    {
        code: {
            type: String,
            required: true,
            unique: true, // stored uppercase — normalised in the route handler
        },
        discountPct: {
            type: Number,
            required: true, // 0-100
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        expiresAt: {
            type: Date,
        },
        usageLimit: {
            type: Number,
            default: 0, // 0 = unlimited
        },
        timesUsed: {
            type: Number,
            default: 0, // counted when access is granted, not when a quote is shown
        },
    },
    {
        timestamps: true,
    }
)

const Coupon = mongoose.model("Coupon", couponSchema)

module.exports = Coupon
