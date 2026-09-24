import { useState, useEffect } from "react"
import { message } from "antd"
import { openStory, getStoryState, submitStoryRecall } from "../../apiCall/submissionsApi"

// Delayed story recall. Five phases, all decided by the SERVER from a stored timestamp:
//
//     not_started  nothing opened yet
//     reading      inside the 60-minute window; the text is available
//     waiting      the hour has passed, less than 24 hours since; nothing to do
//     recall       24–72 hours; the questions are open
//     expired      past 72 hours; not scored
//
// THE COMPONENT ASKS, IT NEVER DECIDES. There is no client timer anywhere in this file. The clock
// spans days, tabs and devices — a browser timer survives none of that, and a student who reloaded
// would simply be given their hour back.
//
// FREE RECALL COMES FIRST, AND THAT ORDER IS NOT COSMETIC. The structured questions contain cues:
// asking "what was the profession of the person brought in to investigate?" tells the student there
// was an investigator. Running them first would inflate free recall and destroy the measure. So the
// two parts are separate screens and there is no way back from the second to the first.

const FREE_QUESTIONS = [
    { id: "LR1", text: "In your own words, what was the problem in the story?" },
    { id: "LR2", text: "What turned out to be causing it?" },
    { id: "LR3", text: "What was done about it in the end?" },
]

