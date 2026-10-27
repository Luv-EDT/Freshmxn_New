import { useState } from "react"
import { ONLY_FILTERS, SECTORS } from "./reportFilters"
import { Info } from "./ReportSortMenu"

// "FILTER YOUR LIST" (owner, Round 29: the Round 27 button back, highlighted, with one line saying what
// it does). The filters are unchanged — leave out blue-collar careers, core engineering only, for
// studying abroad — all off until the student turns one on. How many careers they hide is said on the
// page itself, outside this menu, with one tap to undo: a filter never hides silently.
// Round 36 (owner): "Filter by professional sectors" opens the 18 sectors, each with how many of this
// student's careers are in it; any picked keep only careers in those sectors (it counts as one filter).
function ReportFilterMenu({ excludeBlueCollar, onExcludeBlueCollar, only, onToggleOnly, sectors = [], onSectors, sectorCounts = {} }) {
    const [open, setOpen] = useState(false)
    const [sectorsOpen, setSectorsOpen] = useState(false)
    const on = (excludeBlueCollar ? 1 : 0) + only.length + (sectors.length > 0 ? 1 : 0)
    const toggleSector = (sector) => onSectors(sectors.includes(sector) ? sectors.filter((value) => value !== sector) : [...sectors, sector])

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
                        <button type="button" className={`blue-collar-toggle sector-toggle${sectors.length ? " is-on" : ""}`} aria-expanded={sectorsOpen} onClick={() => setSectorsOpen(!sectorsOpen)}>
                            <span>Filter by professional sectors</span>
                            <span className="sort-current">{sectors.length ? `${sectors.length} picked` : "All sectors"}</span>
                            <span className="sector-caret" aria-hidden="true">{sectorsOpen ? "▴" : "▾"}</span>
                        </button>
                        {sectorsOpen && (
                            <div className="sector-list" role="group" aria-label="Professional sectors">
                                {SECTORS.map((sector) => (
                                    <label key={sector} className={`sector-option${sectors.includes(sector) ? " is-on" : ""}`}>
                                        <input type="checkbox" checked={sectors.includes(sector)} onChange={() => toggleSector(sector)} />
                                        <span>{sector}</span>
                                        <span className="sector-count">{sectorCounts[sector] || 0}</span>
                                    </label>
                                ))}
                                {sectors.length > 0 && <button type="button" className="link-button" onClick={() => onSectors([])}>Show all sectors</button>}
                            </div>
                        )}
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
