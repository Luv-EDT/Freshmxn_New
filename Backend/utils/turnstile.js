// CLOUDFLARE TURNSTILE (owner, Round 25) — the "are you a person?" check on the sign-up forms.
// Off until the owner adds the keys: with no TURNSTILE_SECRET_KEY every request passes, exactly as
// before. With it, the token the widget put in the form is checked with Cloudflare; a missing or
// rejected token fails. Cloudflare being unreachable also fails — a spam wave is worse than a
// student pressing the button again.

const VERIFY_URL = process.env.TURNSTILE_ENDPOINT || "https://challenges.cloudflare.com/turnstile/v0/siteverify"

const turnstileOn = () => Boolean(process.env.TURNSTILE_SECRET_KEY)

const verifyTurnstile = async (token, ip) => {
    if (!turnstileOn()) return true
    if (typeof token !== "string" || !token) return false
    try {
        const body = new URLSearchParams({ secret: process.env.TURNSTILE_SECRET_KEY, response: token })
        if (ip) body.append("remoteip", ip)
        const response = await fetch(VERIFY_URL, { method: "POST", body, signal: AbortSignal.timeout(8000) })
        const result = await response.json()
        return result.success === true
    } catch (error) {
        console.warn(`turnstile: could not check a token — ${error.message}`)
        return false
    }
}

module.exports = { verifyTurnstile, turnstileOn }
