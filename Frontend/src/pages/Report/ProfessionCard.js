import { useState } from "react"

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

const stageLabel = (stage) => STAGE_LABELS[stage] || String(stage || "").replace(/_/g, " ")

const DEMAND_WORDS = {
    high: "High — employers are hiring",
    moderate: "Moderate — steady, not booming",
    low: "Low — fewer openings",
    declining: "Declining — shrinking over time",
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

function ProfessionCard({ entry, detail, detailsLoaded, journey, chips, dimmed, missed, onOpen, tierReason }) {
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

    return (
        <div className={`profession-card${dimmed ? " is-dimmed" : ""}${open ? " is-open" : ""}`}>
            <button
                type="button"
                onClick={toggle}
                className="pc-toggle"
                aria-expanded={open}
            >
                <span className="pc-name">{entry.profession}</span>
                <span className="pc-sign" aria-hidden="true">{open ? "−" : "+"}</span>
                <br />
                <span className="pc-meta">
                    {entry.professional_sector}
                    {typeof entry.display.yearsToQualify === "number" && (
                        <span> · {entry.display.yearsToQualify} yrs to qualify</span>
                    )}
                </span>

                {/* The chips answer "why is this here?" in the student's own terms. Built from
                    joins the engine already made — see reportTags.js. */}
                {chips.length > 0 && (
                    <span className="pc-chips">
                        {chips.map((chip) => (
                            <span key={chip} className="chip">{chip}</span>
                        ))}
                    </span>
                )}

                {/* Says which control faded it, rather than leaving a grey row unexplained. */}
                {dimmed && missed.length > 0 && (
                    <span className="pc-dim-note">
                        <em>Outside your {missed.join(" and ")} filter — still here because it matched you.</em>
                    </span>
                )}
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

                    {/* Why this one sits where it sits, in the ranking's own terms. Shown inside
                        the card rather than on the row so the list stays scannable — but shown,
                        because a position with no stated reason is just an assertion. */}
                    {tierReason && (
                        <p className="pc-tier-reason"><em>{tierReason}</em></p>
                    )}

                    {detail && (
                        <>
                            {detail.oneLiner && <p className="pc-oneliner">{detail.oneLiner}</p>}

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
                                    <Nuances section="exams" />
                                </Section>
                            )}

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

                            {detail.economics && (
                                <Section title="What it pays">
                                    <p className="pc-line">
                                        Starting <strong>₹{detail.economics.earlyEarningsLpa}L</strong>
                                        {detail.economics.midCareerLpa && <span> · mid-career <strong>₹{detail.economics.midCareerLpa}L</strong></span>}
                                    </p>
                                    {typeof detail.economics.costOfEntryLakh === "number" && (
                                        <p className="pc-small">
                                            Typical cost of qualifying: about ₹{detail.economics.costOfEntryLakh}L
                                        </p>
                                    )}
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
                                    <Nuances section="pay" />
                                </Section>
                            )}

                            {detail.demand && (
                                <Section title="Demand">
                                    <p className="pc-line">{DEMAND_WORDS[detail.demand.india] || detail.demand.india}</p>
                                    {detail.demand.note && <p className="pc-small"><em>{detail.demand.note}</em></p>}
                                    <Nuances section="demand" />
                                </Section>
                            )}

                            {detail.aiExposure && (
                                <Section title="How AI affects this">
                                    <p className="pc-line">{AI_WORDS[detail.aiExposure.band] || detail.aiExposure.band}</p>
                                    {detail.aiExposure.reason && <p className="pc-small">{detail.aiExposure.reason}</p>}
                                    <Nuances section="ai" />
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

                            {detail.licensingBody && (
                                <p className="pc-small">Licensed by {detail.licensingBody}.</p>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    )
}

export default ProfessionCard
