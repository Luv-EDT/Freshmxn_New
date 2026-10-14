import { useEffect, useRef, useState } from "react"
import { message } from "antd"
import { demoReasoningNext, demoReasoningAnswer } from "../../apiCall/demoApi"
import { MatrixCell, CubeFigure } from "../Assessment/ReasoningFigures"

// SIX PUZZLES — the first six of the real reasoning test, from the server one at a time, marked there and
// timed there exactly as the real test is (owner, Round 32). The puzzle view is the real test's own
// (ReasoningTest.js), with the demo's routes behind it; the figures are the real ReasoningFigures.
function DemoReasoning({ token, onDone }) {
    const [phase, setPhase] = useState("intro")   // intro | item
    const [current, setCurrent] = useState(null)
    const [choice, setChoice] = useState(null)
    const [busy, setBusy] = useState(false)
    const [secondsLeft, setSecondsLeft] = useState(null)
    const sent = useRef(false)

    const loadNext = async () => {
        setBusy(true)
        try {
            const response = await demoReasoningNext(token)
            const data = response.data.data
            if (data.done) {
                onDone()
                return
            }
            setCurrent(data)
            setSecondsLeft(data.secondsLeft ?? data.item.timeLimitS)
            sent.current = false
            setChoice(null)
            setPhase("item")
            window.scrollTo(0, 0)
        } catch (error) {
            message.error(error.response?.data?.message || "Could not load the next puzzle — check your connection")
        } finally {
            setBusy(false)
        }
    }

    const answer = async (picked) => {
        if (sent.current) return
        sent.current = true
        setBusy(true)
        try {
            const response = await demoReasoningAnswer({ token, choice: picked })
            if (response.data.data.done) {
                onDone()
                return
            }
            await loadNext()
        } catch (error) {
            sent.current = false
            message.error("Could not save your answer — check your connection and try again")
        } finally {
            setBusy(false)
        }
    }

    useEffect(() => {
        if (phase !== "item" || secondsLeft === null) return undefined
        if (secondsLeft <= 0) {
            answer(null)
            return undefined
        }
        const tick = setTimeout(() => setSecondsLeft((left) => left - 1), 1000)
        return () => clearTimeout(tick)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [phase, secondsLeft])

    if (phase === "intro") {
        return (
            <section className="demo-step reasoning">
                <h2>Six puzzles</h2>
                <p className="demo-lead">
                    Picture patterns, a number series, a word problem and a 3D shape — the first six of our real
                    sixteen-puzzle test. Each has its own clock: 60 seconds for words and numbers, 90 for pictures.
                    Not sure? Choose <strong>I don't know</strong> and move on.
                </p>
                <button type="button" className="btn btn-primary" onClick={loadNext} disabled={busy}>
                    {busy ? "Loading…" : "Start the puzzles"}
                </button>
            </section>
        )
    }

    const { item, number, of } = current

    return (
        <section className="demo-step reasoning">
            <p className="reasoning-progress">Puzzle {number} of {of}</p>
            <div className="reasoning-bar" aria-hidden="true"><span style={{ width: `${((number - 1) / of) * 100}%` }} /></div>
            <div className={`reasoning-clock${secondsLeft !== null && secondsLeft <= 10 ? " is-low" : ""}`} role="timer" aria-live="off">
                <div className="reasoning-clock-bar"><span style={{ width: `${Math.max(secondsLeft || 0, 0) / item.timeLimitS * 100}%` }} /></div>
                <span className="reasoning-clock-text">{Math.max(secondsLeft || 0, 0)} s left</span>
            </div>

            <h2 className="reasoning-prompt">{item.prompt}</h2>

            {item.type === "matrix" && (
                <div className="matrix-grid">
                    {item.payload.cells.map((cell, index) => (
                        <div className="matrix-cell" key={index}><MatrixCell cell={cell} id={`${item.id}-q${index}`} /></div>
                    ))}
                </div>
            )}

            {item.type === "series" && (
                <p className="series-terms">{item.payload.terms.join(",  ")},  <strong>?</strong></p>
            )}

            {item.type === "rotation" && (
                <div className="rotation-target">
                    <CubeFigure cubes={item.payload.target} size={170} label="the object to compare with" />
                </div>
            )}

            <div className={`reasoning-options reasoning-options-${item.type}`} role="radiogroup" aria-label="Answers">
                {item.options.map((option, index) => (
                    <button
                        type="button"
                        role="radio"
                        aria-checked={choice === index}
                        key={index}
                        className={`reasoning-option${choice === index ? " is-picked" : ""}`}
                        onClick={() => setChoice(index)}
                    >
                        <span className="reasoning-option-letter">{"ABCDEF"[index]}</span>
                        {item.type === "matrix" && <MatrixCell cell={option} size={80} id={`${item.id}-o${index}`} />}
                        {item.type === "rotation" && <CubeFigure cubes={option} size={110} label={`option ${"ABCDEF"[index]}`} />}
                        {(item.type === "series" || item.type === "verbal") && <span className="reasoning-option-text">{option}</span>}
                    </button>
                ))}
            </div>

            <div className="btn-row">
                <button type="button" className="btn btn-primary" onClick={() => answer(choice)} disabled={busy || choice === null}>
                    {busy ? "Saving…" : "Next"}
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => answer(null)} disabled={busy}>
                    I don't know
                </button>
            </div>
        </section>
    )
}

export default DemoReasoning
