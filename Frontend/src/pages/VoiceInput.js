import { useEffect, useRef, useState } from "react"

// VOICE TYPING (Round 13, owner: browser dictation first). A mic button beside a written answer: the
// student speaks in English or Hindi, the browser's own speech service turns it into text, and the
// words land in the box to be read and edited before anything is saved. We receive only the text —
// never audio (Privacy Policy, "Voice typing"). Hinglish is fine: the graders judge content, and the
// activity matcher puts Hindi into English before it looks for careers.
//
// Where the browser has no speech recognition (Firefox, some in-app browsers) the button is not
// shown; the full version says to type instead.

const Recognition = typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : null

const LANGUAGES = [
    { code: "en-IN", label: "English" },
    { code: "hi-IN", label: "हिंदी" },
]

const readLanguage = () => {
    try {
        return localStorage.getItem("voiceLanguage") || "en-IN"
    } catch (error) {
        return "en-IN"
    }
}

// what was already typed, then what was just said
export const appendSpoken = (current, spoken) => {
    const text = String(spoken || "").trim()
    if (!text) return current || ""
    return current && current.trim() ? `${current.replace(/\s+$/, "")} ${text}` : text
}

function VoiceInput({ onText, compact = false }) {
    const [language, setLanguage] = useState(readLanguage)
    const [listening, setListening] = useState(false)
    const [error, setError] = useState("")
    const recognition = useRef(null)
    // the words arrive after the render that started listening, so always hand them to the latest
    // onText — an old one would append to text that has since changed
    const latest = useRef(onText)
    latest.current = onText

    // never leave the microphone on when the student moves away
    useEffect(() => () => { if (recognition.current) recognition.current.abort() }, [])

    if (!Recognition) {
        return compact ? null : <p className="voice-note">Voice typing isn't available in this browser — please type your answer.</p>
    }

    const start = () => {
        const session = new Recognition()
        session.lang = language
        session.continuous = true
        session.interimResults = false
        // every final phrase in one event goes over as one piece — two calls in a row would each
        // append to the same old text, and the first phrase would be lost
        session.onresult = (event) => {
            const said = []
            for (let index = event.resultIndex; index < event.results.length; index += 1) {
                if (event.results[index].isFinal) said.push(event.results[index][0].transcript.trim())
            }
            if (said.length > 0) latest.current(said.join(" "))
        }
        session.onerror = (event) => {
            setError(event.error === "not-allowed" || event.error === "service-not-allowed"
                ? "Allow the microphone to use voice typing, or type instead."
                : "Voice typing stopped — try again, or type instead.")
            setListening(false)
        }
        session.onend = () => setListening(false)
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

    const choose = (code) => {
        setLanguage(code)
        try {
            localStorage.setItem("voiceLanguage", code)
        } catch (storageError) {
            // a private window: the choice simply isn't remembered
        }
    }

    return (
        <div className={`voice-input${compact ? " is-compact" : ""}`}>
            <button type="button" className={`voice-mic${listening ? " is-on" : ""}`} onClick={listening ? stop : start} aria-pressed={listening}>
                <span aria-hidden="true">🎤</span> {listening ? "Stop" : "Speak"}
            </button>
            <span className="voice-languages" role="group" aria-label="Language you'll speak">
                {LANGUAGES.map((option) => (
                    <button
                        type="button"
                        key={option.code}
                        className={`voice-language${language === option.code ? " is-on" : ""}`}
                        aria-pressed={language === option.code}
                        onClick={() => choose(option.code)}
                        disabled={listening}
                    >
                        {option.label}
                    </button>
                ))}
            </span>
            {listening && <span className="voice-live">Listening… speak, then press Stop</span>}
            {error && <span className="voice-error">{error}</span>}
        </div>
    )
}

export default VoiceInput
