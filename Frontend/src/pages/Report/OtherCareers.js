import { listOf } from "./reportFraming"

// SOME OTHER CAREERS YOU CAN CONSIDER (owner, Round 29). Your list holds the careers your activities
// and the careers you named pointed to. These are careers nothing pointed to, but which fit how you
// think and work — best fit first, behind one button so they never crowd the list. Never ranked, so
// no tier and no rank number; the strengths named are the ones the work leans on most.
function OtherCareers({ careers }) {
    if (!careers || careers.length === 0) return null

    return (
        <details className="report-details other-careers">
            <summary className="report-summary">
                <strong>Some other careers you can consider</strong> ({careers.length})
            </summary>
            <p className="report-small">
                Nothing you told us pointed to these, but they fit how you think and work. If one catches your
                eye, tell us about it — what you do and love decides where a career sits in your list.
            </p>
            <ul className="other-careers-list">
                {careers.map((entry) => (
                    <li key={entry.professionId}>
                        <strong>{entry.profession}</strong>
                        {entry.supportingFactors && entry.supportingFactors.length > 0 && (
                            <span className="report-small"> — uses your {listOf(entry.supportingFactors.map((factor) => factor.factor.toLowerCase()))}</span>
                        )}
                        {entry.wastedYears > 0 && (
                            <span className="report-small"> · about {entry.wastedYears} {entry.wastedYears === 1 ? "year" : "years"} of what you've done would be left behind</span>
                        )}
                    </li>
                ))}
            </ul>
        </details>
    )
}

export default OtherCareers
