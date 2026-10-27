import { useCallback, useEffect, useState } from "react"
import { message } from "antd"
import { useDispatch } from "react-redux"
import { setUser } from "../../store/userSlice"
import PublicNav from "../Public/PublicNav"
import PublicFooter from "../Public/PublicFooter"
import TurnstileBox, { turnstileOn } from "../TurnstileBox"
import DemoPulls from "./DemoPulls"
import DemoStuck from "./DemoStuck"
import DemoMi from "./DemoMi"
import DemoSart from "./DemoSart"
import DemoPuzzles from "./DemoPuzzles"
import DemoResult from "./DemoResult"
import DemoAccount from "./DemoAccount"
import { startDemo, getDemoState, saveDemoInterests, saveDemoTests, loadDemoResult } from "../../apiCall/demoApi"

// "TRY A FREE DEMO" (owner, Rounds 32-33, 36) — /try-demo, about 5 minutes. A first name and where they are
// now; their story across three timelines and what stuck; seven statements, a 90-second focus game and four
// puzzles; then (Round 36, owner) an account — sign up with an emailed code, or log in — and the result: two
// careers from the real engines, what the full program adds and the programs.
//
// The demo runs on its own routes (/demo) and its own data; only the account step (DemoAccount →
// /demoAccount) makes an account, and they leave the demo logged in. The demo's token
// lives in this tab (sessionStorage), so a refresh carries on where it was; where they are now stays in the
// tab too, and reaches the server only with the email (owner).
const TOKEN_KEY = "freshmxnDemoToken"
const STAGE_KEY = "freshmxnDemoStage"
const read = (key) => {
    try { return sessionStorage.getItem(key) } catch (error) { return null }
}
const keep = (key, value) => {
    try { sessionStorage.setItem(key, value) } catch (error) { /* a private window — the demo still runs */ }
}

// the three stages the visitor moves through (owner, Round 33)
const PHASES = [
    { key: "counselling", label: "Virtual career counselling", steps: ["pulls", "stuck"] },
    { key: "assessments", label: "Assessments", steps: ["mi", "sart", "puzzles"] },
    { key: "report", label: "Report", steps: ["gate", "result"] },
]
const ASSESSMENT_STEPS = PHASES[1].steps

const STAGE_OPTIONS = [
    { value: "class9_10", label: "School — Class 9–10" },
    { value: "class11_12", label: "School — Class 11–12" },
    { value: "college", label: "College" },
    { value: "early_professional", label: "Working — early professional" },
]

const readStage = () => {
    try { return JSON.parse(read(STAGE_KEY)) || { journey: "", years: "" } } catch (error) { return { journey: "", years: "" } }
}

// the email, checked as they type (owner, Round 33): a proper address, and a nudge on the common typos
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i
const DOMAIN_FIXES = { "gmail.con": "gmail.com", "gmail.co": "gmail.com", "gmial.com": "gmail.com", "gmal.com": "gmail.com", "gamil.com": "gmail.com", "yahoo.con": "yahoo.com", "yaho.com": "yahoo.com", "hotmail.con": "hotmail.com", "outlook.con": "outlook.com", "rediffmail.con": "rediffmail.com" }
const emailCheck = (value) => {
    const email = String(value || "").trim().toLowerCase()
    if (!email) return { ok: false, message: "" }
    const domain = email.split("@")[1] || ""
    if (DOMAIN_FIXES[domain]) return { ok: false, message: `Did you mean ${email.split("@")[0]}@${DOMAIN_FIXES[domain]}?`, fix: `${email.split("@")[0]}@${DOMAIN_FIXES[domain]}` }
    if (!EMAIL_SHAPE.test(email)) return { ok: false, message: "That doesn't look like a full email yet — e.g. you@gmail.com" }
    return { ok: true, message: "" }
}

