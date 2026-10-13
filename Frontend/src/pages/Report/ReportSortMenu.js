import { useState } from "react"
import { Tooltip } from "antd"
import { PRIMARY_SORTS, SECONDARY_SORTS } from "./reportFilters"

// "SORT YOUR LIST" (owner, Round 29: the Round 27 buttons back, highlighted, each with one line saying
// what opening it does). Closed by default so the list is what a student sees first; inside, every
// option keeps its ⓘ (hover on a laptop, tap on a phone). A "then order by" ignores the tiers — the
// whole list is ordered by it, with the 2+ years group still last under Best match.
export const Info = ({ text }) => (
    <Tooltip title={text} trigger={["hover", "click"]}>
        <span className="info-dot" role="img" tabIndex={0} aria-label={text}>ⓘ</span>
    </Tooltip>
)

function ReportSortMenu({ primary, onPrimary, secondary, onSecondary, showNoCost }) {
    const [open, setOpen] = useState(false)

    const primaries = PRIMARY_SORTS.filter((option) => option.value !== "noCost" || showNoCost)
    const primaryLabel = (primaries.find((option) => option.value === primary) || primaries[0]).label
    const secondaryLabel = secondary ? (SECONDARY_SORTS.find((option) => option.value === secondary) || {}).label : null

    return (
        <div className={`sort-menu is-highlighted${open ? " is-open" : ""}`}>
            <button type="button" className="sort-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
                <span className="sort-burger" aria-hidden="true">☰</span>
                <span>Sort your list</span>
                <span className="sort-current">{primaryLabel}{secondaryLabel ? ` · then ${secondaryLabel.toLowerCase()}` : ""}</span>
            </button>
            {!open && <p className="sort-hint">Choose what comes first, and then what to order by.</p>}

            {open && (
                <div className="sort-panel">
                    <p className="sort-title">Show me</p>
                    <div className="sort-primaries">
                        {primaries.map((option) => (
                            <button
                                type="button"
                                key={option.value}
                                title={option.hint}
                                className={`sort-primary${primary === option.value ? " is-on" : ""}`}
                                aria-pressed={primary === option.value}
                                onClick={() => onPrimary(option.value)}
                            >
                                <strong>{option.label}</strong> <Info text={option.hint} />
                            </button>
                        ))}
                    </div>

                    <p className="sort-title">
                        Then order by <Info text="These order your whole list, across the groups — the best-paid first, say, whatever group it was in. Under Best match, careers that would leave 2+ years behind stay last." />
                    </p>
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
                                title={option.hint}
                                className={`filter-option${secondary === option.value ? " is-on" : ""}`}
                                aria-pressed={secondary === option.value}
                                onClick={() => onSecondary(option.value)}
                            >
                                {option.label} <Info text={option.hint} />
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}

export default ReportSortMenu
