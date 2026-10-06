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

// ONE LAYOUT FOR EVERY PART OF THE CARD (owner, Round 18): a short title, plain one-line answers,
// then a note where one applies. A part that is a question is written as the question a student
// would ask. `More` is a top-level part (The road, Money…); `Fold` is a sub-heading inside one.
// Each renders only when it has something in it.
const More = ({ title, children }) => (
    <details className="pc-more">
        <summary>{title}</summary>
        <div className="pc-more-body">{children}</div>
    </details>
)

const Fold = ({ title, children }) => (
    <details className="pc-sub">
        <summary>{title}</summary>
        <div className="pc-sub-body">{children}</div>
    </details>
)

const SUBJECTS = { physics: "Physics", chemistry: "Chemistry", maths: "Maths", biology: "Biology" }

const DEGREE_WORDS = {
    none: "No degree needed",
    certificate: "A certificate or diploma is enough",
    undergrad: "A bachelor's degree",
    professional: "A professional degree (like MBBS, LLB or CA)",
}

// "Can I move into this from another course or job?" — answers that explain themselves (Round 18)
const MOVE_IN_WORDS = {
    open: "Yes — you can move in from almost any course or job, without starting a new degree.",
    after_any_degree: "Yes — finish whatever degree you're doing (any subject), then move in.",
    restart_undergrad: "Only by starting the degree this career needs",
}

const MASTERS_WORDS = {
    work_first: "Not needed — start working after your degree",
    masters_advantage: "Helps later, but not needed to start",
    masters_required: "Needed to practise",
    masters_is_the_entry: "The master's is the way in",
}

// "Can I start my own business or freelance?" (was "Working for yourself", Round 18)
const SELF_WORDS = {
    common: "Yes, often — many people in this work run their own business or freelance",
    possible_later: "Yes, later — once you have a few years of experience",
    rare: "Rarely — this is mostly a job with an employer",
}

const ABROAD_STAGE = {
    undergrad: "for the first degree",
    masters: "for a master's",
    doctorate: "for a PhD or research",
    training: "for the training",
}

// Round 13 (owner): the card says what a student can USE — never where a fact came from or when we
// checked it. Those labels live in the data and on the admin and mentor screens.

// Going abroad to work (Round 13): how a career travels, in a student's words
const PORTABILITY_WORDS = {
    travels_well: "Travels well",
    requalify: "A licence first — you would need that country's licence or exam before you can work",
    india_based: "India-based — this is a role in India's own system",
}

// Owner, Round 18: no foreign links — specialist advice, later
const ABROAD_ADVICE = "Studying and working abroad, especially a master's abroad, needs specialist advice. When you reach that stage, we'll connect you with a consultant."

