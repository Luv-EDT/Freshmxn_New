import { useEffect, useState } from "react"
import { expressInterest, getMyInterest } from "../../apiCall/studyAbroadApi"
import { abroadCareers } from "./reportPlan"

// The study-abroad offer (owner, Round 11). Shown only when one of the top ten matches is a career
// where studying abroad helps. Nothing is shared until the student ticks the consent box and sends.
function StudyAbroadCard({ ranked, details }) {
    const careers = abroadCareers(ranked, details)
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

    return (
        <details className="report-details">
            <summary className="report-summary"><strong>Studying abroad</strong> — would it help you?</summary>
            <p>
                For {names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`}, studying abroad can help.
                Each career's own card says why, under "The road".
            </p>
            {sent ? (
                <p><strong>Thanks — we'll be in touch.</strong> You asked to be connected with our study-abroad partner.</p>
            ) : (
                <>
                    <p>Interested? We can connect you with a study-abroad partner who can talk you through it.</p>
                    <label className="abroad-consent">
                        <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
                        <span>I agree Freshmxn may share my name, email and phone with our study-abroad partner.</span>
                    </label>
                    <button type="button" className="btn btn-primary" disabled={!consent || sending} onClick={send}>
                        {sending ? "Sending…" : "Connect me"}
                    </button>
                    {problem && <p className="report-small">{problem}</p>}
                </>
            )}
        </details>
    )
}

export default StudyAbroadCard
