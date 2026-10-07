import { useEffect, useState } from "react"
import { expressInterest, getMyInterest } from "../../apiCall/studyAbroadApi"

// HELP WITH STUDYING OR WORKING ABROAD — A WAITLIST (owner, Round 19). It replaces "we'll connect
// you with a consultant" inside a career's "Studying and working abroad" fold: the help comes in a
// future version, and a student can join the waitlist for it here. Nothing is kept until the box is
// ticked and the button pressed; the consent and the policy version are stored with it.
function AbroadWaitlist({ professionId }) {
    const [joined, setJoined] = useState(null)   // null = loading
    const [consent, setConsent] = useState(false)
    const [sending, setSending] = useState(false)
    const [problem, setProblem] = useState("")

    useEffect(() => {
        getMyInterest()
            .then((response) => setJoined(Boolean(response.data.data.lead)))
            .catch(() => setJoined(false))
    }, [])

    const join = async () => {
        try {
            setSending(true)
            setProblem("")
            await expressInterest([professionId], consent)
            setJoined(true)
        } catch (error) {
            setProblem(error.response?.data?.message || "Could not join — please try again")
        } finally {
            setSending(false)
        }
    }

    if (joined === null) return null
    if (joined) return <p className="pc-small"><strong>You're on the waitlist</strong> for help with studying or working abroad.</p>

    return (
        <div className="abroad-waitlist">
            <p className="pc-small">
                Studying and working abroad, especially a master's abroad, needs specialist advice. We'll help with
                this in a future version — join the waitlist and we'll tell you when it's ready.
            </p>
            <label className="abroad-consent">
                <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
                <span>Put me on the waitlist. Freshmxn may contact me about it.</span>
            </label>
            <button type="button" className="btn btn-ghost btn-sm" disabled={!consent || sending} onClick={join}>
                {sending ? "Joining…" : "Join the waitlist"}
            </button>
            {problem && <p className="pc-small">{problem}</p>}
        </div>
    )
}

export default AbroadWaitlist
