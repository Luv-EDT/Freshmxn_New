import { useState } from "react"
import { IPIP_ITEMS, IPIP_SCALE, IPIP_STEM } from "../Assessment/ipip50Items"

// OPENNESS — eight of the real IPIP-50 Openness statements, worded and scored exactly as in the full
// assessment (owner, Round 32). Eight because the real scorer needs 8 of a trait's 10 to give a score.
export const DEMO_OPENNESS_ITEMS = ["IPIP_O1", "IPIP_O2", "IPIP_O3", "IPIP_O4", "IPIP_O5", "IPIP_O6", "IPIP_O9", "IPIP_O10"]

function DemoOpenness({ onNext, busy }) {
    const items = DEMO_OPENNESS_ITEMS.map((id) => IPIP_ITEMS.find((item) => item.id === id)).filter(Boolean)
    const [answers, setAnswers] = useState({})
    const done = items.every((item) => answers[item.id])

    return (
        <section className="demo-step">
            <h2>How you see yourself</h2>
            <p className="demo-lead">{IPIP_STEM} — pick how accurately each describes you. There are no right answers.</p>
            {items.map((item) => (
                <fieldset key={item.id} className="question-card demo-question">
                    <legend>{item.text}</legend>
                    <div className="demo-scale">
                        {IPIP_SCALE.map((option) => (
                            <label key={option.value} className={`demo-scale-option${answers[item.id] === option.value ? " is-on" : ""}`}>
                                <input
                                    type="radio"
                                    name={item.id}
                                    value={option.value}
                                    checked={answers[item.id] === option.value}
                                    onChange={() => setAnswers({ ...answers, [item.id]: option.value })}
                                />
                                {option.label}
                            </label>
                        ))}
                    </div>
                </fieldset>
            ))}
            <button type="button" className="btn btn-primary" disabled={busy || !done} onClick={() => onNext(answers)}>
                {busy ? "Saving…" : "Next: six puzzles"}
            </button>
        </section>
    )
}

export default DemoOpenness
