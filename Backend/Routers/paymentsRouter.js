const express = require("express")
const crypto = require("crypto")
const Razorpay = require("razorpay")
const User = require("../model/userModel")
const Payment = require("../model/paymentsModel")
const AccessRequest = require("../model/accessRequestsModel")
const RefundRequest = require("../model/refundRequestsModel")
const FinancialAidRequest = require("../model/financialAidRequestsModel")
const Coupon = require("../model/couponsModel")
const authMiddleware = require("../middlewares/authMiddleware")
const adminAuthMiddleware = require("../middlewares/adminAuthMiddleware")
const requirePaid = require("../middlewares/requirePaid")

// This whole router is mounted BEFORE app.use(express.json()) in server.js, because the Razorpay
// webhook needs the raw request body to check its signature. Every JSON route below adds
// express.json() itself. In Express 5 a POST without it has req.body === undefined.

const router = express.Router()

// null when the keys are missing, so the server still boots in manual mode
const razorpay = process.env.RAZORPAY_KEY_ID
    ? new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET,
    })
    : null

// prices are module constants, not env vars — a missing env var must never mean a ₹0 charge
const TIER_PRICE_INR = {
    1: 3500,    // Career Discovery
    2: 6500,    // Mentorship
}

const phoneRegex = /^[0-9]{10}$/

// shown on the admin page and in the student's own request list
const CALLBACK_DAYS = ["today", "tomorrow", "day_after"]
const CALLBACK_SLOTS = ["morning", "afternoon", "evening"]


// ========================
// calculateQuote — tier + coupon → the amount we will actually charge
// ========================

// every money route calls this; none of them trust an amount from req.body
const calculateQuote = async (user, tier, coupon) => {
    const requestedTier = Number(tier)

    if (requestedTier !== 1 && requestedTier !== 2) {
        return { error: "Invalid tier" }
    }

    if (user.paid === true && user.currentTier >= requestedTier) {
        return { error: "You already have this tier" }
    }

    // a Tier 1 student moving to Tier 2 pays the difference, not the full ₹7,000
    const isUpgrade = user.paid === true && user.currentTier === 1 && requestedTier === 2

    const baseAmountInr = isUpgrade
        ? TIER_PRICE_INR[2] - TIER_PRICE_INR[1]
        : TIER_PRICE_INR[requestedTier]

    let couponCode = null
    let discountPct = 0

    if (coupon && coupon.trim()) {
        couponCode = coupon.trim().toUpperCase()

        const existingCoupon = await Coupon.findOne({ code: couponCode })

        const isCouponUsable = existingCoupon
            && existingCoupon.isActive
            && (!existingCoupon.expiresAt || existingCoupon.expiresAt > new Date())
            && (existingCoupon.usageLimit === 0 || existingCoupon.timesUsed < existingCoupon.usageLimit)

        // never a silent 0% — a student who typed a code must know it didn't work
        if (!isCouponUsable) {
            return { error: "Invalid coupon" }
        }

        discountPct = existingCoupon.discountPct
    }

    // an approved financial aid replaces the price outright — it already IS the discount, so a
    // coupon on top is ignored. Capped at the base so an aid agreed for a full tier can't exceed
    // the smaller upgrade price.
    const approvedAid = await FinancialAidRequest.findOne({
        user: user._id,
        requestedTier,
        status: "approved",
        usedAt: null,
    })

    if (approvedAid && typeof approvedAid.approvedAmountInr === "number") {
        return {
            quote: {
                tier: requestedTier,
                isUpgrade,
                baseAmountInr,
                coupon: null,
                discountPct: 0,
                isFinancialAid: true,
                finalAmountInr: Math.min(approvedAid.approvedAmountInr, baseAmountInr),
            }
        }
    }

    // whole rupees only — Razorpay takes paise, and a fractional rupee is a non-integer paise amount
    const finalAmountInr = Math.round((baseAmountInr * (100 - discountPct)) / 100)

    return {
        quote: {
            tier: requestedTier,
            isUpgrade,
            baseAmountInr,
            coupon: couponCode,
            discountPct,
            isFinancialAid: false,
            finalAmountInr,
        }
    }
}


// ========================
// grantAccess — the ONE seam both payment modes call
// ========================

// callers: the admin Grant action (manual mode) and the verified Razorpay webhook.
// the only place that sets paid = true / currentTier and writes a purchase or upgrade row.
const grantAccess = async (userId, tier, amountInr, coupon, options = {}) => {
    const user = await User.findById(userId)

    if (!user) {
        return { error: "User not found" }
    }

    // already holds this tier → write nothing. Razorpay retries webhooks; admins double-click.
    if (user.paid === true && user.currentTier >= tier) {
        return { user, payment: null, isAlreadyGranted: true }
    }

    const isUpgrade = user.paid === true && user.currentTier === 1 && tier === 2

    const newPayment = await Payment.create({
        user: userId,
        mode: options.mode || "manual",
        razorpayOrderId: options.razorpayOrderId,
        razorpayPaymentId: options.razorpayPaymentId,
        tier,
        action: isUpgrade ? "upgrade" : "purchase",
        coupon: coupon || undefined,
        discountPct: options.discountPct || 0,
        amountInr,
        status: "paid",
        paidAt: new Date(),
        grantedByAdmin: options.grantedByAdmin,
        accessRequest: options.accessRequest,
    })

    // dot-paths so the other progress fields are never overwritten
    const updatedUser = await User.findByIdAndUpdate(
        userId,
        {
            paid: true,
            currentTier: tier,
            "progress.mentor": tier === 2 ? "waitlisted" : "not_applicable",
        },
        { returnDocument: "after" }
    ).select("-password")

    if (coupon) {
        await Coupon.updateOne({ code: coupon }, { $inc: { timesUsed: 1 } })
    }

    // a subsidised rate is spent once — the next purchase is back at list price unless re-approved
    await FinancialAidRequest.findOneAndUpdate(
        { user: userId, requestedTier: tier, status: "approved", usedAt: null },
        { usedAt: new Date() }
    )

    return { user: updatedUser, payment: newPayment, isAlreadyGranted: false }
}


