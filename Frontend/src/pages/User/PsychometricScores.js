import { useEffect, useState } from "react"
import { getMyScores } from "../../apiCall/reportsApi"

// "Your psychometric profile" on the Profile page. The server sends levels as words (High / Medium /
// Low) and never the raw score — V1 has no norms to compare against, and most readers are minors.
// Confidence is not shown at all, and uncertainty tolerance is a position, not a level. See
// GET /reports/getMyScores for the reasoning.
function PsychometricScores() {
    const [scores, setScores] = useState(undefined) // undefined = loading, null = none yet
    const [failed, setFailed] = useState(false)

    useEffect(() => {
        const load = async () => {
            try {
                const response = await getMyScores()
                setScores(response.data.data)
            } catch (error) {
                setFailed(true)
            }
        }
        load()
    }, [])

    if (failed) return <p>We couldn't load your scores just now. Please try again later.</p>
    if (scores === undefined) return <p>Loading...</p>
    if (scores === null) return <p>Finish your assessment to see your psychometric profile here.</p>

    return (
        <div>
            <p><em>Based on your own answers — not a comparison with other students. Provisional.</em></p>
            {!scores.coverageKnown && (
                <p className="report-small">
                    To see how much of each one we could measure, open your report and press <strong>Update my report</strong>.
                </p>
            )}

            {scores.groups.map((group) => (
                <div key={group.title}>
                    <h4>{group.title}</h4>
                    <ul>
                        {group.factors.map((factor) => (
                            <li key={factor.slug}>
                                {factor.label} — <strong>{factor.level || "not measured yet"}</strong>
                                {/* Round 10 (owner): how much of this factor was measured, only when it
                                    is less than all of it — a complete factor shows nothing extra */}
                                {factor.level && typeof factor.partialPct === "number" && (
                                    <span className="status-chip is-progress score-partial">Partial · {factor.partialPct}%</span>
                                )}
                            </li>
                        ))}
                    </ul>
                </div>
            ))}

            {scores.uncertainty.position && (
                <div>
                    <h4>How you handle the unknown</h4>
                    <p>
                        Between <em>prefers a clear plan</em> and <em>comfortable not knowing</em>, you're:{" "}
                        <strong>{scores.uncertainty.position}</strong>. Neither end is better — it's about the kind
                        of work that suits you.
                    </p>
                </div>
            )}
        </div>
    )
}

export default PsychometricScores
