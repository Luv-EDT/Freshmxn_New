import { useState } from "react"
import { whyFits, cardSteps, entryRoute } from "./reportPlan"

// One profession in the report: a heading until it is opened, then everything the taxonomy knows.
//
// HEADING ONLY, BY DEFAULT. The old report printed four lines under every profession and a student
// scrolled past forty of them without reading one. A list of names is scannable; a list of
// paragraphs is wallpaper.
//
// EVERY SECTION DISAPPEARS WHEN ITS FIELD IS EMPTY, and that is not tidiness. Sectors 8-18 — Design,
// Media, Performing Arts, Hospitality, Personal Care — have far sparser exam and gate data than the
// exam-gated sectors, so a student looking at Tattoo Artist would meet a column of "N/A" that reads
// as "we know nothing about this" rather than "this has no entrance exam, which is the point".

// The student's journey, mapped onto the four levels a path step can sit at. Exported because
// the report derives its concrete next actions from the same mapping — two copies would drift.
export const JOURNEY_LEVEL = {
    class9_10: 0,
    class11_12: 1,
    college: 2,
    early_professional: 3,
}

// ⚠ THE PATH LEVELS ARE ANCHORED AT THE HEAD AND FORWARD-FILLED, NOT ENUMERATED.
//
// `stage` is free-form and has about ninety distinct values across the taxonomy — `aibe`, `ssb`,
// `showreel`, `sea_time`, `articleship`, `hygiene`. A fixed map would cover the common head and
// silently mis-bucket the long tail, which sits mid-path — exactly where a college student's cursor
// lands.
//
// What the data does guarantee, verified across all 223: `step` is strictly increasing in every
// record, and a school token appears at step 1 or not at all — never later. So anchor the handful
// of tokens that are unambiguous, and let every unrecognised stage INHERIT the level of the step
// before it. Monotonicity does the rest, and a new taxonomy value lands in the right bucket instead
// of a wrong one.
const STAGE_ANCHORS = {
    class_9_10: 0, class_10: 0, class_10_12: 0,
    class_11_12: 1, class_12: 1,
    entrance_exam: 2, entrance: 2, degree: 2, undergrad: 2, diploma: 2,
}

export const levelPath = (steps) => {
    let running = 0

    return steps.map((step) => {
        const anchor = STAGE_ANCHORS[step.stage]
        running = anchor === undefined ? running : Math.max(running, anchor)
        return { ...step, level: running }
    })
}

const STAGE_LABELS = {
    class_9_10: "School", class_10: "Class 10", class_10_12: "School",
    class_11_12: "Class 11-12", class_12: "Class 12",
    entrance_exam: "Entrance exam", degree: "Degree", undergrad: "Degree",
    post_graduate: "Postgraduate", specialisation: "Specialisation",
    training: "Training", certification: "Certification", registration: "Registration",
    work: "Work", employment: "Work", practice: "Practice",
}

// The long tail of taxonomy stages has no label; show it in sentence case ("Portfolio", not "portfolio").
const stageLabel = (stage) => {
    if (STAGE_LABELS[stage]) return STAGE_LABELS[stage]
    const words = String(stage || "").replace(/_/g, " ")
    return words.charAt(0).toUpperCase() + words.slice(1)
}

const DEMAND_WORDS = {
    high: "High — employers are hiring",
    moderate: "Moderate — steady, not booming",
    low: "Low — fewer openings",
    declining: "Declining — shrinking over time",
}

// "53/100 (medium)" — the value behind the band, shown on the card and beside each row when the
// list is sorted by AI exposure (owner, Round 10). Higher means more of the work is exposed.
export const aiExposureText = (detail) => {
    if (!detail || !detail.aiExposure || typeof detail.aiExposure.raw !== "number") return null
    return `${Math.round(detail.aiExposure.raw)}/100${detail.aiExposure.band ? ` (${detail.aiExposure.band})` : ""}`
}

const AI_WORDS = {
    low: "Low — the core of this work is hard to automate",
    medium: "Medium — parts of it are already changing",
    high: "High — a lot of this is exposed",
}

const Section = ({ title, children }) => (
    <div className="pc-section">
        <p className="pc-section-title">{title}</p>
        {children}
    </div>
)