// ========================
// Refund helpers — money-back logic lives here once, shared by downgrade and full refund
// ========================

// what is still refundable on one purchase/upgrade payment
const getRefundableBalance = async (originalPayment) => {
    // Only money that actually arrived can go back. An overturned grant (status "reversed" — the
    // student never paid), a failed row, or an order that was never captured must never read as
    // refundable, or we would hand back cash that was never collected. Guarding here rather than in
    // each caller's query covers getFullRefundAmount, getRolloverRefund, refundForAdmin and the
    // Razorpay path at once.
    if (originalPayment.status !== "paid") return 0

    const existingRefunds = await Payment.find({
        refundOfPayment: originalPayment._id,
        action: "refund",
        status: { $ne: "failed" },      // a failed refund returned nothing
    })

    const refundedInr = existingRefunds.reduce((sum, refund) => sum + refund.amountInr, 0)

    return Math.max(originalPayment.amountInr - refundedInr, 0)
}

// the Razorpay SDK rejects with a plain object, sometimes just { statusCode: 404 } and no description
const getRazorpayErrorMessage = (error) => {
    if (error && error.error && error.error.description) return error.error.description
    if (error && error.message) return error.message
    if (error && error.statusCode) return `Razorpay returned status ${error.statusCode}`
    return "Razorpay refund failed"
}

// Razorpay mode: ask Razorpay to send the money back, then record it
const refundThroughRazorpay = async (originalPayment, amountInr, refundContext) => {
    const refundRow = {
        user: originalPayment.user,
        mode: "razorpay",
        tier: refundContext.tierAfter,
        action: "refund",
        amountInr,
        grantedByAdmin: refundContext.grantedByAdmin,
        refundRequest: refundContext.refundRequest,
        refundOfPayment: originalPayment._id,
    }

    try {
        const razorpayRefund = await razorpay.payments.refund(originalPayment.razorpayPaymentId, {
            amount: amountInr * 100,    // Razorpay takes paise
            speed: "normal",
            notes: {
                userId: String(originalPayment.user),
                refundRequestId: refundContext.refundRequest ? String(refundContext.refundRequest) : "",
            },
        })

        const isAlreadyProcessed = razorpayRefund.status === "processed"

        return Payment.create({
            ...refundRow,
            razorpayRefundId: razorpayRefund.id,
            status: isAlreadyProcessed ? "refunded" : "refund_pending",
            // a refund that is already done needs its completion date now; otherwise the
            // refund.processed webhook stamps it
            paidAt: isAlreadyProcessed ? new Date() : undefined,
        })

    } catch (error) {
        // Razorpay refused (e.g. low balance) — record it as failed, never swallow it
        return Payment.create({
            ...refundRow,
            status: "failed",
            failureMessage: getRazorpayErrorMessage(error),
        })
    }
}

// picks the mode: Razorpay refunds a Razorpay payment automatically; everything else is recorded
// here and the admin sends the money back by hand
const sendRefund = async (originalPayment, amountInr, refundContext) => {
    if (originalPayment.razorpayPaymentId && process.env.PAYMENT_MODE === "razorpay" && razorpay) {
        return refundThroughRazorpay(originalPayment, amountInr, refundContext)
    }

    return Payment.create({
        user: originalPayment.user,
        mode: "manual",
        tier: refundContext.tierAfter,
        action: "refund",
        amountInr,
        status: "refunded",
        paidAt: new Date(),
        grantedByAdmin: refundContext.grantedByAdmin,
        refundRequest: refundContext.refundRequest,
        refundOfPayment: originalPayment._id,
    })
}

// Tier 2 → Tier 1: which payment the money comes back from, and how much of it.
// Shared by the student's rollover quote, the admin's rollover approval and the admin downgrade,
// so all three always name the same figure.
const getRolloverRefund = async (user) => {
    // the most recent Tier-2 money: an upgrade, or a direct Tier-2 purchase
    const tierTwoPayments = await Payment.find({
        user: user._id,
        $or: [{ action: "upgrade" }, { action: "purchase", tier: 2 }],
    }).sort({ createdAt: -1 })

    for (const payment of tierTwoPayments) {
        const balance = await getRefundableBalance(payment)

        if (balance <= 0) continue

        if (payment.action === "upgrade") {
            // upgraded from Tier 1 → return what they paid for the upgrade
            return { originalPayment: payment, amountInr: balance }
        }

        // bought Tier 2 directly → return what they paid minus Tier 1 at the same discount
        const tierOneAtSameDiscount = Math.round((TIER_PRICE_INR[1] * (100 - payment.discountPct)) / 100)

        return {
            originalPayment: payment,
            amountInr: Math.min(Math.max(payment.amountInr - tierOneAtSameDiscount, 0), balance),
        }
    }

    return { originalPayment: null, amountInr: 0 }
}

// everything paid, minus everything already refunded
const getFullRefundAmount = async (user) => {
    const paidPayments = await Payment.find({
        user: user._id,
        action: { $in: ["purchase", "upgrade"] },
    })

    let amountInr = 0

    for (const payment of paidPayments) {
        amountInr += await getRefundableBalance(payment)
    }

    return amountInr
}

// what a refund of this type is worth right now — the student's quote and the admin's action
// both read it, so the figure a student was shown is the figure that gets refunded
const getRefundAmount = async (user, refundType) => {
    if (refundType === "rollover") {
        const { amountInr } = await getRolloverRefund(user)
        return amountInr
    }

    return getFullRefundAmount(user)
}

// Tier 1 is only "used" once all three of its steps have been delivered.
// report: locked → ready | locked_final, so anything but locked means it reached the student.
const hasCompletedTierOne = (user) => {
    const progress = user.progress || {}

    return progress.interestForm === "done"
        && progress.psychometric === "done"
        && progress.report !== "locked"
}


// ========================
// Razorpay Webhook
// ========================

