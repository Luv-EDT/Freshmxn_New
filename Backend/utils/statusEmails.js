const { sendEmail, escapeHtml } = require("./mailer")
const Notification = require("../model/notificationsModel")
const { mayEmail } = require("./emailBudget")
const { PRIVACY_RULES } = require("./mentorInvite")

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

const send = async (user, subject, body, withHistory, kind) => {
    if (!user || !user.email) return { sent: false, error: "no email" }
    if (!(await mayEmail(kind))) return { sent: false, error: "held back by the daily email cap" }
    return sendEmail({
        to: user.email,
        subject,
        html: `<p>Hi,</p>${body}${withHistory ? HISTORY(site()) : ""}<p>— Freshmxn</p>`,
    })
}

// the same message as a notification on the student's Profile (Round 29): plain text, and the first
// link to our own site as the place it points to
const plainText = (html) => String(html)
    .replace(/<a [^>]*href="([^"]*)"[^>]*>[^<]*<\/a>/g, "")
    .replace(/<\/(p|li)>/g, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&amp;/g, "&")
    .replace(/\s+(?:at|from|here|in)?\s*:?\s*(?=[.,;]|$)/g, "")
    .replace(/\s+/g, " ")
    .replace(/\s*:\s*$/, "")
    .trim()

const linkIn = (html) => {
    const found = String(html).match(/href="https?:\/\/[^/"]+(\/[^"]*)"/)
    return found ? found[1] : null
}

const remember = async (user, kind, subject, body) => {
    try {
        if (!user || !user._id) return
        await Notification.create({ user: user._id, kind, title: subject, body: plainText(body).slice(0, 600), link: linkIn(body) })
    } catch (error) {
        console.error(`Could not save the ${kind} notification: ${error.message}`)
    }
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
    // Round 29 (owner): the reason is said plainly, and the retake never costs one of the 3 updates
    retakeGranted: ({ testName, reasons }) => ({
        subject: `Please take ${testName} again`,
        body: `<p>You need to retake <strong>${escapeHtml(testName)}</strong>, because our system flagged a problem with your earlier attempt${reasons && reasons.length ? ":" : "."}</p>${reasons && reasons.length ? `<ul>${reasons.map((reason) => `<li>${escapeHtml(reason)}</li>`).join("")}</ul>` : ""}<p>Open your assessment, take the test, then press Submit again. Updating your report after a retake we asked for is free — it doesn't use one of your 3 updates: <a href="${site()}/assessment">${site()}/assessment</a></p>`,
    }),
    // a system improvement (owner, Round 29): the update is free
    systemUpdate: () => ({
        subject: "We've improved how we match careers",
        body: `<p>We've improved how Freshmxn matches careers. Update your report to see the new version — it's free and doesn't use one of your 3 updates: <a href="${site()}/report">${site()}/report</a></p>`,
    }),
    // an assessment improvement that offers everyone a retake of one test (owner, Round 29)
    assessmentRetakeOffer: ({ testName, reason }) => ({
        subject: `You can take ${testName} again`,
        body: `<p>We've improved <strong>${escapeHtml(testName)}</strong>${reason ? ` — ${escapeHtml(reason)}` : ""}. If you'd like, take it again and press Submit — your earlier result stays unless you finish the new one, and updating your report afterwards is free: <a href="${site()}/assessment">${site()}/assessment</a></p>`,
    }),
    // ── the short story's clock (owner, Round 29) ──
    storyOpened: () => ({
        subject: "Your short story is open — it disappears in 1 hour",
        body: `<p>You've opened your short story. Read it carefully: it disappears <strong>one hour</strong> after you opened it, and we'll ask you about it tomorrow: <a href="${site()}/assessment/storyRecall">${site()}/assessment/storyRecall</a></p>`,
    }),
    storyFiveMinutes: () => ({
        subject: "5 minutes left with your story",
        body: `<p>Your short story disappears in <strong>5 minutes</strong>. Read it once more now, for the questions tomorrow: <a href="${site()}/assessment/storyRecall">${site()}/assessment/storyRecall</a></p>`,
    }),
    storyRecallOpen: ({ until }) => ({
        subject: "Your story questions are open",
        body: `<p>The questions about your short story are open now${until ? `, until <strong>${escapeHtml(until)}</strong>` : ""}. It takes about 5 minutes: <a href="${site()}/assessment/storyRecall">${site()}/assessment/storyRecall</a></p>`,
    }),
    storyRecallClosing: ({ until }) => ({
        subject: "Your story questions close in 6 hours",
        body: `<p>Your short-story questions close in about <strong>6 hours</strong>${until ? ` (${escapeHtml(until)})` : ""}. Answer them now so this part of your report counts: <a href="${site()}/assessment/storyRecall">${site()}/assessment/storyRecall</a></p>`,
    }),
    reportRerun: () => ({
        subject: "Your report is being prepared again",
        body: `<p>We've fixed what stopped your report and it is being prepared again. It is usually ready within a few minutes: <a href="${site()}/report">${site()}/report</a></p>`,
    }),
    // ── mentor sessions (Round 28) ──
    mentorInvite: ({ firstName, profession, jobRole, focus, helpWanted }) => ({
        subject: "You've received a mentor invite",
        body: `<p>You've been matched with a student who would like your help.</p>${line("Student", firstName)}${line("Career", profession)}${line("Job role", jobRole)}${line("Help with", focus)}${line("They'd like to know", helpWanted)}<p>Please open your mentor page, accept our privacy rules, and you'll see how to reach the student: <a href="${site()}/mentor">${site()}/mentor</a></p><p>Then send them your Calendly (booking) link and press "I've sent my booking link".</p><p><strong>Privacy rules</strong></p><ul>${PRIVACY_RULES.map((rule) => `<li>${escapeHtml(rule)}</li>`).join("")}</ul>`,
    }),
    mentorConfirmed: ({ mentorName, contactVia }) => ({
        subject: "Your mentor is confirmed",
        body: `<p>Your mentor${mentorName ? `, <strong>${escapeHtml(mentorName)}</strong>,` : ""} is confirmed. They'll message you on <strong>${contactVia === "email" ? "email" : "WhatsApp"}</strong> with a link to book your session.</p><p>After your session, leave a short review here — it opens once we've marked the session done: <a href="${site()}/mentorship/review">${site()}/mentorship/review</a></p><p>If anything about your mentor feels wrong, use "Report a problem with my mentor" on <a href="${site()}/mentorship">${site()}/mentorship</a>.</p>`,
    }),
    reviewOpen: () => ({
        subject: "How was your mentor session?",
        body: `<p>Your mentor session is marked done. Tell us how it went — a rating out of 10 and two quick questions: <a href="${site()}/mentorship/review">${site()}/mentorship/review</a></p>`,
    }),
    mentorReportReceived: () => ({
        subject: "We've received your report about your mentor",
        body: `<p>Thank you for telling us. <strong>Please block your mentor's number on WhatsApp now</strong> if you haven't already.</p><p>We'll stop them contacting you and come back to you within 2 working days with what you chose — your money back, or another mentor.</p>`,
    }),
    mentorReportResolved: ({ outcome, note }) => ({
        subject: "About your report",
        body: `<p>${outcome === "new_mentor" ? "We're finding you a different mentor — the one you reported will not be matched with you again." : outcome === "refund" ? "We're processing your refund. You'll get a separate email when it is on its way." : "We've looked into your report."}</p>${line("Note from our team", note)}`,
    }),
    retakeDeclined: ({ testName, reason }) => ({
        subject: `About your request for ${testName}`,
        body: `<p>We looked into what you told us about <strong>${escapeHtml(testName)}</strong> and couldn't reopen it.</p>${line("Reason", reason)}<p>If something still seems wrong, reply to this email.</p>`,
    }),
}

// only money emails point to the payment history
const MONEY = ["paymentSuccess", "planGranted", "paymentFailed", "refundStarted", "refundCompleted", "refundFailed", "refundDeclined", "aidApproved", "aidDeclined", "aidCancelled"]

const notifyStudent = (user, kind, details = {}) => {
    const template = TEMPLATES[kind]
    if (!template) return Promise.resolve({ sent: false, error: `unknown email ${kind}` })
    const { subject, body } = template(details)
    remember(user, kind, subject, body)
    return send(user, subject, body, MONEY.includes(kind), kind)
}

module.exports = { notifyStudent, TEMPLATES, plainText, linkIn }
