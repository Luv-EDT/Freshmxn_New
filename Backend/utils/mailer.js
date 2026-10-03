const { Resend } = require("resend")

// ONE PLACE THAT SENDS EMAIL, shared by everything added after userRouter's own two emails (Round 10):
// parent-consent codes, the 6- and 12-month follow-up, retake notices and admin alerts.
//
// THE CLIENT IS BUILT ON FIRST USE, NOT AT LOAD. userRouter builds its Resend client at module load,
// and a missing RESEND_API_KEY there crashes boot (HANDOVER Part 4). A helper required by workers and
// routers alike must never do that — a machine with no key should still start, and say so per send.
//
// NEVER THROWS. A failed email is logged and reported back as `{ sent: false, error }`, so the caller
// decides whether it matters (a consent code that never arrived does; an admin alert can wait).
let client = null

const resendClient = () => {
    if (!process.env.RESEND_API_KEY) return null
    if (!client) client = new Resend(process.env.RESEND_API_KEY)
    return client
}

// the minimum escaping needed to put a student's own words inside an email
const escapeHtml = (text) => String(text === undefined || text === null ? "" : text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")

const sendEmail = async ({ to, subject, html }) => {
    const resend = resendClient()

    if (!resend || !process.env.EMAIL_FROM) {
        console.log(`Email not sent (RESEND_API_KEY or EMAIL_FROM missing): "${subject}" to ${to}`)
        return { sent: false, error: "email is not configured" }
    }

    try {
        const { error } = await resend.emails.send({ from: process.env.EMAIL_FROM, to, subject, html })
        if (error) {
            console.log(`Email "${subject}" failed:`, error)
            return { sent: false, error: error.message || String(error) }
        }
        return { sent: true }
    } catch (error) {
        console.log(`Email "${subject}" threw:`, error.message)
        return { sent: false, error: error.message }
    }
}

// Alerts for the team go to ADMIN_EMAIL (set in Render). No address, no alert — the admin tabs still
// show everything; email is only the nudge.
const notifyAdmin = async (subject, html) => {
    if (!process.env.ADMIN_EMAIL) return { sent: false, error: "ADMIN_EMAIL is not set" }
    return sendEmail({ to: process.env.ADMIN_EMAIL, subject: `[Freshmxn] ${subject}`, html })
}

module.exports = { sendEmail, notifyAdmin, escapeHtml }