// sent by Razorpay to my backend — the ONLY Razorpay signal we trust.
// never act on the client-side checkout callback.
const paymentVerificationWebhook = async (req, res) => {
    try {
        if (!process.env.RAZORPAY_WEBHOOK_SECRET) {
            return res.status(400).json({
                success: false,
                message: "Webhook secret not configured"
            })
        }

        const signature = req.headers["x-razorpay-signature"]

        // req.body is a Buffer here (express.raw) — hash the exact bytes Razorpay signed.
        // JSON.parse + re-stringify would reorder keys and break the hash.
        const expectedSignature = crypto
            .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET)
            .update(req.body)
            .digest("hex")

        const isSignatureValid = typeof signature === "string"
            && signature.length === expectedSignature.length
            && crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))

        if (!isSignatureValid) {
            return res.status(400).json({
                success: false,
                message: "Invalid signature"
            })
        }

        const event = JSON.parse(req.body.toString())

        // ── payment.captured → grant access ──────────────────────────────────
        if (event.event === "payment.captured") {
            const razorpayPayment = event.payload.payment.entity

            // same payment id twice = a Razorpay retry
            const existingPayment = await Payment.findOne({ razorpayPaymentId: razorpayPayment.id })

            if (existingPayment) {
                return res.status(200).json({
                    success: true,
                    message: "Payment already recorded"
                })
            }

            // the notes attached at /create-order tell us who paid for what
            const { userId, tier, coupon, discountPct } = razorpayPayment.notes

            const grantResult = await grantAccess(userId, Number(tier), razorpayPayment.amount / 100, coupon || null, {
                mode: "razorpay",
                razorpayOrderId: razorpayPayment.order_id,
                razorpayPaymentId: razorpayPayment.id,
                discountPct: Number(discountPct) || 0,
            })

            if (grantResult.error || grantResult.isAlreadyGranted) {
                console.log("Webhook payment not granted:", razorpayPayment.id, grantResult.error || "already on this tier")
            }

            return res.status(200).json({
                success: true,
                message: "Payment verified"
            })
        }

        // ── refund.processed → the money reached the student ─────────────────
        if (event.event === "refund.processed") {
            const razorpayRefund = event.payload.refund.entity

            const refundRow = await Payment.findOne({ razorpayRefundId: razorpayRefund.id })

            if (!refundRow || refundRow.status === "refunded") {
                return res.status(200).json({
                    success: true,
                    message: "Refund already recorded"
                })
            }

            await Payment.findByIdAndUpdate(refundRow._id, { status: "refunded", paidAt: new Date() })

            // the request is done once none of its refunds are still waiting
            if (refundRow.refundRequest) {
                const stillPending = await Payment.countDocuments({
                    refundRequest: refundRow.refundRequest,
                    status: "refund_pending",
                })

                if (stillPending === 0) {
                    await RefundRequest.findOneAndUpdate(
                        { _id: refundRow.refundRequest, status: "refund_pending" },
                        { status: "refunded" }
                    )
                }
            }

            return res.status(200).json({
                success: true,
                message: "Refund confirmed"
            })
        }

        // ── refund.failed → show it to the admin with a retry ────────────────
        if (event.event === "refund.failed") {
            const razorpayRefund = event.payload.refund.entity

            const refundRow = await Payment.findOne({ razorpayRefundId: razorpayRefund.id })

            if (!refundRow || refundRow.status === "failed") {
                return res.status(200).json({
                    success: true,
                    message: "Refund failure already recorded"
                })
            }

            const failureMessage = "Razorpay could not complete this refund"

            await Payment.findByIdAndUpdate(refundRow._id, { status: "failed", failureMessage })

            if (refundRow.refundRequest) {
                await RefundRequest.findByIdAndUpdate(refundRow.refundRequest, {
                    status: "refund_failed",
                    failureMessage,
                })
            }

            return res.status(200).json({
                success: true,
                message: "Refund failure recorded"
            })
        }

        // ack anything we don't handle, or Razorpay retries it for days
        return res.status(200).json({
            success: true,
            message: "Event ignored"
        })

    } catch (err) {
        return res.status(500).json({
            success: false,
            message: "Webhook failed",
            error: err.message,
        })
    }
}


// ========================
// Get Pricing
// ========================

// public — the marketing site (Day 4) reads prices from here too
router.get("/getPricing", async (req, res) => {
    try {
        const paymentMode = process.env.PAYMENT_MODE === "razorpay" ? "razorpay" : "manual"

        return res.status(200).json({
            success: true,
            message: "Pricing fetched successfully",
            data: {
                tiers: {
                    1: { name: "Career Recommendation + Psychometric Analysis", amountInr: TIER_PRICE_INR[1] },
                    2: { name: "Mentor Connection", amountInr: TIER_PRICE_INR[2] },
                },
                upgradeAmountInr: TIER_PRICE_INR[2] - TIER_PRICE_INR[1],
                paymentMode,
                razorpayKeyId: paymentMode === "razorpay" ? process.env.RAZORPAY_KEY_ID : null,   // public key, safe to send
            },
        })

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to fetch pricing",
            error: error.message,
        })
    }
})


// ========================
// Get Quote
// ========================

router.post("/getQuote", express.json(), authMiddleware, async (req, res) => {
    try {
        const { tier, coupon } = req.body

        const { quote, error } = await calculateQuote(req.user, tier, coupon)

        if (error) {
            return res.status(400).json({
                success: false,
                message: error
            })
        }

        return res.status(200).json({
            success: true,
            message: "Quote fetched successfully",
            data: quote,
        })

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to fetch quote",
            error: error.message,
        })
    }
})


// ========================
// Request Access (manual mode)
// ========================

