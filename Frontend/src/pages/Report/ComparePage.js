import { useEffect, useMemo, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { getMyReport } from "../../apiCall/reportsApi"
import { getProfessions } from "../../apiCall/professionsApi"
import Navbar from "../Navbar"
import { whyFits } from "./reportPlan"
import { aiExposureText } from "./ProfessionCard"

// Compare careers side by side (owner, 2026-09-29): its own page, reached from the top of the
// report. The student picks 2-3 careers from THEIR OWN list — the ranking plus the worth-the-switch
// careers — and sees them in one table. The selection lives in the URL (?ids=a,b,c) so Back and a
// refresh keep it. No new backend: the same two calls the report already makes.
const MAX = 3

const SUBJECTS = { physics: "Physics", chemistry: "Chemistry", maths: "Maths", biology: "Biology" }
const DEGREE = { none: "No degree needed", certificate: "Certificate or diploma", undergrad: "Bachelor's degree", professional: "Professional degree" }
const DEMAND = { high: "High", moderate: "Moderate", low: "Low", declining: "Declining" }
const AI = { low: "Low", medium: "Medium", high: "High" }
const SELF = { common: "Common", possible_later: "Possible later", rare: "Rare" }

const ROWS = [
    ["What it is", (entry, detail) => detail.oneLiner],
    ["Why it fits you", (entry) => whyFits(entry).strengths.join(", ") || "—"],
    ["Years to qualify", (entry, detail) => (typeof detail.yearsToQualify === "number" ? `About ${detail.yearsToQualify}` : "—")],
    ["Subjects in Class 11–12", (entry, detail) => (detail.class12Prerequisite.includes("any") ? "Any stream" : detail.class12Prerequisite.map((subject) => SUBJECTS[subject] || subject).join(" + "))],
    ["Degree needed", (entry, detail) => DEGREE[detail.degreeDependency] || "—"],
    ["Main exam", (entry, detail) => {
        if (detail.entryGate) {
            return `${detail.entryGate.name}${typeof detail.entryGate.applicantsPerSeat === "number" ? ` — about ${Math.round(detail.entryGate.applicantsPerSeat)} per seat` : ""}`
        }
        return (detail.entranceExams && detail.entranceExams.publicRoutes[0]) || "No entrance exam"
    }],
    ["Deadline", (entry, detail) => (detail.entryWindow && detail.entryWindow.constrainedRoute) || "None"],
    ["Cost to qualify", (entry, detail) => (detail.economics && typeof detail.economics.costOfEntryLakh === "number" ? `About ₹${detail.economics.costOfEntryLakh}L` : "—")],
    ["Starting pay", (entry, detail) => (detail.economics ? `₹${detail.economics.earlyEarningsLpa}L a year` : "—")],
    ["Mid-career pay", (entry, detail) => (detail.economics && detail.economics.midCareerLpa ? `₹${detail.economics.midCareerLpa}L a year${detail.economics.checked ? "" : " (estimate)"}` : "—")],
    ["Demand", (entry, detail) => (detail.demand ? DEMAND[detail.demand.india] || detail.demand.india : "—")],
    ["AI exposure", (entry, detail) => aiExposureText(detail) || (detail.aiExposure ? AI[detail.aiExposure.band] || detail.aiExposure.band : "—")],
    ["How much was measured", (entry) => (typeof entry.measuredPct === "number" ? `Partial · ${entry.measuredPct}%` : "Complete")],
    ["Working for yourself", (entry, detail) => (detail.selfEmployment ? SELF[detail.selfEmployment.likelihood] || "—" : "—")],
    ["Years of what you've done left behind", (entry) => (entry.wastedYears > 0 ? `About ${entry.wastedYears}` : "None")],
    ["Licence", (entry, detail) => detail.licensingBody || "None"],
]

function ComparePage() {
    const [params, setParams] = useSearchParams()
    const [careers, setCareers] = useState(null)       // the student's own list: ranking + worth-the-switch
    const [details, setDetails] = useState({})
    const [error, setError] = useState("")

    useEffect(() => {
        const load = async () => {
            try {
                const response = await getMyReport()
                const data = response.data.data || {}
                const ranked = data.ranked || []
                const seen = new Set(ranked.map((entry) => String(entry.professionId)))
                const extras = (data.worthTheSwitch || []).filter((entry) => !seen.has(String(entry.professionId)))
                const list = [...ranked, ...extras]
                setCareers(list)

                if (list.length > 0) {
                    const detailResponse = await getProfessions(list.map((entry) => entry.professionId))
                    const byId = {}
                    detailResponse.data.data.professions.forEach((profession) => { byId[profession.id] = profession })
                    setDetails(byId)
                }
            } catch (loadError) {
                setError("Could not load your careers")
            }
        }
        load()
    }, [])

    // Default selection: the top three, until the student picks their own.
    const selected = useMemo(() => {
        const fromUrl = (params.get("ids") || "").split(",").filter(Boolean)
        if (fromUrl.length > 0) return fromUrl.slice(0, MAX)
        return (careers || []).slice(0, MAX).map((entry) => String(entry.professionId))
    }, [params, careers])

    const toggle = (id) => {
        const next = selected.includes(id)
            ? selected.filter((item) => item !== id)
            : [...selected, id].slice(-MAX)
        setParams({ ids: next.join(",") }, { replace: true })
    }

    const columns = selected
        .map((id) => (careers || []).find((entry) => String(entry.professionId) === id))
        .filter((entry) => entry && details[entry.professionId])

    return (
        <div className="report-page">
            <Navbar />
            <main className="compare-page">
                <p><Link to="/report">← Back to your report</Link></p>
                <h1>Compare careers</h1>
                <p className="report-small">Pick up to {MAX} careers from your list to see them side by side.</p>

                {error && <p>{error}</p>}
                {!careers && !error && <p>Loading…</p>}

                {careers && careers.length === 0 && (
                    <p>Your report isn't ready yet — your careers appear here once it is.</p>
                )}

                {careers && careers.length > 0 && (
                    <div className="compare-picker">
                        {careers.map((entry) => {
                            const id = String(entry.professionId)
                            return (
                                <button
                                    type="button"
                                    key={id}
                                    className={`filter-option${selected.includes(id) ? " is-on" : ""}`}
                                    aria-pressed={selected.includes(id)}
                                    onClick={() => toggle(id)}
                                >
                                    {entry.profession}
                                    {details[entry.professionId] && details[entry.professionId].blueCollar && <span className="pc-tag">Blue-collar</span>}
                                </button>
                            )
                        })}
                    </div>
                )}

                {columns.length >= 2 && (
                    <div className="table-scroll compare-scroll">
                        <table className="compare-table">
                            <thead>
                                <tr>
                                    <th scope="col"><span className="sr-only">Compare</span></th>
                                    {columns.map((entry) => (
                                        <th scope="col" key={entry.professionId}>
                                            {entry.profession}
                                            {details[entry.professionId].blueCollar && <span className="pc-tag">Blue-collar</span>}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {ROWS.map(([label, value]) => (
                                    <tr key={label}>
                                        <th scope="row">{label}</th>
                                        {columns.map((entry) => (
                                            <td key={entry.professionId}>{value(entry, details[entry.professionId]) || "—"}</td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {careers && careers.length > 0 && columns.length < 2 && (
                    <p className="report-small"><em>Pick at least two careers to compare.</em></p>
                )}
            </main>
        </div>
    )
}

export default ComparePage
