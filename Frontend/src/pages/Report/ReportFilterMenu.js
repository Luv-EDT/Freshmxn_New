import { useState } from "react"
import { ONLY_FILTERS } from "./reportFilters"

// THE FILTERS, folded away like the sort (owner, Round 24: "encapsulated just like Sorting — this
// looks clean"). One "Filter your list" button, collapsed by default, saying how many are on. The
// three are unchanged (Rounds 9, 13 and 18): leave out blue-collar careers, core engineering only,
// studying abroad helps — all off until the student turns one on. How many careers they hide is said
// on the page itself, outside this menu, with one tap to undo — a filter must never hide silently.
function ReportFilterMenu({ excludeBlueCollar, onExcludeBlueCollar, only, onToggleOnly }) {
    const [open, setOpen] = useState(false)
    const on = (excludeBlueCollar ? 1 : 0) + only.length

    return (
        <div className={`sort-menu filter-menu${open ? " is-open" : ""}`}>
            <button type="button" className="sort-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
                <span className="sort-burger" aria-hidden="true">☰</span>
                <span>Filter your list</span>
                <span className="sort-current">{on === 0 ? "No filters" : `${on} on`}</span>
            </button>

            {open && (
                <div className="sort-panel">
                    <div className="report-filters">
                        <label className={`blue-collar-toggle${excludeBlueCollar ? " is-on" : ""}`}>
                            <input
                                type="checkbox"
                                checked={excludeBlueCollar}
                                onChange={(event) => onExcludeBlueCollar(event.target.checked)}
                            />
                            <span>Leave out blue-collar careers*</span>
                        </label>
                        {ONLY_FILTERS.map((option) => (
                            <label key={option.value} className={`blue-collar-toggle${only.includes(option.value) ? " is-on" : ""}`}>
                                <input type="checkbox" checked={only.includes(option.value)} onChange={() => onToggleOnly(option.value)} />
                                <span>{option.label}</span>
                            </label>
                        ))}
                    </div>
                    <p className="report-small report-filter-note">* Some of the most AI-proof careers are blue-collar.</p>
                </div>
            )}
        </div>
    )
}

export default ReportFilterMenu