router.post("/requestAccess", express.json(), authMiddleware, async (req, res) => {
    try {
        const { tier, coupon, name, phone, callbackDay, callbackSlot } = req.body

        // an address nobody can open must never be attached to money — see /user/verifyEmail
        if (req.user.isEmailVerified !== true) {
            return res.status(403).json({
                success: false,
                message: "Please confirm your email first"
            })
        }

        if (!name || !name.trim()) {
            return res.status(400).json({
                success: false,
                message: "Please fill in your name"
            })
        }

        if (!CALLBACK_DAYS.includes(callbackDay) || !CALLBACK_SLOTS.includes(callbackSlot)) {
            return res.status(400).json({
                success: false,
                message: "Please choose when we should call you"
            })
        }

        if (!phoneRegex.test(phone || "")) {
            return res.status(400).json({
                success: false,
                message: "Enter a valid 10-digit phone number"
            })
        }

        const existingRequest = await AccessRequest.findOne({ user: req.user._id, status: "pending" })

        if (existingRequest) {
            return res.status(400).json({
                success: false,
                message: "You already have a pending request"
            })
        }

        // the amount is always recomputed here — any finalAmountInr in the body is ignored
        const { quote, error } = await calculateQuote(req.user, tier, coupon)

        if (error) {
            return res.status(400).json({
                success: false,
                message: error
            })
        }

        const newAccessRequest = await AccessRequest.create({
            user: req.user._id,     // taken from auth middleware, not from req.body
            requestedTier: quote.tier,
            isUpgrade: quote.isUpgrade,
            coupon: quote.coupon || undefined,
            discountPct: quote.discountPct,
            finalAmountInr: quote.finalAmountInr,
            name: name.trim(),
            phone,
            callbackDay,
            callbackSlot,
            status: "pending",      // always starts as pending
        })

        // the user document is the one copy the admin tables read, so keep it current
        await User.findByIdAndUpdate(req.user._id, { phone })

        return res.status(201).json({
            success: true,
            message: "Access request submitted successfully",
            data: newAccessRequest,
        })

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to submit access request",
            error: error.message,
        })
    }
})


// ========================
// Create Order (Razorpay mode)
// ========================

router.post("/create-order", express.json(), authMiddleware, async (req, res) => {
    try {
        // dormant at launch — PAYMENT_MODE=manual until Razorpay KYC clears
        if (process.env.PAYMENT_MODE !== "razorpay" || !razorpay) {
            return res.status(400).json({
                success: false,
                message: "Razorpay is not active"
            })
        }

        // an address nobody can open must never be attached to money — see /user/verifyEmail
        if (req.user.isEmailVerified !== true) {
            return res.status(403).json({
                success: false,
                message: "Please confirm your email first"
            })
        }

        const { tier, coupon } = req.body

        const { quote, error } = await calculateQuote(req.user, tier, coupon)

        if (error) {
            return res.status(400).json({
                success: false,
                message: error
            })
        }

        if (quote.finalAmountInr < 1) {
            return res.status(400).json({
                success: false,
                message: "This coupon makes the price ₹0 — please use Request Access instead"
            })
        }

        const order = await razorpay.orders.create({
            amount: quote.finalAmountInr * 100,     // Razorpay takes paise
            currency: "INR",
            receipt: `t${quote.tier}${req.user._id}${Date.now().toString(36)}`,   // ← must stay under 40 chars
            notes: {
                userId: req.user._id.toString(),
                tier: String(quote.tier),
                coupon: quote.coupon || "",
                discountPct: String(quote.discountPct),
            },
        })

        return res.status(201).json({
            success: true,
            message: "Order created successfully",
            data: {
                order,
                keyId: process.env.RAZORPAY_KEY_ID,     // public key, safe to send to the browser
                quote,
            },
        })

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to create order",
            error: getRazorpayErrorMessage(error),
        })
    }
})


// ========================
// Get My Access Requests
// ========================

router.get("/getMyRequests", authMiddleware, async (req, res) => {
    try {
        const accessRequests = await AccessRequest.find({ user: req.user._id })  // ← filter by logged in user
            .sort({ createdAt: -1 })

        return res.status(200).json({
            success: true,
            message: "Access requests fetched successfully",
            data: accessRequests,
        })

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to fetch access requests",
            error: error.message,
        })
    }
})


// ========================
// Get My Payments
// ========================

router.get("/getMyPayments", authMiddleware, async (req, res) => {
    try {
        const payments = await Payment.find({ user: req.user._id })
            .sort({ createdAt: -1 })

        return res.status(200).json({
            success: true,
            message: "Payments fetched successfully",
            data: payments,
        })

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to fetch payments",
            error: error.message,
        })
    }
})


// ========================
// Get All Access Requests For Admin
// ========================

router.get("/getAllRequestsForAdmin", authMiddleware, adminAuthMiddleware, async (req, res) => {
    try {
        const accessRequests = await AccessRequest.find({})
            .populate("user", "-password")
            .populate("handledByAdmin", "name email")
            .sort({ createdAt: -1 })

        return res.status(200).json({
            success: true,
            message: "Access requests fetched successfully",
            data: accessRequests,
        })

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to fetch access requests",
            error: error.message,
        })
    }
})


// ========================
// Grant Access For Admin
// ========================

router.put("/grantForAdmin/:id", express.json(), authMiddleware, adminAuthMiddleware, async (req, res) => {
    try {
        const { id } = req.params   // :id is an ACCESS REQUEST id

        const accessRequest = await AccessRequest.findById(id)

        if (!accessRequest) {
            return res.status(404).json({
                success: false,
                message: "Access request not found",
            })
        }

        if (accessRequest.status !== "pending") {
            return res.status(400).json({
                success: false,
                message: "Access request already handled",
            })
        }

        const grantResult = await grantAccess(
            accessRequest.user,
            accessRequest.requestedTier,
            accessRequest.finalAmountInr,
            accessRequest.coupon,
            {
                mode: "manual",
                discountPct: accessRequest.discountPct,
                grantedByAdmin: req.user._id,
                accessRequest: accessRequest._id,
            }
        )

        if (grantResult.error) {
            return res.status(404).json({
                success: false,
                message: grantResult.error,
            })
        }

        if (grantResult.isAlreadyGranted) {
            return res.status(400).json({
                success: false,
                message: "Student already has this tier — decline this request instead",
            })
        }

        const updatedAccessRequest = await AccessRequest.findByIdAndUpdate(
            id,
            { status: "granted", handledByAdmin: req.user._id, handledAt: new Date() },
            { returnDocument: "after" }
        )

        return res.status(200).json({
            success: true,
            message: "Access granted successfully",
            data: {
                accessRequest: updatedAccessRequest,
                user: grantResult.user,
                payment: grantResult.payment,
            },
        })

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to grant access",
            error: error.message,
        })
    }
})


