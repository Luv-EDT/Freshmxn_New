import { useState } from "react"

// QUESTION 2 — WHAT STUCK, AND WHY (owner, Round 32). For each thing: has it stayed with you over time?
// For a yes, why it stays — the four chips are the real form's four "why" groups, so the answer means the
// same thing to matching and can carry into the real form later — and, if they like, their own words.
const REASONS = [
    { key: "curiosityDriven", label: "I'm curious about it" },
    { key: "personalGrowth", label: "It helps me grow" },
    { key: "socialRecognition", label: "People notice me for it" },
    { key: "effortlessEngagement", label: "It feels effortless" },
]

function DemoStuck({ draws, initial, onNext, onBack, busy }) {
    const startOf = (text) => (initial || []).find((row) => row.text === text)
    const [rows, setRows] = useState(draws.map((draw) => {
        const saved = startOf(draw.text)
        return { text: draw.text, stuck: saved ? true : null, reasons: saved ? saved.reasons || [] : [], why: saved ? saved.why || "" : "" }
    }))

    const update = (index, change) => setRows(rows.map((row, i) => (i === index ? { ...row, ...change } : row)))
    const toggleReason = (index, key) => {
        const row = rows[index]
        update(index, { reasons: row.reasons.includes(key) ? row.reasons.filter((reason) => reason !== key) : [...row.reasons, key] })
    }
    const answered = rows.every((row) => row.stuck !== null)

    return (
        <section className="demo-step">
            <h2>What has stayed with you?</h2>
            <p className="demo-lead">Some pulls fade, some keep coming back. Tell us which ones stuck — and why you think they stay.</p>

            {rows.map((row, index) => (
                <div key={row.text} className="demo-box demo-stuck">
                    <p className="demo-thing"><strong>{row.text}</strong></p>
                    <div className="demo-yesno" role="radiogroup" aria-label={`Has ${row.text} stayed with you?`}>
                        <button type="button" role="radio" aria-checked={row.stuck === true} className={`demo-chip${row.stuck === true ? " is-on" : ""}`} onClick={() => update(index, { stuck: true })}>Yes, it has stayed</button>
                        <button type="button" role="radio" aria-checked={row.stuck === false} className={`demo-chip${row.stuck === false ? " is-on" : ""}`} onClick={() => update(index, { stuck: false, reasons: [], why: "" })}>Not really</button>
                    </div>
                    {row.stuck && (
                        <>
                            <p className="demo-label">Why do you think it stays?</p>
                            <div className="demo-chips">
                                {REASONS.map((reason) => (
                                    <button type="button" key={reason.key} aria-pressed={row.reasons.includes(reason.key)} className={`demo-chip${row.reasons.includes(reason.key) ? " is-on" : ""}`} onClick={() => toggleReason(index, reason.key)}>{reason.label}</button>
                                ))}
                            </div>
                            <input
                                type="text"
                                className="demo-input"
                                maxLength={300}
                                value={row.why}
                                onChange={(event) => update(index, { why: event.target.value })}
                                placeholder="In your own words, if you like"
                                aria-label={`Why ${row.text} stays, in your own words`}
                            />
                        </>
                    )}
                </div>
            ))}

            <div className="btn-row">
                <button type="button" className="btn btn-ghost" onClick={onBack}>Back</button>
                <button type="button" className="btn btn-primary" disabled={busy || !answered} onClick={() => onNext(rows.filter((row) => row.stuck).map(({ text, reasons, why }) => ({ text, reasons, why })))}>
                    {busy ? "Saving…" : "Next"}
                </button>
            </div>
            {!answered && <p className="demo-hint">Answer each one to go on.</p>}
        </section>
    )
}

export default DemoStuck
