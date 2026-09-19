import { useState } from "react"

function ActivityReferenceList({ activities }) {
    const [isExpanded, setIsExpanded] = useState(false)

    return (
        <div>
            <div>
                <strong>Activity Reference List</strong>{" "}
                <button type="button" onClick={() => setIsExpanded(!isExpanded)}>
                    {isExpanded ? "Hide List" : "Show List"}
                </button>
            </div>
            {isExpanded && (
                <div>
                    <p>Use this list as a reference for activities you might have been involved in:</p>
                    <ul>
                        {activities.map((activity, index) => (
                            <li key={index}>{activity}</li>
                        ))}
                    </ul>
                    <p>Note: This is not an exhaustive list. Feel free to mention any other activities not listed here.</p>
                </div>
            )}
        </div>
    )
}

export default ActivityReferenceList