// A collapsed sub-section inside an opened card. The owner's rule for the report (2026-09-29): the
// first three things are always visible, everything else is one tap away, so opening a career is
// never a wall of text. Rendered only when it has something in it.
const More = ({ title, children }) => (
    <details className="pc-more">
        <summary>{title}</summary>
        <div className="pc-more-body">{children}</div>
    </details>
)

const SUBJECTS = { physics: "Physics", chemistry: "Chemistry", maths: "Maths", biology: "Biology" }

const DEGREE_WORDS = {
    none: "No degree needed",
    certificate: "A certificate or diploma is enough",
    undergrad: "A bachelor's degree",
    professional: "A professional degree (like MBBS, LLB or CA)",
}

const MID_STREAM_WORDS = {
    open: "Yes — you can move in from almost any background",
    after_any_degree: "Yes, after any degree",
    restart_undergrad: "Only by starting its own degree",
}

const MASTERS_WORDS = {
    work_first: "Not needed — start working after your degree",
    masters_advantage: "Helps later, but not needed to start",
    masters_required: "Needed to practise",
    masters_is_the_entry: "The master's is the way in",
}

const SELF_WORDS = {
    common: "Common — many people do this for themselves",
    possible_later: "Possible later, once you have experience",
    rare: "Rare — this is mostly employed work",
}

const monthYear = (iso) => {
    const date = iso ? new Date(iso) : null
    return date && !Number.isNaN(date.getTime())
        ? date.toLocaleDateString("en-IN", { month: "short", year: "numeric" })
        : null
}

