import { Tooltip } from "antd"
import { PRIMARY_SORTS, SECONDARY_SORTS, ONLY_FILTERS } from "./reportFilters"

// THE SORTS AND FILTERS, ALWAYS OPEN (owner, Round 28: "not visible enough behind a button"). On a
// laptop they sit in a column on the left of the list; on a phone, open at the top. Every option has
// an ⓘ — hover on a laptop, tap on a phone — saying exactly what it does, and the same words are its
// title. Nothing here hides a career except the filters the student turns on, and the page says how
// many they hid.
const Info = ({ text }) => (
    <Tooltip title={text} trigger={["hover", "click"]}>
        <span className="info-dot" role="img" tabIndex={0} aria-label={text}>ⓘ</span>
    </Tooltip>
)

function ReportControls({ primary, onPrimary, secondary, onSecondary, showNoCost, excludeBlueCollar, onExcludeBlueCollar, only, onToggleOnly }) {
    const primaries = PRIMARY_SORTS.filter((option) => option.value !== "noCost" || showNoCost)

    return (
        <div className="report-controls">
            <p className="sort-title">Order your list</p>
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
                Then order by <Info text="These only reorder careers inside each group of your list — they never move a career above a stronger match." />
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

            <p className="sort-title">Filter</p>
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
    )
}

export default ReportControls
