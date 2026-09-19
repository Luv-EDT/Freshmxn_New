const mongoose = require("mongoose")

// the full money history. currentTier on the user is only "where they are now";
// every charge and every refund is a row here and nothing is ever overwritten.

const paymentSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        mode: {
            type: String,
            required: true, // manual | razorpay
        },
        razorpayOrderId: {
            type: String,
        },
        razorpayPaymentId: {
            type: String, // leave unset (not null) on manual rows
        },
        razorpayRefundId: {
            type: String, // leave unset (not null) unless Razorpay issued a refund
        },
        tier: {
            type: Number,
            required: true, // the tier the student holds AFTER this row (0 after a full refund)
        },
        action: {
            type: String,
            required: true, // purchase | upgrade | refund
        },
        coupon: {
            type: String,
        },
        discountPct: {
            type: Number,
            default: 0,
        },
        amountInr: {
            type: Number,
            required: true, // always positive — the direction lives in `action`
        },
        status: {
            type: String,
            // created | paid | refund_pending | refunded | failed | reversed
            // "reversed" = an admin overturned the grant because the money never arrived. The row
            // stays as the record that it happened; getRefundableBalance treats it as worth nothing.
            default: "paid",
        },
        failureMessage: {
            type: String,
        },
        paidAt: {
            type: Date,
        },
        grantedByAdmin: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
        accessRequest: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "AccessRequest",
        },
        refundRequest: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "RefundRequest",
        },
        refundOfPayment: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Payment", // on a refund row: the original payment the money comes back from
        },
    },
    {
        timestamps: true,
    }
)

// a student's history, and the refundable-total calculation
paymentSchema.index({ user: 1, createdAt: -1 })
// webhook idempotency — NOT unique: Razorpay can send the same payment twice and we check with findOne
paymentSchema.index({ razorpayPaymentId: 1 }, { sparse: true })
// refund.processed / refund.failed lookups; unique so a refund can never be recorded twice
paymentSchema.index({ razorpayRefundId: 1 }, { unique: true, sparse: true })
// "how much has already come back from this payment?"
paymentSchema.index({ refundOfPayment: 1 }, { sparse: true })

const Payment = mongoose.model("Payment", paymentSchema)

module.exports = Payment
