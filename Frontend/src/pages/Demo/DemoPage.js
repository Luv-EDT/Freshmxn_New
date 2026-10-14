import { useCallback, useEffect, useState } from "react"
import { message } from "antd"
import PublicNav from "../Public/PublicNav"
import PublicFooter from "../Public/PublicFooter"
import TurnstileBox, { turnstileOn } from "../TurnstileBox"
import DemoPulls from "./DemoPulls"
import DemoStuck from "./DemoStuck"
import DemoOpenness from "./DemoOpenness"
import DemoReasoning from "./DemoReasoning"
import DemoResult from "./DemoResult"
import { startDemo, getDemoState, saveDemoInterests, saveDemoOpenness, getDemoResult, loadDemoResult } from "../../apiCall/demoApi"

// "TRY THE DEMO" (owner, Round 32) — /try-demo, no login. A first name; what pulls you and what stuck;
// eight statements and six puzzles; an email; then two careers from the real engines and the three plans.
//
// It runs on its own routes (/demo) and its own data — nothing here touches an account. The demo's
// token lives in this tab (sessionStorage), so a refresh carries on where it was.
const TOKEN_KEY = "freshmxnDemoToken"
const readToken = () => {
    try { return sessionStorage.getItem(TOKEN_KEY) } catch (error) { return null }
}
const keepToken = (token) => {
    try { sessionStorage.setItem(TOKEN_KEY, token) } catch (error) { /* a private window — the demo still runs */ }
}

const STEPS = ["pulls", "stuck", "openness", "reasoning", "gate"]

