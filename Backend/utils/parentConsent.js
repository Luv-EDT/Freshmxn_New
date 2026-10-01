const crypto = require("crypto")
const bcrypt = require("bcrypt")
const Consent = require("../model/consentModel")
const { sendEmail, escapeHtml } = require("./mailer")

// VERIFIED PARENTAL CONSENT BY EMAIL (owner, Round 10; SMS later). The DPDP Act needs a parent's
// verifiable consent before a child's data is processed. A self-declared checkbox is the student
// speaking for the parent; this is the parent speaking: a 6-digit code goes to the PARENT's inbox,
// and only someone who can read that inbox can give it back.
//
// THE CODE IS NEVER STORED AS SENT — only its bcrypt hash — and it dies after OTP_MINUTES, after
// OTP_MAX_ATTEMPTS wrong tries (a fresh code is needed), and on use. A new code cannot be asked for
// within OTP_RESEND_SECONDS of the last, so the button cannot be used to flood a parent's inbox.
const OTP_MINUTES = 10
const OTP_MAX_ATTEMPTS = 5
const OTP_RESEND_SECONDS = 60

const isMinor = (user) => typeof user.age === "number" && user.age < 18
const isVerified = (consent) => Boolean(consent && consent.verifiedAt && consent.isTemporary === false)

// "pa***@gmail.com" — enough for the student to recognise, not enough to harvest
const maskEmail = (email) => {
    if (!email || !email.includes("@")) return null
    const [name, domain] = email.split("@")
    return `${name.slice(0, 2)}${"*".repeat(Math.max(name.length - 2, 1))}@${domain}`
}

const secondsUntilResend = (consent) => {
    if (!consent || !consent.otpSentAt) return 0
    const waited = (Date.now() - new Date(consent.otpSentAt).getTime()) / 1000
    return Math.max(Math.ceil(OTP_RESEND_SECONDS - waited), 0)
}

// Issues a fresh code and emails it to the parent. Returns { sent, error }.
const sendParentCode = async (consent, student) => {
    const code = String(crypto.randomInt(0, 1000000)).padStart(6, "0")

    consent.otpHash = await bcrypt.hash(code, 10)
    consent.otpExpiresAt = new Date(Date.now() + OTP_MINUTES * 60 * 1000)
    consent.otpAttempts = 0
    consent.otpSentAt = new Date()
    await consent.save()

    const privacyUrl = `${process.env.FRONTEND_URL}/privacy`

    return sendEmail({
        to: consent.parentEmail,
        subject: `${student.name} is asking for your permission to use Freshmxn`,
        html: `<p>Dear ${escapeHtml(consent.parentName)},</p>
               <p><strong>${escapeHtml(student.name)}</strong> has signed up for Freshmxn, a career-guidance service for students in India,
               and has named you as their parent or guardian. Because they are under 18, the law asks for your permission before we keep
               and use their information.</p>
               <p>If you agree, give them this code (or type it in yourself) on the Freshmxn page that asks for it:</p>
               <p style="font-size:28px;font-weight:bold;letter-spacing:6px">${code}</p>
               <p>The code works for ${OTP_MINUTES} minutes. Entering it means you agree to our Terms and Privacy Policy
               (<a href="${privacyUrl}">${privacyUrl}</a>), which explains exactly what we collect and why. You can withdraw your
               permission and ask us to delete your child's data at any time by replying to this email or writing to luvgoel@freshmxn.com.</p>
               <p>If you did not expect this, you can ignore this email — nothing happens without the code.</p>`,
    })
}

// Checks a code. Returns { ok, message }.
const checkParentCode = async (consent, code, ip, policyVersion) => {
    if (!consent || !consent.otpHash || !consent.otpExpiresAt) return { ok: false, message: "Ask for a code first" }
    if (new Date(consent.otpExpiresAt).getTime() < Date.now()) return { ok: false, message: "That code has expired — ask for a new one" }
    if (consent.otpAttempts >= OTP_MAX_ATTEMPTS) return { ok: false, message: "Too many tries — ask for a new code" }

    const typed = String(code || "").replace(/\D/g, "")
    const matches = typed.length === 6 && await bcrypt.compare(typed, consent.otpHash)

    if (!matches) {
        consent.otpAttempts += 1
        await consent.save()
        const left = OTP_MAX_ATTEMPTS - consent.otpAttempts
        return { ok: false, message: left > 0 ? `That code is not right — ${left} ${left === 1 ? "try" : "tries"} left` : "Too many tries — ask for a new code" }
    }

    consent.consentMethod = "otp_email"
    consent.isTemporary = false
    consent.verifiedAt = new Date()
    consent.ipAtVerify = ip
    consent.policyVersion = policyVersion
    consent.otpHash = null
    consent.otpExpiresAt = null
    await consent.save()

    return { ok: true, message: "Thank you — your parent's permission is confirmed" }
}

module.exports = { isMinor, isVerified, maskEmail, secondsUntilResend, sendParentCode, checkParentCode, OTP_MINUTES, OTP_RESEND_SECONDS, Consent }
