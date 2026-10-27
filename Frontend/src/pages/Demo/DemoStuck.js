import { useState } from "react"

// QUESTION 2 — WHAT STUCK, AND WHY (owner, Round 32). For each thing: has it stayed with you over time?
// For a yes, why it stays — the chips are the real form's four "why" groups and (Round 33) its kinds of problem, so the answer means the
// same thing to matching and can carry into the real form later — and, if they like, their own words.
const REASONS = [
    { key: "curiosityDriven", label: "I'm curious about it" },
    { key: "personalGrowth", label: "It helps me grow" },
    { key: "socialRecognition", label: "People notice me for it" },
    { key: "effortlessEngagement", label: "It feels effortless" },
]
// "It helps me deal with a problem in my life" (owner, Round 33) — the real form's three kinds of problem,
// so it counts towards what drives them exactly as in the full counselling
const PROBLEMS = [
    { key: "individualInternalProblems", label: "Inside me" },
    { key: "interpersonalInternalProblems", label: "With people" },
    { key: "externalProblems", label: "Around me — money, place, circumstances" },
]
const PROBLEM_KEYS = PROBLEMS.map((problem) => problem.key)

function DemoStuck({ draws, initial, onNext, onBack, busy }) {
    const startOf = (text) => (initial || []).find((row) => row.text === text)
    const [rows, setRows] = useState(draws.map((draw) => {
        const saved = startOf(draw.text)
        return { text: draw.text, dream: draw.when === "future", stuck: saved ? true : null, reasons: saved ? saved.reasons || [] : [], why: saved ? saved.why || "" : "" }
    }))

    const update = (index, change) => setRows(rows.map((row, i) => (i === index ? { ...row, ...change } : row)))
    const toggleReason = (index, key) => {
        const row = rows[index]
        update(index, { reasons: row.reasons.includes(key) ? row.reasons.filter((reason) => reason !== key) : [...row.reasons, key] })
    }
    // the problem tag: on with "inside me" by default, off clears all three
    const hasProblem = (row) => row.reasons.some((reason) => PROBLEM_KEYS.includes(reason))
    const toggleProblem = (index) => {
        const row = rows[index]
        update(index, { reasons: hasProblem(row) ? row.reasons.filter((reason) => !PROBLEM_KEYS.includes(reason)) : [...row.reasons, PROBLEM_KEYS[0]] })
    }
    const pickProblem = (index, key) => {
        const row = rows[index]
        update(index, { reasons: [...row.reasons.filter((reason) => !PROBLEM_KEYS.includes(reason)), key] })
    }
    const answered = rows.every((row) => row.stuck !== null)

    return (
        <section className="demo-step">
            {/* Round 36 (owner): clearer — what they've kept at for a long time, and for a dream, whether they've wanted it for long */}
            <h2>What have you stuck with — or wanted — for a long time?</h2>
            <p className="demo-lead">
                Some interests fade; others you keep coming back to for months or years. For each one, tell us if it has
                lasted — and for a dream, whether you've wanted it for a long time. Then why you think it stays.
            </p>

            {rows.map((row, index) => (
                <div key={row.text} className="demo-box demo-stuck">
                    <p className="demo-thing"><strong>{row.text}</strong></p>
                    <div className="demo-yesno" role="radiogroup" aria-label={`Has ${row.text} lasted for you?`}>
                        <button type="button" role="radio" aria-checked={row.stuck === true} className={`demo-chip${row.stuck === true ? " is-on" : ""}`} onClick={() => update(index, { stuck: true })}>{row.dream ? "Yes, I've wanted it for a long time" : "Yes, I've stuck with it"}</button>
                        <button type="button" role="radio" aria-checked={row.stuck === false} className={`demo-chip${row.stuck === false ? " is-on" : ""}`} onClick={() => update(index, { stuck: false, reasons: [], why: "" })}>{row.dream ? "It's a new idea" : "Not really"}</button>
                    </div>
                    {row.stuck && (
                        <>
                            <p className="demo-label">Why do you think it stays?</p>
                            <div className="demo-chips">
                                {REASONS.map((reason) => (
                                    <button type="button" key={reason.key} aria-pressed={row.reasons.includes(reason.key)} className={`demo-chip${row.reasons.includes(reason.key) ? " is-on" : ""}`} onClick={() => toggleReason(index, reason.key)}>{reason.label}</button>
                                ))}
                                <button type="button" aria-pressed={hasProblem(row)} className={`demo-chip${hasProblem(row) ? " is-on" : ""}`} onClick={() => toggleProblem(index)}>It helps me deal with a problem in my life</button>
                            </div>
                            {hasProblem(row) && (
                                <div className="demo-chips demo-subchips" role="radiogroup" aria-label="What kind of problem?">
                                    <span className="demo-hint">What kind?</span>
                                    {PROBLEMS.map((problem) => (
                                        <button type="button" role="radio" key={problem.key} aria-checked={row.reasons.includes(problem.key)} className={`demo-chip${row.reasons.includes(problem.key) ? " is-on" : ""}`} onClick={() => pickProblem(index, problem.key)}>{problem.label}</button>
                                    ))}
                                </div>
                            )}
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