// ========================
// Overturn Grant For Admin — the grant was a mistake and the money never arrived
// ========================

// NOT a refund: nothing was collected, so nothing may be recorded as going back. Access is revoked,
// the payment row is marked "reversed" (never deleted — it stays as the record that this happened),
// and the request returns to pending so it can be granted properly once the money really comes in.
router.put("/overturnGrantForAdmin/:id", express.json(), authMiddleware, adminAuthMiddleware, async (req, res) => {
    try {
        const { id } = req.params   // :id is an ACCESS REQUEST id

        const accessRequest = await AccessRequest.findById(id)

        if (!accessRequest) {
            return res.status(404).json({
                success: false,
                message: "Access request not found",
            })
        }

        if (accessRequest.status !== "granted") {
            return res.status(400).json({
                success: false,
                message: "Only a granted request can be overturned",
            })
        }

        // a request that was overturned and then granted again has several rows against it, so take
        // the live one — an older reversed row must not be mistaken for the current grant
        const grantPayment = await Payment.findOne({
            accessRequest: accessRequest._id,
            action: { $in: ["purchase", "upgrade"] },
            status: "paid",
        }).sort({ createdAt: -1 })

        if (!grantPayment) {
            return res.status(400).json({
                success: false,
                message: "No live payment found for this grant — it may already have been overturned",
            })
        }

        // money has already moved on this payment — that is a refund, not a mistake
        const balance = await getRefundableBalance(grantPayment)

        if (balance < grantPayment.amountInr) {
            return res.status(400).json({
                success: false,
                message: "This payment has already been refunded — handle it through Refund Requests",
            })
        }

        // unwinding an earlier grant from underneath a later one would leave the tier wrong
        const laterPayment = await Payment.findOne({
            user: grantPayment.user,
            action: { $in: ["purchase", "upgrade"] },
            status: "paid",
            createdAt: { $gt: grantPayment.createdAt },
        })

        if (laterPayment) {
            return res.status(400).json({
                success: false,
                message: "This student has paid again since. Overturn the newer grant first, or use Refund Requests",
            })
        }

        // an upgrade drops them back to Tier 1 still paid; a first purchase closes access entirely
        const isUpgrade = grantPayment.action === "upgrade"

        const updatedUser = await User.findByIdAndUpdate(
            grantPayment.user,
            {
                paid: isUpgrade,
                currentTier: isUpgrade ? 1 : 0,
                "progress.mentor": "not_applicable",
            },
            { returnDocument: "after" }
        ).select("-password")

        await Payment.findByIdAndUpdate(grantPayment._id, { status: "reversed" })

        // give back whatever the grant spent, so a student who really pays later is not penalised
        if (grantPayment.coupon) {
            await Coupon.updateOne({ code: grantPayment.coupon }, { $inc: { timesUsed: -1 } })
        }

        await FinancialAidRequest.findOneAndUpdate(
            { user: grantPayment.user, requestedTier: accessRequest.requestedTier, status: "approved" },
            { usedAt: null }
        )

        const updatedAccessRequest = await AccessRequest.findByIdAndUpdate(
            id,
            { status: "pending", handledByAdmin: null, handledAt: null },
            { returnDocument: "after" }
        )

        return res.status(200).json({
            success: true,
            message: "Grant overturned — the request is pending again and no refund was recorded",
            data: {
                accessRequest: updatedAccessRequest,
                user: updatedUser,
            },
        })

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to overturn grant",
            error: error.message,
        })
    }
})


// ========================
// Decline Access For Admin
// ========================

router.put("/declineForAdmin/:id", express.json(), authMiddleware, adminAuthMiddleware, async (req, res) => {
    try {
        const { id } = req.params   // :id is an ACCESS REQUEST id

        const accessRequest = await AccessRequest.findById(id)

        if (!accessRequest) {
            return res.status(404).json({
                success: false,
                message: "Access request not found",
            })
        }

        if (accessRequest.status !== "pending") {
            return res.status(400).json({
                success: false,
                message: "Access request already handled",
            })
        }

        const updatedAccessRequest = await AccessRequest.findByIdAndUpdate(
            id,
            { status: "declined", handledByAdmin: req.user._id, handledAt: new Date() },
            { returnDocument: "after" }
        )

        return res.status(200).json({
            success: true,
            message: "Access request declined",
            data: updatedAccessRequest,
        })

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to decline access request",
            error: error.message,
        })
    }
})


// ========================
// Downgrade For Admin (Tier 2 → Tier 1)
// ========================

