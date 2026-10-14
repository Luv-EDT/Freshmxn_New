import { useState, useMemo, useEffect } from "react"
import { Link, useLocation } from "react-router-dom"
import Navbar from "../Navbar"
import BackToDashboard from "../BackToDashboard"
import ProfessionCard from "./ProfessionCard"
import ReportSortMenu from "./ReportSortMenu"
import ReportFilterMenu from "./ReportFilterMenu"
import CombinedCareers from "./CombinedCareers"
import ReportStatus from "./ReportStatus"
import useReportData from "./useReportData"
import { groupList, splitShown, MAIN_SHOWN, SWITCH_COST_GROUP_YEARS, SECONDARY_SORTS } from "./reportFilters"
import { abroadLines } from "./reportPlan"
import { TOP_SHOWN, tierNameFor, tierWhyFor, buildFirstFor, BUILD_FIRST_TITLE, BUILD_FIRST_NOTE, framingFor, listOf } from "./reportFraming"

// "YOUR MATCHES" — the whole list on its own page (owner, Round 19, /report/matches). The report
// itself is a short overview with the top three; this page holds every match with the sort, the
// filters, the combined careers, the studying- and working-abroad lines and, last, how the list is
// ordered (owner, Round 29: moved here from the overview).
//
// ONE LIST, TWO ORDERS (owner, Round 20). The top three show first; opening the rest shows the tiers
// as headed groups — up to MAIN_SHOWN (15) of them, and anything beyond folded under "Some other
// careers you can consider", still under their tier headings (owner, Rounds 28 and 31). Every career
// here was pointed to by the student's own answers — none reaches the list on fit alone (Round 31). The sort and the filters are two highlighted buttons above the list, each
// with one line saying what it does (owner, Round 29). "Best match" puts careers that would cost 2+
// years to switch in a last group of their own, least affected first; "Best fit, ignoring switching
// cost" leaves them in their tiers. A "then order by" orders the whole list, across the tiers.
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
    const split = useMemo(() => splitShown(groups, MAIN_SHOWN), [groups])
    const shownIds = useMemo(() => ordered.slice(0, MAIN_SHOWN).map((entry) => String(entry.professionId)), [ordered])
    // the first not-a-fit tier on show, which carries the "Build fundamentals/factors first" band
    const firstBuildTier = useMemo(() => {
        const first = groups.find((group) => !group.costly && buildFirstFor(group.tier))
        return first ? first.tier : null
    }, [groups])

    const sortKey = [primary, secondary, only.join("+"), excludeBlueCollar].join("|")
    // a "then order by" turns the list into one group, headed by what it is ordered by (Round 29)
    const secondaryLabel = secondary ? (SECONDARY_SORTS.find((option) => option.value === secondary) || {}).label || "" : ""

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
            you={(state.data && state.data.you) || {}}
        />
    )

    // one group of the list, under its heading (the costly group folds)
    const renderGroup = (group) => (group.costly ? (
        <details key={group.key} className="report-details match-group is-costly">
            <summary className="report-summary">
                <strong>Would leave {SWITCH_COST_GROUP_YEARS}+ years behind</strong> — {group.entries.length} {group.entries.length === 1 ? "career" : "careers"}
            </summary>
            <p className="report-small">The least affected first. Each card says how many years of what you've done would be left behind.</p>
            <div className="match-list">{group.entries.map((entry) => card(entry))}</div>
        </details>
    ) : (
        <section key={group.key} className="match-group">
            {/* "Build fundamentals/factors first" heads the not-a-fit tiers once, above the first of them */}
            {buildFirstFor(group.tier) && group.tier === firstBuildTier && !group.key.endsWith("-more") && (
                <div className="match-band">
                    <h2 className="match-band-title">{BUILD_FIRST_TITLE}</h2>
                    <p className="report-small">{BUILD_FIRST_NOTE}</p>
                </div>
            )}
            <h3 className="match-group-title">{group.flat ? `All your matches — ${secondaryLabel.toLowerCase().replace("ai-", "AI-")} first` : tierNameFor(group.tier) || "Your other matches"}</h3>
            {!group.flat && tierWhyFor(group.tier) && <p className="report-small match-group-why">{tierWhyFor(group.tier)}</p>}
            <div className="match-list">{group.entries.map((entry) => card(entry))}</div>
        </section>
    ))

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
            {data.updateAvailable && !data.rebuildFailed && (
                <p className="report-banner">An update to your report is ready. <Link to="/report">Update it from your report page →</Link></p>
            )}

            <p className="report-small"><em>Tap any career to see what it is, how you get there, and what it pays.</em></p>

            <div className="report-menus">
                <ReportSortMenu
                    primary={primary}
                    onPrimary={setPrimary}
                    secondary={secondary}
                    onSecondary={setSecondary}
                    showNoCost={framing.switchIsDistinct}
                />
                <ReportFilterMenu
                    excludeBlueCollar={excludeBlueCollar}
                    onExcludeBlueCollar={setExcludeBlueCollar}
                    only={only}
                    onToggleOnly={toggleOnly}
                />
            </div>

            <div className="matches-main">
                {primary === "noCost" && (
                    <p className="report-small report-switch-note">
                        Every career stays in its group, ordered by how well it fits you — nothing is moved for what
                        switching would cost you. The years it would cost are still inside each card.
                    </p>
                )}
                {/* said beside the list, so a filter never hides careers silently */}
                {hiddenCount > 0 && (
                    <p className="report-hidden-note">
                        {hiddenCount} {hiddenCount === 1 ? "career is" : "careers are"} hidden by your filters.{" "}
                        <button type="button" className="link-button" onClick={() => { setExcludeBlueCollar(false); setOnly([]) }}>Show them again</button>
                    </p>
                )}

                {/* THE TOP THREE; then up to fifteen in their groups; the rest folded (owner, Rounds 28 and 31) */}
                {showAllFor !== sortKey ? (
                    <div className="match-list">
                        {ordered.slice(0, TOP_SHOWN).map((entry) => card(entry))}
                    </div>
                ) : (
                    <>
                        {split.shown.map(renderGroup)}
                        {split.rest.length > 0 && (
                            <details className="report-details match-more">
                                <summary className="report-summary">
                                    <strong>Some other careers you can consider</strong>
                                    {" "}({ordered.length - MAIN_SHOWN})
                                </summary>
                                {split.rest.map(renderGroup)}
                            </details>
                        )}
                    </>
                )}

                {ordered.length > TOP_SHOWN && showAllFor !== sortKey && (
                    <button type="button" className="btn btn-ghost show-rest" onClick={() => setShowAllFor(sortKey)}>
                        Show {Math.min(ordered.length, MAIN_SHOWN) - TOP_SHOWN} more {Math.min(ordered.length, MAIN_SHOWN) - TOP_SHOWN === 1 ? "career" : "careers"}
                    </button>
                )}

                {ordered.length === 0 && hiddenCount > 0 && <p>None of your matches fit every filter you turned on.</p>}
            </div>

            {/* COMBINED CAREERS (Round 10) — beside the list, never in it; the same card since Round 19 */}
            <CombinedCareers combined={data.combined} journey={journey} shownIds={shownIds} />

            {/* STUDYING AND WORKING ABROAD ACROSS YOUR MATCHES (owner, Round 19; at the bottom since Round 24) —
                each line shows only when it names something */}
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

            {/* HOW YOUR LIST IS ORDERED (owner, Round 29: at the bottom of this page). THE RANKING EXPLAINS
                ITSELF, in one place — a student who cannot see why one career sits above another has been
                handed an opinion with a number on it. */}
            <details className="report-details report-ordering">
                <summary className="report-summary">
                    <strong className="report-heading-md">How your list is ordered</strong> — why each career sits where it does
                </summary>
                <p className="report-small">Three things decide where a career sits, in this order:</p>
                <ol className="report-small">
                    <li>
                        <strong>What you have actually done.</strong> Something you've kept up for years counts for
                        more than something you do now.
                    </li>
                    <li>
                        <strong>How strongly you feel about it.</strong> <em>Proven</em> (you've achieved at it) comes
                        first, then <em>confident</em> (you said you're sure), then <em>passion</em> (you love it), then
                        simply an <em>interest</em>.
                    </li>
                    <li>
                        <strong>Whether it fits how you think and work</strong>, measured from your assessment against
                        what the work asks. Careers that fit you now come first; the ones under <em>{BUILD_FIRST_TITLE}</em> link
                        to what you do but ask for more of your fundamentals — the qualities in your psychometric
                        analysis — than your profile shows today.
                    </li>
                </ol>
                <p className="report-small">
                    Open your full list to see each group by name — "Proven long-time passion" down to "Something
                    you do now". Inside a group, <em>Best match</em> puts first the careers that fit you best once what
                    you'd leave behind is counted; <em>Best fit, ignoring switching cost</em> orders them by fit alone. A
                    <em> Then order by</em> sort orders the whole list instead. Having more of a quality than
                    a career asks never counts against you — except comfort with uncertainty and how firmly you hold a
                    view, where careers can want either end.
                </p>
                {framing.switchIsDistinct && (
                    <p className="report-small">
                        <strong>Switching cost.</strong> Each career shows two numbers. <em>Years left behind</em> are the
                        years that wouldn't count towards it — degree years, a Class 12 subject you'd add through open
                        school, work in a different field (your own career, and work that carries over, cost nothing).
                        <em> Time to get there</em> is the road ahead from where you are. Only the first moves a career:
                        under <em>Best match</em>, careers that would leave {SWITCH_COST_GROUP_YEARS} or more years behind go
                        to a last group of their own, the least affected first. On your list, choose <em>Best fit, ignoring
                        switching cost</em> to keep them in their groups, or sort by <em>Least switching cost</em>.
                    </p>
                )}
                <p className="report-small">
                    <em>
                        Nothing here is a verdict on what you are capable of. It is a reading of the evidence you gave
                        us, and it moves when you give us more.
                    </em>
                </p>
            </details>
        </div>
    )
}

export default MatchesPage
