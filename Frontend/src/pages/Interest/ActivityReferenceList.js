// "Stuck?" — a list of everyday activities to jog the memory, folded away until asked for. It sticks
// under the header while the section scrolls (Round 13), so it is there when the memory runs dry.
// Round 36 (owner): a student who attached a résumé sees its activities for this stage first.
function ActivityReferenceList({ activities, fromResume = [] }) {
    return (
        <details className="if-reference">
            <summary className="if-chip-summary">
                <span className="if-q" aria-hidden="true">?</span> Stuck? See a list of activities people often mention
                {fromResume.length > 0 && <span className="if-reference-count"> · {fromResume.length} from your résumé</span>}
            </summary>
            {fromResume.length > 0 && (
                <>
                    <p className="if-reference-note">The activity list includes all activities from your résumé, plus others you can choose.</p>
                    <ul className="if-reference-resume">
                        {fromResume.map((activity) => (
                            <li key={activity}>{activity} <span className="if-resume-tag">from your résumé</span></li>
                        ))}
                    </ul>
                </>
            )}
            <ul>
                {activities.map((activity, index) => (
                    <li key={index}>{activity}</li>
                ))}
            </ul>
            <p>It is not a complete list — anything you did counts.</p>
        </details>
    )
}

export default ActivityReferenceList
