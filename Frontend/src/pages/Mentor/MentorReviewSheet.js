import { useEffect, useState } from "react"
import { message } from "antd"
import { getMyReviewSheet, saveMyReview } from "../../apiCall/mentorReviewsApi"

// "Check our data for {profession}" (owner, Round 12). An approved mentor reads what students are
// told about their own profession and says, section by section, whether it looks right — and, for
// every quality the work is rated on (the eight that matter most open), whether we have them right. Nothing changes from here:
// our team goes through every answer first.

const SECTION_TITLES = {
    what_it_is: "What it is",
    path: "The path in",
    exams: "Exams",
    where_to_study: "Where to study",
    abroad: "Studying abroad",
    working_abroad: "Working abroad",
    degrees: "Degrees that already count",
    masters: "Master's degree",
    pay: "Pay",
    demand: "Demand in India",
    ai: "How much AI changes this work",
    nuances: "Worth knowing",
}

const MASTERS_WORDS = {
    work_first: "Not needed — people start working after their degree",
    masters_advantage: "Helps later, but not needed to start",
    masters_required: "Needed to practise",
    masters_is_the_entry: "The master's is the usual way in",
}

const ABROAD_WORDS = {
    not_needed: "Not needed — the Indian routes are enough",
    helps: "Helps, but not needed",
    often_needed: "Often part of the route",
}

const PORTABILITY_WORDS = {
    travels_well: "Travels well — the skills are recognised; the hurdles are the visa and the job",
    requalify: "A licence first — each country's own exam or registration comes before work",
    india_based: "India-based — an Indian government role, not a route abroad",
}

const DIRECTION_WORDS = { right: "About right", higher: "Should be higher", lower: "Should be lower" }

const lpa = (value) => (value ? `₹${value}L a year` : "—")

