// THE WORDS FOR EVERY MONEY STATUS (owner, Round 28), shared by the student's payment history and the
// admin's refund list. A refund is "processing" until Razorpay says it has sent it to the bank — never
// "refunded" the moment the admin presses the button.

export const ACTION_WORDS = {
    purchase: "Plan bought",
    upgrade: "Plan upgraded",
    refund: "Refund",
    mentor_session: "Another mentor session",
}

const PAYMENT_STATUS = {
    paid: "Paid",
    failed: "Payment failed",
    reversed: "Cancelled (money not received)",
    created: "Started",
}

const REFUND_STATUS = {
    refund_pending: "Refund processing",
    refunded: "Refund sent to your bank",
    failed: "Refund failed — we're retrying",
}

const ADMIN_REFUND_STATUS = {
    refund_pending: "Processing at Razorpay",
    refunded: "Completed",
    failed: "Failed — retry",
}

// a payment row: purchase/upgrade/mentor_session or refund
export const paymentStatusWord = (row, forAdmin) => {
    if (row.action === "refund") {
        if (row.status === "refunded" && row.mode === "manual") return forAdmin ? "Completed (sent by hand)" : "Refund sent"
        return (forAdmin ? ADMIN_REFUND_STATUS : REFUND_STATUS)[row.status] || row.status
    }
    return PAYMENT_STATUS[row.status] || row.status
}

// a refund REQUEST, as the student reads it
export const REQUEST_WORDS = {
    pending: "Waiting for our team",
    refund_pending: "Approved — refund processing",
    refunded: "Refund sent to your bank",
    refund_failed: "Approved — the bank refused it, we're retrying",
    declined: "Declined",
}

export const ADMIN_REQUEST_WORDS = {
    pending: "Waiting for you",
    refund_pending: "Processing at Razorpay",
    refunded: "Completed",
    refund_failed: "Failed — retry",
    declined: "Declined",
}

export const AID_WORDS = {
    pending: "Waiting — we'll call you",
    approved: "Approved",
    declined: "Declined",
    cancelled: "Closed — you paid for this plan",
}

// the ids a student or the admin can quote to Razorpay or a bank
export const trackingIds = (row) => [
    row.razorpayPaymentId && `Payment id ${row.razorpayPaymentId}`,
    row.razorpayRefundId && `Refund id ${row.razorpayRefundId}`,
    row.refundArn && `Bank reference (ARN) ${row.refundArn}`,
].filter(Boolean)
