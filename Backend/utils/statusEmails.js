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
    // ── mentor sessions (Rounds 28 and 34) ──
    mentorInvite: ({ firstName, profession, jobRole, focus, helpWanted }) => ({
        subject: "You have a new student",
        body: `<p>We've matched you with a student. You have <strong>2.5 days</strong> to read their brief and prepare — about 30 minutes, and much less with practice.</p>${line("Student", firstName)}${line("Career", profession)}${line("Job role", jobRole)}${line("Help with", focus)}${line("They'd like to know", helpWanted)}<p>Read the full brief on your mentor page: <a href="${site()}/mentor">${site()}/mentor</a></p><p>The student books from your Calendly links, so keep the slots you opened free and honour every booking. After the session, tell us on WhatsApp (8882756287) that it's done — we then send the student the feedback form, and your payment follows their feedback.</p><p><strong>Privacy rules</strong></p><ul>${PRIVACY_RULES.map((rule) => `<li>${escapeHtml(rule)}</li>`).join("")}</ul>`,
    }),
    mentorConfirmed: ({ mentorName, calendlyMain, calendlyFollowUp }) => ({
        subject: "Your mentor is confirmed — book your session",
        body: `<p>Your mentor${mentorName ? `, <strong>${escapeHtml(mentorName)}</strong>,` : ""} is confirmed. Book your session from these links within <strong>2.5 days</strong>, or it counts as a no-show:</p>${calendlyMain ? `<p>1-hour main session (in the next 4 days): <a href="${escapeHtml(calendlyMain)}">${escapeHtml(calendlyMain)}</a></p>` : ""}${calendlyFollowUp ? `<p>20-minute follow-up (day 5 or 6, if you'd like one): <a href="${escapeHtml(calendlyFollowUp)}">${escapeHtml(calendlyFollowUp)}</a></p>` : ""}<p>Book both together — if you don't pick a follow-up slot now, we take it that you don't want it (your mentor will also offer it at the end of your session). Add both to your calendar. Joining more than 10 minutes late counts as a no-show. To reschedule, message us on WhatsApp (8882756287) and we'll ask your mentor.</p><p>The links are also on your dashboard: <a href="${site()}/mentorship">${site()}/mentorship</a></p><p>After your session we'll send you a short feedback form. Please fill it only after the session, and don't share it with your mentor — it's for you to tell us, and for us to judge the mentor.</p>`,
    }),
    reviewOpen: () => ({
        subject: "How was your mentor session? Your feedback form is open",
        body: `<p>Your mentor has told us your session is done. Please fill the short feedback form — it takes 2 minutes and you can send it only once. It closes your mentor ticket, so send it after your follow-up too, if you booked one: <a href="${site()}/mentorship/review">${site()}/mentorship/review</a></p><p>Please don't share it with your mentor.</p>`,
    }),
    mentorReportReceived: ({ wants, refundInr }) => ({
        subject: "We've received your report about your mentor",
        body: wants === "refund"
            ? `<p>Thank you for telling us, and we're sorry. Your mentor ticket is closed and you'll get a refund of the mentor part${refundInr ? ` (<strong>${inr(refundInr)}</strong>)` : ""} — you'll get a separate email when it's on its way.</p>`
            : `<p>Thank you for telling us, and we're sorry. We'll give you a new mentor within <strong>15 business days</strong> — the one you reported will not be matched with you again. We'll update you by email, WhatsApp and on your dashboard.</p>`,
    }),
    mentorReportResolved: ({ outcome, note }) => ({
        subject: "About your report",
        body: `<p>${outcome === "new_mentor" ? "We've looked into your report. We're finding you a different mentor — the one you reported will not be matched with you again." : outcome === "refund" ? "We've looked into your report. Your refund of the mentor part is being processed — you'll get a separate email when it is on its way." : "We've looked into your report."}</p>${line("Note from our team", note)}`,
    }),
    choiceReset: () => ({
        subject: "Choose your mentor's job role again",
        body: `<p>As you asked, we've reset your mentor choice. Please choose the career and job role again — your 20-business-day match starts when you send it: <a href="${site()}/mentorship/choose">${site()}/mentorship/choose</a></p>`,
    }),
    newMentorComing: ({ dueBy }) => ({
        subject: "We're finding you a new mentor",
        body: `<p>We're finding you a new mentor for the same career and job role${dueBy ? `, by <strong>${escapeHtml(new Date(dueBy).toDateString())}</strong>` : " within 15 business days"}. We're sorry for the wait — we'll update you by email, WhatsApp and on your dashboard: <a href="${site()}/mentorship">${site()}/mentorship</a></p>`,
    }),
    studentNoShow: () => ({
        subject: "Your mentor session was marked a no-show",
        body: `<p>Your mentor session was marked a no-show — it wasn't booked within 2.5 days, or nobody joined within 10 minutes of the start. Your mentor ticket is now closed. If something went wrong, message us on WhatsApp (8882756287).</p>`,
    }),
    // ── for mentors (Round 34) ──
    mentorTestReceived: () => ({
        subject: "We've received your mentor test",
        body: `<p>Thank you — your test is with our team. It usually takes a couple of days to review your profile and test; we'll let you know by email whether you're onboarded.</p>`,
    }),
    mentorDecision: ({ decision, note }) => ({
        subject: decision === "approved" ? "Welcome — you're an approved Freshmxn mentor" : "About your mentor application",
        body: decision === "approved"
            ? `<p>You're approved. We'll message you on WhatsApp before we match you with a student, so you can open slots on your Calendly links. Your dashboard has everything: <a href="${site()}/mentor">${site()}/mentor</a></p>${line("Note from our team", note)}<p>As promised, your test video has been deleted.</p>`
            : `<p>Thank you for applying. We can't onboard you as a mentor this time.</p>${line("Why", note)}<p>As promised, your test video has been deleted. Questions? WhatsApp 8882756287.</p>`,
    }),
    mentorTierUp: ({ tier }) => ({
        subject: `You're now a Tier ${tier} mentor`,
        body: `<p>Congratulations — you've moved up to <strong>Tier ${tier}</strong>, so your sessions now pay more. See it on your dashboard: <a href="${site()}/mentor">${site()}/mentor</a></p>`,
    }),
    mentorPaid: ({ amountInr, amountUsd, reference }) => ({
        subject: "We've sent your mentor payment",
        body: `<p>We've paid you <strong>${inr(amountInr)}</strong>${amountUsd ? ` ($${amountUsd})` : ""} for your session.</p>${line("Payment reference", reference)}<p>Each payment is listed under Payouts on your dashboard: <a href="${site()}/mentor">${site()}/mentor</a></p>`,
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
