import { useEffect, useRef } from "react"

// Cloudflare Turnstile — the "are you a person?" check on sign-up (owner, Round 25). Shown only when
// REACT_APP_TURNSTILE_SITE_KEY is set at build time; until then it renders nothing and the server,
// with no secret key, lets every sign-up through as before. Most people never see a puzzle: the
// widget decides in the background and hands the form a token, which the server checks.
const SITE_KEY = process.env.REACT_APP_TURNSTILE_SITE_KEY
const SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"

export const turnstileOn = Boolean(SITE_KEY)

const loadScript = () => new Promise((resolve) => {
    if (window.turnstile) return resolve(true)
    const existing = document.querySelector(`script[src="${SCRIPT}"]`)
    const script = existing || document.createElement("script")
    script.addEventListener("load", () => resolve(true))
    script.addEventListener("error", () => resolve(false))
    if (!existing) {
        script.src = SCRIPT
        script.async = true
        document.head.appendChild(script)
    }
})

// resetKey: change it after a failed sign-up and the widget hands out a fresh token — each token
// works once, so a retry with the old one always failed (Round 28)
function TurnstileBox({ onToken, resetKey }) {
    const box = useRef(null)
    const widget = useRef(null)

    useEffect(() => {
        if (!resetKey || widget.current === null || !window.turnstile) return
        onToken("")
        window.turnstile.reset(widget.current)
    }, [resetKey, onToken])

    useEffect(() => {
        if (!turnstileOn) return undefined
        let widgetId = null
        let gone = false
        loadScript().then((loaded) => {
            if (!loaded || gone || !box.current || !window.turnstile) return
            widgetId = window.turnstile.render(box.current, {
                sitekey: SITE_KEY,
                callback: (token) => onToken(token),
                "expired-callback": () => onToken(""),
                "error-callback": () => onToken(""),
            })
            widget.current = widgetId
        })
        return () => {
            gone = true
            if (widgetId !== null && window.turnstile) window.turnstile.remove(widgetId)
            widget.current = null
        }
    }, [onToken])

    if (!turnstileOn) return null
    return <div ref={box} className="turnstile-box" />
}

export default TurnstileBox
