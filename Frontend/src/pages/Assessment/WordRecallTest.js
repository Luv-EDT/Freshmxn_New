import { useState, useEffect, useRef } from "react"
import { message } from "antd"
import { wordRecallNext, wordRecallAnswer } from "../../apiCall/submissionsApi"
import OneAttemptWarning from "./OneAttemptWarning"
import useLeaveWarning from "./useLeaveWarning"

// The in-house word-memory test (Round 11) — two lists of fifteen everyday words, each word shown
// once, then written down from memory in any order. See Backend/assessment/wordBank.js.
//
// THE LIST ARRIVES ONCE. The server hands a list over at the moment it is shown and records it as
// shown, so a refresh in the middle goes straight to "write what you remember" — never a second look.
// Nothing about the marking comes back: knowing how many you got changes how you try the next list.
//
// The pace is set by the server (msPerWord); the words are shown large, one at a time, with nothing
// else on screen.
function WordRecallTest({ alreadyTaken, onDone }) {
    const [phase, setPhase] = useState(alreadyTaken ? "alreadyTaken" : "intro")   // intro | study | recall | between | done | alreadyTaken
    const [list, setList] = useState(null)          // { number, of, words, msPerWord }
    const [shown, setShown] = useState(0)
    const [text, setText] = useState("")
    const [busy, setBusy] = useState(false)
    const [interrupted, setInterrupted] = useState(false)   // the page was left mid-list (Round 17)
    const timer = useRef(null)

    // a list on screen, or one waiting to be written down, can't be shown again
    useLeaveWarning(phase === "study" || phase === "recall")

    useEffect(() => () => clearTimeout(timer.current), [])

    // one word at a time; after the last, straight to writing
    useEffect(() => {
        if (phase !== "study" || !list) return
        if (shown >= list.words.length) {
            setPhase("recall")
            return
        }
        timer.current = setTimeout(() => setShown((count) => count + 1), list.msPerWord)
        return () => clearTimeout(timer.current)
    }, [phase, list, shown])

    const loadNext = async () => {
        setBusy(true)
        try {
            const response = await wordRecallNext()
            const data = response.data.data
            if (data.done) {
                setPhase("done")
                return
            }
            setList(data)
            setText("")
            setShown(0)
            setInterrupted(Boolean(data.interrupted))
            setPhase(data.phase)
            window.scrollTo(0, 0)
        } catch (error) {
            message.error("Could not load the list — check your connection")
        } finally {
            setBusy(false)
        }
    }

    const submit = async () => {
        setBusy(true)
        try {
            const response = await wordRecallAnswer({ text })
            setPhase(response.data.data.done ? "done" : "between")
        } catch (error) {
            message.error("Could not save what you wrote — check your connection and try again")
        } finally {
            setBusy(false)
        }
    }

    if (phase === "alreadyTaken" || phase === "done") {
        return (
            <section className="word-recall">
                <h2>{phase === "done" ? "Both lists done" : "Word memory"}</h2>
                <p>{phase === "done" ? "Your answers are saved. Your results are part of your report." : "You have finished this section — thank you. It is taken once, so there is nothing more to do here."}</p>
                <button type="button" className="btn btn-primary" onClick={onDone}>Back to all sections</button>
            </section>
        )
    }

    if (phase === "intro") {
        return (
            <section className="word-recall">
                <h2>Word memory</h2>
                <p>
                    You will see fifteen everyday words, one at a time, a second and a half each. Then write down
                    every word you remember, in any order. Then a second list, the same way.
                </p>
                <ul>
                    <li>Each list is shown <strong>once</strong>. There is no going back to look again.</li>
                    <li>Spelling doesn't need to be perfect, and the order doesn't matter.</li>
                    <li>Do it in one sitting, somewhere quiet. It takes about five minutes.</li>
                </ul>
                <OneAttemptWarning minutes={5} reason="A second look at the same lists would measure practice, not memory." />
                <button type="button" className="btn btn-primary" onClick={loadNext} disabled={busy}>
                    {busy ? "Loading…" : "Show the first list"}
                </button>
            </section>
        )
    }

    if (phase === "between") {
        return (
            <section className="word-recall">
                <h2>List 1 done</h2>
                <p>Take a breath. The second list has different words.</p>
                <button type="button" className="btn btn-primary" onClick={loadNext} disabled={busy}>
                    {busy ? "Loading…" : "Show the second list"}
                </button>
            </section>
        )
    }

    if (phase === "study") {
        const word = list.words[shown]
        return (
            <section className="word-recall" aria-live="assertive">
                <p className="word-recall-progress">List {list.number} of {list.of} · word {Math.min(shown + 1, list.words.length)} of {list.words.length}</p>
                <div className="word-recall-stage"><span key={shown}>{word}</span></div>
            </section>
        )
    }

    return (
        <section className="word-recall">
            <p className="word-recall-progress">List {list ? list.number : ""} of {list ? list.of : 2}</p>
            <h2>Write every word you remember</h2>
            {interrupted && (
                <p className="assess-pending">
                    You left during this list, so it won't be shown again. Write what you remember — our team has
                    been told, and can let you take it again if something went wrong.
                </p>
            )}
            <p>Any order. Separate them with spaces, commas or new lines.</p>
            <textarea
                className="word-recall-input"
                rows={6}
                value={text}
                maxLength={600}
                onChange={(event) => setText(event.target.value)}
                aria-label="The words you remember"
                autoFocus
            />
            <div className="btn-row">
                <button type="button" className="btn btn-primary" onClick={submit} disabled={busy}>
                    {busy ? "Saving…" : "That's all I remember"}
                </button>
            </div>
        </section>
    )
}

export default WordRecallTest
