import { useEffect, useState } from "react"
import { ACADEMIC_OPTIONS } from "../Interest/BackgroundInfo"
import { getProfessionOptions } from "../../apiCall/professionsApi"
import CareerRolePicker, { pickerComplete } from "../CareerRolePicker"

// The mentor onboarding form (PRD §B.9 / Master Plan §6.4; Round 34 adds where they live and how we pay
// them; Round 35, owner: the Calendly links moved to the test). Used for the first
// submission and for later edits — `initial` is the saved profile when editing.
// Where they live and how we pay them are ADMIN-ONLY: never shown to a student, used for payouts.
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
        // Round 34 (owner): where they live sets their pay; how we pay them; the links students book from
        region: initial?.region || "",
        payout: {
            upiId: initial?.payout?.upiId || "",
            accountName: initial?.payout?.accountName || "",
            accountNumber: initial?.payout?.accountNumber || "",
            ifsc: initial?.payout?.ifsc || "",
            pan: initial?.payout?.pan || "",
            intlMethod: initial?.payout?.intlMethod || "",
        },
    })
    const regionLocked = Boolean(initial && initial.status === "onboarded" && initial.region)
    const updatePayout = (field) => (e) => setForm((prev) => ({ ...prev, payout: { ...prev.payout, [field]: e.target.value } }))
    const [saving, setSaving] = useState(false)

    const update = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }))
    const careerReady = pickerComplete(form.career) && (form.career.industryCodes || []).length > 0
    const [showMissing, setShowMissing] = useState(false)

    // what still stops Save, in words — a greyed-out button with no reason was the owner's report
    const missing = [
        !form.career.professionId && "your profession",
        form.career.professionId && !pickerComplete(form.career) && "your job role",
        (form.career.industryCodes || []).length === 0 && "at least one industry",
    ].filter(Boolean)

    // A profile saved before Round 12 holds a free-text role. Where it names one of our professions or
    // job roles exactly, the picker starts on it rather than empty (Round 13).
    useEffect(() => {
        if (!initial || initial.professionId || !(initial.currentRole || initial.discipline)) return
        const said = [initial.currentRole, initial.discipline].filter(Boolean).map((text) => text.trim().toLowerCase())
        getProfessionOptions().then((response) => {
            const { professions = [], industries = [] } = response.data.data || {}
            const role = professions.map((row) => ({ row, name: row.jobRoles.find((name) => said.includes(name.toLowerCase())) })).find((hit) => hit.name)
            const byName = professions.find((row) => said.includes(row.profession.toLowerCase()))
            const hit = role ? role.row : byName
            const sectors = (initial.sectors || []).map((text) => String(text).trim().toLowerCase())
            const industryCodes = industries.filter((industry) => sectors.includes(industry.name.toLowerCase()) || sectors.includes(String(industry.code).toLowerCase())).map((industry) => industry.code)
            if (!hit && industryCodes.length === 0) return
            setForm((prev) => ({
                ...prev,
                career: {
                    ...prev.career,
                    ...(hit && !prev.career.professionId ? { professionId: hit.id, profession: hit.profession, jobRole: role ? role.name : undefined } : {}),
                    industryCodes: prev.career.industryCodes && prev.career.industryCodes.length > 0 ? prev.career.industryCodes : industryCodes,
                },
            }))
        }).catch(() => null)
    }, [initial])

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!careerReady) {
            setShowMissing(true)
            return
        }
        setSaving(true)
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
                {!careerReady && <p className="report-small">Choose {missing.join(", ")}.</p>}
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

            {/* Round 34 (owner): India or abroad — an Indian living abroad is an International mentor */}
            <fieldset>
                <legend>11. Where do you live?</legend>
                {[["indian", "In India"], ["international", "Abroad (an Indian living abroad)"]].map(([value, label]) => (
                    <label key={value} className="choice">
                        <input type="radio" name="region" value={value} checked={form.region === value} onChange={update("region")} disabled={regionLocked} required />
                        <span>{label}</span>
                    </label>
                ))}
                <p className="report-small">
                    This sets your payment rates (Indian or International).{regionLocked ? " To change it now, message us on WhatsApp." : ""}
                </p>
            </fieldset>
            <div>
                <label>12. Country you live in</label>
                <br />
                <input value={form.residenceCitizenship} onChange={update("residenceCitizenship")} required />
            </div>

            <fieldset className="mentor-payout">
                <legend>13. How should we pay you? <span className="report-small">Only our team sees this.</span></legend>
                {form.region !== "international" ? (
                    <>
                        <label>UPI ID</label>
                        <input placeholder="name@okbank" value={form.payout.upiId} onChange={updatePayout("upiId")} />
                        <p className="report-small">Or a bank account:</p>
                    </>
                ) : (
                    <>
                        <label>How we can pay you — an Indian NRE/NRO account (below), or Wise / PayPal (email)</label>
                        <input placeholder="e.g. Wise: me@example.com" value={form.payout.intlMethod} onChange={updatePayout("intlMethod")} />
                    </>
                )}
                <label>Account holder's name</label>
                <input value={form.payout.accountName} onChange={updatePayout("accountName")} />
                <label>Account number</label>
                <input inputMode="numeric" value={form.payout.accountNumber} onChange={updatePayout("accountNumber")} />
                <label>IFSC</label>
                <input placeholder="HDFC0001234" value={form.payout.ifsc} onChange={updatePayout("ifsc")} />
                <label>PAN (for tax)</label>
                <input placeholder="ABCDE1234F" value={form.payout.pan} onChange={updatePayout("pan")} />
            </fieldset>

            {/* Round 35 (owner): the Calendly links are asked in the test, not here */}

            {showMissing && !careerReady && (
                <p className="form-missing" role="alert">To save, choose {missing.join(", ")} in questions 4–6 above.</p>
            )}
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
