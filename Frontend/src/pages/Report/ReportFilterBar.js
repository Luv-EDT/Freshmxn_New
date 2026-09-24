import { AI_BANDS, DEMAND_LEVELS, PAY_BANDS, PAY_BASIS, EMPTY_FILTERS, SORTS } from "./reportFilters"

// The filter controls. Every option carries a live count of what it would leave, and an option that
// would leave nothing is visibly disabled rather than pressable.
//
// THE COUNTS ARE THE ANTI-FRUSTRATION MECHANISM. "High AI exposure" matches 13 professions out of
// 223, and a student's ranked list is sector-clustered, so it is routinely zero for them. Without a
// count they press it, the page goes flat, and they conclude it is broken. With one, they can see
// before pressing — and it teaches them something true about their list.

const Group = ({ title, options, selected, counts, onToggle, hint }) => (
    <div className="filter-group">
        <p className="filter-title">{title}</p>
        {hint && <p className="filter-hint"><em>{hint}</em></p>}

        <div className="filter-options">
            {options.map((option) => {
                const count = counts ? counts[option.value] : null
                const isOn = selected.includes(option.value)
                const dead = count === 0 && !isOn

                return (
                    <button
                        type="button"
                        key={option.value}
                        onClick={() => !dead && onToggle(option.value)}
                        disabled={dead}
                        title={dead ? "Nothing in your list matches this" : ""}
                        className={`filter-option${isOn ? " is-on" : ""}${dead ? " is-dead" : ""}`}
                    >
                        {option.label}
                        {count !== null && count !== undefined && <span> ({count})</span>}
                    </button>
                )
            })}
        </div>
    </div>
)

function ReportFilterBar({ filters, counts, onChange, sort, onSort, activeCount, total, available }) {
    const toggle = (key, value) => {
        const current = filters[key]
        const next = current.includes(value)
            ? current.filter((item) => item !== value)
            : [...current, value]
        onChange({ ...filters, [key]: next })
    }

    const anyActive = filters.ai.length > 0 || filters.demand.length > 0 || filters.payBands.length > 0 || sort !== "best"

    return (
        <div className="filter-bar">
            {/* SORT FIRST. It is the control most students actually want — "show me the quickest
                ones" is a more natural question than any filter, and it never hides anything. */}
            <div className="filter-group">
                <p className="filter-title">Order by</p>
                <div className="filter-options">
                    {SORTS.map((option) => (
                        <button
                            type="button"
                            key={option.value}
                            onClick={() => onSort(option.value)}
                            className={`filter-option${sort === option.value ? " is-on" : ""}`}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
            </div>

            <p className="filter-summary">
                <strong>Narrow it down</strong> — nothing is removed. What does not match fades, so
                you can always see what you filtered out.
            </p>

            {/* A GROUP WITH NO DATA IS HIDDEN, NOT SHOWN DEAD. Three greyed-out demand buttons at
                (0) read as a broken product; an absent section reads as an attribute we do not have
                for this list, which is the truth. */}
            {available.ai && (
                <Group
                    title="AI exposure"
                    options={AI_BANDS}
                    selected={filters.ai}
                    counts={counts.ai}
                    onToggle={(value) => toggle("ai", value)}
                />
            )}

            {available.demand && (
                <Group
                    title="Demand in India"
                    options={DEMAND_LEVELS}
                    selected={filters.demand}
                    counts={counts.demand}
                    onToggle={(value) => toggle("demand", value)}
                />
            )}

            {available.pay && (
                <div className="filter-group">
                    <p className="filter-title">Pay</p>

                    <div className="filter-options spaced">
                        {PAY_BASIS.map((basis) => (
                            <button
                                type="button"
                                key={basis.value}
                                onClick={() => onChange({ ...filters, payBasis: basis.value })}
                                className={`filter-option${filters.payBasis === basis.value ? " is-on" : ""}`}
                            >
                                {basis.label}
                            </button>
                        ))}
                    </div>

                    <Group
                        title=""
                        options={PAY_BANDS}
                        selected={filters.payBands}
                        counts={counts.pay}
                        onToggle={(value) => toggle("payBands", value)}
                        hint="Pay figures are estimates, and for some careers the average describes almost nobody — those are never faded out."
                    />
                </div>
            )}

            <p className="filter-summary end">
                {anyActive
                    ? <span><strong>{activeCount}</strong> of {total} match — the rest are faded, not gone.</span>
                    : <span>Showing all {total}.</span>}
                {anyActive && (
                    <button
                        type="button"
                        onClick={() => { onChange(EMPTY_FILTERS); onSort("best") }}
                        className="filter-option filter-clear"
                    >
                        Reset
                    </button>
                )}
            </p>
        </div>
    )
}

export default ReportFilterBar
