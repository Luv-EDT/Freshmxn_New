import { useEffect, useMemo, useState } from "react"
import { getProfessionOptions } from "../apiCall/professionsApi"

// PICK A CAREER, THEN A JOB ROLE, FROM OUR LIST (Round 12) — shared by the Mentor Only student's
// mentor choice and the mentor's own profile form.
//
//   search        a profession or a job title ("UX", "chip design")
//   job role      the chosen career's job roles, or "Something else" with the person's own words
//   industry      one from our list (multi for mentors), if they have one in mind
//   not listed    allowAnyCareer only: a free description we act on by hand
//
// It reports every change to the parent as one value, so the parent owns what gets sent.
function CareerRolePicker({ value, onChange, multiIndustry = false, allowAnyCareer = false, industryLabel = "Industry, if you have one in mind" }) {
    const [options, setOptions] = useState({ professions: [], industries: [] })
    const [query, setQuery] = useState("")

    useEffect(() => {
        getProfessionOptions()
            .then((response) => setOptions(response.data.data))
            .catch(() => setOptions({ professions: [], industries: [] }))
    }, [])

    const current = value || {}
    const set = (patch) => onChange({ ...current, ...patch })
    const profession = options.professions.find((row) => row.id === current.professionId) || null

    const matches = useMemo(() => {
        const text = query.trim().toLowerCase()
        if (text.length < 2) return []
        return options.professions
            .map((row) => {
                const role = row.jobRoles.find((name) => name.toLowerCase().includes(text))
                const score = row.profession.toLowerCase().startsWith(text) ? 3 : row.profession.toLowerCase().includes(text) ? 2 : role ? 1 : 0
                return { row, role, score }
            })
            .filter((entry) => entry.score > 0)
            .sort((left, right) => right.score - left.score || left.row.profession.localeCompare(right.row.profession))
            .slice(0, 12)
    }, [query, options.professions])

    if (current.other !== undefined && current.other !== null && allowAnyCareer) {
        return (
            <div className="career-picker">
                <label htmlFor="career-other">Tell us the career or role you want a mentor in</label>
                <textarea id="career-other" rows={3} maxLength={300} value={current.other} onChange={(event) => set({ other: event.target.value })} />
                <p className="report-small">We'll look for this mentor ourselves, outside our list.</p>
                <button type="button" className="tap" onClick={() => onChange({})}>Back to the list</button>
            </div>
        )
    }

    return (
        <div className="career-picker">
            {!profession && (
                <>
                    <label htmlFor="career-search">Search for a career or a job title</label>
                    <input id="career-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="e.g. UX, architect, chip design" autoComplete="off" />
                    {matches.length > 0 && (
                        <ul className="career-picker-results">
                            {matches.map(({ row, role }) => (
                                <li key={row.id}>
                                    <button type="button" className="tap" onClick={() => { set({ professionId: row.id, profession: row.profession, jobRole: role || null, jobRoleOther: "" }); setQuery("") }}>
                                        <strong>{row.profession}</strong>{role ? <span className="report-small"> — {role}</span> : null}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                    {query.trim().length >= 2 && matches.length === 0 && <p className="report-small">Nothing in our list matches that.</p>}
                    {allowAnyCareer && (
                        <p><button type="button" className="tap" onClick={() => onChange({ other: "" })}>My career isn't in this list</button></p>
                    )}
                </>
            )}

            {profession && (
                <>
                    <p>
                        Career: <strong>{profession.profession}</strong>{" "}
                        <button type="button" className="tap" onClick={() => onChange({ industryCode: current.industryCode, industryCodes: current.industryCodes })}>Change</button>
                    </p>
                    <fieldset className="career-picker-roles">
                        <legend>Job role</legend>
                        {profession.jobRoles.map((role) => (
                            <label key={role} className="choice">
                                <input type="radio" name="careerRole" checked={current.jobRole === role} onChange={() => set({ jobRole: role, jobRoleOther: "" })} />
                                <span>{role}</span>
                            </label>
                        ))}
                        <label className="choice">
                            <input type="radio" name="careerRole" checked={current.jobRole === "other"} onChange={() => set({ jobRole: "other" })} />
                            <span>Something else in this career</span>
                        </label>
                        {current.jobRole === "other" && (
                            <input aria-label="Your job role" maxLength={120} value={current.jobRoleOther || ""} onChange={(event) => set({ jobRoleOther: event.target.value })} placeholder="The role, in your words" />
                        )}
                    </fieldset>
                </>
            )}

            {multiIndustry ? <p className="mentor-form-label">{industryLabel}</p> : <label htmlFor="career-industry">{industryLabel}</label>}
            {multiIndustry ? (
                // tick boxes, not a multi-select: "hold Ctrl" means nothing on a phone
                <details className="career-picker-industries" id="career-industry">
                    <summary className="tap">
                        {(current.industryCodes || []).length > 0
                            ? options.industries.filter((row) => (current.industryCodes || []).includes(row.code)).map((row) => row.name).join(", ")
                            : "Choose industries"}
                    </summary>
                    <div className="career-picker-roles">
                        {options.industries.map((row) => (
                            <label key={row.code} className="choice">
                                <input
                                    type="checkbox"
                                    value={row.code}
                                    checked={(current.industryCodes || []).includes(row.code)}
                                    onChange={(event) => set({
                                        industryCodes: event.target.checked
                                            ? [...(current.industryCodes || []), row.code]
                                            : (current.industryCodes || []).filter((code) => code !== row.code),
                                    })}
                                />
                                <span>{row.name}</span>
                            </label>
                        ))}
                    </div>
                </details>
            ) : (
                <select id="career-industry" value={current.industryCode || ""} onChange={(event) => set({ industryCode: event.target.value || null })}>
                    <option value="">No particular industry</option>
                    {options.industries.map((row) => <option key={row.code} value={row.code}>{row.name}</option>)}
                </select>
            )}
        </div>
    )
}

// ready to send? a listed career with a role (or the person's own words for one), or a free description
export const pickerComplete = (value) => {
    if (!value) return false
    if (typeof value.other === "string") return value.other.trim().length >= 3
    if (!value.professionId || !value.jobRole) return false
    return value.jobRole !== "other" || (value.jobRoleOther || "").trim().length >= 2
}

// how the choice reads back to the person
export const pickerSummary = (value) => {
    if (!value) return ""
    if (typeof value.other === "string") return value.other.trim()
    const role = value.jobRole === "other" ? (value.jobRoleOther || "").trim() : value.jobRole
    return `${role} (${value.profession})`
}

export default CareerRolePicker
