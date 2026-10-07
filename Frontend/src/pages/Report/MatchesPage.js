import { useState, useMemo, useEffect } from "react"
import { Link, useLocation } from "react-router-dom"
import Navbar from "../Navbar"
import BackToDashboard from "../BackToDashboard"
import ProfessionCard from "./ProfessionCard"
import ReportSortMenu from "./ReportSortMenu"
import CombinedCareers from "./CombinedCareers"
import ReportStatus from "./ReportStatus"
import useReportData from "./useReportData"
import { groupList, ONLY_FILTERS, SWITCH_COST_GROUP_YEARS } from "./reportFilters"
import { abroadLines } from "./reportPlan"
import { TOP_SHOWN, tierNameFor, framingFor, listOf } from "./reportFraming"

// "YOUR MATCHES" — the whole list on its own page (owner, Round 19, /report/matches). The report
// itself is a short overview with the top three; this page holds every match with the sort, the
// filters, how the list is ordered, the studying- and working-abroad lines and the combined careers.
//
// ONE LIST, TWO ORDERS (owner, Round 20). The top three show first; opening the rest shows the tiers
// as headed groups. "Best match" puts careers that would cost 2+ years to switch in a last group of
// their own, least affected first; "Best fit, ignoring switching cost" leaves them in their tiers.
//
// match_confidence is already stripped by reportsRouter, and every factor slug is already
// translated there. Nothing here needs to know either exists.
function MatchesPage() {
    const report = useReportData()
    const { state, ranked, details, detailsLoaded } = report
    const { hash } = useLocation()
    const [primary, setPrimary] = useState("best")
    const [secondary, setSecondary] = useState(null)
    // THE FILTERS (owner, Rounds 9 and 18), all off by default, each labelled, each saying how many it
    // hid: leave out blue-collar careers; keep only core engineering; keep only careers where
    // studying abroad helps.
    const [excludeBlueCollar, setExcludeBlueCollar] = useState(false)
    const [only, setOnly] = useState([])
    // TOP THREE FIRST (owner, Rounds 13 and 18): the first three of whatever order is chosen, the rest
    // one tap away. Opening the rest belongs to that order — a new sort or filter starts again at three.
    const [showAllFor, setShowAllFor] = useState(null)

    // THE LIST THE STUDENT SEES — see groupList in reportFilters.js. Only the filters the student
    // turned on ever hide a career. `ordered` is the same entries, flat, so rank numbers run on
    // across the groups.
    const groups = useMemo(
        () => groupList(ranked, primary, secondary, details, { only, excludeBlueCollar }),
        [ranked, primary, secondary, details, only, excludeBlueCollar]
    )
    const ordered = useMemo(() => groups.flatMap((group) => group.entries), [groups])

    const sortKey = [primary, secondary, only.join("+"), excludeBlueCollar].join("|")

    // How many the filters hid, so the page can say so — a filter that hides silently is the thing
    // this report was rebuilt to avoid.
    const hiddenCount = useMemo(() => {
        if (!excludeBlueCollar && only.length === 0) return 0
        return (ranked || []).length - ordered.length
    }, [excludeBlueCollar, only, ranked, ordered])
    const toggleOnly = (key) => setOnly((current) => (current.includes(key) ? current.filter((value) => value !== key) : [...current, key]))

    // The engine's top three keep their colours under every order, so "my best matches" never
    // gets lost when a student sorts by pay.
    const topIds = useMemo(() => (ranked || []).slice(0, 3).map((entry) => String(entry.professionId)), [ranked])


    const abroad = useMemo(() => abroadLines(ranked, details), [ranked, details])

    // /report/matches#combined opens on the combined careers, once they are on the page
    const ready = Boolean(state.data && state.data.status === "ready")
    useEffect(() => {
        if (!ready || !hash) return
        const target = document.getElementById(hash.slice(1))
        if (target) target.scrollIntoView()
    }, [ready, hash])

    // one card, numbered by its place in the whole list (the numbers run on across the groups)
    const card = (entry) => (
        <ProfessionCard
            key={entry.professionId}
            entry={entry}
            detail={details[entry.professionId]}
            detailsLoaded={detailsLoaded}
            journey={state.data && state.data.journey}
            topRank={topIds.indexOf(String(entry.professionId)) + 1}
            rank={ordered.indexOf(entry) + 1}
            switchCost={entry.wastedYears || 0}
            showAi={secondary === "ai"}
            degreeLabel={(state.data && state.data.degree) || null}
            abroadPlans={(state.data && state.data.abroadPlans) || null}
        />
    )

    const gate = <ReportStatus state={state} retry={report.retry} retrying={report.retrying} />
    if (state.loading || state.error || !ready || state.data.release === "withhold") return gate

    const data = state.data
    const { journey } = data
    const framing = framingFor(journey)

    return (
        <div className="report-page">
            <Navbar />
            <BackToDashboard />

            <p className="report-back"><Link to="/report">← Your report</Link></p>
            <div className="report-matches-head">
                <h1>Your matches</h1>
                {/* Its own page (owner): the student picks 2-3 careers and sees them side by side. */}
                <Link to="/report/compare" className="btn btn-ghost btn-sm tap">Compare careers →</Link>
            </div>
            {framing.runwayNote && <p><em>{framing.runwayNote}</em></p>}

            <p className="report-small"><em>Tap any career to see what it is, how you get there, and what it pays.</em></p>

            {/* STUDYING AND WORKING ABROAD ACROSS YOUR MATCHES (owner, Round 19) — replaces the
                report-level "A master's abroad" card; each line shows only when it names something */}
            {(abroad.study.length > 0 || abroad.work.length > 0) && (
                <div className="report-abroad">
                    {abroad.study.length > 0 && (
                        <p className="report-small"><strong>Good prospects for studying abroad:</strong> {listOf(abroad.study)}.</p>
                    )}
                    {abroad.work.length > 0 && (
                        <p className="report-small"><strong>Good chances of working abroad:</strong> {listOf(abroad.work)}.</p>
                    )}
                </div>
            )}

            <ReportSortMenu
                primary={primary}
                onPrimary={setPrimary}
                secondary={secondary}
                onSecondary={setSecondary}
                noCostHint={framing.switchIsDistinct ? framing.switchIntro : null}
            />

            {primary === "noCost" && (
                <p className="report-small report-switch-note">
                    Every career stays in its group, ordered by how well it fits you — nothing is moved for what
                    switching would cost you. The years it would cost are still inside each card.
                </p>
            )}

            {/* THE FILTERS sit in plain sight beside the sort, not inside it (Rounds 13 and 18) */}
            <div className="report-filters">
                <label className={`blue-collar-toggle${excludeBlueCollar ? " is-on" : ""}`}>
                    <input
                        type="checkbox"
                        checked={excludeBlueCollar}
                        onChange={(event) => setExcludeBlueCollar(event.target.checked)}
                    />
                    <span>Leave out blue-collar careers*</span>
                </label>
                {ONLY_FILTERS.map((option) => (
                    <label key={option.value} className={`blue-collar-toggle${only.includes(option.value) ? " is-on" : ""}`}>
                        <input type="checkbox" checked={only.includes(option.value)} onChange={() => toggleOnly(option.value)} />
                        <span>{option.label}</span>
                    </label>
                ))}
            </div>
            <p className="report-small report-filter-note">* Some of the most AI-proof careers are blue-collar.</p>

            {/* THE RANKING EXPLAINS ITSELF, in one place. A student who cannot see why one career
                sits above another has been handed an opinion with a number on it. */}
            <details className="report-details">
                <summary className="report-summary small">
                    <strong>How this list is ordered</strong>
                </summary>
                <p className="report-small">Three things decide where a career sits, in this order:</p>
                <ol className="report-small">
                    <li>
                        <strong>What you have actually done.</strong> Something you have stuck with for
                        years counts for more than something you picked up recently, and both count for
                        more than a career that reached you on your profile alone.
                    </li>
                    <li>
                        <strong>Whether it fits how you think and work.</strong> Measured from the
                        assessment against what the work actually demands.
                    </li>
                    <li>
                        <strong>How strongly you feel about it.</strong> Loving something outranks having
                        won at it, which outranks saying you are confident about it — what you told us
                        about yourself is the softest of the three, so it counts least.
                    </li>
                </ol>
                <p className="report-small">
                    Together these make up to sixteen groups, from "Long-time passions you've achieved in" down to
                    "A stretch — reached on your profile alone". Open the full list to see yours under their
                    headings; inside each group, the careers that fit you best come first. A career counts as a
                    fit when your profile meets or goes beyond what the work asks: having more of a quality than the
                    work needs doesn't count against you — except comfort with uncertainty and how firmly you
                    hold a view, where careers can want either end.
                </p>
                {framing.switchIsDistinct && (
                    <p className="report-small">
                        <strong>Switching cost.</strong> Under <em>Best match</em>, careers that would leave {SWITCH_COST_GROUP_YEARS} or
                        more years of what you've already done behind go to a last group of their own, the least
                        affected first. Choose <em>Best fit, ignoring switching cost</em> under "Sort your list" to keep
                        them in their groups, or sort by <em>Least switching cost</em>.
                    </p>
                )}
                <p className="report-small">
                    <em>
                        Nothing here is a verdict on what you are capable of. It is a reading of the
                        evidence you gave us, and it moves when you give us more.
                    </em>
                </p>
            </details>

            {/* COLLAPSED: the top three of the chosen order. OPEN: every group under its heading. */}
            {showAllFor !== sortKey ? (
                <div className="match-list">
                    {ordered.slice(0, TOP_SHOWN).map((entry) => card(entry))}
                </div>
            ) : (
                groups.map((group) => (group.costly ? (
                    <details key={group.key} className="report-details match-group is-costly">
                        <summary className="report-summary">
                            <strong>Would cost you {SWITCH_COST_GROUP_YEARS}+ years to switch</strong> — {group.entries.length} {group.entries.length === 1 ? "career" : "careers"}
                        </summary>
                        <p className="report-small">The least affected first. Each card says how many years of what you've done would be left behind.</p>
                        <div className="match-list">{group.entries.map((entry) => card(entry))}</div>
                    </details>
                ) : (
                    <section key={group.key} className="match-group">
                        <h3 className="match-group-title">{tierNameFor(group.tier) || "Your other matches"}</h3>
                        <div className="match-list">{group.entries.map((entry) => card(entry))}</div>
                    </section>
                )))
            )}

            {ordered.length > TOP_SHOWN && showAllFor !== sortKey && (
                <button type="button" className="btn btn-ghost show-rest" onClick={() => setShowAllFor(sortKey)}>
                    Show the other {ordered.length - TOP_SHOWN} {ordered.length - TOP_SHOWN === 1 ? "career" : "careers"}
                </button>
            )}

            {hiddenCount > 0 && (
                <p className="report-hidden-note">
                    {hiddenCount} {hiddenCount === 1 ? "career is" : "careers are"} hidden by your filters.{" "}
                    <button type="button" className="link-button" onClick={() => { setExcludeBlueCollar(false); setOnly([]) }}>Show them again</button>
                </p>
            )}
            {ordered.length === 0 && hiddenCount > 0 && <p>None of your matches fit every filter you turned on.</p>}

            {/* COMBINED CAREERS (Round 10) — beside the list, never in it; the same card since Round 19 */}
            <CombinedCareers combined={data.combined} journey={journey} />
        </div>
    )
}

export default MatchesPage