router.put("/downgradeForAdmin/:id", express.json(), authMiddleware, adminAuthMiddleware, async (req, res) => {
    try {
        const { id } = req.params   // :id is a USER id

        const user = await User.findById(id)

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            })
        }

        if (user.paid !== true || user.currentTier !== 2) {
            return res.status(400).json({
                success: false,
                message: "User is not on Tier 2",
            })
        }

        const { originalPayment, amountInr: refundAmountInr } = await getRolloverRefund(user)

        let refundPayment = null
        let downgradeRequest = null

        if (originalPayment && refundAmountInr > 0) {
            // an admin downgrade is recorded as a refund request too, so the money shows up on the
            // Refund Requests tab and in the student's own history instead of only in the payments
            // collection where no screen reads it
            // a retry after a failed refund reuses the same request instead of stacking a new one
            downgradeRequest = await RefundRequest.findOneAndUpdate(
                {
                    user: user._id,
                    initiatedBy: "admin",
                    refundType: "rollover",
                    status: "refund_failed",
                },
                {
                    amountInr: refundAmountInr,
                    status: "pending",
                    handledByAdmin: req.user._id,
                    handledAt: new Date(),
                },
                { returnDocument: "after" }
            )

            if (!downgradeRequest) {
                downgradeRequest = await RefundRequest.create({
                    user: user._id,
                    reason: "Downgraded from Mentorship to Career Discovery by admin",
                    refundType: "rollover",
                    initiatedBy: "admin",
                    tierAtRequest: 2,
                    amountInr: refundAmountInr,
                    status: "pending",
                    handledByAdmin: req.user._id,
                    handledAt: new Date(),
                })
            }

            refundPayment = await sendRefund(originalPayment, refundAmountInr, {
                tierAfter: 1,
                grantedByAdmin: req.user._id,
                refundRequest: downgradeRequest._id,
            })

            // a refused refund leaves the student on Tier 2, so clicking Downgrade again retries it
            if (refundPayment.status === "failed") {
                await RefundRequest.findByIdAndUpdate(downgradeRequest._id, {
                    status: "refund_failed",
                    failureMessage: refundPayment.failureMessage,
                })

                return res.status(400).json({
                    success: false,
                    message: `Refund failed: ${refundPayment.failureMessage}. The student is still on Tier 2 — try again.`,
                    data: refundPayment,
                })
            }

            await RefundRequest.findByIdAndUpdate(downgradeRequest._id, {
                status: refundPayment.status === "refund_pending" ? "refund_pending" : "refunded",
            })
        }

        const updatedUser = await User.findByIdAndUpdate(
            id,
            {
                currentTier: 1,
                "progress.mentor": "not_applicable",
            },
            { returnDocument: "after" }
        ).select("-password")

        return res.status(200).json({
            success: true,
            message: refundPayment && refundPayment.status === "refund_pending"
                ? "Downgraded — refund sent to Razorpay, waiting for confirmation"
                : "Downgraded successfully",
            data: {
                user: updatedUser,
                refund: refundPayment,
            },
        })

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to downgrade user",
            error: error.message,
        })
    }
})


// ========================
// Get Refund Options (student) — what this student may ask for, and for how much
// ========================

router.get("/getRefundOptions", authMiddleware, requirePaid, async (req, res) => {
    try {
        const isEligible = hasCompletedTierOne(req.user)

        // a Tier 1 student has nothing to roll back to, so only a full refund is offered
        const canRollover = req.user.currentTier === 2

        return res.status(200).json({
            success: true,
            message: "Refund options fetched successfully",
            data: {
                isEligible,
                canRollover,
                fullAmountInr: await getFullRefundAmount(req.user),
                rolloverAmountInr: canRollover ? await getRefundAmount(req.user, "rollover") : 0,
            },
        })

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to fetch refund options",
            error: error.message,
        })
    }
})


// ========================
// Request Refund (student)
// ========================

router.post("/requestRefund", express.json(), authMiddleware, requirePaid, async (req, res) => {
    try {
        const { reason, refundType } = req.body

        // refunds open only once Tier 1 has actually been delivered
        if (!hasCompletedTierOne(req.user)) {
            return res.status(403).json({
                success: false,
                message: "Refunds open once all three Tier 1 steps are complete"
            })
        }

        // any length is fine — the reason goes to the admin, who decides
        if (!reason || !reason.trim()) {
            return res.status(400).json({
                success: false,
                message: "Please tell us why you want a refund"
            })
        }

        const requestedType = refundType === "rollover" ? "rollover" : "full"

        // rolling back to Tier 1 only means anything if they are on Tier 2
        if (requestedType === "rollover" && req.user.currentTier !== 2) {
            return res.status(400).json({
                success: false,
                message: "Only a Mentorship student can move back to Career Discovery"
            })
        }

        const existingRequest = await RefundRequest.findOne({
            user: req.user._id,
            status: { $in: ["pending", "refund_pending", "refund_failed"] },
        })

        if (existingRequest) {
            return res.status(400).json({
                success: false,
                message: "You already have a refund request in progress"
            })
        }

        // computed here, never taken from the body
        const amountInr = await getRefundAmount(req.user, requestedType)

        if (amountInr <= 0) {
            return res.status(400).json({
                success: false,
                message: "There is nothing left to refund on your account"
            })
        }

        const newRefundRequest = await RefundRequest.create({
            user: req.user._id,
            reason: reason.trim(),
            refundType: requestedType,
            initiatedBy: "student",
            tierAtRequest: req.user.currentTier,
            amountInr,
            status: "pending",
        })

        return res.status(201).json({
            success: true,
            message: "Refund request submitted successfully",
            data: newRefundRequest,
        })

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to submit refund request",
            error: error.message,
        })
    }
})


// ========================
// Get My Refund Requests
// ========================

router.get("/getMyRefundRequests", authMiddleware, async (req, res) => {
    try {
        const refundRequests = await RefundRequest.find({ user: req.user._id })
            .sort({ createdAt: -1 })

        return res.status(200).json({
            success: true,
            message: "Refund requests fetched successfully",
            data: refundRequests,
        })

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to fetch refund requests",
            error: error.message,
        })
    }
})


// ========================
// Get All Refund Requests For Admin
// ========================

router.get("/getAllRefundRequestsForAdmin", authMiddleware, adminAuthMiddleware, async (req, res) => {
    try {
        const refundRequests = await RefundRequest.find({})
            .populate("user", "-password")
            .populate("handledByAdmin", "name email")
            .sort({ createdAt: -1 })

        return res.status(200).json({
            success: true,
            message: "Refund requests fetched successfully",
            data: refundRequests,
        })

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to fetch refund requests",
            error: error.message,
        })
    }
})


// ========================
// Get Failed Refunds For Admin
// ========================

