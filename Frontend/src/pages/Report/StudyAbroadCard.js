import { useEffect, useState } from "react"
import { expressInterest, getMyInterest } from "../../apiCall/studyAbroadApi"
import { abroadCareers } from "./reportPlan"

// The study-abroad offer (owner, Round 11), a waitlist since Round 18. Shown when one of the top ten
// matches is a career where studying abroad helps — or, since Round 13, when the student told us they
// hope to go abroad. Nothing is kept until the student ticks the consent box and sends.
function StudyAbroadCard({ ranked, details, abroadPlans }) {
    // Round 13: a student who said yes to going abroad sees the offer for their top three anyway
    const helped = abroadCareers(ranked, details)
    const careers = helped.length === 0 && abroadPlans && abroadPlans.hope === "yes" ? ranked.slice(0, 3) : helped
    const [consent, setConsent] = useState(false)
    const [sent, setSent] = useState(null)
    const [sending, setSending] = useState(false)
    const [problem, setProblem] = useState("")

    useEffect(() => {
        if (careers.length === 0) return
        getMyInterest()
            .then((response) => setSent(response.data.data.lead))
            .catch(() => setSent(null))
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [careers.length])

    if (careers.length === 0) return null

    const names = careers.map((career) => career.profession)
    const send = async () => {
        try {
            setSending(true)
            setProblem("")
            const response = await expressInterest(careers.map((career) => career.professionId), consent)
            setSent(response.data.data)
        } catch (error) {
            setProblem(error.response?.data?.message || "Could not send — please try again")
        } finally {
            setSending(false)
        }
    }

    // A WAITLIST, NOT A PARTNER (owner, Round 18): help with a master's abroad comes in a future
    // version. Ticking the box (with consent) puts the student on that waitlist.
    return (
        <details className="report-details">
            <summary className="report-summary"><strong>A master's abroad</strong> — help is coming</summary>
            <p>
                For {names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`}, studying abroad can help.
                Each career's own card says why, under "The road".
            </p>
            {sent ? (
                <p><strong>You're on the waitlist.</strong> We'll tell you when help with a master's abroad is ready.</p>
            ) : (
                <>
                    <p>We'll help you with a master's abroad in a future version. Tick to join the waitlist.</p>
                    <label className="abroad-consent">
                        <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
                        <span>Put me on the waitlist. I agree Freshmxn may contact me, and later share my name, email and phone with the people who help with it.</span>
                    </label>
                    <button type="button" className="btn btn-primary" disabled={!consent || sending} onClick={send}>
                        {sending ? "Sending…" : "Join the waitlist"}
                    </button>
                    {problem && <p className="report-small">{problem}</p>}
                </>
            )}
        </details>
    )
}

export default StudyAbroadCard
