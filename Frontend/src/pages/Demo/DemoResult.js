import { Link } from "react-router-dom"
import ProfessionCard from "../Report/ProfessionCard"
import DemoPlans from "./DemoPlans"

// THE DEMO REPORT (owner, Round 33) — kept clean: the two careers straight away (no quoted words), each
// a real career card (everything inside: why, the road from where they stand, exams, money, the future);
// a psychometric fold showing exactly how much of each factor the demo measured (an owner exception for the
// demo: "N% measured" beside a word level — never a score) with the rest faded at 0%; a fold on what we did
// differently; what the full program
// adds; then the plans, financial aid and refunds. True numbers only — never a confidence or match figure.
const TOTAL_FACTORS = 31

const secondsOf = (ms) => (typeof ms === "number" ? `${(ms / 1000).toFixed(2)} s` : null)

function DemoResult({ result }) {
    const { name, careers, details, pointedTo, factors = [], sart, reasoningRight, you = {} } = result
    const measured = factors.flatMap((group) => group.factors).filter((factor) => factor.measuredPct > 0)
    const measuredRows = factors.flatMap((group) => group.factors.filter((factor) => factor.measuredPct > 0).map((factor) => ({ ...factor, group: group.title })))
    const restRows = factors.flatMap((group) => group.factors.filter((factor) => factor.measuredPct === 0))
    const untouched = factors.filter((group) => group.factors.every((factor) => factor.measuredPct === 0)).map((group) => group.title.toLowerCase())

    return (
        <section className="demo-step demo-result">
            <h1>{name}, here's your glimpse.</h1>
            <h2>Two careers your story points to</h2>
            {careers.length === 0 && (
                <p>Your words didn't point to one of our careers yet — that happens with a few short answers. The full counselling asks about four stages of your life, and finds far more.</p>
            )}
            {careers.length === 1 && <p className="demo-hint">Your words pointed to one career this time. The full counselling asks about four stages of your life, and finds far more.</p>}
            <div className="match-list">
                {careers.map(({ entry }, index) => (
                    <div key={entry.professionId} className="demo-career">
                        <ProfessionCard
                            entry={entry}
                            detail={details[entry.professionId]}
                            detailsLoaded
                            journey={you.stage || undefined}
                            you={you}
                            rank={index + 1}
                            topRank={index + 1}
                            switchCost={0}
                        />
                    </div>
                ))}
            </div>
            {/* Round 36 (owner): in this order — the tap hint, the limit in bold, the question, what 5 minutes
                can't do, then the snapshot with its line underneath */}
            <p className="demo-hint">Tap a career to open everything about it.</p>
            <p className="demo-limit"><strong>The demo result is limited to two careers.</strong></p>
            <p className="demo-unhappy">Not happy with the 2 recommendations?</p>
            <p className="demo-fomo">That took about 5 minutes. <strong>The full journey takes 3+ hours</strong> — and finds sharper careers, the road to each, and a far deeper you.</p>

            <details className="faq-item demo-fold demo-snapshot">
                <summary>Your psychometric snapshot</summary>
                <p>
                    Seven quick statements, a 90-second focus game and four puzzles touched {measured.length} factors —
                    and none of them fully. The bar shows how much of each we measured; the rest we didn't touch at all.
                </p>
                {(reasoningRight !== undefined || sart) && (
                    <p className="demo-hint">
                        {typeof reasoningRight === "number" && <>Puzzles: {reasoningRight} of 4 right. </>}
                        {sart && sart.meanMs && <>Focus game: average response {secondsOf(sart.meanMs)}, {sart.pressesOnThree} of {sart.threes} presses on a 3.</>}
                        {sart && sart.tooEarly && <>Focus game: many presses came before the number appeared, so we couldn't read your speed.</>}
                    </p>
                )}
                {/* measured (partly) first, the rest blurred below — owner, Round 33 */}
                <div className="demo-factor-group">
                    <h3>What we measured — partly</h3>
                    <ul>
                        {measuredRows.map((factor) => (
                            <li key={factor.factor} className="is-measured">
                                <span className="demo-factor-name">{factor.name} <small>· {factor.group}</small></span>
                                <span className="demo-factor-level">{factor.level || "—"}</span>
                                <span className="demo-measure" aria-label={`${factor.measuredPct}% measured`}>
                                    <span style={{ width: `${factor.measuredPct}%` }} />
                                </span>
                                <span className="demo-measure-pct">{factor.measuredPct}% measured</span>
                            </li>
                        ))}
                    </ul>
                </div>
                <div className="demo-factor-group demo-factor-locked">
                    <h3>Not measured yet — {TOTAL_FACTORS - measuredRows.length} factors</h3>
                    <ul aria-label="Factors the full assessment measures">
                        {restRows.map((factor) => (
                            <li key={factor.factor} className="is-faded">
                                <span className="demo-factor-name">{factor.name}</span>
                                <span className="demo-measure-pct">0% measured</span>
                            </li>
                        ))}
                    </ul>
                    <p className="demo-locked-note">The full assessment measures all {TOTAL_FACTORS}.</p>
                </div>
            </details>
            <p className="demo-hint demo-snapshot-note">Just {measured.length} of {TOTAL_FACTORS} factors, and even those only partly measured.</p>

            <details className="faq-item demo-fold">
                <summary>What we did differently</summary>
                <p>
                    We started with <strong>your story</strong> — what you've enjoyed, what stuck and why — and let it
                    point to careers first. Only then did we look at your answers to the three tasks, and only to check
                    whether those careers fit the fundamentals they ask for.
                </p>
                <p>
                    Most tests do it the other way round: they score you first and screen careers by marks or
                    intelligence — which skips what you truly care about.
                </p>
                <p><Link to="/how-it-works">How the full program works →</Link></p>
            </details>

            {/* WHAT THE FULL PROGRAM GIVES YOU (owner, Round 36) — what they missed, and how to get there: four
                crisp points that open to a line or two, then the way to the programs */}
            <section className="demo-adds">
                <h2>What you missed — and what the full program gives you</h2>
                <details className="demo-add-card">
                    <summary><span className="demo-add-icon" aria-hidden="true">🧭</span>A detailed virtual career counselling experience</summary>
                    <p>Instead of three short questions, it walks through four stages of your life — what you did, what stuck and why — so you understand yourself before any career is named.</p>
                </details>
                <details className="demo-add-card">
                    <summary><span className="demo-add-icon" aria-hidden="true">🧠</span>All {TOTAL_FACTORS} factors, measured completely — not just {measured.length}</summary>
                    <p>
                        The demo touched {measured.length}, and only partly.{untouched.length > 0 && <> It didn't touch {untouched.join(", ")} at all.</>}
                        {" "}The full assessment measures all {TOTAL_FACTORS}, properly.
                    </p>
                </details>
                <details className="demo-add-card">
                    <summary><span className="demo-add-icon" aria-hidden="true">🎯</span>A whole list of careers — not just two</summary>
                    <p>
                        {typeof pointedTo === "number" && pointedTo > 2 && <>Your few words already pointed to {pointedTo}. </>}
                        The full report ranks every career your story points to, from 1,000+ careers and job roles — each with its road from where you stand, exams, money, demand and AI exposure.
                    </p>
                </details>
                <details className="demo-add-card">
                    <summary><span className="demo-add-icon" aria-hidden="true">🤝</span>Talk to a mentor in one of these two careers</summary>
                    <p>Someone who does the work, one to one — or find more careers that fit you first, then choose the one to talk to a mentor in.</p>
                </details>
            </section>

            <DemoPlans />
        </section>
    )
}

export default DemoResult