// any refund Razorpay refused, including ones from a downgrade (which has no refund request to show it on)
router.get("/getFailedRefundsForAdmin", authMiddleware, adminAuthMiddleware, async (req, res) => {
    try {
        const failedRefunds = await Payment.find({ action: "refund", status: "failed" })
            .populate("user", "-password")
            .sort({ createdAt: -1 })

        return res.status(200).json({
            success: true,
            message: "Failed refunds fetched successfully",
            data: failedRefunds,
        })

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to fetch failed refunds",
            error: error.message,
        })
    }
})


// ========================
// Refund For Admin — full refund, or a rollover from Mentorship back to Career Discovery
// ========================

router.put("/refundForAdmin/:id", express.json(), authMiddleware, adminAuthMiddleware, async (req, res) => {
    try {
        const { id } = req.params   // :id is a REFUND REQUEST id
        const { adminNote } = req.body

        const refundRequest = await RefundRequest.findById(id)

        if (!refundRequest) {
            return res.status(404).json({
                success: false,
                message: "Refund request not found",
            })
        }

        // pending = first attempt, refund_failed = retry. Anything else is already handled.
        if (refundRequest.status !== "pending" && refundRequest.status !== "refund_failed") {
            return res.status(400).json({
                success: false,
                message: "Refund request already handled",
            })
        }

        const student = await User.findById(refundRequest.user)

        if (!student) {
            return res.status(404).json({
                success: false,
                message: "Student not found",
            })
        }

        const newRefunds = []

        if (refundRequest.refundType === "rollover") {
            // Mentorship → Career Discovery: only the Tier-2 part comes back, access continues
            if (student.currentTier !== 2) {
                return res.status(400).json({
                    success: false,
                    message: "This student is no longer on Tier 2",
                })
            }

            const { originalPayment, amountInr } = await getRolloverRefund(student)

            if (!originalPayment || amountInr <= 0) {
                return res.status(400).json({
                    success: false,
                    message: "There is nothing left to refund on the Tier 2 payment",
                })
            }

            const rolloverRefund = await sendRefund(originalPayment, amountInr, {
                tierAfter: 1,
                grantedByAdmin: req.user._id,
                refundRequest: refundRequest._id,
            })

            newRefunds.push(rolloverRefund)

            // only drop the tier once the money is actually on its way — otherwise a failed refund
            // would leave them on Tier 1 with nothing back, and the retry would be refused
            // because they are no longer on Tier 2
            if (rolloverRefund.status !== "failed") {
                await User.findByIdAndUpdate(refundRequest.user, {
                    currentTier: 1,                         // paid stays true — Tier 1 continues
                    "progress.mentor": "not_applicable",
                })
            }

        } else {
            // Close Access: from this click on, the student has no tier
            await User.findByIdAndUpdate(refundRequest.user, {
                paid: false,
                currentTier: 0,
                "progress.mentor": "not_applicable",
            })

            // Refund every payment that still has money on it. On a retry, failed refunds don't count
            // against the balance, so only the part that failed is attempted again.
            const paidPayments = await Payment.find({
                user: refundRequest.user,
                action: { $in: ["purchase", "upgrade"] },
            })

            for (const payment of paidPayments) {
                const balance = await getRefundableBalance(payment)

                if (balance <= 0) continue

                newRefunds.push(await sendRefund(payment, balance, {
                    tierAfter: 0,
                    grantedByAdmin: req.user._id,
                    refundRequest: refundRequest._id,
                }))
            }
        }

        const failedRefund = newRefunds.find((refund) => refund.status === "failed")

        const pendingCount = await Payment.countDocuments({
            refundRequest: refundRequest._id,
            status: "refund_pending",
        })

        let status = "refunded"
        if (pendingCount > 0) status = "refund_pending"
        if (failedRefund) status = "refund_failed"

        const updatedRefundRequest = await RefundRequest.findByIdAndUpdate(
            id,
            {
                status,
                failureMessage: failedRefund ? failedRefund.failureMessage : "",   // clears an old failure on a successful retry
                adminNote: adminNote || refundRequest.adminNote,
                handledByAdmin: req.user._id,
                handledAt: new Date(),
            },
            { returnDocument: "after" }
        )

        const messageByStatus = {
            refunded: refundRequest.refundType === "rollover"
                ? "Moved back to Career Discovery and refund recorded"
                : "Refund recorded successfully",
            refund_pending: "Refund sent to Razorpay — waiting for confirmation",
            refund_failed: `Refund failed: ${failedRefund ? failedRefund.failureMessage : ""}. You can retry.`,
        }

        return res.status(200).json({
            success: status !== "refund_failed",
            message: messageByStatus[status],
            data: {
                refundRequest: updatedRefundRequest,
                refunds: newRefunds,
            },
        })

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to process refund",
            error: error.message,
        })
    }
})


// ========================
// Decline Refund For Admin
// ========================

router.put("/declineRefundForAdmin/:id", express.json(), authMiddleware, adminAuthMiddleware, async (req, res) => {
    try {
        const { id } = req.params   // :id is a REFUND REQUEST id
        const { adminNote } = req.body

        const refundRequest = await RefundRequest.findById(id)

        if (!refundRequest) {
            return res.status(404).json({
                success: false,
                message: "Refund request not found",
            })
        }

        if (refundRequest.status !== "pending") {
            return res.status(400).json({
                success: false,
                message: "Refund request already handled",
            })
        }

        const updatedRefundRequest = await RefundRequest.findByIdAndUpdate(
            id,
            {
                status: "declined",
                adminNote: adminNote || undefined,
                handledByAdmin: req.user._id,
                handledAt: new Date(),
            },
            { returnDocument: "after" }
        )

        return res.status(200).json({
            success: true,
            message: "Refund request declined",
            data: updatedRefundRequest,
        })

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to decline refund request",
            error: error.message,
        })
    }
})


// ========================
// Financial Aid — a student asks for a subsidised rate, the admin agrees one on a call
// ========================

