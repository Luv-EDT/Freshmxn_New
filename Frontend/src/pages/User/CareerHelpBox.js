import { useEffect, useState } from "react"
import { message } from "antd"
import { getMyCareerHelp, saveMyCareerHelp } from "../../apiCall/careerHelpApi"

// "HOW ELSE CAN WE HELP?" (owner, Round 25), asked once a student has chosen a career: on the
// dashboard for Career Discovery, on /mentorship/choose for the mentor plans. One shared waitlist —
// we go through it on a detailed call, then recommend a partner affiliate or a new product of ours.
// It replaced the mentor page's separate "help with a master's abroad" tick.
export const HELP_OPTIONS = [
    { value: "toolkit", label: "A getting-started skill kit", hint: "the 20% of skills that get you 80% of the way in (the 80-20 rule)" },
    { value: "opportunities", label: "Internships, jobs or fellowships", hint: "finding and landing your first ones" },
    { value: "abroad", label: "A master's abroad, or settling abroad", hint: "planning the move" },
    { value: "other", label: "Anything else" },
]

const OTHER_MAX = 300

// fixedCareer: { id, name } when the career is already chosen (the mentor page); otherwise the
// student picks from their own top matches, which the server sends with the row
function CareerHelpBox({ fixedCareer = null }) {
    const [saved, setSaved] = useState(null)
    const [careers, setCareers] = useState([])
    const [wants, setWants] = useState([])
    const [otherText, setOtherText] = useState("")
    const [careerId, setCareerId] = useState(fixedCareer ? fixedCareer.id : "")
    const [consent, setConsent] = useState(false)
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        const load = async () => {
            const response = await getMyCareerHelp()
            const data = response?.data?.data
            if (!data) return
            setCareers(data.careers || [])
            const row = data.row
            if (!row) return
            setSaved(row)
            setWants(row.wants || [])
            setOtherText(row.otherText || "")
            if (!fixedCareer && row.careerId) setCareerId(row.careerId)
        }
        load()
    }, [fixedCareer])

    const toggle = (value) => setWants((prev) => (prev.includes(value) ? prev.filter((want) => want !== value) : [...prev, value]))

    const save = async () => {
        setSaving(true)
        const response = await saveMyCareerHelp({ wants, otherText, careerId: careerId || null, consent })
        setSaving(false)
        if (!response || response.data.success === false) {
            message.error(response?.data?.message || "Could not save")
            return
        }
        message.success(response.data.message)
        setSaved(response.data.data)
        setConsent(false)
    }

    const ready = wants.length > 0 && consent && (!wants.includes("other") || otherText.trim())

    return (
        <section className="card career-help">
            <h3>How else can we help you?</h3>
            <p>
                {fixedCareer ? <>For <strong>{fixedCareer.name}</strong>, w</> : "W"}e can help with more than a
                plan. We'll go through it with you on a detailed call, then recommend you to our partner
                affiliates — join the waitlist.
            </p>

            {!fixedCareer && careers.length > 0 && (
                <label className="career-help-career">
                    <strong>For which career?</strong>
                    <select value={careerId} onChange={(event) => setCareerId(event.target.value)}>
                        <option value="">Not sure yet</option>
                        {careers.map((career) => <option key={career.id} value={career.id}>{career.name}</option>)}
                    </select>
                </label>
            )}

            <fieldset className="career-help-options">
                <legend><strong>What would help? Tick any.</strong></legend>
                {HELP_OPTIONS.map((option) => (
                    <label key={option.value} className="choice">
                        <input type="checkbox" checked={wants.includes(option.value)} onChange={() => toggle(option.value)} />
                        <span><strong>{option.label}</strong>{option.hint && ` — ${option.hint}`}</span>
                    </label>
                ))}
            </fieldset>

            {wants.includes("other") && (
                <>
                    <label htmlFor="career-help-other" className="mentor-help-label"><strong>What else can we help with?</strong></label>
                    <textarea id="career-help-other" rows={3} maxLength={OTHER_MAX} value={otherText} onChange={(event) => setOtherText(event.target.value)} />
                    <p className="report-small mentor-help-count">{otherText.length}/{OTHER_MAX}</p>
                </>
            )}

            {/* the permission, set apart from the options above so it can't be mistaken for one (owner, Round 26) */}
            <label className="consent-check">
                <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
                <span><span aria-hidden="true">🔒</span> Freshmxn may contact me about this and, if I ask, introduce me to a partner.</span>
            </label>

            {saved && <p className="report-small">You're on the waitlist (saved {new Date(saved.consentAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}). Change anything and save again.</p>}

            <p>
                <button type="button" className="btn btn-primary" disabled={!ready || saving} onClick={save}>
                    {saving ? "Saving…" : saved ? "Update my waitlist place" : "Join the waitlist"}
                </button>
            </p>
        </section>
    )
}

export default CareerHelpBox