function ProfessionCard({ entry, detail, detailsLoaded, journey, onOpen, switchCost, topRank, showAi, degreeLabel }) {
    const [open, setOpen] = useState(false)

    const toggle = () => {
        const next = !open
        setOpen(next)
        if (next && !detail && onOpen) onOpen(entry.professionId)
    }

    const studentLevel = JOURNEY_LEVEL[journey]
    const steps = detail ? levelPath(detail.pathToEntry || []) : []

    // The first step at or beyond where the student is — what they do next.
    const nextIndex = studentLevel === undefined
        ? -1
        : steps.findIndex((step) => step.level >= studentLevel)

    const fit = whyFits(entry)
    // A class 11-12 student is already IN the school step, so their next step is the first one after
    // school (the entrance exam or the degree), not "any stream" again.
    const stepForPlan = journey === "class11_12"
        ? steps.find((step) => step.level > studentLevel) || null
        : (nextIndex >= 0 ? steps[nextIndex] : null)
    const nextSteps = cardSteps(entry, detail, journey, stepForPlan)

    // Nuances attach under the section they annotate, so a caveat about money sits with the money.
    // The server sends a section id rather than the taxonomy's own field name — the card needs to
    // know where to put it, the student does not need to see `entry_competition`.
    const Nuances = ({ section }) => {
        const rows = (detail && detail.nuances ? detail.nuances : []).filter((nuance) => nuance.section === section)
        if (rows.length === 0) return null
        return rows.map((nuance, index) => (
            <p key={index} className="pc-nuance"><em>{nuance.statement}</em></p>
        ))
    }

    const subjects = detail && Array.isArray(detail.class12Prerequisite) && !detail.class12Prerequisite.includes("any")
        ? detail.class12Prerequisite.map((subject) => SUBJECTS[subject] || subject).join(" + ")
        : null
    const laterStage = journey === "college" || journey === "early_professional"
    const blueCollar = Boolean(detail && detail.blueCollar)
    const aiValue = aiExposureText(detail)

    return (
        <div className={`profession-card${topRank ? ` is-top is-top-${topRank}` : ""}${open ? " is-open" : ""}`}>
            <button
                type="button"
                onClick={toggle}
                className="pc-toggle"
                aria-expanded={open}
            >
                {/* THE NAME, AND NOTHING ELSE (owner, 2026-09-24) — plus, since 2026-09-30, the
                    blue-collar tag, which the owner asked to travel with these careers everywhere. */}
                <span className="pc-name">
                    {topRank > 0 && <span className="pc-top">Top match</span>}
                    {entry.profession}
                    {blueCollar && <span className="pc-tag">Blue-collar</span>}
                    {/* Round 10 (owner): when a career's picture is incomplete, say how much of what
                        it needs was measured — and say nothing when it is complete */}
                    {typeof entry.measuredPct === "number" && (
                        <span className="pc-partial">Partial · {entry.measuredPct}% measured</span>
                    )}
                    {/* the AI sub-sort shows the number it is sorting by */}
                    {showAi && aiValue && <span className="pc-ai">AI exposure {aiValue}</span>}
                </span>
                <span className="pc-sign" aria-hidden="true">{open ? "−" : "+"}</span>
            </button>

            {open && (
                <div className="pc-body">
                    {/* "Loading…" only while something is actually in flight. Once the fetch has
                        answered and this profession still has no record, saying "loading" implies
                        something is on its way that never is — and the student sits waiting. */}
                    {!detail && !detailsLoaded && <p><em>Loading…</em></p>}

                    {!detail && detailsLoaded && (
                        <p><em>The details for this one could not be loaded. Everything above it is still accurate.</em></p>
                    )}

                    {/* 1. WHAT IT IS */}
                    {detail && (
                        <div className="pc-what">
                            {detail.oneLiner && <p className="pc-oneliner">{detail.oneLiner}</p>}
                            <p className="pc-small">
                                {detail.professionalSector}
                                {detail.jobRoles.length > 0 && <span> · e.g. {detail.jobRoles.slice(0, 3).join(", ")}</span>}
                            </p>
                        </div>
                    )}

                    {/* 2. WHY IT FITS YOU — built from the ranking, never from a model, never a number */}
                    {(fit.strengths.length > 0 || fit.via || entry.bestRoles) && (
                        <Section title="Why it fits you">
                            {fit.strengths.length > 0 && (
                                <p className="pc-line">It uses what you're strongest at: <strong>{fit.strengths.join(", ")}</strong>.</p>
                            )}
                            {fit.via && <p className="pc-line">You got here through: <strong>{fit.via}</strong>.</p>}
                            {fit.stretch && <p className="pc-small">It would stretch you on {fit.stretch}.</p>}
                            {/* Round 10: the role group inside this career that fits better than the whole */}
                            {entry.bestRoles && entry.bestRoles.roles && (
                                <p className="pc-line">
                                    Roles in this career that suit you most: <strong>{entry.bestRoles.roles.join(", ")}</strong>.
                                    {entry.bestRoles.why && <span className="pc-small"> {entry.bestRoles.why}</span>}
                                </p>
                            )}
                        </Section>
                    )}

                    {/* 3. YOUR NEXT STEPS — for this student's stage */}
                    {(nextSteps.length > 0 || switchCost > 0 || (entry.degreeCounts && degreeLabel)) && (
                        <Section title="Your next steps">
                            {/* Round 10: the student's own degree already leads here */}
                            {entry.degreeCounts && degreeLabel && (
                                <p className="pc-line">Your <strong>{degreeLabel}</strong> already counts towards this — no need to start again.</p>
                            )}
                            {/* Worth-the-switch shows its cost beside the fit (DECISIONS §5). */}
                            {switchCost > 0 && (
                                <p className="pc-small">About {switchCost} years of what you've done so far would be left behind.</p>
                            )}
                            {nextSteps.length > 0 && (
                                <ul className="pc-steps">
                                    {nextSteps.map((step) => <li key={step}>{step}</li>)}
                                </ul>
                            )}
                        </Section>
                    )}

                    {detail && (
                        <>
                            {/* 4. THE ROAD */}
                            <More title="The road">
                                {typeof entry.display.yearsToQualify === "number" && (
                                    <p className="pc-years">About <strong>{entry.display.yearsToQualify} years</strong> to qualify</p>
                                )}

                                {steps.length > 0 && (
                                    <Section title="How you get there">
                                        <ol className="pc-path">
                                            {steps.map((step, index) => {
                                                const isNext = index === nextIndex
                                                const isPast = studentLevel !== undefined && step.level < studentLevel

                                                return (
                                                    <li
                                                        key={step.step}
                                                        className={`${isPast ? "is-past" : ""}${isNext ? " is-next" : ""}`.trim() || undefined}
                                                    >
                                                        <span className="pc-stage">{stageLabel(step.stage)}</span>
                                                        {isNext && <span className="pc-next"> · your next step</span>}
                                                        <br />
                                                        {step.requirement}
                                                    </li>
                                                )
                                            })}
                                        </ol>
                                        <Nuances section="path" />
                                    </Section>
                                )}

                                <dl className="pc-facts">
                                    <dt>Subjects in Class 11–12</dt>
                                    <dd>{subjects || "Any stream"}</dd>
                                    {(entryRoute(detail) || DEGREE_WORDS[detail.degreeDependency]) && (
                                        <>
                                            <dt>Degree needed</dt>
                                            <dd>{entryRoute(detail) || DEGREE_WORDS[detail.degreeDependency]}</dd>
                                        </>
                                    )}
                                    {laterStage && MID_STREAM_WORDS[detail.midStreamEntry] && (
                                        <>
                                            <dt>Can you switch in?</dt>
                                            <dd>{MID_STREAM_WORDS[detail.midStreamEntry]}</dd>
                                        </>
                                    )}
                                    {laterStage && MASTERS_WORDS[detail.afterUndergrad] && (
                                        <>
                                            <dt>A master's?</dt>
                                            <dd>{MASTERS_WORDS[detail.afterUndergrad]}</dd>
                                        </>
                                    )}
                                    {detail.licensingBody && (
                                        <>
                                            <dt>Licence</dt>
                                            <dd>From {detail.licensingBody}</dd>
                                        </>
                                    )}
                                </dl>

                                {detail.entranceExams && (detail.entranceExams.publicRoutes.length > 0 || detail.entranceExams.note) && (
                                    <Section title="Exams">
                                        {detail.entranceExams.publicRoutes.length > 0 && (
                                            <p className="pc-line">{detail.entranceExams.publicRoutes.join(" · ")}</p>
                                        )}
                                        {detail.entranceExams.privateEntrances.length > 0 && (
                                            <p className="pc-small">
                                                Private: {detail.entranceExams.privateEntrances.join(" · ")}
                                            </p>
                                        )}
                                        {detail.entranceExams.note && <p className="pc-small"><em>{detail.entranceExams.note}</em></p>}
                                        {detail.entryGate && typeof detail.entryGate.applicantsPerSeat === "number" && (
                                            <p className="pc-small">
                                                {detail.entryGate.name}: about <strong>{Math.round(detail.entryGate.applicantsPerSeat)} people per seat</strong>
                                                {detail.entryGate.preparationYears && <span>, usually {detail.entryGate.preparationYears} years of preparation</span>}.
                                            </p>
                                        )}
                                        {detail.entryGate && typeof detail.entryGate.typicalTotalCostLakh === "number" && (
                                            <p className="pc-small">A seat through {detail.entryGate.name} costs about ₹{detail.entryGate.typicalTotalCostLakh}L in total.</p>
                                        )}
                                        {detail.entryGate && detail.entryGate.ifUnsuccessful.length > 0 && (
                                            <p className="pc-small">If it doesn't work out: {detail.entryGate.ifUnsuccessful.join(" · ")}.</p>
                                        )}
                                        <Nuances section="exams" />
                                    </Section>
                                )}

                                {detail.entryWindow && detail.entryWindow.constrainedRoute && (
                                    <Section title="Deadline">
                                        <p className="pc-line">{detail.entryWindow.constrainedRoute}</p>
                                        {detail.entryWindow.bypass.length > 0 && (
                                            <p className="pc-small">Other ways in: {detail.entryWindow.bypass.join(" · ")}</p>
                                        )}
                                    </Section>
                                )}
                            </More>

                            {/* 5. MONEY — ranges only (owner: no payback) */}
                            {detail.economics && (
                                <More title="Money">
                                    <p className="pc-line">
                                        Starting <strong>₹{detail.economics.earlyEarningsLpa}L</strong> a year
                                        {detail.economics.midCareerLpa && <span> · mid-career <strong>₹{detail.economics.midCareerLpa}L</strong></span>}
                                    </p>
                                    {typeof detail.economics.costOfEntryLakh === "number" && (
                                        <p className="pc-small">
                                            Typical cost of qualifying: about ₹{detail.economics.costOfEntryLakh}L
                                        </p>
                                    )}
                                    <p className="pc-small pc-source">
                                        {detail.economics.checked
                                            ? `Pay figures checked${monthYear(detail.economics.checkedOn) ? ` ${monthYear(detail.economics.checkedOn)}` : ""}.`
                                            : "Pay figures are estimates."}
                                        {" "}Mid-career means about 5–8 years in, as an employee.
                                    </p>
                                    {/* The record's own warning, carried with the number rather than
                                        left behind. For these nine the midpoint describes almost
                                        nobody, and a figure without that caveat is misleading. */}
                                    {(detail.economics.distribution === "power_law" || detail.economics.distribution === "bimodal") && (
                                        <p className="pc-small">
                                            <em>
                                                {detail.economics.distribution === "power_law"
                                                    ? "Earnings here are very uneven — a few earn enormously and most earn little. An average figure describes almost nobody."
                                                    : "There are two separate groups here rather than a spread, so the middle figure describes almost nobody."}
                                            </em>
                                        </p>
                                    )}
                                    {/* filter_rules.json's pay rule, as a caution — never a reason to hide. */}
                                    {detail.payCaution && (
                                        <p className="pc-caution">Pay often stays low even after 5–8 years in a city. It goes further in smaller towns.</p>
                                    )}
                                    <Nuances section="pay" />
                                </More>
                            )}

                            {/* 6. THE FUTURE */}
                            {(detail.demand || detail.aiExposure || detail.selfEmployment) && (
                                <More title="The future">
                                    {detail.demand && (
                                        <Section title="Demand">
                                            <p className="pc-line">{DEMAND_WORDS[detail.demand.india] || detail.demand.india}</p>
                                            {detail.demand.pathway === "any" && (
                                                <p className="pc-small">This work can be done for clients anywhere, not only in India.</p>
                                            )}
                                            {detail.demand.note && <p className="pc-small"><em>{detail.demand.note}</em></p>}
                                            <Nuances section="demand" />
                                        </Section>
                                    )}

                                    {detail.aiExposure && (
                                        <Section title="How AI affects this">
                                            <p className="pc-line">{AI_WORDS[detail.aiExposure.band] || detail.aiExposure.band}</p>
                                            {aiValue && <p className="pc-small">AI exposure: <strong>{aiValue}</strong> — higher means more of the work is exposed to AI.</p>}
                                            {detail.aiExposure.workMostly && detail.aiExposure.workMostly.length > 0 && (
                                                <p className="pc-small">The work is mostly {detail.aiExposure.workMostly.join(" and ")}.</p>
                                            )}
                                            {detail.aiExposure.legalAccountability && (
                                                <p className="pc-small">A qualified person has to sign off on this work and be accountable for it — that part AI can't take over.</p>
                                            )}
                                            {detail.aiExposure.reason && <p className="pc-small">{detail.aiExposure.reason}</p>}
                                            <Nuances section="ai" />
                                        </Section>
                                    )}

                                    {detail.selfEmployment && SELF_WORDS[detail.selfEmployment.likelihood] && (
                                        <Section title="Working for yourself">
                                            <p className="pc-line">{SELF_WORDS[detail.selfEmployment.likelihood]}</p>
                                            {detail.selfEmployment.route && <p className="pc-small">{detail.selfEmployment.route}</p>}
                                        </Section>
                                    )}
                                </More>
                            )}

                            {/* 7. MORE ABOUT THE WORK */}
                            {(detail.industries.length > 0 || (detail.roleSpread && detail.roleSpread.deviatingRoles.length > 0)) && (
                                <More title="More about the work">
                                    {detail.industries.length > 0 && (
                                        <Section title="Where this work happens">
                                            <p className="pc-line">{detail.industries.join(" · ")}</p>
                                            {detail.jobRoles.length > 0 && (
                                                <p className="pc-small">
                                                    Roles: {detail.jobRoles.slice(0, 8).join(" · ")}
                                                    {detail.jobRoles.length > 8 && <span> and {detail.jobRoles.length - 8} more</span>}
                                                </p>
                                            )}
                                            <Nuances section="where" />
                                        </Section>
                                    )}

                                    {/* The join nothing else in the product makes: which roles INSIDE this
                                        profession suit this student, from role_spread's deviating groups. */}
                                    {detail.roleSpread && detail.roleSpread.deviatingRoles.length > 0 && (
                                        <Section title="Not all of it is the same job">
                                            {detail.roleSpread.deviatingRoles.map((group, index) => (
                                                <div key={index} className="pc-group">
                                                    <p className="pc-small tight">
                                                        <strong>{group.roles.join(", ")}</strong> lean on{" "}
                                                        {group.higher.join(", ")}
                                                        {group.lower.length > 0 && <span>, and less on {group.lower.join(", ")}</span>}.
                                                    </p>
                                                    <p className="pc-small tight"><em>{group.why}</em></p>
                                                </div>
                                            ))}
                                            <Nuances section="roles" />
                                        </Section>
                                    )}
                                </More>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    )
}

export default ProfessionCard
