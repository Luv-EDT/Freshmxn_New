import { useEffect, useRef, useState } from "react"
import { buildTrials, runBlock, FONT_SIZES } from "../Assessment/sartTask"

// THE FOCUS GAME (owner, Round 33) — 90 seconds of the real SART: digits flash for a quarter of a second,
// press for every number except 3. It runs on the real task's own clock and trial builder
// (sartTask.buildTrials / runBlock, used read-only — nothing in the real test changes); only the length is
// the demo's: 78 digits with nine 3s instead of 225 with 25, and no practice round (owner).
//
// The digit display below is the demo's own copy of the real one's look (white digits on black, the five
// sizes, the ⊗ between digits, green after a right press and red after a press on a 3). Only the four
// fields the result reads leave the page — never a timing log — and the server keeps none of them.
const DEMO_TRIALS = 78
const DEMO_NO_GO = 9

const pressTime = (event) => {
    const now = performance.now()
    return event && event.timeStamp > 0 && event.timeStamp <= now ? event.timeStamp : now
}

function DemoSart({ onDone }) {
    const [phase, setPhase] = useState("intro")      // intro → countdown → running → done
    const [count, setCount] = useState(3)
    const [secondsLeft, setSecondsLeft] = useState(90)
    const digitRef = useRef(null)
    const maskRef = useRef(null)
    const controls = useRef({})
    const currentTrial = useRef(null)
    const flagged = useRef(false)

    const hide = () => {
        if (digitRef.current) digitRef.current.style.display = "none"
        if (maskRef.current) maskRef.current.style.display = "none"
    }

    const show = (what, trial) => {
        hide()
        if (what === "mask") {
            if (maskRef.current) maskRef.current.style.display = "block"
            return
        }
        currentTrial.current = trial
        flagged.current = false
        if (maskRef.current) maskRef.current.style.color = "#fff"
        if (digitRef.current) {
            digitRef.current.textContent = String(trial.digit)
            digitRef.current.style.fontSize = `${FONT_SIZES[trial.fontIndex]}pt`
            digitRef.current.style.display = "block"
        }
    }

    const press = (event) => {
        if (phase !== "running") return
        if (controls.current.respond) controls.current.respond(pressTime(event))
        if (!currentTrial.current || flagged.current) return
        flagged.current = true
        if (maskRef.current) maskRef.current.style.color = currentTrial.current.isGo ? "#34c759" : "#ff3b30"
    }

    // Space presses, held keys don't repeat (the real task's rule)
    useEffect(() => {
        const onKey = (event) => {
            if (event.code !== "Space" || event.repeat) return
            event.preventDefault()
            press(event)
        }
        window.addEventListener("keydown", onKey)
        return () => window.removeEventListener("keydown", onKey)
    })

    // 3-2-1, then the block
    useEffect(() => {
        if (phase !== "countdown") return undefined
        if (count === 0) {
            setPhase("running")
            return undefined
        }
        const timer = setTimeout(() => setCount(count - 1), 700)
        return () => clearTimeout(timer)
    }, [phase, count])

    useEffect(() => {
        if (phase !== "running") return undefined
        let cancelled = false
        const blockControls = controls.current
        const startedAt = performance.now()
        const tick = setInterval(() => setSecondsLeft(Math.max(0, 90 - Math.floor((performance.now() - startedAt) / 1000))), 500)
        runBlock({ trials: buildTrials(DEMO_TRIALS, DEMO_NO_GO), show, hide, controls: blockControls }).then(({ records }) => {
            clearInterval(tick)
            if (cancelled) return
            setPhase("done")
            onDone(records.map((record) => ({ isGo: record.isGo, correct: record.correct, rt: record.rt, dropped: Boolean(record.dropped) })))
        })
        return () => {
            cancelled = true
            clearInterval(tick)
            if (blockControls.cancel) blockControls.cancel()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [phase])

    if (phase === "intro") {
        return (
            <section className="demo-step">
                <h2>A 90-second focus game</h2>
                <p className="demo-lead">
                    Numbers from 1 to 9 flash on the screen. <strong>Press Space</strong> (or tap the black box) for every
                    number — <strong>except 3</strong>. When you see a 3, do nothing. Be quick, but stay accurate.
                </p>
                <div className="demo-sart-rules">
                    <span className="demo-sart-rule is-go">7 → press</span>
                    <span className="demo-sart-rule is-nogo">3 → don't press</span>
                </div>
                <p className="demo-hint">A green ⊗ means a right press, a red one means you pressed on a 3. It measures how fast and how steadily you respond.</p>
                <button type="button" className="btn btn-primary" onClick={() => setPhase("countdown")}>Start the game</button>
            </section>
        )
    }

    return (
        <section className="demo-step">
            <p className="demo-sart-time" aria-live="off">{phase === "countdown" ? "Get ready…" : `${secondsLeft} s left`}</p>
            <div className="demo-sart-stage" role="button" tabIndex={0} aria-label="Tap for every number except 3" onPointerDown={press}>
                {phase === "countdown" && <span className="demo-sart-count">{count || "Go"}</span>}
                <span ref={digitRef} className="demo-sart-digit" style={{ display: "none" }} />
                <span ref={maskRef} className="demo-sart-mask" style={{ display: "none" }}>⊗</span>
            </div>
            <p className="demo-hint">Press for every number except 3.</p>
        </section>
    )
}

export default DemoSart
