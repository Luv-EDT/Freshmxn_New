// "Stuck?" — a list of everyday activities to jog the memory, folded away until asked for. It sticks
// under the header while the section scrolls (Round 13), so it is there when the memory runs dry.
function ActivityReferenceList({ activities }) {
    return (
        <details className="if-reference">
            <summary className="if-chip-summary"><span className="if-q" aria-hidden="true">?</span> Stuck? See a list of activities people often mention</summary>
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
