import { useState, useEffect, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { useSelector } from "react-redux"
import { getMyReport } from "../../apiCall/reportsApi"
import { getProfessions } from "../../apiCall/professionsApi"
import Navbar from "../Navbar"
import JourneyProgress from "../JourneyProgress"
import UpgradeToMentorship from "../UpgradeToMentorship"
import ProfessionCard, { levelPath, JOURNEY_LEVEL } from "./ProfessionCard"
import ReportFilterBar from "./ReportFilterBar"
import { chipsFor, studentTags } from "./reportTags"
import { EMPTY_FILTERS, missedBy, optionCounts, sortRanked, hasData } from "./reportFilters"

// Stage 3 — the report.
//
// THE LIST IS THE REPORT. An earlier version opened with about 1,500 words of prose and then listed
// professions four lines at a time; a fifteen-year-old scrolled past all of it. Now the prose is
// four short paragraphs, the list is headings, and everything the taxonomy knows about a profession
// lives one tap away inside it. A report nobody reads is worth the same as no report.
//
// THREE RELEASE STATES, and they are the point rather than an edge case:
//   release            the full picture
//   release_with_note  findings shown, plus what is still missing and what completing it buys
//   withhold           below 75% of the matching vector. The completion prompt INSTEAD of findings,
//                      because a confident-looking report built on a fifth of the evidence is worse
//                      than no report.
//
// BOTH LISTS, ALWAYS. DECISIONS.md §5 is explicit that fit × switching-cost makes the engine
// structurally timid — it will never advise the hard change even when that is the true answer. So
// "Worth the switch" is rendered beside the ranking, never instead of it, with the cost shown.
//
// match_confidence is already stripped by reportsRouter, and every factor slug is already
// translated there. Nothing here needs to know either exists.

// ── THE SIXTEEN TIERS, MADE VISIBLE ─────────────────────────────────────────────────────────────
//
// `tiers.js` sorts every profession into one of sixteen buckets from three signals. Sixteen
// headings on a screen would be noise, so they collapse into five — but the RULE behind each one is
// shown, because a ranking a student cannot interrogate is just an opinion with a number on it.
//
// The three signals, and the exact tier boundaries they produce (see Backend/matching/tiers.js):
//
//   list      A = something you have pursued long-term points here
//             B = something you do now points here
//             C = neither; it reached you on profile alone
//   comfort   does the psychometric profile clear 0.7 against what the work demands
//             (tiers 1-11 yes, 12-16 no)
//   evidence  passion → achievement → expressed confidence, in that order of weight.
//             "Loved it" beats "won at it" beats "sure about it", and self-report ranks last
//             because it is the softest of the three.
const TIER_GROUPS = [
    {
        upTo: 2,
        label: "Strongest matches",
        why: "You love the thing that leads here, you have achieved something in it, and it fits how you think and work.",
    },
    {
        upTo: 6,
        label: "Strong matches",
        why: "Something you do points here and it fits your profile. You said you love it.",
    },
    {
        upTo: 8,
        label: "Worth a look",
        why: "You have achieved something that points here and it fits your profile — even though you did not mark it as a passion.",
    },
    {
        upTo: 11,
        label: "Fits how you work",
        why: "The profile fit is there and something connects you to it, but there is no passion or achievement behind it yet.",
    },
    {
        upTo: 16,
        label: "Further from your current shape",
        why: "Reachable, and something links you to it — but the way this work is usually done sits further from how you currently work.",
    },
]

const groupFor = (tier) => TIER_GROUPS.find((group) => tier <= group.upTo) || TIER_GROUPS[TIER_GROUPS.length - 1]

// What put THIS profession in its bucket, in one line. Sixteen tiers means sixteen distinct
// reasons, and the student can see which one applies to them rather than inferring it.
const tierReason = (entry) => {
    const evidence = []
    if (entry.passion) evidence.push("you said you love it")
    if (entry.achievement) evidence.push("you have achieved something in it")
    if (entry.confidenceExp === "High") evidence.push("you are confident about it")

    const source = entry.list === "A"
        ? "something you have stuck with long-term"
        : entry.list === "B"
            ? "something you do now"
            : "your profile rather than your activities"

    const fit = entry.comfort ? "it fits how you think and work" : "the fit with how you work is looser"

    return `Reached through ${source}; ${fit}${evidence.length > 0 ? `; ${evidence.join(" and ")}` : ""}.`
}

// "a, b and c" — because "spatial thinking, reasoning" reads like a truncated list rather than a
// finished sentence, and these strings sit inside prose.
const listOf = (items) => {
    if (items.length === 0) return ""
    if (items.length === 1) return items[0]
    return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`
}

// THE FOUR JOURNEYS DO NOT GET THE SAME REPORT, and the difference is not decoration.
//
// "Worth the switch" is the clearest case. For a class 9-10 student nothing has been invested yet,
// so there is nothing to switch FROM — the heading is meaningless and the framing implies they have
// already committed to something, which is exactly the anxiety the product should not create. For
// someone four years into a job it is the most important section on the page.
//
// The engine already knows this: τ is Infinity for class9_10, so the switching-cost multiplier is
// exactly 1.0 and both lists come out identical. Showing them as two lists with different
// explanations would be presenting the same ranking twice and implying a distinction the maths did
// not make.
const JOURNEY_FRAMING = {
    class9_10: {
        switchHeading: "Worth knowing about",
        switchIntro: "Nothing is decided at your stage, so nothing here costs you anything to consider. These are the strongest fits full stop.",
        // Both lists are the same ranking when nothing is sunk. Say so instead of staging a contrast.
        switchIsDistinct: false,
        runwayNote: "Years to qualify counts from the end of school, so it is the same for everyone your age — it is about the path, not about you being behind.",
    },
    class11_12: {
        switchHeading: "Worth the switch",
        switchIntro: "The list above accounts for your stream. These are the strongest fits ignoring that — some may need a stream change or an extra subject, which is still possible now.",
        switchIsDistinct: true,
        runwayNote: null,
    },
    college: {
        switchHeading: "Worth the switch",
        switchIntro: "The list above is weighted by what changing course would cost you now. These are the strongest fits ignoring that cost — shown because the safe answer is not always the right one.",
        switchIsDistinct: true,
        runwayNote: null,
    },
    early_professional: {
        switchHeading: "Worth the switch",
        switchIntro: "The list above is weighted by what leaving your current track would cost. These ignore that entirely. Your experience is not wasted in most of them — work skills carry further between fields than qualifications do.",
        switchIsDistinct: true,
        runwayNote: null,
    },
}

const framingFor = (journey) => JOURNEY_FRAMING[journey] || JOURNEY_FRAMING.college

function ReportPage() {
    const navigate = useNavigate()
    const { user } = useSelector((state) => state.user)
    const [state, setState] = useState({ loading: true, data: null, error: "" })
    const [details, setDetails] = useState({})        // professionId → the full student-facing record
    const [detailsLoaded, setDetailsLoaded] = useState(false)
    const [filters, setFilters] = useState(EMPTY_FILTERS)
    const [sort, setSort] = useState("best")

    // Polls while the pipeline is running, and stops the moment it is not. A student who has just
    // pressed Submit is looking at this page NOW — telling them to come back later and leaving it
    // frozen is the difference between "it is working" and "it is broken", and they cannot tell
    // which from a static screen.
    useEffect(() => {
        let cancelled = false
        let timer = null

        const load = async () => {
            try {
                const response = await getMyReport()
                if (cancelled) return

                const data = response.data.data
                setState({ loading: false, data, error: "" })

                if (data.status === "generating") timer = setTimeout(load, 5000)
            } catch (error) {
                if (!cancelled) setState({ loading: false, data: null, error: "Could not load your report" })
            }
        }

        load()

        return () => {
            cancelled = true
            clearTimeout(timer)
        }
    }, [])

    // ONE REQUEST FOR EVERY PROFESSION IN THE REPORT, fired once the ranking arrives rather than on
    // each expand. Forty accordion rows fetching themselves individually is forty round trips on a
    // phone connection, and the first tap would feel broken. The taxonomy is static, so this is a
    // read of shared data, not of anything belonging to the student.
    const ranked = state.data && state.data.ranked ? state.data.ranked : null
    const switchList = state.data && state.data.worthTheSwitch ? state.data.worthTheSwitch : null

    // ⚠ BOTH LISTS, NOT JUST THE RANKING. This fetched only `ranked` ids, and worth-the-switch cards
    // sat on "Loading…" forever — because the whole point of that list is to surface professions
    // that are NOT in the ranking. `alreadyRanked: false` is the common case there, so the entries
    // most worth reading were exactly the ones with no detail to read.
    //
    // Still one request. The union is at most a few dozen ids and the route takes up to 60.
    const detailIds = useMemo(() => {
        const ids = new Set()
        ;(ranked || []).forEach((entry) => ids.add(entry.professionId))
        ;(switchList || []).forEach((entry) => ids.add(entry.professionId))
        return [...ids]
    }, [ranked, switchList])

    // A stable key, so the effect does not refire on every render just because the array is new.
    const detailKey = detailIds.join(",")

    useEffect(() => {
        if (detailIds.length === 0) return

        let cancelled = false

        const loadDetails = async () => {
            try {
                const response = await getProfessions(detailIds)
                if (cancelled) return

                const byId = {}
                response.data.data.professions.forEach((profession) => { byId[profession.id] = profession })
                setDetails(byId)
                setDetailsLoaded(true)
            } catch (error) {
                // Answered, badly. The card must stop saying "Loading…" or it implies something is
                // still on its way that never is.
                setDetailsLoaded(true)
                // The headings and the chips still render; only the expanded detail is missing, and
                // the card says it is loading rather than claiming the profession has no detail.
            }
        }

        loadDetails()
        return () => { cancelled = true }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [detailKey])

    const data = state.data
    const ordered = useMemo(() => (ranked ? sortRanked(ranked, sort, details) : []), [ranked, sort, details])

    // THE CONTROLS GOVERN EVERY PROFESSION ON THE PAGE, not just the ranking. Worth-the-switch is a
    // list of careers too, and a student who sets "quickest to qualify" and finds one list obeying
    // it and another ignoring it has been given a control that half works.
    const orderedSwitch = useMemo(
        () => (switchList ? sortRanked(switchList, sort, details) : []),
        [switchList, sort, details]
    )

    // Counted across BOTH lists, so "High demand (11)" describes what the page will actually show
    // rather than what one section of it will show.
    const countable = useMemo(() => [...(ranked || []), ...(switchList || [])], [ranked, switchList])

    const counts = useMemo(
        () => (countable.length > 0 ? optionCounts(countable, filters, details) : { ai: {}, demand: {}, pay: {} }),
        [countable, filters, details]
    )

    // Which controls have anything behind them on THIS list. An attribute we do not hold for any
    // ranked profession gets no control at all rather than a row of dead buttons.
    const available = useMemo(() => ({
        ai: hasData(countable, details, "ai"),
        demand: hasData(countable, details, "demand"),
        pay: hasData(countable, details, "pay"),
    }), [countable, details])

    const matchingCount = useMemo(
        () => countable.filter((entry) => missedBy(entry, filters, details[entry.professionId]).length === 0).length,
        [countable, filters, details]
    )

    if (state.loading) return <div><Navbar />Loading your report…</div>
    if (state.error) return <div><Navbar /><p>{state.error}</p></div>

    const { status, release, sections, worthTheSwitch, aspirationSignals, filtered, journey, dominantReasons } = data
    const framing = framingFor(journey)

    if (status === "not_started") {
        return (
            <div>
                <Navbar />
                <JourneyProgress user={user} current="report" />
                <h1>Your report</h1>
                <p>Finish the assessment and your report will be built from it.</p>
                <button type="button" onClick={() => navigate("/assessment/start")}>Go to the assessment</button>
            </div>
        )
    }

    if (status === "generating") {
        return (
            <div>
                <Navbar />
                <JourneyProgress user={user} current="report" />
                <h1>We are preparing your report</h1>
                <p>
                    This usually takes about a minute. We are scoring your answers, matching them
                    against 223 careers, and writing it up.
                </p>
                <p>
                    <em>This page checks for itself every few seconds — you can also close it and
                    come back whenever you like.</em>
                </p>
            </div>
        )
    }

    // Below the release threshold: say what is missing instead of showing findings that would read
    // as more certain than they are.
    if (release === "withhold") {
        return (
            <div>
                <Navbar />
                <JourneyProgress user={user} current="report" />
                <h1>Not enough to go on yet</h1>
                <p>
                    You have finished part of the assessment, but not enough of it for us to say
                    anything useful about which careers fit you. We would rather tell you that than
                    give you a confident answer built on a fraction of the picture.
                </p>
                <button type="button" onClick={() => navigate("/assessment/start")}>
                    Finish the assessment
                </button>
            </div>
        )
    }

    const grouped = []
    ordered.forEach((entry) => {
        const label = groupFor(entry.tier).label
        const bucket = grouped.find((item) => item.label === label)
        if (bucket) bucket.entries.push(entry)
        else grouped.push({ label, entries: [entry] })
    })

    const myTags = studentTags(dominantReasons)

    // ── CONCRETE NEXT STEPS, DERIVED ────────────────────────────────────────────────────────────
    //
    // The model's `nextSteps` is prose and can only be as specific as the payload it was given.
    // These come from the ranking itself, so they carry actual names: the actual next step on the
    // actual top matches, the exams those actually require, and the sections the student has
    // actually left unfinished. Anything that cannot be derived is simply not listed — an empty
    // list is better than a filler action.
    const nextActions = (() => {
        const actions = []
        const topThree = ordered.slice(0, 3)

        // The immediate path step, named, for the strongest matches that share one.
        const steps = new Map()
        topThree.forEach((entry) => {
            const detail = details[entry.professionId]
            if (!detail || !detail.pathToEntry || detail.pathToEntry.length === 0) return

            const levelled = levelPath(detail.pathToEntry)
            const level = JOURNEY_LEVEL[journey]
            const next = level === undefined ? levelled[0] : levelled.find((step) => step.level >= level)
            if (!next) return

            const existing = steps.get(next.requirement) || []
            steps.set(next.requirement, [...existing, entry.profession])
        })

        steps.forEach((professions, requirement) => {
            actions.push(`For ${listOf(professions)}: ${requirement}`)
        })

        // Exams the top matches gate on — the single most actionable thing in the taxonomy.
        const exams = new Set()
        topThree.forEach((entry) => {
            const detail = details[entry.professionId]
            if (detail && detail.entranceExams) {
                detail.entranceExams.publicRoutes.slice(0, 2).forEach((exam) => exams.add(exam))
            }
        })
        if (exams.size > 0) {
            actions.push(`Look up when these are held and who can sit them: ${[...exams].slice(0, 4).join(", ")}.`)
        }

        // An aspiration that reached nothing is a real, specific thing to act on.
        const unreached = aspirationSignals.filter((signal) => signal.outcome === "unranked" || signal.outcome === "unmatched")
        if (unreached.length > 0) {
            actions.push(
                `You named ${listOf(unreached.map((signal) => signal.professionText))} but nothing you told us about pointed there. Start doing something in it and add that to your interest form — it will change this list.`
            )
        }

        // And the honest one: the assessment is not finished, and finishing it sharpens everything.
        if (release === "release_with_note") {
            actions.push("Finish the remaining assessment sections — the matches above get more specific, not replaced.")
        }

        return actions
    })()

    return (
        <div style={{ maxWidth: "800px" }}>
            <Navbar />
            <JourneyProgress user={user} current="report" />

            <h1>Your report</h1>

            {status === "stale" && (
                <p><em>Your matches have been recalculated since this was written. A fresh version is
                   on the way.</em></p>
            )}

            {release === "release_with_note" && (
                <p>
                    <strong>This is built on most of the assessment, not all of it.</strong> Finishing
                    the remaining sections sharpens these matches rather than replacing them.
                </p>
            )}

            {myTags.length > 0 && (
                <p style={{ fontSize: "14px" }}>
                    What seems to drive you: <strong>{listOf(myTags)}</strong>. You will see this
                    alongside the careers below that are pursued for the same reason.
                </p>
            )}

            <hr />

            <h2>Reachable from here</h2>
            {framing.runwayNote && <p><em>{framing.runwayNote}</em></p>}

            <p style={{ fontSize: "14px" }}><em>Tap any career to see what it is, how you get there, and what it pays.</em></p>

            <ReportFilterBar
                filters={filters}
                counts={counts}
                onChange={setFilters}
                sort={sort}
                onSort={setSort}
                activeCount={matchingCount}
                total={countable.length}
                available={available}
            />

            {/* THE RANKING EXPLAINS ITSELF. A student who cannot see why one career sits above
                another has been handed an opinion with a number on it. */}
            <details style={{ margin: "12px 0" }}>
                <summary style={{ cursor: "pointer", minHeight: "44px", padding: "10px 0", fontSize: "15px" }}>
                    <strong>How this list is ordered</strong>
                </summary>
                <p style={{ fontSize: "14px" }}>Three things decide where a career sits, in this order:</p>
                <ol style={{ fontSize: "14px", paddingLeft: "20px" }}>
                    <li style={{ margin: "6px 0" }}>
                        <strong>What you have actually done.</strong> Something you have stuck with for
                        years counts for more than something you picked up recently, and both count for
                        more than a career that reached you on your profile alone.
                    </li>
                    <li style={{ margin: "6px 0" }}>
                        <strong>Whether it fits how you think and work.</strong> Measured from the
                        assessment against what the work actually demands.
                    </li>
                    <li style={{ margin: "6px 0" }}>
                        <strong>How strongly you feel about it.</strong> Loving something outranks having
                        won at it, which outranks saying you are confident about it — what you told us
                        about yourself is the softest of the three, so it counts least.
                    </li>
                </ol>
                <p style={{ fontSize: "14px" }}>
                    <em>
                        Nothing here is a verdict on what you are capable of. It is a reading of the
                        evidence you gave us, and it moves when you give us more.
                    </em>
                </p>
            </details>

            {grouped.map((group) => (
                <div key={group.label}>
                    <h3 style={{ fontSize: "15px", marginBottom: "2px" }}>{group.label}</h3>
                    <p style={{ fontSize: "13px", margin: "0 0 10px" }}><em>{group.why}</em></p>
                    {group.entries.map((entry) => {
                        const missed = missedBy(entry, filters, details[entry.professionId])

                        return (
                            <ProfessionCard
                                key={entry.professionId}
                                entry={entry}
                                detail={details[entry.professionId]}
                                detailsLoaded={detailsLoaded}
                                journey={journey}
                                chips={chipsFor(entry, dominantReasons)}
                                tierReason={tierReason(entry)}
                                dimmed={missed.length > 0}
                                missed={missed}
                            />
                        )
                    })}
                </div>
            ))}

            {/* Rendered for every journey EXCEPT class 9-10, where nothing is sunk and the two
                lists are the same ranking. See JOURNEY_FRAMING. */}
            {/* NOT COLLAPSED. These are the strongest fits ignoring what changing course would
                cost, and DECISIONS.md §5 exists because fit × cost makes the engine structurally
                timid — it will never advise the hard change even when that is the true answer.
                Hiding this list behind a disclosure is the interface doing the same timidity the
                maths was corrected for. They get the same cards as the main list. */}
            {worthTheSwitch.length > 0 && framing.switchIsDistinct && (
                <>
                    <hr />
                    <h2>{framing.switchHeading}</h2>
                    <p>{framing.switchIntro}</p>

                    {orderedSwitch.map((entry) => {
                        const missed = missedBy(entry, filters, details[entry.professionId])

                        return (
                            <ProfessionCard
                                key={entry.professionId}
                                entry={{
                                    ...entry,
                                    professional_sector: (details[entry.professionId] || {}).professionalSector || "",
                                    display: { yearsToQualify: entry.yearsToQualify },
                                    supportingFactors: entry.supportingFactors || [],
                                    matchedBy: [],
                                }}
                                detail={details[entry.professionId]}
                                detailsLoaded={detailsLoaded}
                                journey={journey}
                                chips={[
                                    ...(entry.wastedYears > 0 ? [`About ${entry.wastedYears} years left behind`] : []),
                                    ...(entry.alreadyRanked ? [] : ["Not in the list above"]),
                                ]}
                                dimmed={missed.length > 0}
                                missed={missed}
                            />
                        )
                    })}
                </>
            )}

            {/* THE ASPIRATION SECTION IS A COLLAPSIBLE EXPLANATION, not a wall of cards. Every
                stated wish is still answered in full — including the ones that did not work out —
                but a student who is happy with their list does not have to scroll past all of it. */}
            {aspirationSignals.length > 0 && (
                <details style={{ margin: "20px 0" }}>
                    <summary style={{ cursor: "pointer", minHeight: "44px", padding: "10px 0", fontSize: "16px" }}>
                        <strong>What you said you wanted</strong> — what happened to {aspirationSignals.length === 1 ? "it" : "all of them"}
                    </summary>

                    <p>
                        You named these when we asked what you want to be. Every one is answered here,
                        including the ones that did not work out, and why.
                    </p>

                    {aspirationSignals.map((signal) => (
                        <div key={signal.professionText} style={{ borderLeft: "3px solid #ccc", paddingLeft: "12px", margin: "16px 0" }}>
                            <p style={{ marginTop: 0, fontSize: "17px" }}>
                                <strong>{signal.professionText}</strong>
                            </p>

                            {/* RANKED — say where it landed AND what put it there. "Ranked #4" on its
                                own is a verdict with no reasoning attached, which a student can
                                neither act on nor argue with. */}
                            {signal.outcome === "ranked" && (
                                <>
                                    {/* "#4 IN YOUR LIST ABOVE" WAS WRONG THE MOMENT SORTING EXISTED.
                                        `rankedPosition` is the engine's match rank and never changes;
                                        the on-screen order does. A student sorting by pay would count
                                        to the fourth row and find something else. Stated as what it
                                        actually is — a rank on match strength — it stays true under
                                        every sort and filter. */}
                                    <p><strong>It came {signal.rankedPosition === 1 ? "top" : `#${signal.rankedPosition}`} of your matches on strength of fit.</strong></p>
                                    {signal.supportingFactors.length > 0 && (
                                        <p>
                                            It ranked there because your profile shows{" "}
                                            {listOf(signal.supportingFactors.map((factor) => factor.factor))}.
                                        </p>
                                    )}
                                    {signal.divergingFactors.length > 0 && (
                                        <p>
                                            The part that does not line up yet:{" "}
                                            {listOf(signal.divergingFactors.map((factor) => factor.factor))}.{" "}
                                            <em>That is a gap to work on, not a door closing.</em>
                                        </p>
                                    )}
                                </>
                            )}

                            {/* BLOCKED — which door is shut, and what the nearest reachable version
                                is. A bare "not open to you" leaves a sixteen-year-old with a closed
                                door and nowhere to go. */}
                            {signal.outcome === "blocked" && (
                                <>
                                    <p><strong>This one is not reachable from where you are now.</strong></p>
                                    <p>The reason is specific: it {signal.blockedReason}.</p>
                                    {signal.alsoReached && signal.alsoReached.length > 0 ? (
                                        <p>
                                            The closest thing you <em>can</em> reach from here, based on
                                            what you already do:{" "}
                                            <strong>{signal.alsoReached.map((hit) => hit.profession).join(", ")}</strong>.
                                        </p>
                                    ) : (
                                        <p>
                                            We could not find a near version of it that is open to you
                                            from here. That is worth raising with a teacher or a mentor
                                            rather than treating as final — requirements change, and
                                            this is one answer from one system.
                                        </p>
                                    )}
                                </>
                            )}

                            {/* UNRANKED — the name resolved, nothing the student does reached it.
                                The honest "we have no evidence either way", and it must not read as
                                "you are not suited to it". */}
                            {signal.outcome === "unranked" && (
                                <>
                                    <p><strong>Nothing you told us about pointed here yet.</strong></p>
                                    <p>
                                        That is not the same as it being wrong for you. It means none of
                                        the things you said you do are ones this career is usually built
                                        from — so we have no evidence either way, rather than evidence
                                        against.
                                    </p>
                                    {signal.alsoReached && signal.alsoReached.length > 0 && (
                                        <p>
                                            What you described pointed instead at:{" "}
                                            <strong>{signal.alsoReached.map((hit) => hit.profession).join(", ")}</strong>.
                                        </p>
                                    )}
                                    <p>
                                        <em>
                                            If you want this one, the most useful thing you can do is
                                            start doing something in it and add it to your interest form.
                                        </em>
                                    </p>
                                </>
                            )}

                            {/* UNMATCHED — our gap, not theirs, and it should read that way. */}
                            {/* DOES NOT ANNOUNCE THAT WE DO NOT COVER IT. Leading with our own gap
                                tells a student their ambition is off the map, which is both
                                discouraging and not what happened — what they wrote DID feed the
                                matching. So this says what their words pointed at, and mentions the
                                limit quietly and second. */}
                            {signal.outcome === "unmatched" && (
                                <>
                                    <p>
                                        <strong>What you wrote here still counted.</strong> It fed into
                                        the matching above, so the list you are looking at already has
                                        it in the mix.
                                    </p>
                                    {signal.alsoReached && signal.alsoReached.length > 0 ? (
                                        <p>
                                            It pointed at:{" "}
                                            <strong>{signal.alsoReached.map((hit) => hit.profession).join(", ")}</strong>.
                                        </p>
                                    ) : (
                                        <p>
                                            We match against a fixed set of careers, and this one is not
                                            in it yet — so we could not rank it by name. Worth raising
                                            with a teacher or a mentor, who is not limited to our list.
                                        </p>
                                    )}
                                </>
                            )}
                        </div>
                    ))}
                </details>
            )}

            {filtered.length > 0 && (
                <details style={{ margin: "20px 0" }}>
                    <summary style={{ cursor: "pointer", minHeight: "44px", padding: "10px 0", fontSize: "16px" }}>
                        <strong>Ruled out</strong> — {filtered.length} that are not open from here
                    </summary>
                    <ul>
                        {filtered.map((entry) => (
                            <li key={entry.professionId}>{entry.profession} — {entry.reason}</li>
                        ))}
                    </ul>
                </details>
            )}

            {/* THE PROSE SITS AFTER THE LIST, NOT BEFORE IT. The student came for careers; making
                them read two paragraphs to reach the thing they came for is the same mistake the
                1,500-word version made, just smaller. Read here it works as a wrap-up — you have
                seen the careers, this is what your profile says about why. */}
            {(sections.opening || sections.yourMatches) && (
                <>
                    <hr />
                    <h2>What this says about you</h2>
                    {sections.opening && <p>{sections.opening}</p>}
                    {sections.yourMatches && <p>{sections.yourMatches}</p>}
                </>
            )}

            {(sections.readiness || sections.nextSteps) && <hr />}

            {/* COLLAPSIBLE, AND BACKED BY DATA RATHER THAN ONLY PROSE. The model writes three
                generic-ish actions; the concrete ones can be derived — the actual next step on the
                actual top matches, the exams those need, and the sections still unfinished. A
                student who opens this should find things with names in them, not advice. */}
            <details style={{ margin: "16px 0" }} open>
                <summary style={{ cursor: "pointer", minHeight: "44px", padding: "10px 0", fontSize: "16px" }}>
                    <strong>What to do next</strong>
                </summary>

                {sections.nextSteps && <p>{sections.nextSteps}</p>}

                {nextActions.length > 0 && (
                    <ul style={{ paddingLeft: "20px" }}>
                        {nextActions.map((action, index) => (
                            <li key={index} style={{ margin: "8px 0" }}>{action}</li>
                        ))}
                    </ul>
                )}
            </details>

            {sections.readiness && (
                <details style={{ margin: "16px 0" }}>
                    <summary style={{ cursor: "pointer", minHeight: "44px", padding: "10px 0", fontSize: "16px" }}>
                        <strong>Where you are right now</strong>
                    </summary>
                    <p>{sections.readiness}</p>
                </details>
            )}

            {/* Named from the student's own top matches, so the offer is about the thing they have
                just read rather than a generic upsell. Renders nothing for Tier 2. */}
            <UpgradeToMentorship user={user} professions={ranked.slice(0, 3).map((entry) => entry.profession)} />
        </div>
    )
}

export default ReportPage
