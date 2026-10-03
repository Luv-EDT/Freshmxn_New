import { TOTAL_MINUTES } from "./assessmentModules"
import { reviewLabel } from "./moduleLabels"
import { factorCoverage } from "./factorFeeds"
import { ResearchBox, ModuleWhy, ReportProblem } from "./ResearchBox"
import AccommodationsBox from "./AccommodationsBox"
import { affectedModules } from "./accommodations"

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
        return `The questions are open — about ${storyState.hoursLeft} hours left to answer them.`
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
function AssessmentIntro({ modules, completed, started, storyState, onOpen, onSubmit, canSubmit, isSubmitting, alreadySubmitted, hasNewAnswers, onReadReport, retakeGranted = {}, accommodations = null, onSaveAccommodations }) {
    const built = modules.filter((module) => module.built)
    const comingSoon = modules.filter((module) => !module.built)
    const unfinished = built.filter((module) => !completed.includes(module.key))
    // a section skipped for a declared difficulty is finished, but it measured nothing
    const skipped = (accommodations && accommodations.skipped) || {}
    const coverage = factorCoverage(completed.filter((key) => !skipped[key]))
    const skippable = affectedModules(accommodations && accommodations.needs)

    // One renderer for both lists. They differ in what the heading above them says, not in how a
    // section behaves — and having two copies of this is how "Continue" stopped matching the story's
    // clock the first time.
    const renderModule = (module) => {
        const isSkipped = Boolean(skipped[module.key])
        const isDone = completed.includes(module.key) && !isSkipped
        const isStarted = started.includes(module.key)
        const note = storyNote(module, storyState)

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

        // The finished label itself says whether anything can still be changed — see reviewLabel.

        // an admin reopened this test after a technical problem, and it has not been taken again yet
        const reopened = Boolean(retakeGranted[module.key]) && !isDone

        return (
            <div key={module.key} className={`module-row${isDone ? " is-done" : ""}`}>
                <div className="module-title-row">
                    <p className="module-title">
                        <strong>{module.title}</strong> · about {module.minutes} minutes
                        {isDone && <span> · done</span>}
                        {isStarted && <span> · in progress</span>}
                    </p>
                    <ModuleWhy moduleKey={module.key} />
                </div>
                {reopened && (
                    <p className="retake-note">
                        <strong>Retake available</strong> — your earlier attempt had a technical problem, so this is open
                        again for one more try. Press Submit again afterwards so your report is updated.
                    </p>
                )}
                {note && <p><em>{note}</em></p>}
                {isSkipped ? (
                    <p className="retake-note">
                        Skipped because of the difficulty you told us about — <strong>not measured</strong>, never counted as low.{" "}
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => onSaveAccommodations({ ...accommodations, skipped: { ...skipped, [module.key]: false } })}>Take it after all</button>
                    </p>
                ) : (
                    <>
                        <button type="button" className={isDone ? "btn btn-ghost btn-sm" : "btn btn-primary btn-sm"} onClick={() => onOpen(module.key)}>{label}</button>
                        {!isDone && skippable.includes(module.key) && (
                            <button type="button" className="btn btn-ghost btn-sm skip-btn" onClick={() => onSaveAccommodations({ ...accommodations, skipped: { ...skipped, [module.key]: true } })}>
                                Skip this — mark it not measured
                            </button>
                        )}
                    </>
                )}
                {PERFORMANCE_TESTS.includes(module.key) && (isDone || isStarted) && <ReportProblem moduleKey={module.key} />}
            </div>
        )
    }

    return (
        <div>
            <h1>The assessment</h1>

            <p>
                This is the part that measures how you think and work. It is not an exam and there is
                nothing to revise for. Do it in as many sittings as you like — every section is saved
                when you leave it.
            </p>

            <p>
                <strong>About {TOTAL_MINUTES} minutes</strong> in total, across all the sections below.
            </p>

            <ResearchBox />

            <AccommodationsBox saved={accommodations} onSave={onSaveAccommodations} />

            {/* how much of the picture the finished sections already measure (owner, Round 10) */}
            <p className="coverage-line">
                <strong>{coverage.count} of {coverage.total} factors</strong> can be measured from what you have
                finished — {coverage.pct}%.
            </p>
            <div className="coverage-bar" aria-hidden="true"><span style={{ width: `${coverage.pct}%` }} /></div>

            {alreadySubmitted && (
                <p>
                    <strong>You have already submitted.</strong> You can still open a section to
                    review your answers, and anything you change will be picked up the next time
                    your report is prepared.
                </p>
            )}

            <hr />

            {built.map(renderModule)}

            {comingSoon.length > 0 && (
                <>
                    <hr />
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

            <hr />

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
    )
}

export default AssessmentIntro
