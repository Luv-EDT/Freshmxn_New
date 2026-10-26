import { useState } from "react"
import { message } from "antd"
import { reportMentor } from "../../apiCall/mentorSessionsApi"

// "REPORT A PROBLEM WITH MY MENTOR" (owner, Rounds 28 and 34) — a small button that opens the form. What
// happened, then what the student wants now. The ticket changes at once: a refund closes it (the choice
// kept in the ticket's history) and says how much comes back; a new mentor keeps the choice and promises
// one within 15 business days.
const REASONS = [
    { value: "no_show", label: "They didn't turn up or stopped replying" },
    { value: "inappropriate", label: "They behaved inappropriately" },
    { value: "privacy", label: "They didn't respect my privacy" },
    { value: "other", label: "Something else" },
]

const inr = (amount) => `₹${Number(amount || 0).toLocaleString("en-IN")}`

function ReportMentor({ refundInr, onSent }) {
    const [open, setOpen] = useState(false)
    const [reason, setReason] = useState(null)
    const [note, setNote] = useState("")
    const [wants, setWants] = useState(null)
    const [busy, setBusy] = useState(false)
    const [sent, setSent] = useState(null)

    const send = async () => {
        setBusy(true)
        const response = await reportMentor({ reason, note, wants })
        setBusy(false)
        if (!response || response.data.success === false) {
            message.error(response?.data?.message || "Could not send your report")
            return
        }
        setSent(response.data.message)
        if (onSent) onSent()
    }

    if (sent) return <p className="report-mentor-sent" role="status">{sent}</p>

    return (
        <div className="report-mentor">
            <button type="button" className="link-button report-mentor-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
                ⚠ Report a problem with my mentor
            </button>
            {open && (
                <div className="report-mentor-form">
                    <fieldset>
                        <legend>What happened?</legend>
                        {REASONS.map((option) => (
                            <label key={option.value} className="choice">
                                <input type="radio" name="reportReason" checked={reason === option.value} onChange={() => setReason(option.value)} />
                                <span>{option.label}</span>
                            </label>
                        ))}
                    </fieldset>
                    <label htmlFor="report-note">Tell us more{reason === "other" ? "" : " (if you'd like)"}</label>
                    <textarea id="report-note" rows={3} maxLength={600} value={note} onChange={(event) => setNote(event.target.value)} />
                    <fieldset>
                        <legend>What would you like us to do?</legend>
                        <label className="choice">
                            <input type="radio" name="reportWants" checked={wants === "new_mentor"} onChange={() => setWants("new_mentor")} />
                            <span>Give me a new mentor — within 15 business days, same career and role</span>
                        </label>
                        <label className="choice">
                            <input type="radio" name="reportWants" checked={wants === "refund"} onChange={() => setWants("refund")} />
                            <span>Refund me — the mentor part{refundInr ? ` (${inr(refundInr)})` : ""}; my mentor ticket closes</span>
                        </label>
                    </fieldset>
                    <button type="button" className="btn btn-primary btn-sm tap" disabled={!reason || !wants || (reason === "other" && note.trim().length < 3) || busy} onClick={send}>
                        {busy ? "Sending…" : "Send my report"}
                    </button>
                </div>
            )}
        </div>
    )
}

export default ReportMentor
