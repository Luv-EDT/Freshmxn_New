const express = require("express")
const crypto = require("crypto")
const Razorpay = require("razorpay")
const User = require("../model/userModel")
const Payment = require("../model/paymentsModel")
const AccessRequest = require("../model/accessRequestsModel")
const RefundRequest = require("../model/refundRequestsModel")
const FinancialAidRequest = require("../model/financialAidRequestsModel")
const Coupon = require("../model/couponsModel")
const MentorWaitlist = require("../model/mentorWaitlistModel")
const Consent = require("../model/consentModel")
const { isMinor, isVerified } = require("../utils/parentConsent")
const { notifyStudent } = require("../utils/statusEmails")

// NO PAYMENT FROM AN UNDER-18 UNTIL THEIR PARENT HAS CONFIRMED (Round 10). Asked once, at the two
// doors to paying: a manual access request and a Razorpay order. A student already paying before
// this existed is not locked out — the dashboard asks their parent to confirm.
const parentConsentMissing = async (user) => {
    if (!isMinor(user)) return false
    const consent = await Consent.findOne({ user: user._id }).lean()
    return !isVerified(consent)
}

const PARENT_CONSENT_REPLY = {
    success: false,
    message: "Your parent needs to confirm their permission before you can pay — we've emailed them a code",
    data: { code: "PARENT_CONSENT_REQUIRED" },
}
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

// prices and plan names live in utils/plans.js (Round 12): constants, never env vars — a missing
// env var must never mean a ₹0 charge
const { TIER_PRICE_INR, PLAN_NAMES, TIERS, grants, owns, isUpgrade: isUpgradeOf, upgradePrice, purchaseProblem } = require("../utils/plans")

const phoneRegex = /^[0-9]{10}$/

// shown on the admin page and in the student's own request list
const CALLBACK_DAYS = ["today", "tomorrow", "day_after"]
const CALLBACK_SLOTS = ["morning", "afternoon", "evening"]


// ========================
// calculateQuote — tier + coupon → the amount we will actually charge
// ========================

// every money route calls this; none of them trust an amount from req.body
// HOW MANY TIMES A COUPON HAS BEEN USED (owner, Round 29): the paid purchases and upgrades that carry
// it. Counted from the payments themselves, so it can never drift — an overturned grant is "reversed"
// and drops out by itself.
const couponUses = (code) => Payment.countDocuments({ coupon: code, status: "paid", action: { $in: ["purchase", "upgrade"] } })

