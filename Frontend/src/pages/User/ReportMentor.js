import { useState } from "react"
import { message } from "antd"
import { reportMentor } from "../../apiCall/mentorSessionsApi"

// "REPORT A PROBLEM WITH MY MENTOR" (owner, Round 28). What happened, then what the student wants now —
// their money back, or another mentor. They are told straight away to block the mentor on WhatsApp.
const REASONS = [
    { value: "inappropriate", label: "They behaved inappropriately" },
    { value: "privacy", label: "They didn't respect my privacy" },
    { value: "no_show", label: "They didn't turn up or stopped replying" },
    { value: "other", label: "Something else" },
]

function ReportMentor({ openReport, onSent }) {
    const [reason, setReason] = useState(null)
    const [note, setNote] = useState("")
    const [wants, setWants] = useState(null)
    const [busy, setBusy] = useState(false)
    const [sent, setSent] = useState(Boolean(openReport))

    const send = async () => {
        setBusy(true)
        const response = await reportMentor({ reason, note, wants })
        setBusy(false)
        if (!response || response.data.success === false) {
            message.error(response?.data?.message || "Could not send your report")
            return
        }
        setSent(true)
        if (onSent) onSent()
    }

    return (
        <details className="faq-item report-mentor">
            <summary><span aria-hidden="true">⚠</span> Report a problem with my mentor</summary>
            {sent ? (
                <div className="report-mentor-sent">
                    <p><strong>Thank you for telling us.</strong> Please <strong>block your mentor's number on WhatsApp</strong> now if you haven't already.</p>
                    <p>We'll stop them contacting you and come back to you within 2 working days.</p>
                </div>
            ) : (
                <>
                    <p>If anything about your mentor feels wrong, tell us. <strong>Block them on WhatsApp straight away</strong> — you don't need to wait for us.</p>
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
                        <legend>You have two options now</legend>
                        <label className="choice">
                            <input type="radio" name="reportWants" checked={wants === "new_mentor"} onChange={() => setWants("new_mentor")} />
                            <span>Give me another mentor</span>
                        </label>
                        <label className="choice">
                            <input type="radio" name="reportWants" checked={wants === "refund"} onChange={() => setWants("refund")} />
                            <span>Refund me</span>
                        </label>
                    </fieldset>
                    <button type="button" className="btn btn-primary tap" disabled={!reason || !wants || (reason === "other" && note.trim().length < 3) || busy} onClick={send}>
                        {busy ? "Sending…" : "Send my report"}
                    </button>
                </>
            )}
        </details>
    )
}

export default ReportMentor
