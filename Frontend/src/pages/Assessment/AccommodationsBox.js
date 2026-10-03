import { useState } from "react"
import { NEEDS, affectedModules } from "./accommodations"

// "Would anything make these tests harder for you?" (owner, Round 10) — asked before the timed tasks,
// open until the student has answered. Their answer can open a "skip" on the tests it affects; a
// skipped test is NOT MEASURED, never a low score. It is never used to rank careers, and it reaches a
// mentor only if the student says so here.
function AccommodationsBox({ saved, onSave }) {
    const [needs, setNeeds] = useState((saved && saved.needs) || [])
    const [none, setNone] = useState(Boolean(saved && saved.declaredAt && (saved.needs || []).length === 0 && !saved.preferNotToSay))
    const [preferNot, setPreferNot] = useState(Boolean(saved && saved.preferNotToSay))
    const [share, setShare] = useState(Boolean(saved && saved.shareWithMentor))
    const [busy, setBusy] = useState(false)

    const toggle = (id) => {
        setNone(false)
        setPreferNot(false)
        setNeeds((previous) => (previous.includes(id) ? previous.filter((need) => need !== id) : [...previous, id]))
    }

    const save = async () => {
        setBusy(true)
        await onSave({
            needs: none || preferNot ? [] : needs,
            preferNotToSay: preferNot,
            shareWithMentor: share && needs.length > 0,
            declaredAt: new Date().toISOString(),
            skipped: (saved && saved.skipped) || {},
        })
        setBusy(false)
    }

    const answered = Boolean(saved && saved.declaredAt)
    const affected = affectedModules(needs)

    return (
        <details className="faq-item accommodations-box" open={!answered}>
            <summary>{answered ? "Support with the tests — your answer is saved" : "Before you start: would anything make these tests harder for you?"}</summary>
            <div className="research-body">
                <p>
                    Some sections are timed or happen on screen. If something makes that harder for you, tell us —
                    you can then skip the sections it affects, and they are marked <strong>not measured</strong>,
                    never as a low score. It is never used to choose your careers.
                </p>
                <ul className="needs-list">
                    {NEEDS.map((need) => (
                        <li key={need.id}>
                            <label className="interest-item">
                                <input type="checkbox" checked={needs.includes(need.id)} onChange={() => toggle(need.id)} />
                                <span>{need.label}</span>
                            </label>
                        </li>
                    ))}
                    <li>
                        <label className="interest-item">
                            <input type="checkbox" checked={none} onChange={() => { setNone(!none); setNeeds([]); setPreferNot(false) }} />
                            <span>None of these</span>
                        </label>
                    </li>
                    <li>
                        <label className="interest-item">
                            <input type="checkbox" checked={preferNot} onChange={() => { setPreferNot(!preferNot); setNeeds([]); setNone(false) }} />
                            <span>I'd rather not say</span>
                        </label>
                    </li>
                </ul>
                {needs.length > 0 && (
                    <>
                        <p className="report-small">
                            {affected.length > 0
                                ? "A “Skip this — mark it not measured” button will appear on the sections this can affect."
                                : "None of our sections depend on this, so nothing needs skipping — thank you for telling us."}
                        </p>
                        <label className="interest-item">
                            <input type="checkbox" checked={share} onChange={() => setShare(!share)} />
                            <span>My mentor can know about this, so they can help (only if I join the mentor plan)</span>
                        </label>
                    </>
                )}
                <button type="button" className="btn btn-primary btn-sm" onClick={save} disabled={busy || (!none && !preferNot && needs.length === 0)}>
                    {busy ? "Saving…" : "Save"}
                </button>
            </div>
        </details>
    )
}

export default AccommodationsBox