function DemoPage() {
    const dispatch = useDispatch()
    const [step, setStep] = useState("loading")
    const [token, setToken] = useState(read(TOKEN_KEY))
    const [name, setName] = useState("")
    const [stage, setStage] = useState(readStage)
    const [captcha, setCaptcha] = useState({ token: "", reset: 0 })
    const [interests, setInterests] = useState({ draws: [], aspiration: null, stuck: [] })
    const [mi, setMi] = useState({})
    const [sart, setSart] = useState([])
    const [result, setResult] = useState(null)
    const [busy, setBusy] = useState(false)

    // a refresh carries on where it was (the three tasks restart together if one was cut short)
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
                if (state.tested) return setStep("gate")
                if (state.status === "interests") return setStep("mi")
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
            keep(TOKEN_KEY, response.data.data.token)
            keep(STAGE_KEY, JSON.stringify(stage))
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
        setStep("mi")
    })

    const saveTests = (puzzles) => run(async () => {
        await saveDemoTests({ token, mi, sart, puzzles })
        setStep("gate")
    })

    // Round 36: the account step hands back the result and a session — they carry on logged in
    const accountDone = ({ result: shown, token: session, userData }) => {
        try { localStorage.setItem("token", session) } catch (error) { /* a private window — they log in again later */ }
        dispatch(setUser({ user: userData }))
        setResult(shown)
        setStep("result")
    }

    const onCaptcha = useCallback((value) => setCaptcha((current) => ({ ...current, token: value })), [])
    const phaseIndex = PHASES.findIndex((phase) => phase.steps.includes(step))
    const stageReady = stage.journey && (stage.journey !== "early_professional" || String(stage.years).trim() !== "")

    return (
        // a darker theme for the demo (owner, Round 33): dark at the sides, the page itself a bright column
        <div className="demo-shell">
            <PublicNav />
            <main className="page demo-page">
                {phaseIndex >= 0 && (
                    <ol className="demo-phases" aria-label="Where you are in the demo">
                        {PHASES.map((phase, index) => (
                            <li key={phase.key} className={index < phaseIndex ? "is-done" : index === phaseIndex ? "is-current" : ""}>
                                <span className="demo-phase-dot" aria-hidden="true">{index < phaseIndex ? "✓" : index + 1}</span>
                                {phase.label}
                            </li>
                        ))}
                    </ol>
                )}
                {ASSESSMENT_STEPS.includes(step) && <p className="demo-banner">A taste of 10 of our 31 factors — each only partly measured.</p>}

                {step === "loading" && <p>Loading…</p>}

                {step === "start" && (
                    <section className="demo-step">
                        <span className="eyebrow">FREE DEMO</span>
                        <h1>Five minutes to a glimpse of your careers</h1>
                        <p className="demo-lead">
                            Tell us a little of your story, play three short games, and see two careers your answers point
                            to — from the same engine as the full program.
                        </p>
                        <label className="demo-label" htmlFor="demo-name">Your first name</label>
                        <input id="demo-name" className="demo-input" value={name} maxLength={60} onChange={(event) => setName(event.target.value)} placeholder="e.g. Asha" />

                        <p className="demo-label">Where are you now?</p>
                        <div className="demo-chips" role="radiogroup" aria-label="Where are you now?">
                            {/* Round 36 (owner): this is their category too — it decides what the site shows them */}
                            {STAGE_OPTIONS.map((option) => (
                                <button
                                    type="button"
                                    key={option.value}
                                    role="radio"
                                    aria-checked={stage.journey === option.value}
                                    className={`demo-chip${stage.journey === option.value ? " is-on" : ""}`}
                                    onClick={() => setStage({ ...stage, journey: option.value })}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>
                        {stage.journey === "early_professional" && (
                            <>
                                <label className="demo-label" htmlFor="demo-years">Years of work experience</label>
                                <input id="demo-years" type="number" min="0" max="45" className="demo-input demo-input-short" value={stage.years} onChange={(event) => setStage({ ...stage, years: event.target.value })} />
                            </>
                        )}

                        <TurnstileBox onToken={onCaptcha} resetKey={captcha.reset} />
                        <button type="button" className="btn btn-primary tap" disabled={busy || name.trim().length < 2 || !stageReady || (turnstileOn && !captcha.token)} onClick={start}>
                            {busy ? "Starting…" : "Start"}
                        </button>
                    </section>
                )}

                {step === "pulls" && <DemoPulls initial={interests} onNext={savePulls} busy={busy} token={token} />}
                {step === "stuck" && <DemoStuck draws={interests.draws} initial={interests.stuck} onNext={saveStuck} onBack={() => setStep("pulls")} busy={busy} />}
                {step === "mi" && <DemoMi answers={mi} onChange={setMi} onNext={() => setStep("sart")} />}
                {step === "sart" && <DemoSart onDone={(rows) => { setSart(rows); setStep("puzzles") }} />}
                {step === "puzzles" && (busy ? <p className="demo-hint">Saving…</p> : <DemoPuzzles token={token} onDone={saveTests} />)}

                {step === "gate" && <section className="demo-step"><DemoAccount token={token} name={name} stage={stage} onDone={accountDone} emailCheck={emailCheck} /></section>}

                {step === "result" && result && <DemoResult result={result} />}
            </main>
            {/* no footer while the demo is going on — only once the result is shown (owner, Round 33) */}
            {step === "result" && <PublicFooter />}
        </div>
    )
}

export default DemoPage
