import { whyFits } from "./reportPlan"

// "Careers that combine two of yours" (owner, Round 10) — beside the ranking, never in it. Each one
// joins two areas the student's own activities led to (Backend/matching/combined.js): Wildlife
// Photographer when photography and nature both showed up, Sports Nutritionist for nutrition and
// sport. Hand-checked careers, never invented per student.
//
// The tags travel as they do on every other card: Blue-collar from the reviewed list, Core
// engineering when either side's career is core engineering — and "Show first: core engineering"
// moves those to the top here too.
function CombinedCareers({ combined, details, showFirst }) {
    if (!Array.isArray(combined) || combined.length === 0) return null

    const isCore = (career) => (career.parentIds || []).some((id) => details[id] && details[id].coreEngineering)
    const ordered = showFirst === "coreEngineering"
        ? [...combined.filter(isCore), ...combined.filter((career) => !isCore(career))]
        : combined

    return (
        <section className="combined-careers">
            <h2>Careers that combine two of yours</h2>
            <p className="report-small">
                Some careers sit between two fields. These join two areas your own activities led to.
            </p>
            {ordered.map((career) => {
                const strengths = whyFits(career).strengths
                return (
                    <details key={career.combinedId} className="profession-card combined-card">
                        <summary className="pc-toggle">
                            <span className="pc-name">
                                {career.profession}
                                {career.blueCollar && <span className="pc-tag">Blue-collar</span>}
                                {isCore(career) && <span className="pc-tag">Core engineering</span>}
                            </span>
                            <span className="pc-sign" aria-hidden="true" />
                        </summary>
                        <div className="pc-body">
                            <p className="pc-oneliner">{career.oneLiner}</p>
                            <p className="pc-line">
                                It joins <strong>{career.sideA.label}</strong> (from <em>{career.sideA.via}</em> in your list) and{" "}
                                <strong>{career.sideB.label}</strong> (from <em>{career.sideB.via}</em>).
                            </p>
                            {strengths.length > 0 && (
                                <p className="pc-line">It uses what you're strongest at: <strong>{strengths.join(", ")}</strong>.</p>
                            )}
                            <p className="pc-line"><strong>How people get there:</strong> {career.howToGetThere}</p>
                            <p className="pc-small">Open {career.sideA.via} and {career.sideB.via} in your list for pay, demand and the road into each.</p>
                        </div>
                    </details>
                )
            })}
        </section>
    )
}

export default CombinedCareers
