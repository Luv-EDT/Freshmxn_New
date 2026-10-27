import { useCallback, useState } from "react"
import { Link } from "react-router-dom"
import { Input } from "antd"
import StageFields, { EMPTY_DETAIL } from "../StageFields"
import TurnstileBox, { turnstileOn } from "../TurnstileBox"
import { demoRegister, demoVerify, demoResendCode, demoLogin } from "../../apiCall/demoApi"

// THE ACCOUNT STEP BEFORE THE RESULT (owner, Round 36). The result is for someone with an account: they sign
// up here — the same fields and rules as the register page, their stage (the category that decides what the
// site shows them) carried from the demo's start — and prove the email with a 6-digit code we send. An email
// that already has an account logs in instead. Either way they see the result already logged in.
// Someone who stops here sees no result, and no account is made.
//
// mode: form → code (or login) → done
function DemoAccount({ token, name: firstName, stage, onDone, emailCheck }) {
    const [mode, setMode] = useState("form")
    const [form, setForm] = useState({
        name: firstName || "",
        email: "",
        phone: "",
        password: "",
        age: "",
        journey: stage.journey || "",
        journeyDetail: { ...EMPTY_DETAIL, ...(stage.journey === "early_professional" && stage.years !== "" ? { experienceYears: Number(stage.years) } : {}) },
        parentConsentChecked: false,
        parentName: "",
        parentPhone: "",
        parentEmail: "",
        website: "",
    })
    const [code, setCode] = useState("")
    const [password, setPassword] = useState("")
    const [captcha, setCaptcha] = useState({ token: "", reset: 0 })
    const [busy, setBusy] = useState(false)
    const [note, setNote] = useState("")
    const onCaptcha = useCallback((value) => setCaptcha((current) => ({ ...current, token: value })), [])

    const set = (part) => setForm((current) => ({ ...current, ...part }))
    const isMinor = form.age !== "" && Number(form.age) < 18
    const email = emailCheck(form.email)

    const call = async (request, after) => {
        setBusy(true)
        setNote("")
        try {
            const response = await request()
            await after(response.data)
        } catch (error) {
            const data = error.response?.data
            if (data && data.data && data.data.exists) {
                setMode("login")
                setNote(data.message)
            } else {
                setNote(data?.message || "Something went wrong — please try again")
            }
            if (mode === "form") setCaptcha((current) => ({ token: "", reset: current.reset + 1 }))
        } finally {
            setBusy(false)
        }
    }

    const register = (event) => {
        event.preventDefault()
        call(() => demoRegister({ token, ...form, age: Number(form.age), turnstileToken: captcha.token }), (data) => {
            setMode("code")
            setNote(data.message)
        })
    }
    const verify = (event) => {
        event.preventDefault()
        call(() => demoVerify({ token, code }), (data) => onDone(data.data))
    }
    const login = (event) => {
        event.preventDefault()
        call(() => demoLogin({ token, email: form.email, password }), (data) => onDone(data.data))
    }
    const resend = () => call(() => demoResendCode({ token }), (data) => setNote(data.message))

    if (busy && mode !== "form") {
        return (
            <div className="demo-reading" role="status">
                <span className="demo-reading-bar" aria-hidden="true"><span /></span>
                <p><strong>Reading your answers — this takes about 30 seconds.</strong> We're matching your story against 1,000+ careers and job roles.</p>
            </div>
        )
    }

    if (mode === "code") {
        return (
            <form className="demo-account" onSubmit={verify}>
                <h2>Check your email</h2>
                <p className="demo-lead">{note || `We've sent a 6-digit code to ${form.email}.`} Type it here to finish signing up and see your result.</p>
                <label className="demo-label" htmlFor="demo-code">Your code</label>
                <input id="demo-code" className="demo-input demo-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="123456" />
                <button type="submit" className="btn btn-primary tap" disabled={code.length !== 6}>See my two careers</button>
                <p className="demo-hint">
                    Didn't get it? Check spam, or <button type="button" className="link-button" onClick={resend}>send a new code</button>
                    {" "}· <button type="button" className="link-button" onClick={() => { setMode("form"); setNote("") }}>change my email</button>
                </p>
            </form>
        )
    }

    if (mode === "login") {
        return (
            <form className="demo-account" onSubmit={login}>
                <h2>Log in to see your result</h2>
                <p className="demo-lead">{note || "This email already has a Freshmxn account."}</p>
                <label className="demo-label" htmlFor="demo-login-email">Email</label>
                <input id="demo-login-email" type="email" className="demo-input" value={form.email} onChange={(event) => set({ email: event.target.value })} autoComplete="email" />
                <label className="demo-label" htmlFor="demo-login-password">Password</label>
                <Input.Password id="demo-login-password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" />
                <button type="submit" className="btn btn-primary tap" disabled={busy || !password}>{busy ? "Logging in…" : "Log in and see my result"}</button>
                <p className="demo-hint">
                    Forgot it? <Link to="/forgot-password">Reset your password</Link>, then come back to this page — your demo waits here.
                    {" "}· <button type="button" className="link-button" onClick={() => { setMode("form"); setNote("") }}>use another email</button>
                </p>
            </form>
        )
    }

    return (
        <form className="demo-account" onSubmit={register}>
            <h2>Your result is ready, {firstName}</h2>
            <p className="demo-lead">
                Create your free account to see it. We'll email you a code to confirm your email — then you're signed in,
                and your story carries over when you continue.
            </p>
            <label className="demo-label" htmlFor="demo-acc-name">Name</label>
            <input id="demo-acc-name" className="demo-input" value={form.name} maxLength={60} onChange={(event) => set({ name: event.target.value })} />

            <label className="demo-label" htmlFor="demo-email">Email</label>
            <input id="demo-email" type="email" className={`demo-input${form.email && !email.ok ? " is-invalid" : ""}`} value={form.email} onChange={(event) => set({ email: event.target.value })} placeholder="you@example.com" autoComplete="email" aria-describedby="demo-email-check" />
            {form.email && !email.ok && email.message && (
                <p id="demo-email-check" className="demo-email-check" role="alert">
                    {email.message}
                    {email.fix && <button type="button" className="demo-email-fix" onClick={() => set({ email: email.fix })}>Use it</button>}
                </p>
            )}

            <label className="demo-label" htmlFor="demo-phone">Mobile number (10 digits)</label>
            <input id="demo-phone" type="tel" inputMode="numeric" className="demo-input" value={form.phone} onChange={(event) => set({ phone: event.target.value.replace(/\D/g, "").slice(0, 10) })} />

            <label className="demo-label" htmlFor="demo-password">Password (at least 8 characters)</label>
            <Input.Password id="demo-password" value={form.password} onChange={(event) => set({ password: event.target.value })} autoComplete="new-password" />

            <label className="demo-label" htmlFor="demo-age">Age</label>
            <input id="demo-age" type="number" min="8" max="100" className="demo-input demo-input-short" value={form.age} onChange={(event) => set({ age: event.target.value })} />

            <div className="demo-stage-fields">
                <StageFields journey={form.journey} setJourney={(journey) => set({ journey })} detail={form.journeyDetail} setDetail={(updater) => setForm((current) => ({ ...current, journeyDetail: typeof updater === "function" ? updater(current.journeyDetail) : updater }))} />
            </div>

            {isMinor && (
                <div className="demo-minor">
                    <p><strong>You're under 18</strong></p>
                    <label className="consent-check demo-consent">
                        <input type="checkbox" checked={form.parentConsentChecked} onChange={(event) => set({ parentConsentChecked: event.target.checked })} />
                        I have my parent or guardian's permission to use Freshmxn, and they agree to the <Link to="/terms" target="_blank">Terms</Link> and <Link to="/privacy" target="_blank">Privacy Policy</Link>.
                    </label>
                    <label className="demo-label" htmlFor="demo-parent-name">Parent/guardian name</label>
                    <input id="demo-parent-name" className="demo-input" value={form.parentName} onChange={(event) => set({ parentName: event.target.value })} />
                    <label className="demo-label" htmlFor="demo-parent-phone">Parent/guardian mobile (10 digits)</label>
                    <input id="demo-parent-phone" className="demo-input" inputMode="numeric" value={form.parentPhone} onChange={(event) => set({ parentPhone: event.target.value.replace(/\D/g, "").slice(0, 10) })} />
                    <label className="demo-label" htmlFor="demo-parent-email">Parent/guardian email</label>
                    <input id="demo-parent-email" type="email" className="demo-input" value={form.parentEmail} onChange={(event) => set({ parentEmail: event.target.value })} />
                    <p className="demo-hint">We email them a code so they can confirm their permission themselves.</p>
                </div>
            )}

            <p className="demo-hint">By creating an account you agree to our <Link to="/terms" target="_blank">Terms</Link> and <Link to="/privacy" target="_blank">Privacy Policy</Link>.</p>
            <TurnstileBox onToken={onCaptcha} resetKey={captcha.reset} />
            {note && <p className="demo-email-check" role="alert">{note}</p>}
            <button type="submit" className="btn btn-primary tap" disabled={busy || !email.ok || form.password.length < 8 || form.phone.length !== 10 || !form.age || !form.journey || (turnstileOn && !captcha.token)}>
                {busy ? "Sending your code…" : "Send my code"}
            </button>
            <p className="demo-hint">Already have an account? <button type="button" className="link-button" onClick={() => { setMode("login"); setNote("") }}>Log in instead</button></p>
            <div className="hp-field" aria-hidden="true">
                <label>Leave this empty</label>
                <input type="text" name="hp_url" tabIndex={-1} autoComplete="off" value={form.website} onChange={(event) => set({ website: event.target.value })} />
            </div>
        </form>
    )
}

export default DemoAccount
