import { useEffect, useRef, useState } from "react"
import { message } from "antd"
import { reasoningNext, reasoningAnswer } from "../../apiCall/submissionsApi"
import OneAttemptWarning from "./OneAttemptWarning"
import { MatrixCell, CubeFigure } from "./ReasoningFigures"

// The in-house reasoning test (owner, Round 10, item 1) — sixteen puzzles of four kinds, one at a
// time, from the server. See Backend/assessment/reasoningBank.js.
//
// THE PAGE NEVER KNOWS THE ANSWERS. Each puzzle arrives without one, the student's pick goes back,
// and the server marks it. No right/wrong is shown: knowing you missed one changes how you attempt
// the next. EACH PUZZLE HAS ITS OWN CLOCK (owner, Round 13) — 60 or 90 seconds, kept by the server;
// the bar here only shows it. At zero the page sends "no answer" itself and the next puzzle comes.
//
// One attempt. A puzzle shown and not yet answered comes back on a refresh, so closing the tab costs
// nothing — and it is not a way to see a different puzzle.
function ReasoningTest({ alreadyTaken, onDone }) {
    const [phase, setPhase] = useState(alreadyTaken ? "alreadyTaken" : "intro")   // intro | item | done | alreadyTaken
    const [current, setCurrent] = useState(null)      // { number, of, item }
    const [choice, setChoice] = useState(null)
    const [busy, setBusy] = useState(false)
    const [secondsLeft, setSecondsLeft] = useState(null)
    const sent = useRef(false)      // one answer per puzzle, even if the clock and a tap land together

    const loadNext = async () => {
        setBusy(true)
        try {
            const response = await reasoningNext()
            const data = response.data.data
            if (data.done) {
                setPhase("done")
                return
            }
            setCurrent(data)
            setSecondsLeft(data.secondsLeft ?? data.item.timeLimitS)
            sent.current = false
            setChoice(null)
            setPhase("item")
            window.scrollTo(0, 0)
        } catch (error) {
            message.error("Could not load the next puzzle — check your connection")
        } finally {
            setBusy(false)
        }
    }

    const answer = async (picked) => {
        if (sent.current) return
        sent.current = true
        setBusy(true)
        try {
            const response = await reasoningAnswer({ choice: picked })
            if (response.data.data.done) {
                setPhase("done")
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

    // the clock: one tick a second while a puzzle is on screen; at zero, "no answer"
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

    if (phase === "alreadyTaken") {
        return (
            <section className="reasoning">
                <h2>Reasoning puzzles</h2>
                <p>You have finished this section — thank you. It is taken once, so there is nothing more to do here.</p>
                <button type="button" className="btn btn-primary" onClick={onDone}>Back to all sections</button>
            </section>
        )
    }

    if (phase === "intro") {
        return (
            <section className="reasoning">
                <h2>Reasoning puzzles</h2>
                <p>
                    Sixteen puzzles of four kinds: picture patterns, letter and number series, short word
                    problems, and 3D shapes turned around. They get harder as you go — nobody is expected to
                    get them all.
                </p>
                <ul>
                    <li>Pick the answer you think is right, then press <strong>Next</strong>.</li>
                    <li>If you really cannot tell, choose <strong>I don't know</strong> and move on.</li>
                    <li>Each puzzle has its own clock — 60 seconds for word and number puzzles, 90 for the picture ones. If time runs out it counts as not answered and the next one appears.</li>
                    <li>Do it in one sitting, somewhere quiet.</li>
                </ul>
                <OneAttemptWarning minutes={20} reason="You will not be told which answers were right — that would change how you answer the rest." />
                <button type="button" className="btn btn-primary" onClick={loadNext} disabled={busy}>
                    {busy ? "Loading…" : "Start the puzzles"}
                </button>
            </section>
        )
    }

    if (phase === "done") {
        return (
            <section className="reasoning">
                <h2>All sixteen done</h2>
                <p>Your answers are saved. Your results are part of your report.</p>
                <button type="button" className="btn btn-primary" onClick={onDone}>Back to all sections</button>
            </section>
        )
    }

    const { item, number, of } = current

    return (
        <section className="reasoning">
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

export default ReasoningTest