function ProfessionCard({ entry, detail, detailsLoaded, journey, onOpen, switchCost, topRank, rank, showAi, degreeLabel, abroadPlans }) {
    // a student who said maybe or yes to going abroad also sees how this career travels
    const abroadMinded = Boolean(abroadPlans && abroadPlans.hope !== "no")
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

    const subjects = detail && Array.isArray(detail.class12Prerequisite) && !detail.class12Prerequisite.includes("any")
        ? detail.class12Prerequisite.map((subject) => SUBJECTS[subject] || subject).join(" + ")
        : null
    const laterStage = journey === "college" || journey === "early_professional"
    const blueCollar = Boolean(detail && detail.blueCollar)
    const aiValue = aiExposureText(detail)
    const years = entry.display && typeof entry.display.yearsToQualify === "number" ? entry.display.yearsToQualify : null

    // WHICH PARTS SHOW — worked out once, so a note whose part isn't shown can go to "Worth knowing"
    // rather than vanish (owner, Round 18: each note sits in the part it is about).
    const shows = detail ? {
        what: true,
        roles: detail.jobRoles.length > 0,
        where: detail.industries.length > 0,
        path: steps.length > 0 || years !== null,
        subjects: true,
        degree: Boolean(entryRoute(detail) || DEGREE_WORDS[detail.degreeDependency] || detail.licensingBody),
        move_in: laterStage && Boolean(MOVE_IN_WORDS[detail.midStreamEntry]),
        exams: Boolean(detail.entranceExams && (detail.entranceExams.publicRoutes.length > 0 || detail.entranceExams.note)),
        deadline: Boolean(detail.entryWindow && detail.entryWindow.constrainedRoute),
        masters: Boolean(MASTERS_WORDS[detail.afterUndergrad]),
        pay: Boolean(detail.economics),
        demand: Boolean(detail.demand),
        ai: Boolean(detail.aiExposure),
        own_business: Boolean(detail.selfEmployment && SELF_WORDS[detail.selfEmployment.likelihood]),
    } : {}

    const notesFor = (section) => (detail && detail.nuances ? detail.nuances : []).filter((nuance) => nuance.section === section)
    const Notes = ({ section }) => notesFor(section).map((nuance, index) => (
        <p key={index} className="pc-nuance"><em>{nuance.statement}</em></p>
    ))
    const leftover = detail && detail.nuances ? detail.nuances.filter((nuance) => !shows[nuance.section]) : []

    // JOB ROLES, SORTED BY FIT (owner, Round 18): the roles that suit this student first, marked
    const suits = new Set((entry.bestRoles && entry.bestRoles.roles) || [])
    const roles = detail ? [...detail.jobRoles].sort((left, right) => Number(suits.has(right)) - Number(suits.has(left))) : []

    const abroadShown = Boolean(detail && (detail.abroad || abroadMinded))

    return (
        <div className={`profession-card${topRank ? ` is-top is-top-${topRank}` : ""}${open ? " is-open" : ""}`}>
            <button
                type="button"
                onClick={toggle}
                className="pc-toggle"
                aria-expanded={open}
            >
                {/* THE RANK, THEN THE NAME (owner, Round 18): 1, 2, 3… down the left, in the order
                    the student chose — plus the blue-collar tag, which travels with these careers. */}
                {rank > 0 && <span className="pc-rank">{rank}</span>}
                <span className="pc-name">
                    {entry.profession}
                    {blueCollar && <span className="pc-tag">Blue-collar</span>}
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

                    {/* 1. WHAT IT IS — the one-liner, then the roles and where the work happens */}
                    {detail && (
                        <Section title="What it is">
                            {detail.oneLiner && <p className="pc-oneliner">{detail.oneLiner}</p>}
                            <Notes section="what" />
                            {roles.length > 0 && (
                                <Fold title={`Job roles (${roles.length})`}>
                                    <p className="pc-small">Listed by how well they fit you{suits.size > 0 ? " — the ones that suit you most come first" : ""}.</p>
                                    <ul className="pc-roles">
                                        {roles.map((role) => (
                                            <li key={role}>{role}{suits.has(role) && <span className="pc-suits"> · suits you</span>}</li>
                                        ))}
                                    </ul>
                                    {detail.roleSpread && detail.roleSpread.deviatingRoles.length > 0 && (
                                        <div className="pc-group">
                                            <p className="pc-small">Not every role is the same job:</p>
                                            {detail.roleSpread.deviatingRoles.map((group, index) => (
                                                <p key={index} className="pc-small tight">
                                                    <strong>{group.roles.join(", ")}</strong> lean more on {group.higher.join(", ")}
                                                    {group.lower.length > 0 && <span>, and less on {group.lower.join(", ")}</span>}.
                                                </p>
                                            ))}
                                        </div>
                                    )}
                                    <Notes section="roles" />
                                </Fold>
                            )}
                            {detail.industries.length > 0 && (
                                <Fold title="Where this work happens">
                                    <p className="pc-line">{detail.industries.join(" · ")}</p>
                                    <Notes section="where" />
                                </Fold>
                            )}
                        </Section>
                    )}

                    {/* 2. WHY IT FITS YOU — built from the ranking, never from a model, never a number */}
                    {(fit.strengths.length > 0 || fit.via || entry.bestRoles) && (
                        <Section title="Why it fits you">
                            {fit.strengths.length > 0 && (
                                <p className="pc-line">It uses what you're strongest at: <strong>{fit.strengths.join(", ")}</strong>.</p>
                            )}
                            {fit.via && <p className="pc-line">You got here through: <strong>{fit.via}</strong>.</p>}
                            {/* Round 10: the role group inside this career that fits better than the whole */}
                            {entry.bestRoles && entry.bestRoles.roles && (
                                <p className="pc-line">
                                    Roles in this career that suit you most: <strong>{entry.bestRoles.roles.join(", ")}</strong>.
                                    {entry.bestRoles.why && <span className="pc-small"> {entry.bestRoles.why}</span>}
                                </p>
                            )}
                        </Section>
                    )}

                    {/* 3. WHAT TO WORK ON (owner, Round 18) — qualities this work leans on where you are
                        well below what it asks. Worked out on the server; names only, never a number. */}
                    {Array.isArray(entry.workOn) && entry.workOn.length > 0 && (
                        <Section title="What to work on">
                            <p className="pc-line">This work leans on <strong>{entry.workOn.join(", ")}</strong> — more than you show right now.</p>
                            <p className="pc-small">Each of these grows with practice. It's a starting point, not a verdict.</p>
                        </Section>
                    )}

                    {/* 4. YOUR NEXT 12 MONTHS — for this student's stage, inside each career (Round 13, owner) */}
                    {(nextSteps.length > 0 || switchCost > 0 || (entry.degreeCounts && degreeLabel)) && (
                        <Section title="Your next 12 months">
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
                            {/* 5. THE ROAD — one sub-heading per question */}
                            <More title="The road">
                                {shows.path && (
                                    <Fold title="How long, and the path">
                                        {years !== null && <p className="pc-years">About <strong>{years} years</strong> to qualify</p>}
                                        {steps.length > 0 && (
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
                                        )}
                                        <Notes section="path" />
                                    </Fold>
                                )}

                                {/* Subjects PER ROUTE where the routes differ (owner, Round 18) */}
                                <Fold title="Subjects in Class 11–12">
                                    {detail.subjectRoutes ? (
                                        <ul className="pc-routes">
                                            {detail.subjectRoutes.map((row) => (
                                                <li key={row.route}><strong>{row.route}:</strong> {row.subjects}</li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p className="pc-line">{subjects || "Any stream"}</p>
                                    )}
                                    <Notes section="subjects" />
                                </Fold>

                                {shows.degree && (
                                    <Fold title="Do I need a degree?">
                                        {(entryRoute(detail) || DEGREE_WORDS[detail.degreeDependency]) && (
                                            <p className="pc-line">{entryRoute(detail) || DEGREE_WORDS[detail.degreeDependency]}</p>
                                        )}
                                        {detail.licensingBody && <p className="pc-small">You also need a licence, from {detail.licensingBody}.</p>}
                                        <Notes section="degree" />
                                    </Fold>
                                )}

                                {shows.move_in && (
                                    <Fold title="Can I move into this from another course or job?">
                                        <p className="pc-line">
                                            {MOVE_IN_WORDS[detail.midStreamEntry]}
                                            {detail.midStreamEntry === "restart_undergrad" && (years !== null ? ` — about ${years} years.` : ".")}
                                        </p>
                                        <Notes section="move_in" />
                                    </Fold>
                                )}

                                {shows.exams && (
                                    <Fold title="Exams">
                                        {/* the exam calendar (Round 11): what USUALLY happens, and the official site — never this year's dates */}
                                        {(detail.exams || []).length > 0 && (
                                            <ul className="pc-exams">
                                                {detail.exams.map((exam) => (
                                                    <li key={exam.id}>
                                                        <strong>{exam.name}</strong>
                                                        {" · "}
                                                        <a href={exam.officialUrl} target="_blank" rel="noopener noreferrer">official site ↗</a>
                                                        {exam.window && <span className="pc-small"><br />Applications usually: {exam.window}.</span>}
                                                        {exam.examMonth && <span className="pc-small"> Exam usually: {exam.examMonth}.</span>}
                                                        {exam.eligibility && <span className="pc-small"><br />Who can sit it: {exam.eligibility}.</span>}
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                        {(detail.otherRoutes ? detail.otherRoutes.public : detail.entranceExams.publicRoutes).length > 0 && (
                                            <p className="pc-line">{(detail.otherRoutes ? detail.otherRoutes.public : detail.entranceExams.publicRoutes).join(" · ")}</p>
                                        )}
                                        {(detail.otherRoutes ? detail.otherRoutes.private : detail.entranceExams.privateEntrances).length > 0 && (
                                            <p className="pc-small">
                                                Private: {(detail.otherRoutes ? detail.otherRoutes.private : detail.entranceExams.privateEntrances).join(" · ")}
                                            </p>
                                        )}
                                        {detail.entranceExams.note && <p className="pc-small"><em>{detail.entranceExams.note}</em></p>}
                                        {detail.entryGate && typeof detail.entryGate.applicantsPerSeat === "number" && (
                                            <p className="pc-small">
                                                {detail.entryGate.name}: about <strong>{Math.round(detail.entryGate.applicantsPerSeat)} people per seat</strong>
                                                {detail.entryGate.preparationYears && <span>, usually {detail.entryGate.preparationYears} {detail.entryGate.preparationYears === 1 ? "year" : "years"} of preparation</span>}.
                                            </p>
                                        )}
                                        {detail.entryGate && typeof detail.entryGate.typicalTotalCostLakh === "number" && (
                                            <p className="pc-small">A seat through {detail.entryGate.name} costs about ₹{detail.entryGate.typicalTotalCostLakh}L in total.</p>
                                        )}
                                        {detail.entryGate && detail.entryGate.ifUnsuccessful.length > 0 && (
                                            <p className="pc-small">If it doesn't work out: {detail.entryGate.ifUnsuccessful.join(" · ")}.</p>
                                        )}
                                        <Notes section="exams" />
                                    </Fold>
                                )}

                                {shows.deadline && (
                                    <Fold title="Is there a deadline?">
                                        <p className="pc-line">{detail.entryWindow.constrainedRoute}</p>
                                        {detail.entryWindow.bypass.length > 0 && (
                                            <p className="pc-small">Other ways in: {detail.entryWindow.bypass.join(" · ")}</p>
                                        )}
                                        <Notes section="deadline" />
                                    </Fold>
                                )}

                                {/* Where to study (Round 11): NIRF first; a ranked place shows its rank */}
                                {detail.studyPlaces && (
                                    <Fold title="Where to study">
                                        {detail.studyPlaces.institutions.length > 0 && (
                                            <ul className="pc-exams">
                                                {detail.studyPlaces.institutions.map((place) => (
                                                    <li key={`${place.name}-${place.city}`}>
                                                        <strong>{place.name}</strong>{place.city && <span>, {place.city}</span>}
                                                        {place.private && <span className="pc-small"> · private</span>}
                                                        {!place.suggested && <span className="pc-small"> · {place.basis}</span>}
                                                        {place.note && <span className="pc-small"><br />{place.note}</span>}
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                        <p className="pc-small">
                                            {detail.studyPlaces.institutions.length > 0 ? "Full lists: " : `For ${detail.studyPlaces.discipline.toLowerCase()}, see the official lists: `}
                                            {detail.studyPlaces.links.map((link, position) => (
                                                <span key={link.url}>
                                                    {position > 0 && " · "}
                                                    <a href={link.url} target="_blank" rel="noopener noreferrer">{link.label} ↗</a>
                                                </span>
                                            ))}
                                        </p>
                                        {/* Last year's closing ranks (Round 12): only ranks checked on the official page,
                                            always with the category caveat and the page to check */}
                                        {detail.studyPlaces.cutoffs && (
                                            <div className="pc-cutoffs">
                                                {detail.studyPlaces.cutoffs.rows.map((row) => (
                                                    <p key={`${row.institution}-${row.programme}`} className="pc-line">
                                                        {row.institution}, {row.programme} — last closing rank <strong>{row.closingRank.toLocaleString("en-IN")}</strong>
                                                        <span className="pc-small"> ({row.year}, {row.round}, {row.category}, {row.quota}{row.seatPool ? `, ${row.seatPool}` : ""}) · <a href={row.sourceUrl} target="_blank" rel="noopener noreferrer">official result ↗</a></span>
                                                    </p>
                                                ))}
                                                <p className="pc-small">
                                                    {detail.studyPlaces.cutoffs.rows.length > 0 ? detail.studyPlaces.cutoffs.caveat : "Last year's cut-offs: "}{" "}
                                                    {detail.studyPlaces.cutoffs.sources.map((source, position) => (
                                                        <span key={source.url}>
                                                            {position > 0 && " · "}
                                                            <a href={source.url} target="_blank" rel="noopener noreferrer">{source.name} ↗</a>
                                                            {source.noRank && <span> — {source.how}</span>}
                                                        </span>
                                                    ))}
                                                </p>
                                            </div>
                                        )}
                                    </Fold>
                                )}

                                {shows.masters && (
                                    <Fold title="A master's in India?">
                                        <p className="pc-line">{MASTERS_WORDS[detail.afterUndergrad]}</p>
                                        <Notes section="masters" />
                                    </Fold>
                                )}

                                {/* STUDYING AND WORKING ABROAD (owner, Round 18) — inside the career, as a
                                    note: no foreign links; a consultant when the student gets there */}
                                {abroadShown && (
                                    <Fold title="Studying and working abroad">
                                        {detail.abroad && (
                                            <p className="pc-line">
                                                Studying abroad: {detail.abroad.need === "often_needed" ? "often part of the route" : "helps, but not needed"}
                                                {ABROAD_STAGE[detail.abroad.stage] && <span> — {ABROAD_STAGE[detail.abroad.stage]}</span>}. {detail.abroad.why}.
                                            </p>
                                        )}
                                        {abroadMinded && detail.goingAbroad && (
                                            <p className="pc-line">
                                                Working abroad: {PORTABILITY_WORDS[detail.goingAbroad.portability]}. {detail.goingAbroad.note}
                                            </p>
                                        )}
                                        <p className="pc-small">{ABROAD_ADVICE}</p>
                                    </Fold>
                                )}
                            </More>

                            {/* 6. MONEY — ranges only (owner: no payback) */}
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
                                    <p className="pc-small pc-source">Mid-career means about 5–8 years in, as an employee.</p>
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
                                    <Notes section="pay" />
                                </More>
                            )}

                            {/* 7. THE FUTURE */}
                            {(shows.demand || shows.ai || shows.own_business) && (
                                <More title="The future">
                                    {detail.demand && (
                                        <Fold title="Will there be jobs?">
                                            <p className="pc-line">{DEMAND_WORDS[detail.demand.india] || detail.demand.india}</p>
                                            {detail.demand.pathway === "any" && (
                                                <p className="pc-small">This work can be done for clients anywhere, not only in India.</p>
                                            )}
                                            {detail.demand.note && <p className="pc-small"><em>{detail.demand.note}</em></p>}
                                            <Notes section="demand" />
                                        </Fold>
                                    )}

                                    {detail.aiExposure && (
                                        <Fold title="How AI affects this">
                                            <p className="pc-line">{AI_WORDS[detail.aiExposure.band] || detail.aiExposure.band}</p>
                                            {aiValue && <p className="pc-small">AI exposure: <strong>{aiValue}</strong> — higher means more of the work is exposed to AI.</p>}
                                            {detail.aiExposure.workMostly && detail.aiExposure.workMostly.length > 0 && (
                                                <p className="pc-small">The work is mostly {detail.aiExposure.workMostly.join(" and ")}.</p>
                                            )}
                                            {detail.aiExposure.legalAccountability && (
                                                <p className="pc-small">A qualified person has to sign off on this work and be accountable for it — that part AI can't take over.</p>
                                            )}
                                            {detail.aiExposure.reason && <p className="pc-small">{detail.aiExposure.reason}</p>}
                                            <Notes section="ai" />
                                        </Fold>
                                    )}

                                    {shows.own_business && (
                                        <Fold title="Can I start my own business or freelance?">
                                            <p className="pc-line">{SELF_WORDS[detail.selfEmployment.likelihood]}</p>
                                            {detail.selfEmployment.route && <p className="pc-small">{detail.selfEmployment.route}</p>}
                                            <Notes section="own_business" />
                                        </Fold>
                                    )}
                                </More>
                            )}

                            {/* 8. WORTH KNOWING — only the notes whose part isn't shown above */}
                            {leftover.length > 0 && (
                                <More title="Worth knowing">
                                    {leftover.map((nuance, index) => (
                                        <p key={index} className="pc-nuance"><em>{nuance.statement}</em></p>
                                    ))}
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
