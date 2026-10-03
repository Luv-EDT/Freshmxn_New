// "Stuck?" — a list of everyday activities to jog the memory, folded away until asked for.
function ActivityReferenceList({ activities }) {
    return (
        <details className="if-examples if-reference">
            <summary>Stuck? See a list of activities people often mention</summary>
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