const calculateQuote = async (user, tier, coupon) => {
    const requestedTier = Number(tier)

    const problem = purchaseProblem(user.currentTier, requestedTier, user.paid === true)
    if (problem) {
        return { error: problem }
    }

    // adding the second half of the full plan (Discovery → +Mentor, or Mentor Only → +Discovery)
    // costs the difference, never the full price again
    const isUpgrade = isUpgradeOf(user.currentTier, requestedTier, user.paid === true)

    const baseAmountInr = isUpgrade
        ? upgradePrice(user.currentTier, requestedTier)
        : TIER_PRICE_INR[requestedTier]

    let couponCode = null
    let discountPct = 0

    if (coupon && coupon.trim()) {
        couponCode = coupon.trim().toUpperCase()

        const existingCoupon = await Coupon.findOne({ code: couponCode })

        // a code's uses are its PAID payments (owner, Round 29) — typing, quoting or an order never
        // paid for counts for nothing; one person may use a code more than once
        const isCouponUsable = existingCoupon
            && existingCoupon.isActive
            && (!existingCoupon.expiresAt || existingCoupon.expiresAt > new Date())
            && (existingCoupon.usageLimit === 0 || (await couponUses(couponCode)) < existingCoupon.usageLimit)

        // never a silent 0% — a student who typed a code must know it didn't work
        if (!isCouponUsable) {
            return { error: "Invalid coupon" }
        }

        // a coupon for one plan (owner, Round 33) — an upgrade counts as the plan it ends on, so a
        // Discovery + Mentor coupon also discounts the upgrade into it
        const plans = existingCoupon.plans || []
        if (plans.length > 0 && !plans.includes(requestedTier)) {
            return { error: "This coupon isn't for this plan" }
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

    // already holds this plan → write nothing. Razorpay retries webhooks; admins double-click.
    if (owns(user.currentTier, tier, user.paid === true)) {
        return { user, payment: null, isAlreadyGranted: true }
    }

    const isUpgrade = isUpgradeOf(user.currentTier, tier, user.paid === true)

    const newPayment = await Payment.create({
        user: userId,
        mode: options.mode || "manual",
        razorpayOrderId: options.razorpayOrderId,
        razorpayPaymentId: options.razorpayPaymentId,
        tier,
        action: isUpgrade ? "upgrade" : "purchase",
        fromTier: isUpgrade ? user.currentTier : undefined,
        coupon: coupon || undefined,
        discountPct: options.discountPct || 0,
        amountInr,
        status: "paid",
        paidAt: new Date(),
        grantedByAdmin: options.grantedByAdmin,
        accessRequest: options.accessRequest,
        freeByAdmin: Boolean(options.freeByAdmin),
        adminNote: options.adminNote,
    })

    // dot-paths so the other progress fields are never overwritten
    // the password is dropped here, not by a projection inside the update (FerretDB, used for local
    // tests, can't project in findAndModify; Atlas behaves the same either way)
    const updated = await User.findByIdAndUpdate(
        userId,
        {
            paid: true,
            currentTier: tier,
            "progress.mentor": grants(tier).mentor ? "waitlisted" : "not_applicable",
        },
        { returnDocument: "after" }
    ).lean()
    const { password, ...updatedUser } = updated

    // a subsidised rate is spent once — the next purchase is back at list price unless re-approved
    await FinancialAidRequest.findOneAndUpdate(
        { user: userId, requestedTier: tier, status: "approved", usedAt: null },
        { usedAt: new Date() }
    )

    // Round 28: a request for aid on a plan they now hold is closed — they paid without it
    const nowHeld = TIERS.filter((held) => owns(tier, held, true))
    const openAid = await FinancialAidRequest.find({ user: userId, status: "pending", requestedTier: { $in: nowHeld } }).lean()
    if (openAid.length) {
        await FinancialAidRequest.updateMany(
            { _id: { $in: openAid.map((row) => row._id) } },
            { status: "cancelled", adminNote: "Closed automatically: the student paid for this plan", handledAt: new Date() }
        )
        openAid.forEach((row) => notifyStudent(updatedUser, "aidCancelled", { planName: PLAN_NAMES[row.requestedTier] }))
    }

    notifyStudent(updatedUser, amountInr > 0 ? "paymentSuccess" : "planGranted", {
        planName: PLAN_NAMES[tier], amountInr, paymentId: options.razorpayPaymentId,
    })

    return { user: updatedUser, payment: newPayment, isAlreadyGranted: false }
}


// ========================
// Another mentor session (owner, Round 28) — a paid add-on at the Mentor Only price
// ========================

const MENTOR_SESSION_INR = TIER_PRICE_INR[3]

// why a student can't buy another session now, or null
const mentorSessionProblem = async (user) => {
    if (!(user.paid === true && grants(Number(user.currentTier)).mentor)) return "Mentor sessions come with a mentor plan"
    const row = await MentorWaitlist.findOne({ user: user._id }).select("matchStatus extraSessionsPaid extraSessionsUsed").lean()
    if (!row || row.matchStatus !== "completed") return "You can book another session once your current one is done"
    if ((row.extraSessionsPaid || 0) > (row.extraSessionsUsed || 0)) return "You already have a session paid for — choose it on your mentorship page"
    return null
}

// records the payment and adds one session the student can start (mentorWaitlistRouter startAnotherSession)
const grantMentorSession = async (userId, amountInr, options = {}) => {
    const user = await User.findById(userId).lean()
    if (!user) return { error: "User not found" }
    if (options.razorpayPaymentId && await Payment.exists({ razorpayPaymentId: options.razorpayPaymentId })) return { isAlreadyGranted: true }

    const payment = await Payment.create({
        user: userId,
        mode: options.mode || "manual",
        razorpayOrderId: options.razorpayOrderId,
        razorpayPaymentId: options.razorpayPaymentId,
        tier: user.currentTier,
        action: "mentor_session",
        amountInr,
        status: "paid",
        paidAt: new Date(),
        grantedByAdmin: options.grantedByAdmin,
        freeByAdmin: Boolean(options.freeByAdmin),
        adminNote: options.adminNote,
    })
    await MentorWaitlist.updateOne({ user: userId }, { $inc: { extraSessionsPaid: 1 } })
    notifyStudent(user, amountInr > 0 ? "paymentSuccess" : "planGranted", { planName: "Another mentor session", amountInr, paymentId: options.razorpayPaymentId })
    return { payment }
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
        const student = await User.findById(originalPayment.user).lean()
        notifyStudent(student, isAlreadyProcessed ? "refundCompleted" : "refundStarted", { amountInr, refundId: razorpayRefund.id })

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

    const student = await User.findById(originalPayment.user).lean()
    notifyStudent(student, "refundCompleted", { amountInr, manual: true })

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
// Round 12: a student who reached Tier 2 from Mentor Only paid for the mentor in their tier-3
// purchase, so that purchase is the one the mentor money comes back from; their upgrade paid for
// Discovery, which they keep.
// Shared by the student's rollover quote, the admin's rollover approval and the admin downgrade,
// so all three always name the same figure.
const getRolloverRefund = async (user) => {
    // THE PAYMENT THAT PUT THEM ON TIER 2 — the newest paid upgrade or direct Tier-2 purchase, and
    // only that one. The old loop skipped a newest payment with nothing left on it and fell through
    // to an OLDER one, so a student who moved back to Tier 1, re-upgraded with a 100% coupon and
    // asked again was refunded a second ₹3,000 from the original purchase (Round 10 refund check).
    const latest = await Payment.findOne({
        user: user._id,
        status: "paid",
        $or: [{ action: "upgrade", fromTier: { $ne: 3 } }, { action: "purchase", tier: { $in: [2, 3] } }],
    }).sort({ createdAt: -1 })

    if (!latest) return { originalPayment: null, amountInr: 0 }

    const balance = await getRefundableBalance(latest)

    if (latest.action === "upgrade" || latest.tier === 3) {
        // upgraded from Tier 1 → return what is left of what they paid for the upgrade; started on
        // Mentor Only → return what is left of that purchase, which was the mentor part
        return { originalPayment: latest, amountInr: balance }
    }

    // bought Tier 2 directly → return what is LEFT on it minus Tier 1 at the same discount. Measured
    // against the remaining balance, not the original amount, so a payment that already gave back
    // its Tier-2 part has nothing more to give.
    const tierOneAtSameDiscount = Math.round((TIER_PRICE_INR[1] * (100 - latest.discountPct)) / 100)

    return {
        originalPayment: latest,
        amountInr: Math.max(balance - tierOneAtSameDiscount, 0),
    }
}

// A student who leaves Tier 2 leaves the mentor waitlist too. Their row is closed with the reason
// rather than deleted, and a later re-upgrade starts a fresh one (mentorWaitlistRouter getMyWaitlist).
// Before, the row was left as it was: a re-upgraded student saw their old choice and a deadline
// that had already passed, and could not choose again.
// Its own resolution value, "left_tier2", so it is never confused with an admin's "refunded" on an
// unmatchable case — only this one is re-opened by a re-upgrade.
const closeMentorWaitlist = async (userId) => {
    await MentorWaitlist.updateOne(
        { user: userId, resolution: { $in: [null, undefined] } },
        { $set: { resolution: "left_tier2", adminNote: "Closed automatically when the student left Tier 2" } }
    )
}

// everything paid, minus everything already refunded
const getFullRefundAmount = async (user) => {
    // Round 28: a full refund also returns any extra mentor sessions paid for
    const paidPayments = await Payment.find({
        user: user._id,
        action: { $in: ["purchase", "upgrade", "mentor_session"] },
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
            const { userId, tier, coupon, discountPct, product } = razorpayPayment.notes

            // Round 28: another mentor session, not a plan
            if (product === "mentor_session") {
                await grantMentorSession(userId, razorpayPayment.amount / 100, {
                    mode: "razorpay", razorpayOrderId: razorpayPayment.order_id, razorpayPaymentId: razorpayPayment.id,
                })
                return res.status(200).json({ success: true, message: "Mentor session payment verified" })
            }

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

            // Razorpay has sent it to the bank; the ARN is the bank's own reference for it. Nobody —
            // not us, not Razorpay — is told when the bank actually credits the account (Round 28)
            const arn = razorpayRefund.acquirer_data && razorpayRefund.acquirer_data.arn
            await Payment.findByIdAndUpdate(refundRow._id, { status: "refunded", paidAt: new Date(), refundArn: arn || undefined })
            notifyStudent(await User.findById(refundRow.user).lean(), "refundCompleted", {
                amountInr: refundRow.amountInr, refundId: razorpayRefund.id, arn,
            })

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
            notifyStudent(await User.findById(refundRow.user).lean(), "refundFailed", { amountInr: refundRow.amountInr, refundId: razorpayRefund.id })

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

        // ── payment.failed → record it and tell the student (Round 28) ─────────
        // A row with status "failed" is history only: getRefundableBalance reads it as worth nothing.
        if (event.event === "payment.failed") {
            const razorpayPayment = event.payload.payment.entity

            if (await Payment.findOne({ razorpayPaymentId: razorpayPayment.id })) {
                return res.status(200).json({ success: true, message: "Payment failure already recorded" })
            }

            const { userId, tier } = razorpayPayment.notes || {}
            const student = userId ? await User.findById(userId).lean() : null
            if (!student) {
                return res.status(200).json({ success: true, message: "Payment failure for an unknown student ignored" })
            }

            const reason = (razorpayPayment.error_description || razorpayPayment.error_reason || "The payment was not completed").slice(0, 300)
            await Payment.create({
                user: student._id,
                mode: "razorpay",
                razorpayOrderId: razorpayPayment.order_id,
                razorpayPaymentId: razorpayPayment.id,
                tier: Number(tier) || student.currentTier || 0,
                action: "purchase",
                amountInr: (razorpayPayment.amount || 0) / 100,
                status: "failed",
                failureMessage: reason,
            })
            notifyStudent(student, "paymentFailed", {
                planName: PLAN_NAMES[Number(tier)], amountInr: (razorpayPayment.amount || 0) / 100, paymentId: razorpayPayment.id, reason,
            })

            return res.status(200).json({ success: true, message: "Payment failure recorded" })
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
                // the three plans (Round 12), named as the site names them
                tiers: Object.fromEntries(TIERS.map((tier) => [tier, { name: PLAN_NAMES[tier], amountInr: TIER_PRICE_INR[tier] }])),
                // adding the other half of the full plan costs the difference
                upgrades: {
                    "1-2": upgradePrice(1, 2),
                    "3-2": upgradePrice(3, 2),
                },
                upgradeAmountInr: upgradePrice(1, 2),
                // Round 28 (owner): another mentor session after one is done, at the Mentor Only price
                mentorSessionInr: MENTOR_SESSION_INR,
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

        if (await parentConsentMissing(req.user)) {
            return res.status(403).json(PARENT_CONSENT_REPLY)
        }

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
        if (await parentConsentMissing(req.user)) {
            return res.status(403).json(PARENT_CONSENT_REPLY)
        }

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

        // Round 28: another mentor session is its own product, priced on the server
        if (req.body.product === "mentor_session") {
            const problem = await mentorSessionProblem(req.user)
            if (problem) return res.status(400).json({ success: false, message: problem })
            const order = await razorpay.orders.create({
                amount: MENTOR_SESSION_INR * 100,
                currency: "INR",
                receipt: `ms${req.user._id}${Date.now().toString(36)}`,
                notes: { userId: req.user._id.toString(), tier: String(req.user.currentTier), product: "mentor_session" },
            })
            return res.status(201).json({
                success: true,
                message: "Order created successfully",
                data: { order, keyId: process.env.RAZORPAY_KEY_ID, quote: { product: "mentor_session", finalAmountInr: MENTOR_SESSION_INR } },
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
// Give Free Access For Admin (Round 26, owner)
// ========================

// The admin gives a student a plan for free, straight from the Students tab — no request, no coupon.
// It goes through the same grantAccess as every paid plan, so the student's tier, mentor place and
// payment history all read the usual way: a ₹0 "paid" row marked freeByAdmin, with the admin's note.
// A ₹0 row has nothing refundable (getRefundableBalance), so it can never pay money back out.
router.put("/grantFreeForAdmin/:userId", express.json(), authMiddleware, adminAuthMiddleware, async (req, res) => {
    try {
        const tier = Number(req.body.tier)
        const student = await User.findById(req.params.userId).select("role currentTier paid").lean()

        if (!student || student.role !== "student") {
            return res.status(404).json({
                success: false,
                message: "Student not found",
            })
        }

        const problem = purchaseProblem(student.currentTier, tier, student.paid === true)
        if (problem) {
            return res.status(400).json({
                success: false,
                message: problem,
            })
        }

        const grantResult = await grantAccess(student._id, tier, 0, null, {
            mode: "manual",
            grantedByAdmin: req.user._id,
            freeByAdmin: true,
            adminNote: typeof req.body.note === "string" ? req.body.note.trim().slice(0, 300) : undefined,
        })

        if (grantResult.error) {
            return res.status(404).json({
                success: false,
                message: grantResult.error,
            })
        }

        return res.status(200).json({
            success: true,
            message: `${PLAN_NAMES[tier]} given free`,
            data: { user: grantResult.user, payment: grantResult.payment },
        })

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to give free access",
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

        // an upgrade drops them back to the plan they upgraded from, still paid; a first purchase
        // closes access entirely
        const isUpgrade = grantPayment.action === "upgrade"
        const backTo = isUpgrade ? (grantPayment.fromTier || 1) : 0

        const updatedUser = await User.findByIdAndUpdate(
            grantPayment.user,
            {
                paid: isUpgrade,
                currentTier: backTo,
                "progress.mentor": backTo && grants(backTo).mentor ? "waitlisted" : "not_applicable",
            },
            { returnDocument: "after" }
        ).select("-password")

        await Payment.findByIdAndUpdate(grantPayment._id, { status: "reversed" })

        // the coupon gives its use back by itself: a reversed payment no longer counts (couponUses)

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

        await closeMentorWaitlist(id)

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
        // Mentor Only has no Tier 1 steps to deliver: the promise is a full refund on request if we
        // cannot match a mentor, and the admin decides each request (owner, Round 12)
        const isEligible = Number(req.user.currentTier) === 3 || hasCompletedTierOne(req.user)

        // a Tier 1 student has nothing to roll back to, so only a full refund is offered — and nor
        // does a Tier 2 student whose Tier-2 money has nothing left to give (financial aid, a 100%
        // coupon): offering "move back and get ₹0" only to refuse it on submit helps nobody
        const rolloverAmountInr = req.user.currentTier === 2 ? await getRefundAmount(req.user, "rollover") : 0
        const canRollover = req.user.currentTier === 2 && rolloverAmountInr > 0

        return res.status(200).json({
            success: true,
            message: "Refund options fetched successfully",
            data: {
                isEligible,
                canRollover,
                fullAmountInr: await getFullRefundAmount(req.user),
                rolloverAmountInr,
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

        // refunds open only once Tier 1 has actually been delivered (Mentor Only: any time — see above)
        if (Number(req.user.currentTier) !== 3 && !hasCompletedTierOne(req.user)) {
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

// Round 28: each request carries the refund rows sent for it — Razorpay's refund id, the bank's ARN
// once processed, and their own status — so both the student and the admin can track the money
const withRefundRows = async (requests) => {
    const plain = requests.map((request) => (request.toObject ? request.toObject() : request))
    const rows = await Payment.find({ refundRequest: { $in: plain.map((request) => request._id) }, action: "refund" })
        .select("refundRequest amountInr status razorpayRefundId refundArn failureMessage paidAt createdAt mode")
        .sort({ createdAt: 1 })
        .lean()
    return plain.map((request) => ({ ...request, refunds: rows.filter((row) => String(row.refundRequest) === String(request._id)) }))
}

router.get("/getMyRefundRequests", authMiddleware, async (req, res) => {
    try {
        const refundRequests = await withRefundRows(await RefundRequest.find({ user: req.user._id })
            .sort({ createdAt: -1 }))

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
        const refundRequests = await withRefundRows(await RefundRequest.find({})
            .populate("user", "-password")
            .populate("handledByAdmin", "name email")
            .sort({ createdAt: -1 }))

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


// THE WORK OF A REFUND REQUEST, shared by the Refund Requests tab and the mentor ticket's "Refund the
// mentor part" (Round 34). Returns { status, message, refundRequest, refunds } or { code, error }.
const processRefundRequest = async (refundRequest, adminId, adminNote) => {
    const student = await User.findById(refundRequest.user)

    if (!student) return { code: 404, error: "Student not found" }

    const newRefunds = []

    if (refundRequest.refundType === "rollover") {
        // Mentorship → Career Discovery: only the Tier-2 part comes back, access continues
        //
        // A RETRY AFTER A LATE FAILURE. With Razorpay, the tier drops as soon as the refund is
        // accepted for processing; if Razorpay later reports it failed, the student is already on
        // Tier 1 and the "no longer on Tier 2" check refused the retry for good. So a failed
        // request whose refund row is on file is retried from that row — same payment, same
        // amount — whatever the student's tier is now.
        const failedRow = refundRequest.status === "refund_failed"
            ? await Payment.findOne({ refundRequest: refundRequest._id, action: "refund", status: "failed" }).sort({ createdAt: -1 })
            : null

        let originalPayment = null
        let amountInr = 0

        if (failedRow && student.currentTier !== 2) {
            originalPayment = await Payment.findById(failedRow.refundOfPayment)
            amountInr = failedRow.amountInr
        } else {
            if (student.currentTier !== 2) return { code: 400, error: "This student is no longer on Tier 2" }
            const rollover = await getRolloverRefund(student)
            originalPayment = rollover.originalPayment
            amountInr = rollover.amountInr
        }

        if (!originalPayment || amountInr <= 0) return { code: 400, error: "There is nothing left to refund on the Tier 2 payment" }

        const rolloverRefund = await sendRefund(originalPayment, amountInr, {
            tierAfter: 1,
            grantedByAdmin: adminId,
            refundRequest: refundRequest._id,
        })

        newRefunds.push(rolloverRefund)

        // only drop the tier once the money is actually on its way — otherwise a failed refund
        // would leave them on Tier 1 with nothing back
        if (rolloverRefund.status !== "failed") {
            await User.findByIdAndUpdate(refundRequest.user, {
                currentTier: 1,                         // paid stays true — Tier 1 continues
                "progress.mentor": "not_applicable",
            })
            await closeMentorWaitlist(refundRequest.user)
        }

    } else if (refundRequest.refundType === "mentor_session") {
        // Round 34: an extra mentor session we couldn't deliver — its own payment comes back, and
        // the plan the student has stays as it is
        const sessionPayment = await Payment.findOne({ user: refundRequest.user, action: "mentor_session", status: "paid" }).sort({ createdAt: -1 })
        const balance = sessionPayment ? await getRefundableBalance(sessionPayment) : 0
        if (balance <= 0) return { code: 400, error: "There is nothing left to refund on the extra session" }
        newRefunds.push(await sendRefund(sessionPayment, balance, {
            tierAfter: student.currentTier,
            grantedByAdmin: adminId,
            refundRequest: refundRequest._id,
        }))

    } else {
        // Close Access: from this click on, the student has no tier
        await User.findByIdAndUpdate(refundRequest.user, {
            paid: false,
            currentTier: 0,
            "progress.mentor": "not_applicable",
        })
        await closeMentorWaitlist(refundRequest.user)

        // Refund every payment that still has money on it. On a retry, failed refunds don't count
        // against the balance, so only the part that failed is attempted again.
        const paidPayments = await Payment.find({
            user: refundRequest.user,
            action: { $in: ["purchase", "upgrade", "mentor_session"] },   // Round 28: extra sessions too
        })

        for (const payment of paidPayments) {
            const balance = await getRefundableBalance(payment)

            if (balance <= 0) continue

            newRefunds.push(await sendRefund(payment, balance, {
                tierAfter: 0,
                grantedByAdmin: adminId,
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
        refundRequest._id,
        {
            status,
            failureMessage: failedRefund ? failedRefund.failureMessage : "",   // clears an old failure on a successful retry
            adminNote: adminNote || refundRequest.adminNote,
            handledByAdmin: adminId,
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

    return { status, message: messageByStatus[status], refundRequest: updatedRefundRequest, refunds: newRefunds }
}

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

        const result = await processRefundRequest(refundRequest, req.user._id, adminNote)

        if (result.error) {
            return res.status(result.code).json({
                success: false,
                message: result.error,
            })
        }

        return res.status(200).json({
            success: result.status !== "refund_failed",
            message: result.message,
            data: {
                refundRequest: result.refundRequest,
                refunds: result.refunds,
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
// The mentor part (Round 34)
// ========================

// WHAT "REFUND THE MENTOR PART" GIVES BACK, and from which payment. One rule for the student's quote
// (shown when they report their mentor and ask for a refund) and the admin's one-step refund:
//     an extra session in progress   → that session's own payment
//     Discovery + Mentor (tier 2)     → the difference; they keep Career Discovery
//     Mentor Only (tier 3)            → everything they paid
const mentorPartOf = async (user, row) => {
    if (row && (row.extraSessionsUsed || 0) > 0 && (row.sessions || []).length > 0) {
        const sessionPayment = await Payment.findOne({ user: user._id, action: "mentor_session", status: "paid" }).sort({ createdAt: -1 })
        return { refundType: "mentor_session", amountInr: sessionPayment ? await getRefundableBalance(sessionPayment) : 0 }
    }
    if (Number(user.currentTier) === 2) return { refundType: "rollover", amountInr: (await getRolloverRefund(user)).amountInr }
    if (Number(user.currentTier) === 3) return { refundType: "full", amountInr: await getFullRefundAmount(user) }
    return { refundType: null, amountInr: 0 }
}

router.put("/refundMentorPartForAdmin/:userId", express.json(), authMiddleware, adminAuthMiddleware, async (req, res) => {
    try {
        const student = await User.findById(req.params.userId)
        if (!student) {
            return res.status(404).json({ success: false, message: "Student not found" })
        }

        const row = await MentorWaitlist.findOne({ user: student._id }).lean()
        const { refundType, amountInr } = await mentorPartOf(student, row)
        if (!refundType || amountInr <= 0) {
            return res.status(400).json({ success: false, message: "There is nothing left to refund on the mentor part" })
        }

        const note = typeof req.body.adminNote === "string" ? req.body.adminNote.trim().slice(0, 500) : ""
        const refundRequest = await RefundRequest.create({
            user: student._id,
            reason: `Mentor part refunded by admin${note ? ` — ${note}` : ""}`,
            refundType,
            initiatedBy: "admin",
            tierAtRequest: student.currentTier,
            amountInr,
            status: "pending",
            handledByAdmin: req.user._id,
            handledAt: new Date(),
        })

        const result = await processRefundRequest(refundRequest, req.user._id, note)
        if (result.error) {
            return res.status(result.code).json({ success: false, message: result.error })
        }

        // the ticket is closed and remembered; a tier change already closed it as "left_tier2"
        if (result.status !== "refund_failed") {
            await MentorWaitlist.updateOne(
                { user: student._id },
                {
                    $set: { matchStatus: "closed", ...(refundType === "mentor_session" ? { resolution: "refunded" } : {}) },
                    $push: { history: { at: new Date(), event: "refunded", by: "admin", note: `₹${amountInr} — ${note}`.trim() } },
                }
            )
        }

        return res.status(200).json({
            success: result.status !== "refund_failed",
            message: result.message,
            data: { refundRequest: result.refundRequest, refunds: result.refunds, amountInr },
        })

    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to refund the mentor part", error: error.message })
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

        // Round 28 (owner): a "no" always comes with a reason — the student is emailed it and sees it in
        // their payment history
        const reason = typeof adminNote === "string" ? adminNote.trim().slice(0, 500) : ""
        if (!reason) {
            return res.status(400).json({
                success: false,
                message: "Please write the reason — the student is emailed it",
            })
        }

        const updatedRefundRequest = await RefundRequest.findByIdAndUpdate(
            id,
            {
                status: "declined",
                adminNote: reason,
                handledByAdmin: req.user._id,
                handledAt: new Date(),
            },
            { returnDocument: "after" }
        )

        notifyStudent(await User.findById(refundRequest.user).lean(), "refundDeclined", { amountInr: refundRequest.amountInr, reason })

        return res.status(200).json({
            success: true,
            message: "Refund request declined — the student has been emailed",
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

        const planProblem = purchaseProblem(req.user.currentTier, requestedTier, req.user.paid === true)

        if (planProblem) {
            return res.status(400).json({
                success: false,
                message: planProblem
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

        // Round 28: no discount on a plan they already hold (paying closes the request automatically)
        const aidStudent = await User.findById(aidRequest.user).lean()
        if (aidStudent && owns(aidStudent.currentTier, aidRequest.requestedTier, aidStudent.paid === true)) {
            return res.status(400).json({
                success: false,
                message: "The student already holds this plan",
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

        notifyStudent(aidStudent, "aidApproved", { planName: PLAN_NAMES[aidRequest.requestedTier], amountInr })

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

        // Round 28 (owner): a "no" always comes with a reason — the student is emailed it and sees it in
        // their payment history
        const reason = typeof adminNote === "string" ? adminNote.trim().slice(0, 500) : ""
        if (!reason) {
            return res.status(400).json({
                success: false,
                message: "Please write the reason — the student is emailed it",
            })
        }

        const updatedAidRequest = await FinancialAidRequest.findByIdAndUpdate(
            id,
            {
                status: "declined",
                adminNote: reason,
                handledByAdmin: req.user._id,
                handledAt: new Date(),
            },
            { returnDocument: "after" }
        )

        notifyStudent(await User.findById(aidRequest.user).lean(), "aidDeclined", { planName: PLAN_NAMES[aidRequest.requestedTier], reason })

        return res.status(200).json({
            success: true,
            message: "Financial aid request declined — the student has been emailed",
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


// UNDOING A DECISION (owner, Round 30). An approved aid not yet used for a payment, or a declined one,
// goes back to pending with the reason logged; the admin then decides it again as usual (approve or
// decline, each emailing the student). An approval already spent on a payment can't be undone here —
// that is a refund. The quote stops using an undone approval at once (it reads approved + unused).
router.put("/reopenFinancialAidForAdmin/:id", express.json(), authMiddleware, adminAuthMiddleware, async (req, res) => {
    try {
        const note = typeof req.body.adminNote === "string" ? req.body.adminNote.trim().slice(0, 500) : ""
        if (!note) {
            return res.status(400).json({ success: false, message: "Please write why you're undoing the decision" })
        }

        const aidRequest = await FinancialAidRequest.findById(req.params.id).lean()   // :id is a FINANCIAL AID REQUEST id
        if (!aidRequest) {
            return res.status(404).json({ success: false, message: "Financial aid request not found" })
        }
        if (aidRequest.usedAt) {
            return res.status(400).json({ success: false, message: "Already used for a payment — use a refund instead" })
        }
        if (!["approved", "declined"].includes(aidRequest.status)) {
            return res.status(400).json({ success: false, message: "Only an approved or declined request can be undone" })
        }

        const updated = await FinancialAidRequest.findOneAndUpdate(
            { _id: aidRequest._id, status: aidRequest.status, usedAt: null },
            {
                $set: { status: "pending", adminNote: null, handledAt: null },
                $unset: { approvedAmountInr: "" },
                $push: { decisionLog: { at: new Date(), from: aidRequest.status, amountInr: aidRequest.approvedAmountInr || null, note, by: req.user._id } },
            },
            { returnDocument: "after" }
        )
        if (!updated) {
            return res.status(409).json({ success: false, message: "The request changed meanwhile — refresh and try again" })
        }

        return res.status(200).json({ success: true, message: "Decision undone — the request is pending again", data: updated })

    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to undo the decision", error: error.message })
    }
})


// Admin: another mentor session paid by hand (UPI/bank) or given free — manual mode's way in (Round 28)
router.put("/grantMentorSessionForAdmin/:userId", express.json(), authMiddleware, adminAuthMiddleware, async (req, res) => {
    try {
        const student = await User.findById(req.params.userId).lean()
        if (!student) return res.status(404).json({ success: false, message: "Student not found" })
        const problem = await mentorSessionProblem(student)
        if (problem) return res.status(400).json({ success: false, message: problem })

        const free = req.body.free === true
        const result = await grantMentorSession(student._id, free ? 0 : MENTOR_SESSION_INR, {
            mode: "manual", grantedByAdmin: req.user._id, freeByAdmin: free,
            adminNote: typeof req.body.note === "string" ? req.body.note.trim().slice(0, 300) : undefined,
        })
        if (result.error) return res.status(400).json({ success: false, message: result.error })

        return res.status(200).json({ success: true, message: free ? "Another session given free" : "Another session recorded as paid", data: result.payment })

    } catch (error) {
        return res.status(500).json({ success: false, message: "Could not add the session", error: error.message })
    }
})


router.post(
    "/payment-verification-webhook",
    express.raw({ type: "*/*" }),
    paymentVerificationWebhook
)

module.exports = router
module.exports.couponUses = couponUses
module.exports.mentorPartOf = mentorPartOf
