import { useRef, useState } from "react"
import { TOTAL_MINUTES } from "./assessmentModules"
import { reviewLabel } from "./moduleLabels"
import { factorCoverage } from "./factorFeeds"
import { ResearchBox, ModuleWhy, ReportProblem } from "./ResearchBox"
import { NEEDS } from "./accommodations"

// the tests a student can raise a technical problem about (and the admin can reopen)
const PERFORMANCE_TESTS = ["storyRecall", "digitSpan", "wordRecall", "sartRaw", "reasoning", "extReasoning", "extVerbal"]

// The assessment's landing page — every section, what is done, what is still to come.
//
// UNBUILT SECTIONS ARE SHOWN, NOT HIDDEN. A student who can see that six more sections are coming
// understands why their report says the picture is partial. One who sees two sections and then a
// report concludes the whole product is thin. The same honesty runs through `completeness.release`
// on the report itself — this is just the student-facing half of it.

// What the story section should say, given where its clock actually is.
//
// The static note ("starts a one-hour clock, you are asked about it tomorrow") is only true BEFORE
// the story is opened. Once it is running, the student's next question is always "how long have I
// got" — and answering it on this page means they do not have to open the section to find out,
// which matters when opening it is the thing that costs them time.
const storyNote = (module, storyState) => {
    if (module.key !== "storyRecall" || !storyState) return module.note

    if (storyState.phase === "reading") {
        const minutes = storyState.minutesLeft
        return `About ${minutes} ${minutes === 1 ? "minute" : "minutes"} left before this disappears.`
    }

    if (storyState.phase === "waiting") {
        const hours = Math.max(0, Math.ceil(storyState.recallOpensHours - storyState.hoursElapsed))
        return `The story is gone, as intended. The questions open in about ${hours} ${hours === 1 ? "hour" : "hours"}.`
    }

    if (storyState.phase === "recall") {
        const hours = Math.max(1, Math.round(storyState.hoursLeft))
        return `The questions are open — about ${hours} ${hours === 1 ? "hour" : "hours"} left to answer them.`
    }

    if (storyState.phase === "expired") return "The two-day window closed, so this section will not be scored."
    if (storyState.phase === "submitted") return "Answered."

    return module.note
}

// EVERY SECTION IS PRESENTED THE SAME WAY, in one list, in order.
//
// Three of them do not technically block the Submit button — SART because a phone that fails its
// timing check can never complete it, and the two external tests because they live on somebody
// else's website. That is a safety valve so nobody gets trapped, NOT a feature to advertise. A
// section labelled "optional" is a section most students skip, and a report built without the
// reasoning test is measurably worse at the one job it has.
//
// So the list says nothing about which sections gate submission. A student who finishes everything
// gets the best report; a student who cannot finish one is not stuck.
// The story's three beats, in short lines (Round 13, owner: the old paragraph was hard to read).
const STORY_STEPS = [
    ["📖", "Today: read a short story. It stays open for an hour."],
    ["🌙", "Tomorrow: a few questions about it open."],
    ["⏳", "They stay open for two days, then close."],
]

// One look for state, everywhere (components.css .status-chip): done, in progress with what is left,
// set aside, and waiting on the student.
const statusOf = ({ isDone, isSkipped, isStarted, pct, story }) => {
    if (isSkipped) return { cls: "is-aside", text: "Set aside" }
    if (story === "recall") return { cls: "is-pending", text: "Answer now" }
    if (story === "waiting") return { cls: "is-progress", text: "Questions open tomorrow" }
    if (story === "reading") return { cls: "is-progress", text: "Reading now" }
    if (story === "expired") return { cls: "is-aside", text: "Closed" }
    if (isDone) return { cls: "is-done", text: "✓ Done" }
    if (isStarted) return { cls: "is-progress", text: pct === null || pct === undefined ? "In progress" : `In progress · ${100 - pct}% left` }
    return { cls: "", text: "To do" }
}

