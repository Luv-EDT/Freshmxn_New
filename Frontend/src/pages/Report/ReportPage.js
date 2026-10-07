import { Link } from "react-router-dom"
import { useSelector } from "react-redux"
import Navbar from "../Navbar"
import BackToDashboard from "../BackToDashboard"
import UpgradeToMentorship from "../UpgradeToMentorship"
import ReportStatus from "./ReportStatus"
import useReportData from "./useReportData"
import { studentTags } from "./reportTags"
import { tierNameFor, buildFirstFor, framingFor, listOf, BUILD_FIRST_TITLE } from "./reportFraming"
import { SWITCH_COST_GROUP_YEARS } from "./reportFilters"
import DirectionModal from "../DirectionModal"

// Stage 3 — the report: A SHORT OVERVIEW SINCE ROUND 19 (owner). In the owner's order: "Your report";
// your top three matches, with the full list, the combined careers and compare one tap away (Round 20:
// three buttons in the one card); what seems to drive you; the five fundamentals; and what you said
// you wanted — those three under one medium heading size, Your matches only slightly larger. The shared data and the screens shown instead of a report live in useReportData.js
// and ReportStatus.js; the five bands and the per-journey wording in reportFraming.js.
//
// THE LIST IS THE REPORT. An earlier version opened with about 1,500 words of prose and then listed
// professions four lines at a time; a fifteen-year-old scrolled past all of it. Since Round 19 there is
// no prose at all — everything the taxonomy knows about a profession lives one tap away inside it.
function ReportPage() {
    const { user } = useSelector((state) => state.user)
    const report = useReportData()
    const { state, ranked } = report

    const gate = <ReportStatus state={state} retry={report.retry} retrying={report.retrying} />
    if (state.loading || state.error || state.data.status !== "ready" || state.data.release === "withhold") return gate

    const data = state.data
    const { release, aspirationSignals, filtered, dominantReasons } = data
    const myTags = studentTags(dominantReasons)
    const top = (ranked || []).slice(0, 3)
    const combined = Array.isArray(data.combined) ? data.combined : []

    return (
        <div className="report-page">
            <Navbar />
            <BackToDashboard />

            <h1 className="report-title">Your report</h1>

            {data.rebuildFailed && (
                <div className="report-banner">
                    <p>
                        <strong>We could not update your report with your latest answers.</strong> This is the
                        previous version.
                    </p>
                    <button type="button" className="btn btn-primary btn-sm tap" onClick={report.retry} disabled={report.retrying}>
                        {report.retrying ? "Starting again…" : "Try again"}
                    </button>
                </div>
            )}

            {data.updateAvailable && !data.rebuildFailed && (
                <div className="report-banner">
                    <p>
                        <strong>We've improved how we match careers.</strong> Your report stays exactly as it is
                        unless you choose to update it.
                    </p>
                    <button type="button" className="btn btn-primary btn-sm tap" onClick={() => report.setUpdateOpen(true)}>
                        Update my report
                    </button>
                </div>
            )}

            <DirectionModal
                open={report.updateOpen}
                title="Update your report"
                okText="Update my report"
                busy={report.updating}
                onCancel={() => report.setUpdateOpen(false)}
                onConfirm={report.startUpdate}
            />

            {release === "release_with_note" && (
                <p>
                    <strong>This is built on most of the assessment, not all of it.</strong> Finishing
                    the remaining sections sharpens these matches rather than replacing them.
                </p>
            )}

            {/* 1. YOUR MATCHES — the top three here; the whole list, sort and filters on their own page */}
            <section className="report-card">
                <h2 className="report-heading-lg">Your matches</h2>
                {top.length > 0 ? (
                    <ol className="report-top">
                        {top.map((entry) => <li key={entry.professionId}><strong>{entry.profession}</strong></li>)}
                    </ol>
                ) : (
                    <p>None of the careers on our list is open from where you are now — see "Ruled out" below.</p>
                )}
                <div className="report-card-actions">
                    <Link to="/report/matches" className="btn btn-primary btn-sm tap">
                        See all {ranked.length} {ranked.length === 1 ? "match" : "matches"} →
                    </Link>
                    {/* the careers that mix two professions, on the matches page (owner, Round 20: a button here, not a card) */}
                    {combined.length > 0 && (
                        <Link to="/report/matches#combined" className="btn btn-ghost btn-sm tap">
                            Combined careers ({combined.length}) →
                        </Link>
                    )}
                    <Link to="/report/compare" className="btn btn-ghost btn-sm tap">Compare careers →</Link>
                </div>
            </section>

            {/* HOW YOUR LIST IS ORDERED (owner, Round 24: here, like the fundamentals, not on the matches
                page). THE RANKING EXPLAINS ITSELF, in one place — a student who cannot see why one career
                sits above another has been handed an opinion with a number on it. */}
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
                        to what you do but ask for more than your profile shows today.
                    </li>
                </ol>
                <p className="report-small">
                    Open your full list to see each group by name — "Proven long-time passion" down to "Other
                    interests". Inside a group, the careers that fit you best come first. Having more of a quality than
                    a career asks never counts against you — except comfort with uncertainty and how firmly you hold a
                    view, where careers can want either end.
                </p>
                {framingFor(data.journey).switchIsDistinct && (
                    <p className="report-small">
                        <strong>Switching cost.</strong> Under <em>Best match</em>, careers that would leave {SWITCH_COST_GROUP_YEARS} or
                        more years of what you've already done behind go to a last group of their own, the least affected
                        first. On your list, choose <em>Best fit, ignoring switching cost</em> to keep them in their groups,
                        or sort by <em>Least switching cost</em>.
                    </p>
                )}
                <p className="report-small">
                    <em>
                        Nothing here is a verdict on what you are capable of. It is a reading of the evidence you gave
                        us, and it moves when you give us more.
                    </em>
                </p>
            </details>

            {/* 2. WHAT SEEMS TO DRIVE YOU */}
            {myTags.length > 0 && (
                <section className="report-card">
                    <h2 className="report-heading-md">What seems to drive you</h2>
                    <p><strong>{listOf(myTags)}</strong>.</p>
                </section>
            )}

            {/* 3. THE FIVE FUNDAMENTALS (owner, Rounds 18-20) — four qualities that help in every career,
                as words, and a fifth: the rest of your qualities, which live on the Profile, and why. */}
            {Array.isArray(data.fundamentals) && (
                <details className="report-details report-fundamentals">
                    <summary className="report-summary">
                        <strong className="report-heading-md">The five fundamentals</strong> — what helps in every career
                    </summary>
                    <ul className="fundamentals-list">
                        {data.fundamentals.map((item) => (
                            <li key={item.slug}>
                                <strong>{item.name}</strong>{" "}
                                <span className={`status-chip${item.level ? " is-done" : ""}`}>{item.level || "not measured yet"}</span>
                                <br />
                                <span className="report-small">{item.meaning}. {item.why}</span>
                            </li>
                        ))}
                        <li key="the-rest">
                            <strong>The rest of your qualities</strong> — <Link to="/profile">see them on your Profile</Link>
                            <br />
                            <span className="report-small">
                                Your personality, abilities, the areas you're drawn to and how you work. They aren't
                                here on purpose: they matter once you've chosen a profession — then we work on the
                                ones that profession needs and you don't have yet, not the other way round.
                            </span>
                        </li>
                    </ul>
                    <p className="report-small"><em>From your own answers, not a comparison with anyone. All of them grow with practice.</em></p>
                </details>
            )}

            {/* 4. WHAT YOU SAID YOU WANTED.
                THE ASPIRATION SECTION IS A COLLAPSIBLE EXPLANATION, not a wall of cards. Every
                stated wish is still answered in full — including the ones that did not work out —
                but a student who is happy with their list does not have to scroll past all of it.
                Round 18 (owner): one line for all of them, then for each: a DIRECT match (you named
                it and it is in your list) or an INDIRECT one (your words pointed to other careers),
                and why it sits where it does. */}
            {aspirationSignals.length > 0 && (
                <details className="report-details">
                    <summary className="report-summary">
                        <strong className="report-heading-md">What you said you wanted</strong> — what happened to {aspirationSignals.length === 1 ? "it" : "all of them"}
                    </summary>

                    <p>
                        Every career you named is on our list unless its demand is falling and the pay is
                        weak. Here is where each one landed, and why.
                    </p>

                    {aspirationSignals.map((signal) => (
                        <div key={signal.professionText} className="aspiration-card">
                            <p className="aspiration-title">
                                <strong>{signal.professionText}</strong>{" "}
                                {signal.outcome === "ranked" && <span className="status-chip is-done">Direct match</span>}
                                {signal.outcome !== "ranked" && signal.alsoReached && signal.alsoReached.length > 0 && (
                                    <span className="status-chip">Indirect match</span>
                                )}
                            </p>

                            {/* RANKED — say where it landed AND what put it there. "Ranked #4" on its
                                own is a verdict with no reasoning attached, which a student can
                                neither act on nor argue with. */}
                            {signal.outcome === "ranked" && (
                                <>
                                    {/* "#4 IN YOUR LIST ABOVE" WAS WRONG THE MOMENT SORTING EXISTED.
                                        `rankedPosition` is the engine's match rank and never changes;
                                        the on-screen order does. Stated as what it actually is — a
                                        rank on match strength — it stays true under every sort. */}
                                    <p>
                                        You named it, and it came <strong>{signal.rankedPosition === 1 ? "top" : `#${signal.rankedPosition}`}</strong> of
                                        your matches on strength of fit.
                                    </p>
                                    {tierNameFor(signal.tier) && (
                                        <p>
                                            <strong>Why there:</strong> it is in "{tierNameFor(signal.tier)}"{buildFirstFor(signal.tier) ? ` — ${BUILD_FIRST_TITLE.toLowerCase()}: the work asks for more than your profile shows today` : ""}.
                                        </p>
                                    )}
                                    {signal.supportingFactors.length > 0 && (
                                        <p>
                                            It suits you because your profile shows{" "}
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
                                    {signal.alsoReached && signal.alsoReached.length > 0 && (
                                        <p>Your words also pointed to: <strong>{signal.alsoReached.map((hit) => hit.profession).join(", ")}</strong>.</p>
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
                                    <p><strong>It is on our list, but nothing you told us about pointed here yet.</strong></p>
                                    <p>
                                        That is not the same as it being wrong for you. None of the
                                        things you said you do are ones this career is usually built
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

                            {/* UNMATCHED — not a career on our list. It still counted: since Round 17
                                every aspiration is read as an ACTIVITY ("long distance runner" →
                                long distance running), and that is what pointed to the careers named. */}
                            {signal.outcome === "unmatched" && (
                                <>
                                    <p>
                                        <strong>Not a career on our list</strong> — so we read it as an
                                        activity{signal.readAs ? <>, <em>{signal.readAs}</em></> : ""}, and it
                                        still counted in your matches.
                                    </p>
                                    {signal.alsoReached && signal.alsoReached.length > 0 ? (
                                        <p>
                                            It pointed you to:{" "}
                                            <strong>{signal.alsoReached.map((hit) => hit.profession).join(", ")}</strong>.
                                        </p>
                                    ) : (
                                        <p>
                                            It did not lead to a particular career on its own. Worth
                                            raising with a teacher or a mentor, who is not limited to our list.
                                        </p>
                                    )}
                                </>
                            )}
                        </div>
                    ))}
                </details>
            )}

            {filtered.length > 0 && (
                <details className="report-details">
                    <summary className="report-summary">
                        <strong>Ruled out</strong> — {filtered.length} that are not open from here
                    </summary>
                    <ul>
                        {filtered.map((entry) => (
                            <li key={entry.professionId}>{entry.profession} — {entry.reason}</li>
                        ))}
                    </ul>
                </details>
            )}

            {/* SUPPORT FOR YOUR EXAMS (Round 10) — only for a student who told us about a difficulty,
                and only once the owner has checked every line against its official source. */}
            {data.support && (
                <details className="report-details">
                    <summary className="report-summary"><strong>Support you are entitled to</strong></summary>
                    <ul className="support-list">
                        {data.support.rows.map((row) => (
                            <li key={row.id}>
                                <strong>{row.title}.</strong> {row.text}{" "}
                                <a href={row.url} target="_blank" rel="noreferrer">{row.source}</a>
                            </li>
                        ))}
                    </ul>
                    <p className="report-small">Rules change — confirm with the exam body when you apply.</p>
                </details>
            )}


            {/* Named from the student's own top matches, so the offer is about the thing they have
                just read rather than a generic upsell. Renders nothing for the full plan. */}
            <UpgradeToMentorship user={user} professions={top.map((entry) => entry.profession)} />
        </div>
    )
}

export default ReportPage
