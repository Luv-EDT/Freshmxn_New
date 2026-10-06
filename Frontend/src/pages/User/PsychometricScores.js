import { useEffect, useState } from "react"
import { getMyScores } from "../../apiCall/reportsApi"

// "Your psychometric profile" on the Profile page (owner, Round 18). Six groups in the owner's order —
// the four fundamentals first and open, then personality, cognitive abilities, areas you feel drawn
// to, uncertainty tolerance and ways you solve problems — each with a one-line meaning, and each
// factor with a plain name, a few words on what it is, its level and "Partial · N%" when only part
// of it was measured.
//
// The server sends WORDS, never the score (GET /reports/getMyScores): V1 has no norms to compare
// against, and most readers are minors. Confidence shows as a word level only. Uncertainty tolerance
// is a position, not a level. Names and meanings come from Backend/utils/factorGuide.js, the same
// table the report uses.
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
        <div className="score-groups">
            <p><em>Based on your own answers — not a comparison with other students. Provisional.</em></p>
            {!scores.coverageKnown && (
                <p className="report-small">
                    To see how much of each one we could measure, open your report and press <strong>Update my report</strong>.
                </p>
            )}

            {scores.groups.map((group, index) => (
                <details key={group.key} className="faq-item score-group" open={index === 0}>
                    <summary>{group.title}</summary>
                    <p className="report-small">{group.meaning}</p>
                    <ul className="score-list">
                        {group.factors.map((factor) => (
                            <li key={factor.slug} className="score-row">
                                <div>
                                    <strong>{factor.name}</strong>
                                    <span className="report-small"> — {factor.meaning}</span>
                                </div>
                                <div className="score-level">
                                    {factor.position !== undefined ? (
                                        <span className="status-chip">{factor.position || "not measured yet"}</span>
                                    ) : (
                                        <span className={`status-chip${factor.level ? " is-done" : ""}`}>{factor.level || "not measured yet"}</span>
                                    )}
                                    {/* Round 10 (owner): how much of this factor was measured, only when it
                                        is less than all of it — a complete factor shows nothing extra */}
                                    {(factor.level || factor.position) && typeof factor.partialPct === "number" && (
                                        <span className="status-chip is-progress score-partial">Partial · {factor.partialPct}%</span>
                                    )}
                                </div>
                            </li>
                        ))}
                    </ul>
                </details>
            ))}
        </div>
    )
}

export default PsychometricScores
