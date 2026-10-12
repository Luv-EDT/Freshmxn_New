const { sendEmail, escapeHtml } = require("./mailer")

// EVERY STATUS A STUDENT IS WAITING ON GETS AN EMAIL (owner, Round 28): payments, refunds, financial
// aid and retake requests. One place for the wording, so it reads the same everywhere. "Hi," with no
// typed name (Round 25 — bots used the name box to push text into our email), every value escaped.
//
// NEVER BLOCKS THE ACTION. Callers fire and forget; sendEmail never throws and logs a failure itself.

const site = () => process.env.FRONTEND_URL || "https://www.freshmxn.com"
const inr = (amount) => `₹${Number(amount || 0).toLocaleString("en-IN")}`
const line = (label, value) => (value ? `<p>${label}: <strong>${escapeHtml(value)}</strong></p>` : "")

// money emails point to the payment history, where the same status and ids are shown
const HISTORY = (link) => `<p>You can see this any time under Profile → Payment history: <a href="${link}/profile">${link}/profile</a></p>`

const send = (user, subject, body, withHistory) => {
    if (!user || !user.email) return Promise.resolve({ sent: false, error: "no email" })
    return sendEmail({
        to: user.email,
        subject,
        html: `<p>Hi,</p>${body}${withHistory ? HISTORY(site()) : ""}<p>— Freshmxn</p>`,
    })
}

const TEMPLATES = {
    paymentSuccess: ({ planName, amountInr, paymentId }) => ({
        subject: `Payment received — ${planName} is ready`,
        body: `<p>Thank you. Your payment of <strong>${inr(amountInr)}</strong> for <strong>${escapeHtml(planName)}</strong> went through and your plan is active.</p>${line("Payment id", paymentId)}`,
    }),
    planGranted: ({ planName }) => ({
        subject: `${planName} is ready`,
        body: `<p>Your <strong>${escapeHtml(planName)}</strong> plan is active. Open your dashboard to begin: <a href="${site()}/dashboard">${site()}/dashboard</a></p>`,
    }),
    paymentFailed: ({ planName, amountInr, paymentId, reason }) => ({
        subject: "Your payment didn't go through",
        body: `<p>Your payment of <strong>${inr(amountInr)}</strong>${planName ? ` for <strong>${escapeHtml(planName)}</strong>` : ""} didn't go through. No money was taken — if your bank shows a deduction, it returns to you automatically.</p>${line("Reason", reason)}${line("Payment id", paymentId)}<p>You can try again from <a href="${site()}/paywall">${site()}/paywall</a>.</p>`,
    }),
    refundStarted: ({ amountInr, refundId }) => ({
        subject: "Your refund is processing",
        body: `<p>We've started your refund of <strong>${inr(amountInr)}</strong>. It is <strong>processing</strong> — Razorpay usually takes 5–7 working days to send it to your bank.</p>${line("Refund id (for tracking)", refundId)}`,
    }),
    refundCompleted: ({ amountInr, refundId, arn, manual }) => ({
        subject: manual ? "Your refund has been sent" : "Your refund has been sent to your bank",
        body: manual
            ? `<p>We've sent your refund of <strong>${inr(amountInr)}</strong>. If you don't see it within a few days, reply to this email.</p>`
            : `<p>Razorpay has sent your refund of <strong>${inr(amountInr)}</strong> to your bank. It usually shows in your account within 5–7 working days.</p>${line("Refund id", refundId)}${line("Bank reference (ARN) — quote this to your bank if it doesn't show", arn)}`,
    }),
    refundFailed: ({ amountInr, refundId }) => ({
        subject: "Your refund needs another try",
        body: `<p>Your refund of <strong>${inr(amountInr)}</strong> could not be completed by the bank. Our team will retry it — you don't need to do anything.</p>${line("Refund id", refundId)}`,
    }),
    refundDeclined: ({ amountInr, reason }) => ({
        subject: "Your refund request was not approved",
        body: `<p>We've looked at your refund request${amountInr ? ` for <strong>${inr(amountInr)}</strong>` : ""} and could not approve it, so the request is now cancelled.</p>${line("Reason", reason)}<p>If you'd like to talk it through, reply to this email or WhatsApp us at 8882756287.</p>`,
    }),
    aidApproved: ({ planName, amountInr }) => ({
        subject: "Your financial aid is approved",
        body: `<p>Good news — your financial aid for <strong>${escapeHtml(planName)}</strong> is approved. You can pay <strong>${inr(amountInr)}</strong> instead of the list price.</p><p>Pay here: <a href="${site()}/paywall">${site()}/paywall</a></p>`,
    }),
    aidDeclined: ({ planName, reason }) => ({
        subject: "About your financial aid request",
        body: `<p>We've looked at your financial aid request for <strong>${escapeHtml(planName)}</strong> and couldn't approve it this time.</p>${line("Reason", reason)}<p>If you'd like to talk it through, reply to this email or WhatsApp us at 8882756287.</p>`,
    }),
    aidCancelled: ({ planName }) => ({
        subject: "Your financial aid request is closed",
        body: `<p>You've already paid for <strong>${escapeHtml(planName)}</strong>, so we've closed your financial aid request for it. Nothing else is needed.</p>`,
    }),
    retakeGranted: ({ testName }) => ({
        subject: "You can take one of your Freshmxn tests again",
        body: `<p>Your earlier attempt at <strong>${escapeHtml(testName)}</strong> had a technical problem, so we have opened it again for you — one more attempt.</p><p>Open your assessment at <a href="${site()}/assessment">${site()}/assessment</a>, take the test, then press Submit again so your report is updated.</p>`,
    }),
    reportRerun: () => ({
        subject: "Your report is being prepared again",
        body: `<p>We've fixed what stopped your report and it is being prepared again. It is usually ready within a few minutes: <a href="${site()}/report">${site()}/report</a></p>`,
    }),
    retakeDeclined: ({ testName, reason }) => ({
        subject: `About your request for ${testName}`,
        body: `<p>We looked into what you told us about <strong>${escapeHtml(testName)}</strong> and couldn't reopen it.</p>${line("Reason", reason)}<p>If something still seems wrong, reply to this email.</p>`,
    }),
}

// only money emails point to the payment history
const NOT_MONEY = ["retakeGranted", "retakeDeclined", "reportRerun"]

const notifyStudent = (user, kind, details = {}) => {
    const template = TEMPLATES[kind]
    if (!template) return Promise.resolve({ sent: false, error: `unknown email ${kind}` })
    const { subject, body } = template(details)
    return send(user, subject, body, !NOT_MONEY.includes(kind))
}

module.exports = { notifyStudent, TEMPLATES }
