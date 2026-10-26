import { useEffect, useState } from "react"
import dayjs from "dayjs"
import { getMyWaitlist } from "../../apiCall/mentorWaitlistApi"

// The pieces the mentor pages share (owner, Rounds 20 and 34): /mentorship shows where the student
// stands and what happens next; /mentorship/choose holds the one-time form; /mentorship/how-it-works the
// thinking behind it.

export const formatDate = (date) => (date ? dayjs(date).format("D MMM YYYY") : "")

const WHATSAPP = "https://wa.me/918882756287"

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

// the languages a student may ask for (owner, Round 34) — the server checks the same list
export const LANGUAGES = ["English", "Hindi", "Bengali", "Marathi", "Tamil", "Telugu", "Gujarati", "Kannada", "Malayalam", "Punjabi", "Odia"]

// MASLOW'S PYRAMID beside the framing (owner, Round 34): the lower tiers are contribution, the upper
// ones interest — drawn here, in the brand's colours, so it reads on any screen
const TIERS = [
    { label: "Becoming yourself", side: "interest" },
    { label: "Esteem", side: "interest" },
    { label: "Belonging", side: "interest" },
    { label: "Safety and security", side: "contribution" },
    { label: "Basic needs", side: "contribution" },
]

export const MaslowPyramid = () => (
    <svg className="maslow" viewBox="0 0 320 260" role="img" aria-label="Maslow's pyramid: contribution covers basic needs and safety; interest covers belonging, esteem and becoming yourself">
        {TIERS.map((tier, index) => {
            const y = 16 + index * 46
            const half = 30 + index * 26
            const nextHalf = 30 + (index + 1) * 26
            const fill = tier.side === "interest" ? "var(--pink-tint)" : "var(--teal-tint)"
            return (
                <g key={tier.label}>
                    <polygon points={`${160 - half},${y} ${160 + half},${y} ${160 + nextHalf},${y + 42} ${160 - nextHalf},${y + 42}`} fill={fill} stroke="var(--navy)" strokeWidth="1" />
                    <text x="160" y={y + 26} textAnchor="middle" fontSize="12" fill="var(--navy)">{tier.label}</text>
                </g>
            )
        })}
        <text x="8" y="70" fontSize="12" fontWeight="700" fill="var(--pink-dark, #b03060)">Interest</text>
        <text x="8" y="210" fontSize="12" fontWeight="700" fill="var(--teal-dark)">Contribution</text>
    </svg>
)