function DemoPage() {
    const [step, setStep] = useState("loading")
    const [token, setToken] = useState(readToken())
    const [name, setName] = useState("")
    const [captcha, setCaptcha] = useState({ token: "", reset: 0 })
    const [interests, setInterests] = useState({ draws: [], aspiration: null, stuck: [] })
    const [gate, setGate] = useState({ email: "", adult: null, parent: false })
    const [result, setResult] = useState(null)
    const [busy, setBusy] = useState(false)

    // a refresh carries on where it was
    useEffect(() => {
        const resume = async () => {
            if (!token) return setStep("start")
            try {
                const state = (await getDemoState(token)).data.data
                setName(state.name)
                if (state.interests) setInterests(state.interests)
                if (state.hasResult) {
                    setResult((await loadDemoResult(token)).data.data)
                    return setStep("result")
                }
                if (state.reasoningAnswered >= 6) return setStep("gate")
                if (state.openness) return setStep("reasoning")
                if (state.status === "interests") return setStep("openness")
                return setStep("pulls")
            } catch (error) {
                setToken(null)
                return setStep("start")
            }
        }
        resume()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => { window.scrollTo(0, 0) }, [step])

    const run = async (work) => {
        setBusy(true)
        try {
            await work()
        } catch (error) {
            message.error(error.response?.data?.message || "Something went wrong — please try again")
        } finally {
            setBusy(false)
        }
    }

    const start = () => run(async () => {
        try {
            const response = await startDemo({ name, turnstileToken: captcha.token })
            keepToken(response.data.data.token)
            setToken(response.data.data.token)
            setName(response.data.data.name)
            setStep("pulls")
        } catch (error) {
            setCaptcha({ token: "", reset: captcha.reset + 1 })
            throw error
        }
    })

    const savePulls = ({ draws, aspiration }) => {
        setInterests({ ...interests, draws, aspiration: aspiration && aspiration.text.trim() ? { text: aspiration.text.trim(), professionId: aspiration.professionId } : null })
        setStep("stuck")
    }

    const saveStuck = (stuck) => run(async () => {
        const next = { ...interests, stuck }
        await saveDemoInterests({ token, ...next })
        setInterests(next)
        setStep("openness")
    })

    const saveOpenness = (answers) => run(async () => {
        await saveDemoOpenness({ token, answers })
        setStep("reasoning")
    })

    const seeResult = () => run(async () => {
        const response = await getDemoResult({ token, email: gate.email, adult: gate.adult, parentConsent: gate.adult === false ? gate.parent : undefined })
        setResult(response.data.data)
        setStep("result")
    })

    const onCaptcha = useCallback((value) => setCaptcha((current) => ({ ...current, token: value })), [])
    const progress = STEPS.indexOf(step)

    return (
        <div>
            <PublicNav />
            <main className="page demo-page">
                {progress >= 0 && (
                    <>
                        <p className="demo-banner">A 2-factor taste of a 31-factor assessment.</p>
                        <div className="demo-progress" aria-label={`Step ${progress + 1} of ${STEPS.length}`}>
                            {STEPS.map((key, index) => <span key={key} className={index <= progress ? "is-done" : ""} />)}
                        </div>
                    </>
                )}

                {step === "loading" && <p>Loading…</p>}

                {step === "start" && (
                    <section className="demo-step">
                        <span className="eyebrow">TRY THE DEMO</span>
                        <h1>A 7-minute glimpse of what we'd find for you</h1>
                        <p className="demo-lead">
                            Two questions about what pulls you, eight statements and six puzzles — then two careers your
                            answers point to, from the same engine as the full program. No login.
                        </p>
                        <label className="demo-label" htmlFor="demo-name">Your first name</label>
                        <input id="demo-name" className="demo-input" value={name} maxLength={60} onChange={(event) => setName(event.target.value)} placeholder="e.g. Asha" />
                        <TurnstileBox onToken={onCaptcha} resetKey={captcha.reset} />
                        <button type="button" className="btn btn-primary tap" disabled={busy || name.trim().length < 2 || (turnstileOn && !captcha.token)} onClick={start}>
                            {busy ? "Starting…" : "Start"}
                        </button>
                    </section>
                )}

                {step === "pulls" && <DemoPulls initial={interests} onNext={savePulls} busy={busy} />}
                {step === "stuck" && <DemoStuck draws={interests.draws} initial={interests.stuck} onNext={saveStuck} onBack={() => setStep("pulls")} busy={busy} />}
                {step === "openness" && <DemoOpenness onNext={saveOpenness} busy={busy} />}
                {step === "reasoning" && <DemoReasoning token={token} onDone={() => setStep("gate")} />}

                {step === "gate" && (
                    <section className="demo-step">
                        <h2>Your result is ready, {name}</h2>
                        <p className="demo-lead">Where should we keep it? If you sign up later with this email, your answers carry over.</p>
                        <label className="demo-label" htmlFor="demo-email">Your email</label>
                        <input id="demo-email" type="email" className="demo-input" value={gate.email} onChange={(event) => setGate({ ...gate, email: event.target.value })} placeholder="you@example.com" />
                        <p className="demo-label">Are you 18 or older?</p>
                        <div className="demo-chips" role="radiogroup" aria-label="Are you 18 or older?">
                            <button type="button" role="radio" aria-checked={gate.adult === true} className={`demo-chip${gate.adult === true ? " is-on" : ""}`} onClick={() => setGate({ ...gate, adult: true, parent: false })}>Yes</button>
                            <button type="button" role="radio" aria-checked={gate.adult === false} className={`demo-chip${gate.adult === false ? " is-on" : ""}`} onClick={() => setGate({ ...gate, adult: false })}>No, I'm under 18</button>
                        </div>
                        {gate.adult === false && (
                            <label className="consent-check demo-consent">
                                <input type="checkbox" checked={gate.parent} onChange={(event) => setGate({ ...gate, parent: event.target.checked })} />
                                My parent or guardian knows I'm trying this and agrees.
                            </label>
                        )}
                        <p className="demo-hint">We keep your demo for 30 days and never use it for ads. See our <a href="/privacy#demo">Privacy Policy</a>.</p>
                        <button
                            type="button"
                            className="btn btn-primary tap"
                            disabled={busy || !gate.email.includes("@") || gate.adult === null || (gate.adult === false && !gate.parent)}
                            onClick={seeResult}
                        >
                            {busy ? "Reading your answers…" : "See my two careers"}
                        </button>
                    </section>
                )}

                {step === "result" && result && <DemoResult result={result} />}
            </main>
            <PublicFooter />
        </div>
    )
}

export default DemoPage
