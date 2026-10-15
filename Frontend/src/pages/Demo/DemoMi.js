import { useState } from "react"
import { MI_ITEMS, MI_SCALE } from "../Assessment/moduleItems"

// WHAT YOU'RE DRAWN TO (owner, Round 33) — one real "what you are drawn to" statement per intelligence,
// worded as in the full assessment. One statement says little on its own, so these are a taste: the result
// shows each as "about 20% measured", and they are never carried into the real assessment.
// The ids must match Backend/demo/demoTaste.js MI_DEMO_ITEMS (a fixture checks).
export const DEMO_MI_ITEMS = ["MI_V1", "MI_L1", "MI_S3", "MI_M2", "MI_B3", "MI_N2", "MI_E1"]

function DemoMi({ answers, onChange, onNext }) {
    const items = DEMO_MI_ITEMS.map((id) => MI_ITEMS.find((item) => item.id === id)).filter(Boolean)
    const [current, setCurrent] = useState(answers || {})
    const done = items.every((item) => current[item.id])
    const pick = (id, value) => {
        const next = { ...current, [id]: value }
        setCurrent(next)
        onChange(next)
    }

    return (
        <section className="demo-step">
            <h2>What you're drawn to</h2>
            <p className="demo-lead">Seven quick statements — how much is each like you? There are no right answers.</p>
            {items.map((item) => (
                <fieldset key={item.id} className="question-card demo-question">
                    <legend>{item.text}</legend>
                    <div className="demo-scale">
                        {MI_SCALE.map((option) => (
                            <label key={option.value} className={`demo-scale-option${current[item.id] === option.value ? " is-on" : ""}`}>
                                <input
                                    type="radio"
                                    name={item.id}
                                    value={option.value}
                                    checked={current[item.id] === option.value}
                                    onChange={() => pick(item.id, option.value)}
                                />
                                {option.label}
                            </label>
                        ))}
                    </div>
                </fieldset>
            ))}
            <button type="button" className="btn btn-primary" disabled={!done} onClick={onNext}>
                Next: a 90-second focus game
            </button>
        </section>
    )
}

export default DemoMi
