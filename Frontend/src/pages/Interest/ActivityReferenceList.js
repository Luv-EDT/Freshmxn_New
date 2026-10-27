import { useState } from "react"

// "Stuck?" — a list of everyday activities to jog the memory, folded away until asked for. It sticks
// under the header while the section scrolls (Round 13), so it is there when the memory runs dry.
// Round 36 (owner): a student who attached a résumé sees its activities for this stage first.
// Round 37 (owner): nothing needs typing again — tap an activity and pick the question it answers, or drag it
// onto a question (`targets` = the questions it can go to, `onAdd(key, text)` puts it there). Without
// `targets` the list is for reading only.
export const DRAG_TYPE = "text/plain"

// "Cricket (playing, coaching, or watching)" → "Cricket": the examples in brackets are for reading
export const shortName = (activity) => String(activity).replace(/\s*\([^)]*\)\s*$/, "").trim()

function ActivityReferenceList({ activities, fromResume = [], targets = null, onAdd = null }) {
    const [picking, setPicking] = useState(null)   // the activity whose "add to" choices are open
    const [added, setAdded] = useState("")
    const canAdd = Boolean(targets && targets.length && onAdd)

    const addTo = (key, title) => {
        onAdd(key, picking)
        setAdded(`Added “${picking}” to “${title}”`)
        setPicking(null)
    }

    const item = (activity, fromCv, index) => {
        const text = fromCv ? activity : shortName(activity)
        if (!canAdd) return <li key={`${fromCv}-${index}`}>{activity}{fromCv && <span className="if-resume-tag">from your résumé</span>}</li>
        return (
            <li key={`${fromCv}-${index}`}>
                <button
                    type="button"
                    className={`if-ref-item${picking === text ? " is-on" : ""}`}
                    draggable="true"
                    onDragStart={(event) => event.dataTransfer.setData(DRAG_TYPE, text)}
                    onClick={() => { setAdded(""); setPicking(picking === text ? null : text) }}
                    aria-expanded={picking === text}
                >
                    <span aria-hidden="true">+ </span>{activity}
                    {fromCv && <span className="if-resume-tag">from your résumé</span>}
                </button>
            </li>
        )
    }

    return (
        <details className="if-reference">
            <summary className="if-chip-summary">
                <span className="if-q" aria-hidden="true">?</span> Stuck? See a list of activities people often mention
                {fromResume.length > 0 && <span className="if-reference-count"> · {fromResume.length} from your résumé</span>}
            </summary>
            {canAdd && <p className="if-reference-how">Tap an activity to add it to a question — or drag it onto one.</p>}
            {picking && (
                <div className="if-ref-picker" role="group" aria-label={`Add ${picking} to`}>
                    <p>Add <strong>{picking}</strong> to:</p>
                    {targets.map((target) => (
                        <button type="button" key={target.key} className="if-ref-target" onClick={() => addTo(target.key, target.title)}>{target.title}</button>
                    ))}
                    <button type="button" className="if-link-button" onClick={() => setPicking(null)}>Cancel</button>
                </div>
            )}
            {added && <p className="if-ref-added" role="status">{added} ✓</p>}
            {fromResume.length > 0 && (
                <>
                    <p className="if-reference-note">The activity list includes all activities from your résumé, plus others you can choose.</p>
                    <ul className="if-reference-resume">
                        {fromResume.map((activity, index) => item(activity, true, index))}
                    </ul>
                </>
            )}
            <ul>
                {activities.map((activity, index) => item(activity, false, index))}
            </ul>
            <p>It is not a complete list — anything you did counts.</p>
        </details>
    )
}

export default ActivityReferenceList
