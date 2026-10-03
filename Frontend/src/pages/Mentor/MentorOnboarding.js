import { useState } from "react"
import { ACADEMIC_OPTIONS } from "../Interest/BackgroundInfo"
import CareerRolePicker, { pickerComplete } from "../CareerRolePicker"

// The 12-field mentor onboarding form (PRD §B.9 / Master Plan §6.4). Used for the first
// submission and for later edits — `initial` is the saved profile when editing.
// Fields 11 and 12 are ADMIN-ONLY: never shown to a student, used for payouts.
//
// Round 12 (owner): profession, job role and industries come from OUR lists — the 223 careers,
// their job roles (or "something else" in the mentor's own words) and the industry list — so a
// mentor can be matched to a student's choice exactly, and their profession can be shown back to
// them for review.

const listToText = (list) => (Array.isArray(list) ? list.join(", ") : "")


function MentorOnboarding({ initial, defaultName, defaultEmail, submitLabel, onSubmit, onCancel }) {
    const [form, setForm] = useState({
        name: initial?.name || defaultName || "",
        email: initial?.email || defaultEmail || "",
        phone: initial?.phone || "",
        career: initial?.professionId
            ? {
                professionId: initial.professionId,
                profession: initial.professionName,
                jobRole: initial.jobRoleOther ? "other" : initial.jobRole,
                jobRoleOther: initial.jobRoleOther || "",
                industryCodes: initial.industryCodes || [],
            }
            : { industryCodes: [] },
        yearsExperience: initial?.yearsExperience ?? "",
        languages: listToText(initial?.languages),
        motivation: initial?.motivation || "",
        transitionCategory: initial?.transitionCategory || "",
        preferredCurrency: initial?.preferredCurrency || "",
        residenceCitizenship: initial?.residenceCitizenship || "",
    })
    const [saving, setSaving] = useState(false)

    const update = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }))
    const careerReady = pickerComplete(form.career) && (form.career.industryCodes || []).length > 0

    const handleSubmit = async (e) => {
        e.preventDefault()
        setSaving(true)
        if (!careerReady) return
        const { career, ...rest } = form
        try {
            await onSubmit({
                ...rest,
                professionId: career.professionId,
                jobRole: career.jobRole,
                jobRoleOther: career.jobRole === "other" ? career.jobRoleOther : "",
                industryCodes: career.industryCodes || [],
            })
        } finally {
            setSaving(false)
        }
    }

    return (
        <form onSubmit={handleSubmit} className="mentor-form">
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
                <p className="mentor-form-label">4–6. Your profession, your job role in it, and the industries you've worked in (past included)</p>
                {initial && !initial.professionId && (initial.currentRole || initial.discipline) && (
                    <p className="report-small">You told us before: {initial.currentRole}{initial.discipline ? `, ${initial.discipline}` : ""}. Please choose it from the list now.</p>
                )}
                <CareerRolePicker
                    value={form.career}
                    onChange={(career) => setForm((prev) => ({ ...prev, career }))}
                    multiIndustry
                    industryLabel="Industries you've worked in — choose all that apply"
                />
                {!careerReady && <p className="report-small">Choose your profession, a job role and at least one industry.</p>}
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
                <button type="submit" className="btn btn-primary" disabled={saving || !careerReady}>{saving ? "Saving…" : submitLabel}</button>
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
