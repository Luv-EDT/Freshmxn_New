import { useState } from "react"
import { ONLY_FILTERS } from "./reportFilters"
import { Info } from "./ReportSortMenu"

// "FILTER YOUR LIST" (owner, Round 29: the Round 27 button back, highlighted, with one line saying what
// it does). The filters are unchanged — leave out blue-collar careers, core engineering only, for
// studying abroad — all off until the student turns one on. How many careers they hide is said on the
// page itself, outside this menu, with one tap to undo: a filter never hides silently.
function ReportFilterMenu({ excludeBlueCollar, onExcludeBlueCollar, only, onToggleOnly }) {
    const [open, setOpen] = useState(false)
    const on = (excludeBlueCollar ? 1 : 0) + only.length

    return (
        <div className={`sort-menu filter-menu is-highlighted${open ? " is-open" : ""}`}>
            <button type="button" className="sort-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
                <span className="sort-burger" aria-hidden="true">☰</span>
                <span>Filter your list</span>
                <span className="sort-current">{on === 0 ? "No filters" : `${on} on`}</span>
            </button>
            {!open && <p className="sort-hint">Hide careers you don't want to see — nothing is lost, and you can undo it any time.</p>}

            {open && (
                <div className="sort-panel">
                    <div className="report-filters">
                        <label className={`blue-collar-toggle${excludeBlueCollar ? " is-on" : ""}`}>
                            <input type="checkbox" checked={excludeBlueCollar} onChange={(event) => onExcludeBlueCollar(event.target.checked)} />
                            <span>Leave out blue-collar careers*</span>
                        </label>
                        {ONLY_FILTERS.map((option) => (
                            <label key={option.value} className={`blue-collar-toggle${only.includes(option.value) ? " is-on" : ""}`}>
                                <input type="checkbox" checked={only.includes(option.value)} onChange={() => onToggleOnly(option.value)} />
                                <span>{option.label}</span> <Info text={option.hint} />
                            </label>
                        ))}
                    </div>
                    {/* what "blue-collar" means, right where the word is used (owner, Round 28) */}
                    <p className="report-small report-filter-note">
                        * Blue-collar careers are hands-on, skilled work that doesn't need a degree — electricians, mechanics,
                        farmers, beauticians and more. Some of the most AI-proof careers are blue-collar.
                    </p>
                </div>
            )}
        </div>
    )
}

export default ReportFilterMenu