router.post("/requestFinancialAid", express.json(), authMiddleware, async (req, res) => {
    try {
        const { tier, reason, name, phone, callbackDay, callbackSlot } = req.body

        // an address nobody can open must never be attached to money — see /user/verifyEmail
        if (req.user.isEmailVerified !== true) {
            return res.status(403).json({
                success: false,
                message: "Please confirm your email first"
            })
        }

        const requestedTier = Number(tier)

        if (requestedTier !== 1 && requestedTier !== 2) {
            return res.status(400).json({
                success: false,
                message: "Invalid tier"
            })
        }

        if (req.user.paid === true && req.user.currentTier >= requestedTier) {
            return res.status(400).json({
                success: false,
                message: "You already have this tier"
            })
        }

        if (!reason || !reason.trim()) {
            return res.status(400).json({
                success: false,
                message: "Please tell us a little about your situation"
            })
        }

        if (!name || !name.trim()) {
            return res.status(400).json({
                success: false,
                message: "Please fill in your name"
            })
        }

        if (!CALLBACK_DAYS.includes(callbackDay) || !CALLBACK_SLOTS.includes(callbackSlot)) {
            return res.status(400).json({
                success: false,
                message: "Please choose when we should call you"
            })
        }

        if (!phoneRegex.test(phone || "")) {
            return res.status(400).json({
                success: false,
                message: "Enter a valid 10-digit phone number"
            })
        }

        const existingRequest = await FinancialAidRequest.findOne({
            user: req.user._id,
            status: "pending",
        })

        if (existingRequest) {
            return res.status(400).json({
                success: false,
                message: "You already have a financial aid request pending"
            })
        }

        const newAidRequest = await FinancialAidRequest.create({
            user: req.user._id,     // taken from auth middleware, not from req.body
            requestedTier,
            reason: reason.trim(),
            name: name.trim(),
            phone,
            callbackDay,
            callbackSlot,
            status: "pending",      // always starts as pending — an amount is only set by an admin
        })

        // the user document is the one copy the admin tables read, so keep it current
        await User.findByIdAndUpdate(req.user._id, { phone })

        return res.status(201).json({
            success: true,
            message: "Financial aid request submitted successfully",
            data: newAidRequest,
        })

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to submit financial aid request",
            error: error.message,
        })
    }
})


router.get("/getMyFinancialAid", authMiddleware, async (req, res) => {
    try {
        const aidRequests = await FinancialAidRequest.find({ user: req.user._id })
            .sort({ createdAt: -1 })

        return res.status(200).json({
            success: true,
            message: "Financial aid requests fetched successfully",
            data: aidRequests,
        })

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to fetch financial aid requests",
            error: error.message,
        })
    }
})


router.get("/getAllFinancialAidForAdmin", authMiddleware, adminAuthMiddleware, async (req, res) => {
    try {
        const aidRequests = await FinancialAidRequest.find()
            .populate("user", "name email phone age journey paid currentTier")
            .sort({ createdAt: -1 })

        return res.status(200).json({
            success: true,
            message: "Financial aid requests fetched successfully",
            data: aidRequests,
        })

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to fetch financial aid requests",
            error: error.message,
        })
    }
})


router.put("/approveFinancialAidForAdmin/:id", express.json(), authMiddleware, adminAuthMiddleware, async (req, res) => {
    try {
        const { id } = req.params   // :id is a FINANCIAL AID REQUEST id
        const { approvedAmountInr, adminNote } = req.body

        const aidRequest = await FinancialAidRequest.findById(id)

        if (!aidRequest) {
            return res.status(404).json({
                success: false,
                message: "Financial aid request not found",
            })
        }

        if (aidRequest.status !== "pending") {
            return res.status(400).json({
                success: false,
                message: "Financial aid request already handled",
            })
        }

        const amountInr = Math.round(Number(approvedAmountInr))

        // ₹0 would hand out free access through a route meant for a discount — grant it deliberately
        // from the access request instead
        if (!Number.isFinite(amountInr) || amountInr < 1) {
            return res.status(400).json({
                success: false,
                message: "Enter the agreed amount in whole rupees",
            })
        }

        if (amountInr >= TIER_PRICE_INR[aidRequest.requestedTier]) {
            return res.status(400).json({
                success: false,
                message: `A subsidised rate must be below the ₹${TIER_PRICE_INR[aidRequest.requestedTier]} list price`,
            })
        }

        const updatedAidRequest = await FinancialAidRequest.findByIdAndUpdate(
            id,
            {
                status: "approved",
                approvedAmountInr: amountInr,
                adminNote: adminNote || undefined,
                handledByAdmin: req.user._id,
                handledAt: new Date(),
            },
            { returnDocument: "after" }
        )

        return res.status(200).json({
            success: true,
            message: `Financial aid approved at ₹${amountInr}`,
            data: updatedAidRequest,
        })

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to approve financial aid request",
            error: error.message,
        })
    }
})


router.put("/declineFinancialAidForAdmin/:id", express.json(), authMiddleware, adminAuthMiddleware, async (req, res) => {
    try {
        const { id } = req.params   // :id is a FINANCIAL AID REQUEST id
        const { adminNote } = req.body

        const aidRequest = await FinancialAidRequest.findById(id)

        if (!aidRequest) {
            return res.status(404).json({
                success: false,
                message: "Financial aid request not found",
            })
        }

        if (aidRequest.status !== "pending") {
            return res.status(400).json({
                success: false,
                message: "Financial aid request already handled",
            })
        }

        const updatedAidRequest = await FinancialAidRequest.findByIdAndUpdate(
            id,
            {
                status: "declined",
                adminNote: adminNote || undefined,
                handledByAdmin: req.user._id,
                handledAt: new Date(),
            },
            { returnDocument: "after" }
        )

        return res.status(200).json({
            success: true,
            message: "Financial aid request declined",
            data: updatedAidRequest,
        })

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to decline financial aid request",
            error: error.message,
        })
    }
})


router.post(
    "/payment-verification-webhook",
    express.raw({ type: "*/*" }),
    paymentVerificationWebhook
)

module.exports = router
