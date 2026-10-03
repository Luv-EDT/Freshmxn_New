import { useState } from "react"
import { message } from "antd"
import { savePsychometric } from "../../apiCall/submissionsApi"
import { INTEREST_ITEMS, INTEREST_ATTRIBUTION } from "./interestItems"

// Sixty everyday work activities — tick the ones you would like to do (Round 10). The O*NET Interest
// Profiler Short Form, used here only to strengthen what the intelligences show (interests60.js).
//
// TICK, NOT RATE. The form is a checklist on purpose: "would you like to do this?" — yes or leave
// it. So an unticked box only means "no" once the student says they are done, which is why the block
// carries `completedAt` and is saved by this page itself (one save on Done, one on "come back later").
//
// "Do not think about how much education or training is needed, or how much money you would make" is
// the form's own instruction, kept, because those are the two things that make people untick what
// they would actually enjoy.
function InterestsModule({ saved, onDone }) {
    const [answers, setAnswers] = useState((saved && saved.answers) || {})
    const [busy, setBusy] = useState(false)

    const toggle = (id) => setAnswers((previous) => ({ ...previous, [id]: !previous[id] }))
    const count = INTEREST_ITEMS.filter((item) => answers[item.id]).length

    const save = async (finished) => {
        setBusy(true)
        try {
            const block = { answers }
            if (finished) block.completedAt = new Date().toISOString()
            else if (saved && saved.completedAt) block.completedAt = saved.completedAt
            await savePsychometric({ module: "interests60", block })
            if (!finished) message.success("Saved — you can pick up where you left off")
            onDone()
        } catch (error) {
            message.error("Could not save — check your connection and try again")
        } finally {
            setBusy(false)
        }
    }

    return (
        <section className="interests60">
            <h2>Activities you would enjoy</h2>
            <p>
                Tick every activity you would <strong>like</strong> to do. Don't think about how much study it
                needs or how much it pays — only whether you would enjoy doing it.
            </p>

            <ul className="interest-list">
                {INTEREST_ITEMS.map((item) => (
                    <li key={item.id}>
                        <label className={`interest-item${answers[item.id] ? " is-on" : ""}`}>
                            <input type="checkbox" checked={Boolean(answers[item.id])} onChange={() => toggle(item.id)} />
                            <span>{item.text}</span>
                        </label>
                    </li>
                ))}
            </ul>

            <p className="report-small">{count} ticked. {INTEREST_ATTRIBUTION}</p>

            <div className="btn-row">
                <button type="button" className="btn btn-primary" onClick={() => save(true)} disabled={busy}>
                    {busy ? "Saving…" : "Done — these are the ones I would enjoy"}
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => save(false)} disabled={busy}>
                    Save and come back later
                </button>
            </div>
        </section>
    )
}

export default InterestsModule