function StoryRecall({ onDone }) {
    const [state, setState] = useState(null)
    const [busy, setBusy] = useState(false)
    const [part, setPart] = useState("free")          // free → structured, never back
    const [free, setFree] = useState({})
    const [structured, setStructured] = useState({ LR9: ["", ""] })

    const load = async () => {
        try {
            const response = await getStoryState()
            setState(response.data.data)
        } catch (error) {
            message.error("Could not load the story")
        }
    }

    useEffect(() => { load() }, [])

    const handleOpen = async () => {
        setBusy(true)
        try {
            await openStory()
            await load()
        } catch (error) {
            message.error("Could not open the story")
        } finally {
            setBusy(false)
        }
    }

    const handleSubmit = async () => {
        setBusy(true)
        try {
            await submitStoryRecall({ free, structured })
            message.success("Saved — thank you")
            onDone()
        } catch (error) {
            message.error(error?.response?.data?.message || "Could not save your answers")
            setBusy(false)
        }
    }

    if (!state) return <div>Loading…</div>

    const field = (label, value, onChange, props = {}) => (
        <div>
            <p><strong>{label}</strong></p>
            <input
                type="text"
                value={value || ""}
                onChange={(event) => onChange(event.target.value)}
                style={{ width: "100%", maxWidth: "420px", padding: "10px", fontSize: "16px", boxSizing: "border-box" }}
                {...props}
            />
        </div>
    )

    // ── not started ─────────────────────────────────────────────────────────────────────────────
    if (state.phase === "not_started") {
        return (
            <div>
                <h2>A short story</h2>
                <p>You are about to read a short story. You will be asked about it <strong>tomorrow</strong>, not today.</p>
                <p>
                    The story stays on your screen for <strong>one hour</strong>. After that it
                    disappears and you cannot get it back.
                </p>
                <p>
                    <strong>The best way to remember it:</strong> read it now, then come back and read
                    it once more before the hour is up. Reading something a second time after a gap
                    helps it stay in your memory far better than reading it many times in a row.
                </p>
                <p>
                    Tomorrow, 24 hours from now, we will ask you what you remember. You will have two
                    days to answer.
                </p>
                <p>
                    <strong>You will not be marked on your English.</strong> We only check whether you
                    remember what happened. Write in English, Hindi, or a mix — whatever is easiest.
                </p>
                <hr />
                <p><em>Ready to start the one-hour clock? Once you open the story, the timer begins and cannot be paused.</em></p>
                <button type="button" className="btn btn-primary" onClick={handleOpen} disabled={busy}>
                    {busy ? "Opening…" : "Open the story and start the hour"}
                </button>
            </div>
        )
    }

    // ── reading ─────────────────────────────────────────────────────────────────────────────────
    if (state.phase === "reading") {
        return (
            <div>
                <h2>{state.title}</h2>
                <p><em>About {state.minutesLeft} minutes left before this disappears.</em></p>
                <div style={{ fontSize: "18px", lineHeight: 1.7, whiteSpace: "pre-line", maxWidth: "640px" }}>
                    {state.text}
                </div>
                <hr />
                <p>Read it again before the hour is up — that is the single best thing you can do.</p>
                <button type="button" onClick={() => onDone()}>Back to the assessment</button>
            </div>
        )
    }

    // ── waiting ─────────────────────────────────────────────────────────────────────────────────
    if (state.phase === "waiting") {
        const hoursLeft = Math.max(0, Math.ceil(state.recallOpensHours - state.hoursElapsed))

        return (
            <div>
                <h2>A short story</h2>
                <p>The hour has passed and the story is gone — that is how it is meant to work.</p>
                <p>
                    <strong>Come back in about {hoursLeft} {hoursLeft === 1 ? "hour" : "hours"}.</strong> The
                    questions open 24 hours after you opened the story, and you will then have two days
                    to answer.
                </p>
                <p><em>Carry on with the other sections in the meantime — this one runs on its own clock.</em></p>
                <button type="button" onClick={() => onDone()}>Back to the assessment</button>
            </div>
        )
    }

    // ── expired ─────────────────────────────────────────────────────────────────────────────────
    if (state.phase === "expired") {
        return (
            <div>
                <h2>A short story</h2>
                <p>The two-day window for this one has closed, so it will not be scored.</p>
                <p>
                    <em>Nothing else is affected — the rest of your assessment releases normally, and
                    this section is simply left out rather than counted against you.</em>
                </p>
                <button type="button" onClick={() => onDone()}>Back to the assessment</button>
            </div>
        )
    }

    if (state.phase === "submitted") {
        return (
            <div>
                <h2>A short story</h2>
                <p>You have already answered this one. Your answers are saved.</p>
                <button type="button" onClick={() => onDone()}>Back to the assessment</button>
            </div>
        )
    }

    // ── recall, part A: free ────────────────────────────────────────────────────────────────────
    if (part === "free") {
        const answered = FREE_QUESTIONS.filter((question) => (free[question.id] || "").trim()).length

        return (
            <div>
                <h2>What do you remember?</h2>
                <p>
                    Three questions in your own words. Write whatever you remember, even if you are not
                    sure. <strong>Spelling and grammar are not marked</strong> — English, Hindi or a mix
                    is all fine.
                </p>
                <p><em>About {state.hoursLeft} hours left to finish this.</em></p>
                <hr />

                {FREE_QUESTIONS.map((question) => (
                    <div key={question.id}>
                        <p><strong>{question.text}</strong></p>
                        <textarea
                            rows={5}
                            value={free[question.id] || ""}
                            onChange={(event) => setFree({ ...free, [question.id]: event.target.value })}
                            style={{ width: "100%", boxSizing: "border-box", padding: "10px", fontSize: "16px" }}
                        />
                    </div>
                ))}

                <hr />
                <p><em>{answered} of 3 answered. The next page asks specific questions — you cannot come back here afterwards.</em></p>
                <button type="button" className="btn btn-primary" onClick={() => { setPart("structured"); window.scrollTo(0, 0) }}>
                    Continue to the specific questions
                </button>
            </div>
        )
    }

    // ── recall, part B: structured ──────────────────────────────────────────────────────────────
    const options = state.options || {}

    const select = (id, label) => (
        <div>
            <p><strong>{label}</strong></p>
            {(options[id] || []).map((option) => (
                <label key={option} className="choice">
                    <input
                        type="radio"
                        name={id}
                        checked={structured[id] === option}
                        onChange={() => setStructured({ ...structured, [id]: option })}
                    />
                    {" "}{option}
                </label>
            ))}
        </div>
    )

    return (
        <div>
            <h2>A few specific questions</h2>
            <p>Answer what you can. A blank answer is simply not counted — a guess costs you nothing either.</p>
            <hr />

            {field("In which year did this take place?", structured.LR4, (value) => setStructured({ ...structured, LR4: value }), { inputMode: "numeric" })}
            {field("What was the name of the main person?", structured.LR5, (value) => setStructured({ ...structured, LR5: value }))}
            {field("Name either of the other two people mentioned", structured.LR6, (value) => setStructured({ ...structured, LR6: value }))}

            {select("LR7", "What was the profession of the person brought in to investigate?")}
            {select("LR8", "What was the profession of the person who worked out the cause?")}

            <div>
                <p><strong>Two numbers appeared in the story. What were they?</strong></p>
                {[0, 1].map((index) => (
                    <input
                        key={index}
                        type="text"
                        inputMode="numeric"
                        value={structured.LR9[index] || ""}
                        onChange={(event) => {
                            const next = [...structured.LR9]
                            next[index] = event.target.value
                            setStructured({ ...structured, LR9: next })
                        }}
                        style={{ width: "140px", padding: "10px", fontSize: "16px", marginRight: "10px" }}
                    />
                ))}
            </div>

            {select("LR10", "What was the unusual ability the third person had?")}

            <hr />
            <button type="button" className="btn btn-primary" onClick={handleSubmit} disabled={busy}>
                {busy ? "Saving…" : "Finish this section"}
            </button>
        </div>
    )
}

export default StoryRecall