const untilText = (hoursLeft) => new Date(Date.now() + hoursLeft * 3600 * 1000)
    .toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric" })

// THE PAGE IS A DECK (Round 13, owner): one big card for the section in hand, arrows (or a swipe) to
// move between them, and a strip of small cards underneath showing every section's state at a
// glance. Story questions that are waiting on the student come first, in bold, above everything.
function AssessmentIntro({ modules, completed, started, progress = {}, storyState, onOpen, onSubmit, canSubmit, isSubmitting, alreadySubmitted, hasNewAnswers, onReadReport, retakeGranted = {}, accommodations = null, onSaveAccommodations }) {
    const built = modules.filter((module) => module.built)
    const comingSoon = modules.filter((module) => !module.built)
    const unfinished = built.filter((module) => !completed.includes(module.key))
    // a section skipped for a declared difficulty is finished, but it measured nothing
    const skipped = (accommodations && accommodations.skipped) || {}
    const coverage = factorCoverage(completed.filter((key) => !skipped[key]))
    const needLabels = ((accommodations && accommodations.needs) || []).map((id) => (NEEDS.find((need) => need.id === id) || {}).label).filter(Boolean)
    const setAside = built.filter((module) => skipped[module.key])
    const doneCount = built.filter((module) => completed.includes(module.key)).length
    const storyPhase = storyState ? storyState.phase : null

    // the deck opens on the first section still to do. The story steps aside once it has been read —
    // while its reading window runs and while it waits for tomorrow's questions (Round 17, owner: the
    // test still in progress comes to the front) — unless nothing else is left.
    const open = (module) => !completed.includes(module.key) && !skipped[module.key]
    const storyAside = (module) => module.key === "storyRecall" && (storyPhase === "waiting" || storyPhase === "reading")
    const firstOpen = built.findIndex((module) => open(module) && !storyAside(module)) !== -1
        ? built.findIndex((module) => open(module) && !storyAside(module))
        : built.findIndex((module) => open(module) && storyPhase !== "waiting")
    // until the student picks a card it follows the data, which arrives after the first render
    const [picked, setIndex] = useState(null)
    // the strip of every test stays folded until asked for (owner, Round 15) — the card in hand is the page
    const [showAll, setShowAll] = useState(false)
    const index = picked === null ? Math.max(firstOpen, 0) : picked
    const touchX = useRef(null)
    const move = (step) => setIndex(Math.min(built.length - 1, Math.max(0, index + step)))

    const stateOf = (module) => {
        const isSkipped = Boolean(skipped[module.key])
        const isDone = completed.includes(module.key) && !isSkipped
        const isStarted = started.includes(module.key)
        const story = module.key === "storyRecall" && storyPhase && storyPhase !== "not_started" && storyPhase !== "submitted" ? storyPhase : null
        return { isSkipped, isDone, isStarted, status: statusOf({ isDone, isSkipped, isStarted, pct: progress[module.key], story }) }
    }

    const renderCard = (module) => {
        const { isSkipped, isDone, isStarted, status } = stateOf(module)
        const note = storyNote(module, storyState)
        const storyFresh = module.key === "storyRecall" && (!storyState || storyPhase === "not_started")

        // Three states, not two. "Review answers" on a module the student has barely begun tells
        // them they have finished something they have not, and they stop returning to it. A
        // started-but-unfinished module says Continue.
        let label = isDone ? reviewLabel(module) : isStarted ? "Continue" : "Start"

        // The story's button follows its clock, not its answers. "Continue" during the 24-hour wait
        // invites a student to open a section that can only tell them to come back later — and
        // doing that repeatedly is how a task starts to feel broken.
        if (module.key === "storyRecall" && storyState) {
            const byPhase = {
                not_started: "Start",
                reading: "Read it again",
                waiting: "Check the time left",
                recall: "Answer the questions",
                expired: "See what happened",
                submitted: reviewLabel(module),
            }
            label = byPhase[storyState.phase] || label
        }

        // an admin reopened this test after a technical problem, and it has not been taken again yet
        const reopened = Boolean(retakeGranted[module.key]) && !isDone

        return (
            <div
                className={`deck-card module-row${isDone ? " is-done" : ""}${isSkipped ? " is-set-aside" : ""}`}
                onTouchStart={(event) => { touchX.current = event.touches[0].clientX }}
                onTouchEnd={(event) => {
                    const dx = event.changedTouches[0].clientX - (touchX.current || 0)
                    if (Math.abs(dx) > 60) move(dx < 0 ? 1 : -1)
                }}
            >
                <div className="deck-card-top">
                    <span className={`status-chip ${status.cls}`}>{status.text}</span>
                    <span className="deck-count">{index + 1} of {built.length}</span>
                </div>
                <div className="module-title-row">
                    <h2 className="module-title">{module.title}</h2>
                    <ModuleWhy moduleKey={module.key} />
                </div>
                <p className="deck-minutes">About {module.minutes} minutes</p>
                {reopened && (
                    <p className="retake-note">
                        <strong>Retake available</strong> — your earlier attempt had a technical problem, so this is open
                        again for one more try. Press Submit again afterwards so your report is updated.
                    </p>
                )}
                {storyFresh ? (
                    <ul className="story-steps">
                        {STORY_STEPS.map(([icon, text]) => <li key={text}><span aria-hidden="true">{icon}</span> {text}</li>)}
                    </ul>
                ) : note && <p className="deck-note">{note}</p>}
                {isSkipped ? (
                    <p className="set-aside-note">
                        Set aside because of what you told us in your interest form — <strong>not measured</strong>, never counted as low.{" "}
                        <button type="button" className="link-btn" onClick={() => onSaveAccommodations({ ...accommodations, skipped: { ...skipped, [module.key]: false } })}>I'd like to try this test anyway</button>
                    </p>
                ) : (
                    <button type="button" className={isDone ? "btn btn-ghost" : "btn btn-primary"} onClick={() => onOpen(module.key)}>{label}</button>
                )}
                {PERFORMANCE_TESTS.includes(module.key) && (isDone || isStarted) && <ReportProblem moduleKey={module.key} />}
                <div className="deck-nav">
                    <button type="button" className="deck-arrow" onClick={() => move(-1)} disabled={index === 0} aria-label="Previous section">‹</button>
                    <button type="button" className="deck-arrow" onClick={() => move(1)} disabled={index === built.length - 1} aria-label="Next section">›</button>
                </div>
            </div>
        )
    }

    return (
        <div className="assess-page">
            {/* waiting on the student, so it comes first */}
            {storyPhase === "recall" && (
                <button type="button" className="assess-pending" onClick={() => onOpen("storyRecall")}>
                    <span className="status-chip is-pending">Waiting for you</span>
                    <strong>Answer your story questions — open until {untilText(storyState.hoursLeft)}</strong>
                </button>
            )}

            <h1>The assessment</h1>

            <p>
                It measures how you think and work. It is not an exam and there is nothing to revise for.
                Do it in as many sittings as you like — every section saves when you leave it.
            </p>

            <p className="assess-meta">
                <strong>{doneCount} of {built.length} done</strong> · about {TOTAL_MINUTES} minutes in all
            </p>

            {/* how much of the picture the finished sections already measure (owner, Round 10) */}
            <p className="coverage-line">
                <strong>{coverage.count} of {coverage.total} factors</strong> can be measured from what you have
                finished — {coverage.pct}%.
            </p>
            <div className="coverage-bar" aria-hidden="true"><span style={{ width: `${coverage.pct}%` }} /></div>

            {/* Round 13: what the student told us in the interest form decides which tests are set aside */}
            {needLabels.length > 0 && setAside.length > 0 && (
                <div className="set-aside-box">
                    <p>
                        In your interest form you told us that <strong>{needLabels.join(", ").toLowerCase()}</strong> can
                        be harder for you. So these tests are set aside — marked <strong>not measured</strong>, never
                        counted as low: {setAside.map((module) => module.title).join(", ")}.
                    </p>
                </div>
            )}

            {alreadySubmitted && (
                <p>
                    <strong>You have already submitted.</strong> You can still open a section to
                    review your answers, and anything you change will be picked up the next time
                    your report is prepared.
                </p>
            )}

            {built[index] && renderCard(built[index])}

            <button type="button" className="btn btn-ghost show-tests" aria-expanded={showAll} onClick={() => setShowAll(!showAll)}>
                {showAll ? "Hide the list of tests" : `Show me all the tests (${built.length - doneCount} left)`}
            </button>

            {showAll && <ol className="deck-strip" aria-label="All sections">
                {built.map((module, position) => {
                    const { status } = stateOf(module)
                    return (
                        <li key={module.key}>
                            <button
                                type="button"
                                className={`deck-tile${position === index ? " is-current" : ""}`}
                                aria-current={position === index ? "true" : undefined}
                                onClick={() => { setIndex(position); document.querySelector(".deck-card")?.scrollIntoView({ behavior: "smooth", block: "start" }) }}
                            >
                                <span className="deck-tile-title">{module.title}</span>
                                <span className={`status-chip ${status.cls}`}>{status.text}</span>
                            </button>
                        </li>
                    )
                })}
            </ol>}

            <ResearchBox />

            {comingSoon.length > 0 && (
                <>
                    <h2>Still to come</h2>
                    <p>
                        These sections are not open yet. You can submit without them — your report
                        will tell you which parts of the picture are still missing, and you can come
                        back and fill them in to sharpen it.
                    </p>
                    <ul>
                        {comingSoon.map((module) => (
                            <li key={module.key}>
                                {module.title} · about {module.minutes} minutes
                                {module.external && <span> · done on another website</span>}
                                {module.note && <span> — {module.note}</span>}
                            </li>
                        ))}
                    </ul>
                </>
            )}

            <div className="assess-submit">
            {/* THREE STATES, AND THE MIDDLE ONE IS THE POINT. A student who has submitted and
                changed nothing since already has a report waiting; offering them "Submit and build
                my report" sends them round a minute-long pipeline to be handed what they could have
                read at once, and re-bills every model call for an identical result. */}
            {alreadySubmitted && !hasNewAnswers ? (
                <>
                    <button
                        type="button"
                        className="btn btn-primary btn-next"
                        onClick={onReadReport}
                    >
                        Read my report
                    </button>
                    <p>
                        <em>
                            Your report is built from these answers. Change any of them and this
                            becomes a resubmit.
                        </em>
                    </p>
                </>
            ) : (
                <>
                    <button
                        type="button"
                        className="btn btn-primary btn-next"
                        onClick={onSubmit}
                        disabled={!canSubmit || isSubmitting}
                    >
                        {isSubmitting
                            ? "Submitting…"
                            : alreadySubmitted
                                ? "Submit again — you have new answers"
                                : "Submit and build my report"}
                    </button>

                    {alreadySubmitted && hasNewAnswers && (
                        <p>
                            <em>
                                You have changed something since your last report. Submitting again
                                rebuilds it with the new answers included.
                            </em>
                        </p>
                    )}
                </>
            )}

            {!canSubmit && !alreadySubmitted && (
                <p><em>Finish the sections above to submit.</em></p>
            )}

            {canSubmit && unfinished.length > 0 && (
                <p>
                    <em>
                        {unfinished.length === 1 ? "One section is" : `${unfinished.length} sections are`}{" "}
                        still unfinished. Finishing {unfinished.length === 1 ? "it" : "them"} makes your
                        report more specific. You can also submit now and finish{" "}
                        {unfinished.length === 1 ? "it" : "them"} afterwards — your report is rebuilt
                        with whatever you add.
                    </em>
                </p>
            )}
            </div>
        </div>
    )
}

export default AssessmentIntro