// CONTRIBUTION AND INTEREST (owner, Rounds 19 and 34), said up front, with the pyramid beside it
export const Framing = () => (
    <section className="mentor-framing">
        <div className="mentor-framing-text">
            <p>
                Everything we do serves one of two things. <strong>Contribution</strong> — earning, supporting your
                family, standing on your own feet — is the base of Maslow's hierarchy: safety and security.{" "}
                <strong>Interest</strong>, with passion as its strongest form, is what gives life meaning whether or
                not it pays — the upper tiers: belonging, esteem, becoming yourself.
            </p>
            <p>
                We help with careers, and with how to carry something you love forward in life, which is essentially a
                combination of this contribution and interests/passion theory. Our mentors are the facilitators of this.
            </p>
        </div>
        <MaslowPyramid />
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

// Round 34 (owner): both questions on one line, then where to ask
export const HelpLine = () => (
    <p className="help-line">
        Need help? · Need to change your choice?{" "}
        <a href={WHATSAPP} target="_blank" rel="noreferrer">Message us on WhatsApp</a>
    </p>
)

// "What do you want from your mentor?" — part of the one-time form now (owner, Round 34): no Save of its
// own, it is sent with the choice and shown read-only afterwards
export function HelpFields({ value, onChange }) {
    const set = (part) => onChange({ ...value, ...part })
    const languages = value.languages || []
    const toggle = (name) => set({ languages: languages.includes(name) ? languages.filter((item) => item !== name) : [...languages, name] })

    return (
        <section className="mentor-help">
            <h3>What do you want from your mentor?</h3>
            <fieldset className="mentor-focus">
                <legend><strong>For the role you choose, what help do you want?</strong></legend>
                {HELP_FOCUS.map((option) => (
                    <label key={option.value} className="choice">
                        <input type="radio" name="helpFocus" value={option.value} checked={value.helpFocus === option.value} onChange={() => set({ helpFocus: option.value })} />
                        <span><strong>{option.label}</strong>{option.hint && ` — ${option.hint}`}</span>
                    </label>
                ))}
            </fieldset>
            <p>Your session covers:</p>
            <ul>
                {SESSION_TOPICS.map((topic) => <li key={topic}>{topic}</li>)}
            </ul>
            <label htmlFor="help-wanted" className="mentor-help-label"><strong>Anything specific you want to know?</strong></label>
            <textarea
                id="help-wanted"
                rows={4}
                maxLength={HELP_MAX}
                value={value.helpWanted || ""}
                onChange={(event) => set({ helpWanted: event.target.value })}
                placeholder="For example: what a normal week looks like, which college choices mattered, how you got your first job"
            />
            <p className="report-small mentor-help-count">{(value.helpWanted || "").length}/{HELP_MAX} — your mentor sees this before you meet.</p>

            <fieldset className="mentor-languages">
                <legend><strong>Which languages would you like your session in?</strong> Tick any.</legend>
                <div className="language-grid">
                    {LANGUAGES.map((name) => (
                        <label key={name} className="choice">
                            <input type="checkbox" checked={languages.includes(name)} onChange={() => toggle(name)} />
                            <span>{name}</span>
                        </label>
                    ))}
                </div>
                <label htmlFor="language-other" className="mentor-help-label">Other</label>
                <input id="language-other" type="text" maxLength={40} value={value.languageOther || ""} onChange={(event) => set({ languageOther: event.target.value })} placeholder="Another language" />
            </fieldset>
        </section>
    )
}

export const helpReady = (value) => Boolean(value && value.helpFocus && ((value.languages || []).length > 0 || (value.languageOther || "").trim().length >= 2))

// WHAT HAPPENS NEXT (owner, Round 34) — on the page from the moment a choice is sent
export const NextSteps = () => (
    <section className="mentor-next">
        <h3>What happens next</h3>
        <ul>
            <li><strong>We find your mentor within 20 business days.</strong> You'll hear from us by email, on WhatsApp and here on your dashboard.</li>
            <li><strong>Once matched, your mentor's booking links appear here</strong> (and in the email). Book within <strong>2.5 days</strong>, or it counts as a no-show. The 1-hour main session is in the next 4 days; the 20-minute follow-up on day 5 or 6.</li>
            <li><strong>Book both together.</strong> If you don't pick a follow-up slot with the main one, we take it that you don't want it — it's your choice, for your own questions, on a call or Google Meet. Your mentor will also ask at the end of the main session, and you can book it then.</li>
            <li><strong>Add both to your calendar.</strong> The main session covers a day in the job, the bad parts, your mentor's journey, how it relates to you, and what it takes.</li>
            <li><strong>If you chose WhatsApp,</strong> we'll send you one reminder an hour before.</li>
            <li><strong>Rescheduling</strong> happens only if your mentor agrees — message us on WhatsApp and we'll ask them. Otherwise the booked time stands.</li>
            <li><strong>Not joined within 10 minutes</strong> of the start counts as a no-show.</li>
            <li><strong>After your session(s), fill the feedback form.</strong> It appears here, and by email, once your mentor tells us the session is done. Don't share it with your mentor — it's how we judge the mentor.</li>
            <li><strong>Want to change the career?</strong> Message us on WhatsApp within <strong>7 days</strong> of sending your choice; we reset it, you choose again, and the 20 business days start again. After 7 days it can't be changed.</li>
        </ul>
    </section>
)
