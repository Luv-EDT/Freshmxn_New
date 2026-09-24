import { useState, useEffect, useRef } from "react"
import { message } from "antd"
import { digitSpanNext, digitSpanAnswer } from "../../apiCall/submissionsApi"
import OneAttemptWarning from "./OneAttemptWarning"

// Forward digit span — 04_Item_Bank.md §5. One digit at a time, 1000 ms each, no gap.
//
// THE SERVER OWNS THE SEQUENCES AND THE MARKING. This component asks for one sequence, shows it,
// sends back what the student typed, and is told nothing about whether it was right. It cannot be
// otherwise: a client holding all fourteen sequences could read them from the network tab, and a
// client deciding `correct` would hand everyone a perfect span the first time a front-end bug crept
// in. See /digitSpanNext and /digitSpanAnswer.
//
// NO FEEDBACK ON SCORED TRIALS, deliberately. The practice trial gives feedback because that is
// what makes it practice; after that, knowing you just got one wrong changes how hard you try on
// the next, and the score stops being comparable between students.
//
// THE INPUT IS DISABLED UNTIL THE SEQUENCE FINISHES. Otherwise a student types along as the digits
// appear and the task measures transcription rather than memory.
//
// TIMING USES performance.now(). Date.now() can jump backwards when the system clock syncs, and a
// negative reaction time would silently pass the <300 ms validity gate as if it were instant.

const DIGIT_MS = 1000
const PRACTICE_SEQUENCE = "47"   // one 2-digit trial, with feedback, never scored

