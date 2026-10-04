import { useState } from "react"
import { PRIMARY_SORTS, SECONDARY_SORTS, SHOW_FIRST } from "./reportFilters"

// The report's only control (owner, Round 6): one "Sort your list" button, collapsed by default,
// so the list — not the controls — is what a student sees first. Two primary orders are
// highlighted; a secondary "then order by" is optional; "Show first" moves core engineering up.
// The one filter, "Leave out blue-collar careers", sits beside this menu on the page (Round 13).
function ReportSortMenu({ primary, onPrimary, secondary, onSecondary, noCostHint, showFirst, onShowFirst }) {
    const [open, setOpen] = useState(false)

    const primaries = PRIMARY_SORTS
        .filter((option) => option.value !== "noCost" || noCostHint)
        .map((option) => (option.value === "noCost" ? { ...option, hint: noCostHint } : option))

    const primaryLabel = (primaries.find((option) => option.value === primary) || primaries[0]).label
    const secondaryLabel = secondary ? (SECONDARY_SORTS.find((option) => option.value === secondary) || {}).label : null

    return (
        <div className={`sort-menu${open ? " is-open" : ""}`}>
            <button type="button" className="sort-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
                <span className="sort-burger" aria-hidden="true">☰</span>
                <span>Sort your list</span>
                <span className="sort-current">
                    {primaryLabel}{secondaryLabel ? ` · then ${secondaryLabel.toLowerCase()}` : ""}
                    {showFirst ? " · engineering first" : ""}
                </span>
            </button>

            {open && (
                <div className="sort-panel">
                    <p className="sort-title">Show me</p>
                    <div className="sort-primaries">
                        {primaries.map((option) => (
                            <button
                                type="button"
                                key={option.value}
                                className={`sort-primary${primary === option.value ? " is-on" : ""}`}
                                aria-pressed={primary === option.value}
                                onClick={() => onPrimary(option.value)}
                            >
                                <strong>{option.label}</strong>
                                {option.hint && <span>{option.hint}</span>}
                            </button>
                        ))}
                    </div>

                    <p className="sort-title">Then order by <span className="sort-note">(if you like)</span></p>
                    <div className="sort-secondaries">
                        <button
                            type="button"
                            className={`filter-option${!secondary ? " is-on" : ""}`}
                            aria-pressed={!secondary}
                            onClick={() => onSecondary(null)}
                        >
                            Nothing else
                        </button>
                        {SECONDARY_SORTS.map((option) => (
                            <button
                                type="button"
                                key={option.value}
                                className={`filter-option${secondary === option.value ? " is-on" : ""}`}
                                aria-pressed={secondary === option.value}
                                onClick={() => onSecondary(option.value)}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>

                    <p className="sort-title">Show first <span className="sort-note">(if you like)</span></p>
                    <div className="sort-secondaries">
                        {SHOW_FIRST.map((option) => (
                            <button
                                type="button"
                                key={option.value}
                                className={`filter-option${showFirst === option.value ? " is-on" : ""}`}
                                aria-pressed={showFirst === option.value}
                                title={option.hint}
                                onClick={() => onShowFirst(showFirst === option.value ? null : option.value)}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}

export default ReportSortMenu
