import { useEffect, useState } from "react"
import { useParams, Link } from "react-router-dom"
import PublicNav from "./PublicNav"
import PublicFooter from "./PublicFooter"
import { getFollowUpForm, submitFollowUp, unsubscribeFollowUp } from "../../apiCall/followUpsApi"

// The 6- and 12-month follow-up (owner, Round 10), opened from the emailed link — no login needed.
// Four questions, about a minute. The answers are how we check, over time, whether our matches work.
const DOING = [
    ["studying", "Studying"],
    ["working", "Working"],
    ["preparing_for_exam", "Preparing for an entrance exam"],
    ["between_things", "Between things / deciding"],
    ["other", "Something else"],
]
const FOLLOWED = [["yes", "Yes"], ["partly", "Partly"], ["no", "No"]]

function FollowUpPage() {
    const { token } = useParams()
    const [form, setForm] = useState(null)
    const [error, setError] = useState("")
    const [answers, setAnswers] = useState({ doingNow: "", careerId: "", careerText: "", followedMatch: "", satisfaction: "", note: "" })
    const [state, setState] = useState("idle")   // idle | sending | done | unsubscribed

    useEffect(() => {
        getFollowUpForm(token)
            .then((response) => setForm(response.data.data))
            .catch((loadError) => setError(loadError.response?.data?.message || "This link could not be opened"))
    }, [token])

    const set = (key, value) => setAnswers((previous) => ({ ...previous, [key]: value }))

    const submit = async (event) => {
        event.preventDefault()
        setState("sending")
        try {
            await submitFollowUp(token, { ...answers, satisfaction: Number(answers.satisfaction) })
            setState("done")
        } catch (submitError) {
            setError(submitError.response?.data?.message || "Could not save — please try again")
            setState("idle")
        }
    }

    const unsubscribe = async () => {
        try {
            await unsubscribeFollowUp(token)
            setState("unsubscribed")
        } catch (unsubscribeError) {
            setError("Could not do that — please try again")
        }
    }

    return (
        <div>
            <PublicNav />
            <main className="page follow-up">
                <h1>How is it going?</h1>

                {error && <p className="retake-note">{error}</p>}
                {!form && !error && <p>Loading…</p>}

                {state === "done" && <p className="retake-note"><strong>Thank you.</strong> That really helps the next student. <Link to="/">Back to Freshmxn</Link></p>}
                {state === "unsubscribed" && <p className="retake-note">Done — we won't send these questions again.</p>}

                {form && form.responded && state === "idle" && <p>You've already answered — thank you.</p>}

                {form && !form.responded && state !== "done" && state !== "unsubscribed" && (
                    <form onSubmit={submit}>
                        <p>Hi {form.firstName || "there"} — it has been {form.wave} months since your Freshmxn report. Four short questions.</p>

                        <fieldset>
                            <legend>1. What are you doing now?</legend>
                            {DOING.map(([value, label]) => (
                                <label key={value} className="interest-item">
                                    <input type="radio" name="doingNow" value={value} checked={answers.doingNow === value} onChange={() => set("doingNow", value)} required />
                                    <span>{label}</span>
                                </label>
                            ))}
                        </fieldset>

                        <fieldset>
                            <legend>2. Which career are you working towards?</legend>
                            <select value={answers.careerId} onChange={(event) => set("careerId", event.target.value)}>
                                <option value="">Something else / not sure yet</option>
                                {form.careers.map((career) => <option key={career.id} value={career.id}>{career.name}</option>)}
                            </select>
                            {!answers.careerId && (
                                <input type="text" maxLength={120} placeholder="In your own words (if you like)" value={answers.careerText} onChange={(event) => set("careerText", event.target.value)} />
                            )}
                        </fieldset>

                        <fieldset>
                            <legend>3. Did you follow one of the careers in your report?</legend>
                            {FOLLOWED.map(([value, label]) => (
                                <label key={value} className="interest-item">
                                    <input type="radio" name="followedMatch" value={value} checked={answers.followedMatch === value} onChange={() => set("followedMatch", value)} required />
                                    <span>{label}</span>
                                </label>
                            ))}
                        </fieldset>

                        <fieldset>
                            <legend>4. How happy are you with where you are heading? (1 = not at all, 5 = very)</legend>
                            <div className="rating-row">
                                {[1, 2, 3, 4, 5].map((value) => (
                                    <label key={value} className={`rating-dot${Number(answers.satisfaction) === value ? " is-on" : ""}`}>
                                        <input type="radio" name="satisfaction" value={value} checked={Number(answers.satisfaction) === value} onChange={() => set("satisfaction", value)} required />
                                        <span>{value}</span>
                                    </label>
                                ))}
                            </div>
                        </fieldset>

                        <label htmlFor="note">Anything you'd like to tell us? (you can leave this empty)</label>
                        <textarea id="note" rows={3} maxLength={1000} value={answers.note} onChange={(event) => set("note", event.target.value)} />

                        <div className="btn-row">
                            <button type="submit" className="btn btn-primary" disabled={state === "sending"}>{state === "sending" ? "Sending…" : "Send"}</button>
                        </div>
                        <p className="report-small">
                            Your answers are never shared. <button type="button" className="link-button" onClick={unsubscribe}>Stop these emails</button>
                        </p>
                    </form>
                )}
            </main>
            <PublicFooter />
        </div>
    )
}

export default FollowUpPage
