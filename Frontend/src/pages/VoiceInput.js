import { useEffect, useRef, useState } from "react"

// VOICE TYPING (Round 13, owner: browser dictation first). A mic button beside a written answer: the
// student speaks, the browser's own speech service turns it into text, and the words land in the box
// to be read and edited before anything is saved. We receive only the text — never audio (Privacy
// Policy, "Voice typing").
//
// ONE BUTTON, ONE LANGUAGE (Round 17, owner): just "Speak". It always listens as Indian English
// (en-IN), which writes Indian-accented English and Hinglish in Roman letters ("maine 10th mein
// cricket khela"), so what appears in the box reads in English letters. The activity matcher works
// out what was meant, however it was said (Backend/matching/activityResolver.js).
//
// THE WORDS APPEAR AS YOU SPEAK (Round 17). The box shows what it held when you pressed Speak, then
// the words already settled, then the words still being heard; pressing Stop keeps only the settled
// ones. So the component takes the box's `value` and hands back the whole new value via `onChange`.
//
// Where the browser has no speech recognition (Firefox, some in-app browsers) the button is not
// shown; the full version says to type instead.

const Recognition = typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : null

// what was already typed, then what was just said
export const appendSpoken = (current, spoken) => {
    const text = String(spoken || "").trim()
    if (!text) return current || ""
    return current && current.trim() ? `${current.replace(/\s+$/, "")} ${text}` : text
}

function VoiceInput({ value, onChange, compact = false }) {
    const [listening, setListening] = useState(false)
    const [error, setError] = useState("")
    const recognition = useRef(null)
    const base = useRef("")          // the box as it was when Speak was pressed
    const settled = useRef("")       // every final phrase heard so far in this session
    // the words arrive after the render that started listening, so always hand them to the latest
    // onChange — an old one would write into a box that has since changed
    const latest = useRef(onChange)
    latest.current = onChange

    // never leave the microphone on when the student moves away
    useEffect(() => () => { if (recognition.current) recognition.current.abort() }, [])

    if (!Recognition) {
        return compact ? null : <p className="voice-note">Voice typing isn't available in this browser — please type your answer.</p>
    }

    const start = () => {
        const session = new Recognition()
        session.lang = "en-IN"
        session.continuous = true
        session.interimResults = true
        base.current = value || ""
        settled.current = ""
        // results holds the whole session: the settled phrases, then (last) the one still being heard
        session.onresult = (event) => {
            const finals = []
            const hearing = []
            for (let index = 0; index < event.results.length; index += 1) {
                const phrase = event.results[index][0].transcript.trim()
                if (phrase) (event.results[index].isFinal ? finals : hearing).push(phrase)
            }
            settled.current = finals.join(" ")
            latest.current(appendSpoken(base.current, [...finals, ...hearing].join(" ")))
        }
        session.onerror = (event) => {
            setError(event.error === "not-allowed" || event.error === "service-not-allowed"
                ? "Allow the microphone to use voice typing, or type instead."
                : "Voice typing stopped — try again, or type instead.")
            setListening(false)
        }
        // on stop, a phrase still half-heard is dropped: the box keeps what was settled
        session.onend = () => {
            latest.current(appendSpoken(base.current, settled.current))
            setListening(false)
        }
        recognition.current = session
        setError("")
        try {
            session.start()
            setListening(true)
        } catch (startError) {
            setError("Voice typing could not start — please type instead.")
        }
    }

    const stop = () => recognition.current && recognition.current.stop()

    return (
        <div className={`voice-input${compact ? " is-compact" : ""}`}>
            <button type="button" className={`voice-mic${listening ? " is-on" : ""}`} onClick={listening ? stop : start} aria-pressed={listening}>
                <span aria-hidden="true">🎤</span> {listening ? "Stop" : "Speak"}
            </button>
            {listening && <span className="voice-live">Listening… your words appear as you speak. Press Stop when done.</span>}
            {error && <span className="voice-error">{error}</span>}
        </div>
    )
}

export default VoiceInput
