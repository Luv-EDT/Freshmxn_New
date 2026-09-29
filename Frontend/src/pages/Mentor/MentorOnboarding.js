import { useState } from "react"
import { ACADEMIC_OPTIONS } from "../Interest/BackgroundInfo"

// The 12-field mentor onboarding form (PRD §B.9 / Master Plan §6.4). Used for the first
// submission and for later edits — `initial` is the saved profile when editing.
// Fields 11 and 12 are ADMIN-ONLY: never shown to a student, used for payouts.

const listToText = (list) => (Array.isArray(list) ? list.join(", ") : "")

function MentorOnboarding({ initial, defaultName, defaultEmail, submitLabel, onSubmit, onCancel }) {
    const [form, setForm] = useState({
        name: initial?.name || defaultName || "",
        email: initial?.email || defaultEmail || "",
        phone: initial?.phone || "",
        currentRole: initial?.currentRole || "",
        discipline: initial?.discipline || "",
        sectors: listToText(initial?.sectors),
        yearsExperience: initial?.yearsExperience ?? "",
        languages: listToText(initial?.languages),
        motivation: initial?.motivation || "",
        transitionCategory: initial?.transitionCategory || "",
        preferredCurrency: initial?.preferredCurrency || "",
        residenceCitizenship: initial?.residenceCitizenship || "",
    })
    const [saving, setSaving] = useState(false)

    const update = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }))

    const handleSubmit = async (e) => {
        e.preventDefault()
        setSaving(true)
        try {
            await onSubmit(form)
        } finally {
            setSaving(false)
        }
    }

    return (
        <form onSubmit={handleSubmit}>
            <div>
                <label>1. Full name (shown on your mentor profile)</label>
                <br />
                <input value={form.name} onChange={update("name")} required />
            </div>
            <div>
                <label>2. Email</label>
                <br />
                <input type="email" value={form.email} onChange={update("email")} required />
            </div>
            <div>
                <label>3. Contact number, with country code</label>
                <br />
                <input type="tel" placeholder="+91 98765 43210" value={form.phone} onChange={update("phone")} required />
            </div>
            <div>
                <label>4. Current role / title</label>
                <br />
                <input value={form.currentRole} onChange={update("currentRole")} required />
            </div>
            <div>
                <label>5. Discipline / profession</label>
                <br />
                <input value={form.discipline} onChange={update("discipline")} required />
            </div>
            <div>
                <label>6. Industry domains / sectors you've worked in, past included (comma-separated)</label>
                <br />
                <input value={form.sectors} onChange={update("sectors")} required />
            </div>
            <div>
                <label>7. Years of experience</label>
                <br />
                <input type="number" min="0" max="60" value={form.yearsExperience} onChange={update("yearsExperience")} required />
            </div>
            <div>
                <label>8. Languages you can mentor in (comma-separated)</label>
                <br />
                <input value={form.languages} onChange={update("languages")} required />
            </div>
            <div>
                <label>9. Why do you want to mentor?</label>
                <br />
                <textarea value={form.motivation} onChange={update("motivation")} required />
            </div>
            <fieldset>
                <legend>10. How did you approach going from high school to college?</legend>
                {ACADEMIC_OPTIONS.map((option) => (
                    <label key={option.value} className="choice">
                        <input
                            type="radio"
                            name="transitionCategory"
                            value={option.value}
                            checked={form.transitionCategory === option.value}
                            onChange={update("transitionCategory")}
                            required
                        />
                        <span>{option.label}</span>
                    </label>
                ))}
            </fieldset>

            <p><strong>Only our team sees these two — they're used for payouts.</strong></p>
            <div>
                <label>11. Preferred payment currency</label>
                <br />
                <input placeholder="e.g. INR" value={form.preferredCurrency} onChange={update("preferredCurrency")} required />
            </div>
            <div>
                <label>12. Country of residence / citizenship</label>
                <br />
                <input value={form.residenceCitizenship} onChange={update("residenceCitizenship")} required />
            </div>

            <p>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Saving…" : submitLabel}</button>
                {onCancel && (
                    <>
                        {" "}
                        <button type="button" className="tap" onClick={onCancel}>Cancel</button>
                    </>
                )}
            </p>
        </form>
    )
}

export default MentorOnboarding