// what students see for each section, in plain text
function SectionBody({ id, value }) {
    if (!value) return <p className="report-small">We have nothing on this yet — tell us if we should.</p>
    if (id === "what_it_is") {
        return (
            <>
                <p>{value.oneLiner}</p>
                {value.jobRoles.length > 0 && <p className="report-small">Job roles: {value.jobRoles.join(", ")}</p>}
            </>
        )
    }
    if (id === "path") {
        return (
            <>
                <ol>{value.steps.map((step) => <li key={step.step}>{step.requirement}</li>)}</ol>
                {typeof value.yearsToQualify === "number" && <p className="report-small">About {value.yearsToQualify} years to qualify</p>}
            </>
        )
    }
    if (id === "exams") {
        if (value.exams.length === 0 && value.other.length === 0) return <p className="report-small">No entrance exam listed.</p>
        return (
            <ul>
                {value.exams.map((exam) => (
                    <li key={exam.name}>{exam.name}{exam.window ? ` — applications usually ${exam.window}` : ""}</li>
                ))}
                {value.other.map((name) => <li key={name}>{name}</li>)}
            </ul>
        )
    }
    if (id === "where_to_study") {
        return (
            <>
                <p className="report-small">{value.discipline}</p>
                <ul>
                    {value.institutions.map((institution) => (
                        <li key={`${institution.name}-${institution.city}`}>
                            {institution.name}{institution.city ? `, ${institution.city}` : ""}{institution.private ? " (private)" : ""} · <span className="report-small">{institution.basis}</span>
                        </li>
                    ))}
                </ul>
            </>
        )
    }
    if (id === "abroad") return <p>{ABROAD_WORDS[value.need] || value.need}{value.why ? ` — ${value.why}` : ""}</p>
    if (id === "working_abroad") {
        return (
            <>
                <p>{PORTABILITY_WORDS[value.portability] || value.portability}{value.note ? `. ${value.note}` : ""}</p>
                {value.countries.length > 0 && (
                    <ul>
                        {value.countries.map((row) => (
                            <li key={row.country}>
                                <strong>{row.country}:</strong> {row.body}{row.exam ? ` — ${row.exam}` : ""}{row.steps ? `. ${row.steps}` : ""}
                                {row.url && <> · <a href={row.url} target="_blank" rel="noreferrer">official page ↗</a></>}
                                {row.draft && <span className="report-small"> (draft — please check)</span>}
                            </li>
                        ))}
                    </ul>
                )}
            </>
        )
    }
    if (id === "degrees") {
        return (
            <>
                <p className="report-small">A student with one of these degrees is not counted as starting again for this career.</p>
                <ul>
                    {value.anyBachelors && <li>Any bachelor's degree</li>}
                    {value.degrees.map((label) => <li key={label}>{label}</li>)}
                </ul>
            </>
        )
    }
    if (id === "masters") return <p>{MASTERS_WORDS[value.afterUndergrad] || "—"}</p>
    if (id === "pay") {
        return <p>Starting {lpa(value.earlyEarningsLpa)} · mid-career {lpa(value.midCareerLpa)} · cost to qualify {value.costOfEntryLakh ? `₹${value.costOfEntryLakh}L` : "—"}</p>
    }
    if (id === "demand") return <p>{value.india}{value.note ? ` — ${value.note}` : ""}</p>
    if (id === "ai") return <p>{value.band}{value.reason ? ` — ${value.reason}` : ""}</p>
    if (id === "nuances") {
        return value.length > 0 ? <ul>{value.map((statement) => <li key={statement}>{statement}</li>)}</ul> : <p className="report-small">Nothing listed.</p>
    }
    return null
}

function MentorReviewSheet() {
    const [sheet, setSheet] = useState(null)
    const [reason, setReason] = useState("")
    const [answers, setAnswers] = useState({})         // section → { verdict, note, sourceUrl }
    const [qualities, setQualities] = useState({})     // factor → { direction, note }
    const [skillsMissing, setSkillsMissing] = useState("")
    const [submittedAt, setSubmittedAt] = useState(null)
    const [progress, setProgress] = useState({ waiting: 0, checked: 0 })
    const [saving, setSaving] = useState(false)

    const fill = (review) => {
        if (!review) return
        const sections = {}
        const quality = {}
        review.items.forEach((item) => {
            if (item.section === "qualities") quality[item.factor] = { direction: item.direction, note: item.note }
            else sections[item.section] = { verdict: item.verdict, note: item.note, sourceUrl: item.sourceUrl }
        })
        setAnswers(sections)
        setQualities(quality)
        setSkillsMissing(review.skillsMissing || "")
        setSubmittedAt(review.submittedAt)
        setProgress({ waiting: review.waiting || 0, checked: review.checked || 0 })
    }

    useEffect(() => {
        const load = async () => {
            const response = await getMyReviewSheet()
            const data = response?.data?.data
            if (!data) return
            setSheet(data.sheet)
            setReason(data.reason || "")
            fill(data.review)
        }
        load()
    }, [])

    if (!sheet) return reason ? <p className="report-small">{reason}</p> : null

    const setSection = (id, field) => (e) => setAnswers((prev) => ({ ...prev, [id]: { ...prev[id], [field]: e.target.value } }))
    const setQuality = (factor, field) => (e) => setQualities((prev) => ({ ...prev, [factor]: { ...prev[factor], [field]: e.target.value } }))

    const renderQuality = (quality) => (
        <div key={quality.factor} className="review-quality">
            <p><strong>{quality.label}</strong> — {quality.level}</p>
            <div className="review-choices">
                {Object.entries(DIRECTION_WORDS).map(([value, label]) => (
                    <label key={value} className="choice">
                        <input type="radio" name={`quality-${quality.factor}`} value={value} checked={qualities[quality.factor]?.direction === value} onChange={setQuality(quality.factor, "direction")} />
                        <span>{label}</span>
                    </label>
                ))}
            </div>
        </div>
    )

    const handleSubmit = async (e) => {
        e.preventDefault()
        setSaving(true)
        const response = await saveMyReview({
            sections: Object.entries(answers).filter(([, answer]) => answer.verdict).map(([section, answer]) => ({ section, ...answer })),
            qualities: Object.entries(qualities).filter(([, answer]) => answer.direction).map(([factor, answer]) => ({ factor, ...answer })),
            skillsMissing,
        })
        setSaving(false)
        if (!response || response.data.success === false) {
            message.error(response?.data?.message || "Could not save your review")
            return
        }
        message.success(response.data.message)
        fill(response.data.data)
    }

    return (
        <details className="faq-item mentor-review">
            <summary>Check our data for {sheet.profession}</summary>
            <p>
                This is what students read about your profession. These details come from our research and AI, and are
                improved with suggestions from mentors like you. Answer the sections you can; skip any you're unsure of.
                Only what you say needs changing goes to our team.
            </p>
            {/* Round 16 (owner): always open to a re-send — the latest answers replace what was still waiting */}
            {submittedAt && (
                <p className="report-small">
                    You sent this on {new Date(submittedAt).toLocaleDateString("en-IN")}. Change anything and send again — it replaces what you sent.
                    {" "}Your suggestions are kept and weighed each month together with other mentors' in your field.
                    {progress.waiting > 0 && ` ${progress.waiting} ${progress.waiting === 1 ? "is" : "are"} waiting for this month's look.`}
                    {progress.checked > 0 && ` ${progress.checked} already weighed — thank you.`}
                </p>
            )}

            <form onSubmit={handleSubmit} className="mentor-form">
                {Object.keys(SECTION_TITLES).map((id) => (
                    <fieldset key={id} className="review-section">
                        <legend>{SECTION_TITLES[id]}</legend>
                        <SectionBody id={id} value={sheet.sections[id]} />
                        <div className="review-choices">
                            {[["right", "Looks right"], ["change", "Needs a change"]].map(([value, label]) => (
                                <label key={value} className="choice">
                                    <input type="radio" name={`section-${id}`} value={value} checked={answers[id]?.verdict === value} onChange={setSection(id, "verdict")} />
                                    <span>{label}</span>
                                </label>
                            ))}
                        </div>
                        {answers[id]?.verdict === "change" && (
                            <>
                                <label>What should it say?</label>
                                <textarea maxLength={600} value={answers[id]?.note || ""} onChange={setSection(id, "note")} required />
                                <label>A link that shows it (if you have one)</label>
                                <input type="url" placeholder="https://" value={answers[id]?.sourceUrl || ""} onChange={setSection(id, "sourceUrl")} />
                            </>
                        )}
                    </fieldset>
                ))}

                <fieldset className="review-section">
                    <legend>Qualities this work needs most</legend>
                    <p className="report-small">How much each one matters in this profession, as we have it today.</p>
                    {sheet.qualities.filter((quality) => quality.main).map(renderQuality)}
                    {/* Round 13 (owner): every quality, not only the top eight — the rest folded away */}
                    {sheet.qualities.some((quality) => !quality.main) && (
                        <details className="review-more">
                            <summary className="tap">The other {sheet.qualities.filter((quality) => !quality.main).length} qualities</summary>
                            {sheet.qualities.filter((quality) => !quality.main).map(renderQuality)}
                        </details>
                    )}
                </fieldset>

                <fieldset className="review-section">
                    <legend>Skills we're missing</legend>
                    <textarea maxLength={600} placeholder="Skills people in this work need that we haven't mentioned" value={skillsMissing} onChange={(e) => setSkillsMissing(e.target.value)} />
                </fieldset>

                <p><button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Sending…" : submittedAt ? "Send again" : "Send my review"}</button></p>
            </form>
        </details>
    )
}

export default MentorReviewSheet
