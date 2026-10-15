import { useEffect, useRef, useState } from "react"
import { getDemoPuzzles } from "../../apiCall/demoApi"

// FOUR PUZZLES (owner, Round 33) — one easy, two medium, one hard, drawn for this visitor from the demo's own
// bank of twelve (Backend/demo/demoPuzzles.js), never from the real reasoning test. Each has its own clock
// (30 / 45 / 60 s); when it runs out the puzzle counts as not answered and the next one appears. The answers
// stay on the server: the choices go back with the other two tasks and are marked there.
function DemoPuzzles({ token, onDone }) {
    const [puzzles, setPuzzles] = useState(null)
    const [index, setIndex] = useState(-1)        // -1 = the intro
    const [choice, setChoice] = useState(null)
    const [secondsLeft, setSecondsLeft] = useState(null)
    const [error, setError] = useState("")
    const answers = useRef([])
    const shownAt = useRef(null)

    useEffect(() => {
        getDemoPuzzles(token)
            .then((response) => setPuzzles(response.data.data.puzzles))
            .catch((err) => setError(err.response?.data?.message || "Could not load the puzzles — please refresh"))
    }, [token])

    const current = puzzles && index >= 0 ? puzzles[index] : null

    const next = (picked) => {
        answers.current = [...answers.current, { id: current.id, choice: picked, ms: Math.round(performance.now() - shownAt.current) }]
        setChoice(null)
        if (index + 1 >= puzzles.length) onDone(answers.current)
        else setIndex(index + 1)
    }

    // each puzzle's own clock
    useEffect(() => {
        if (!current) return undefined
        shownAt.current = performance.now()
        setSecondsLeft(current.timeLimitS)
        const tick = setInterval(() => {
            const left = current.timeLimitS - Math.floor((performance.now() - shownAt.current) / 1000)
            setSecondsLeft(Math.max(left, 0))
        }, 250)
        return () => clearInterval(tick)
    }, [current])

    useEffect(() => {
        if (current && secondsLeft === 0) next(null)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [secondsLeft])

    if (error) return <section className="demo-step"><p className="demo-hint">{error}</p></section>

    if (!current) {
        return (
            <section className="demo-step reasoning">
                <h2>Four puzzles</h2>
                <p className="demo-lead">
                    Number patterns, words and logic — one easy, two medium, one hard. Each has its own clock:
                    30, 45 or 60 seconds. Not sure? Choose <strong>I don't know</strong> and move on.
                </p>
                <button type="button" className="btn btn-primary" disabled={!puzzles} onClick={() => setIndex(0)}>
                    {puzzles ? "Start the puzzles" : "Loading…"}
                </button>
            </section>
        )
    }

    return (
        <section className="demo-step reasoning">
            <p className="reasoning-progress">Puzzle {index + 1} of {puzzles.length} · {current.level}</p>
            <div className={`reasoning-clock${secondsLeft !== null && secondsLeft <= 10 ? " is-low" : ""}`} role="timer" aria-live="off">
                <div className="reasoning-clock-bar"><span style={{ width: `${Math.max(secondsLeft || 0, 0) / current.timeLimitS * 100}%` }} /></div>
                <span className="reasoning-clock-text">{Math.max(secondsLeft || 0, 0)} s left</span>
            </div>
            <h2 className="reasoning-prompt">{current.prompt}</h2>
            <div className="reasoning-options reasoning-options-verbal" role="radiogroup" aria-label="Answers">
                {current.options.map((option, optionIndex) => (
                    <button
                        type="button"
                        key={option}
                        role="radio"
                        aria-checked={choice === optionIndex}
                        className={`reasoning-option${choice === optionIndex ? " is-picked" : ""}`}
                        onClick={() => setChoice(optionIndex)}
                    >
                        <span className="reasoning-option-letter">{"ABCD"[optionIndex]}</span>
                        <span className="reasoning-option-text">{option}</span>
                    </button>
                ))}
            </div>
            <div className="btn-row">
                <button type="button" className="btn btn-primary" onClick={() => next(choice)} disabled={choice === null}>
                    {index + 1 >= puzzles.length ? "Finish" : "Next"}
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => next(null)}>I don't know</button>
            </div>
        </section>
    )
}

export default DemoPuzzles