// ALREADY TAKEN MEANS ALREADY TAKEN, and there is no retake button.
//
// A second attempt is not a second measurement of the same thing. The student now knows the
// format, the pace, and that sequences grow — every one of which raises the span independently of
// memory. Offering a retake would quietly turn "how many digits can you hold" into "how many times
// have you practised", and the two scores would not be comparable between students.
//
// It is also not recoverable by re-running: the server's ladder is already exhausted, so
// /digitSpanNext returns done immediately. Before this screen existed, a returning student got the
// full intro and practice round and then landed on "Finished" with no explanation — which reads as
// a bug rather than a rule.
function DigitSpan({ onDone, alreadyTaken }) {
    const [phase, setPhase] = useState(alreadyTaken ? "alreadyTaken" : "intro")
    const [sequence, setSequence] = useState("")
    const [shownIndex, setShownIndex] = useState(-1) // which digit is on screen; -1 = none
    const [typed, setTyped] = useState("")
    const [isPractice, setIsPractice] = useState(false)
    const [practiceResult, setPracticeResult] = useState(null)
    const [blurCount, setBlurCount] = useState(0)
    const [busy, setBusy] = useState(false)

    const answerOpenedAt = useRef(null)
    const timerRef = useRef(null)

    // Page-blur is logged rather than blocked. A student who switches tabs mid-sequence has not
    // necessarily cheated — a notification steals focus on a phone constantly — but the score is
    // no longer clean, and the flag is what lets a human tell the difference later.
    useEffect(() => {
        const onBlur = () => setBlurCount((count) => count + 1)
        window.addEventListener("blur", onBlur)
        document.addEventListener("visibilitychange", onBlur)
        return () => {
            window.removeEventListener("blur", onBlur)
            document.removeEventListener("visibilitychange", onBlur)
            clearTimeout(timerRef.current)
        }
    }, [])

    // Walks the digits one at a time. setTimeout is acceptable here because 1000 ms is coarse —
    // a few milliseconds of drift changes nothing about how many digits someone can hold. SART is
    // the module where that stops being true, and it uses requestAnimationFrame for exactly that
    // reason.
    const present = (digits) => {
        setSequence(digits)
        setTyped("")
        setPhase("showing")

        let index = 0
        setShownIndex(0)

        const step = () => {
            index += 1

            if (index >= digits.length) {
                setShownIndex(-1)
                setPhase("answering")
                answerOpenedAt.current = performance.now()
                return
            }

            setShownIndex(index)
            timerRef.current = setTimeout(step, DIGIT_MS)
        }

        timerRef.current = setTimeout(step, DIGIT_MS)
    }

    const startPractice = () => {
        setIsPractice(true)
        setPracticeResult(null)
        present(PRACTICE_SEQUENCE)
    }

    const loadNextTrial = async () => {
        setBusy(true)

        try {
            const response = await digitSpanNext()
            const data = response.data.data

            if (data.done) {
                setPhase("done")
                onDone({ blurCount })
                return
            }

            setIsPractice(false)
            present(data.digits)
        } catch (error) {
            message.error("Could not load the next sequence — check your connection")
        } finally {
            setBusy(false)
        }
    }

    const submitAnswer = async () => {
        const ms = answerOpenedAt.current === null ? 0 : Math.round(performance.now() - answerOpenedAt.current)

        if (isPractice) {
            setPracticeResult(typed === PRACTICE_SEQUENCE)
            setPhase("practiceDone")
            return
        }

        setBusy(true)

        try {
            const response = await digitSpanAnswer({ response: typed, ms, blurCount })

            if (response.data.data.done) {
                setPhase("done")
                onDone({ blurCount })
                return
            }

            await loadNextTrial()
        } catch (error) {
            message.error("Could not save that answer — check your connection")
            setBusy(false)
        }
    }

    // ── screens ─────────────────────────────────────────────────────────────────────────────────

    if (phase === "alreadyTaken") {
        return (
            <div>
                <h2>Remembering numbers</h2>
                <p><strong>You have already completed this one.</strong> Your answers are saved.</p>
                <p>
                    This is the one section that cannot be retaken. Now that you know the format and
                    the pace, a second attempt would measure practice rather than memory, and it
                    would not be comparable with anyone else's.
                </p>
                <button type="button" onClick={() => onDone({ blurCount: 0 })}>Back to the assessment</button>
            </div>
        )
    }

    if (phase === "intro") {
        return (
            <div style={{ maxWidth: "620px" }}>
                <h2>Remembering numbers</h2>

                <OneAttemptWarning
                    minutes={5}
                    reason="Once you know the format and the pace, a second attempt measures practice rather than memory — so there is no way to start this one again."
                />

                <p>
                    Numbers will appear on the screen one at a time, about one per second. When they
                    stop, type them back in the same order.
                </p>
                <p>
                    They get longer as you go. <strong>Everyone reaches a point where they cannot do
                    it</strong> — that point is the measurement, so stopping is expected, not failure.
                </p>
                <p>
                    You cannot pause or go back, so find a quiet moment. There is one practice round
                    first, and the practice does not count.
                </p>

                <button type="button" style={{ padding: "12px 18px", minHeight: "44px", fontSize: "16px" }} onClick={startPractice}>
                    Start the practice round
                </button>
            </div>
        )
    }

    if (phase === "showing") {
        return (
            <div style={{ textAlign: "center", padding: "60px 0" }}>
                <p>{isPractice ? "Practice — watch the numbers" : "Watch the numbers"}</p>
                <div style={{ fontSize: "96px", fontWeight: "bold", lineHeight: 1.2, minHeight: "120px" }}>
                    {shownIndex >= 0 ? sequence[shownIndex] : ""}
                </div>
            </div>
        )
    }

    if (phase === "answering") {
        return (
            <div style={{ textAlign: "center", padding: "40px 0" }}>
                <p>{isPractice ? "Practice — type what you saw" : "Type what you saw, in order"}</p>
                <input
                    type="text"
                    inputMode="numeric"
                    autoFocus
                    value={typed}
                    onChange={(event) => setTyped(event.target.value.replace(/\D/g, ""))}
                    onKeyDown={(event) => { if (event.key === "Enter" && typed) submitAnswer() }}
                    style={{ fontSize: "40px", textAlign: "center", width: "100%", maxWidth: "320px", padding: "12px", letterSpacing: "8px", boxSizing: "border-box" }}
                />
                <p>
                    <button type="button" onClick={submitAnswer} disabled={!typed || busy}>
                        {busy ? "Saving…" : "Submit"}
                    </button>
                </p>
            </div>
        )
    }

    if (phase === "practiceDone") {
        return (
            <div style={{ textAlign: "center", padding: "40px 0" }}>
                <p>
                    {practiceResult
                        ? "Correct — that is exactly how it works."
                        : `Not quite — the numbers were ${PRACTICE_SEQUENCE}. That is what the practice round is for.`}
                </p>
                <p>The real rounds start now. They will not tell you whether you got them right.</p>
                <button type="button" onClick={loadNextTrial} disabled={busy}>
                    {busy ? "Starting…" : "Start"}
                </button>
            </div>
        )
    }

    return (
        <div>
            <h2>Remembering numbers</h2>
            <p>Finished. Your answers are saved.</p>
        </div>
    )
}

export default DigitSpan
