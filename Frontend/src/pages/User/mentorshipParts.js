import { useEffect, useState } from "react"
import { message } from "antd"
import dayjs from "dayjs"
import { getMyWaitlist, saveMyHelp } from "../../apiCall/mentorWaitlistApi"

// The pieces the two mentor pages share (owner, Round 20): /mentorship shows where the student stands
// and how it all works; /mentorship/choose holds everything the student fills in.

export const formatDate = (date) => (date ? dayjs(date).format("D MMM YYYY") : "")

// WHAT THE SESSIONS COVER (owner, Round 18) — so a student knows what to ask for
export const SESSION_TOPICS = [
    "What the work is like day to day",
    "The drawbacks and the perks",
    "The real picture — and your mentor's own story",
    "How to get in, and the skills you'll need",
    "Your questions, answered",
]
export const HELP_MAX = 600

// "For the role you choose, what help do you want?" (owner, Round 19)
export const HELP_FOCUS = [
    { value: "career", label: "Career help", hint: "making it my work" },
    { value: "passion", label: "Interest / passion help", hint: "pursuing it for meaning, alongside whatever pays" },
    { value: "both", label: "Both", hint: "" },
]

// CONTRIBUTION AND INTEREST (owner, Round 19), said up front: everything we help with serves one of
// the two, and the student says which they want for their role.
export const Framing = () => (
    <section className="mentor-framing">
        <p>
            Everything we do serves one of two things. <strong>Contribution</strong> — earning, supporting your
            family, standing on your own feet — is the base of Maslow's hierarchy: safety and security.{" "}
            <strong>Interest</strong>, with passion as its strongest form, is what gives life meaning whether or
            not it pays — the upper tiers: belonging, esteem, becoming yourself.
        </p>
        <p>We help with careers, and with how to carry something you love forward in life.</p>
    </section>
)

// The waitlist row and the student's picker options, loaded once — nothing until it is in, so the
// page never shows a half-built version first (owner, Round 13)
export const useMentorWaitlist = (enabled) => {
    const [waitlist, setWaitlist] = useState(null)
    const [options, setOptions] = useState([])   // the careers and their job roles, from the student's own ranking
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!enabled) {
            setLoading(false)
            return
        }
        const load = async () => {
            try {
                const response = await getMyWaitlist()
                const place = response?.data?.data || null
                setWaitlist(place)
                setOptions((place && place.options) || [])
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [enabled])

    return { waitlist, setWaitlist, options, loading }
}

// Round 13 (owner): help is one tap away on every state of both pages
export const HelpLine = () => (
    <p className="help-line">
        Need help? <a href="https://wa.me/918882756287" target="_blank" rel="noreferrer">WhatsApp us</a>
    </p>
)

// "What do you want from your mentor?" — the session list, an open box for anything specific, and a
// tick box for help with a master's abroad or settling abroad, which a later version will offer.
// Saved on its own, any time; it never touches the choice or the 20-business-day clock.
export function HelpWanted({ waitlist, onSaved }) {
    const [text, setText] = useState(waitlist.helpWanted || "")
    const [abroad, setAbroad] = useState(Boolean(waitlist.abroadHelpWaitlist))
    const [focus, setFocus] = useState(waitlist.helpFocus || null)
    const [saving, setSaving] = useState(false)
    const changed = text !== (waitlist.helpWanted || "") || abroad !== Boolean(waitlist.abroadHelpWaitlist) || focus !== (waitlist.helpFocus || null)

    const save = async () => {
        setSaving(true)
        const response = await saveMyHelp({ helpWanted: text, helpFocus: focus, abroadHelpWaitlist: abroad })
        setSaving(false)
        if (!response || response.data.success === false) {
            message.error(response?.data?.message || "Could not save")
            return
        }
        message.success(response.data.message)
        onSaved(response.data.data)
    }

    return (
        <section className="mentor-help">
            <h3>What do you want from your mentor?</h3>
            <fieldset className="mentor-focus">
                <legend><strong>For the role you choose, what help do you want?</strong></legend>
                {HELP_FOCUS.map((option) => (
                    <label key={option.value} className="choice">
                        <input type="radio" name="helpFocus" value={option.value} checked={focus === option.value} onChange={() => setFocus(option.value)} />
                        <span><strong>{option.label}</strong>{option.hint && ` — ${option.hint}`}</span>
                    </label>
                ))}
            </fieldset>
            <p>Your sessions cover:</p>
            <ul>
                {SESSION_TOPICS.map((topic) => <li key={topic}>{topic}</li>)}
            </ul>
            <label htmlFor="help-wanted" className="mentor-help-label"><strong>Anything specific you want to know?</strong></label>
            <textarea
                id="help-wanted"
                rows={4}
                maxLength={HELP_MAX}
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder="For example: what a normal week looks like, which college choices mattered, how you got your first job"
            />
            <p className="report-small mentor-help-count">{text.length}/{HELP_MAX} — your mentor sees this before you meet.</p>
            <label className="choice">
                <input type="checkbox" checked={abroad} onChange={(event) => setAbroad(event.target.checked)} />
                <span>
                    <strong>Help with a master's abroad or settling abroad?</strong> In a future version we'll help
                    you with this. Tick to join that waitlist.
                </span>
            </label>
            <p>
                <button type="button" className="btn btn-primary" disabled={!changed || saving} onClick={save}>
                    {saving ? "Saving…" : "Save"}
                </button>
            </p>
        </section>
    )
}

