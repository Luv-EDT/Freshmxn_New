import { useState } from "react"
import { PRIMARY_SORTS, SECONDARY_SORTS, SHOW_FIRST } from "./reportFilters"

// The report's only control (owner, Round 6): one "Sort your list" button, collapsed by default,
// so the list — not the controls — is what a student sees first. Two primary orders are
// highlighted; a secondary "then order by" is optional; "Show first" moves core engineering up.
// The ONE filter is "Leave out blue-collar careers" (owner, 2026-09-30), off by default, and the
// page says how many it hid.
function ReportSortMenu({ primary, onPrimary, secondary, onSecondary, noCostHint, showFirst, onShowFirst, excludeBlueCollar, onExcludeBlueCollar }) {
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
                    {excludeBlueCollar ? " · no blue-collar" : ""}
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

                    <label className="sort-filter">
                        <input
                            type="checkbox"
                            checked={excludeBlueCollar}
                            onChange={(event) => onExcludeBlueCollar(event.target.checked)}
                        />
                        <span>
                            Leave out blue-collar careers
                            <br />
                            <span className="sort-note">Some of the most AI-proof careers are blue-collar, so this hides good options.</span>
                        </span>
                    </label>
                </div>
            )}
        </div>
    )
}

export default ReportSortMenu
