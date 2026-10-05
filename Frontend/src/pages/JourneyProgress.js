import { useNavigate } from "react-router-dom"
import { hasMentor, isMentorOnly } from "./plans"

// The four stages, shown the same way everywhere they appear — Stage 4C's staged progress bar.
//
// WHY IT IS A COMPONENT AND NOT MARKUP ON THE HOME PAGE. A student lands on the assessment from an
// email, finishes it, and has no idea whether anything comes next or what they have already done.
// Home knew the answer and no other page did, so the journey existed only if you went looking for
// it. Putting it above each stage means the shape of the thing is visible from inside it.
//
// IT SHOWS RAW STATE, NOT ENCOURAGEMENT. "Locked" says locked and says why. A bar that implies
// everything is fine while the report is withheld would contradict the report itself two screens
// later, and the report is the one telling the truth.
//
// THE ORDER IS A REAL DEPENDENCY, not a suggested route. The assessment opens only once the
// interest form is done, because Program 2 matches professions against the activities that form
// collects — an assessment taken first would score a profile with nothing to match it against.

const STAGE_MARK = { done: "✓", active: "●", locked: "·" }

// A finished stage gets a line that says so (Round 13, owner: "a rewarding look") — on Home only.
const CELEBRATE = {
    interest: "Your story is in — a great start.",
    assessment: "Assessment done — the hard part is behind you.",
    report: "Your report is ready to read.",
}

// Works out where the student actually is, from the progress the server keeps. Deliberately a pure
// function of `user` — a bar that tracked its own idea of progress would drift from the pages it
// sits above.
export const journeyStages = (user) => {
    const progress = (user && user.progress) || {}
    const interest = progress.interestForm || "not_started"
    const psychometric = progress.psychometric || "not_started"
    const report = progress.report || "locked"

    const interestDone = interest === "done"
    const assessmentDone = psychometric === "done"
    const reportReady = report === "ready"

    const mentorStage = {
        key: "mentor",
        title: "Mentor",
        path: "/mentorship",
        state: hasMentor(user) ? "active" : "locked",
        note: hasMentor(user)
            ? progress.mentor === "waitlisted" ? "Included in your plan — choose your mentor's field" : "Included in your plan"
            : "Part of Discovery + Mentor",
        open: true,
    }

    // Mentor Only (Round 12) has no interest form, assessment or report — just the mentor
    if (isMentorOnly(user)) return [mentorStage]

    return [
        {
            key: "interest",
            title: "Interest form",
            path: "/interest",
            state: interestDone ? "done" : interest === "in_progress" ? "active" : "active",
            note: interestDone ? "Done — you can still edit it" : interest === "in_progress" ? "In progress" : "Not started",
            open: true,
        },
        {
            key: "assessment",
            title: "Assessment",
            path: "/assessment/start",
            state: assessmentDone ? "done" : interestDone ? "active" : "locked",
            note: !interestDone
                ? "Opens once the interest form is done"
                : assessmentDone
                    ? "Submitted — you can still add sections"
                    : psychometric === "in_progress" ? "In progress" : "Not started",
            open: interestDone,
        },
        {
            key: "report",
            title: "Your report",
            path: "/report",
            state: reportReady ? "done" : assessmentDone ? "active" : "locked",
            note: reportReady
                ? "Ready to read"
                : assessmentDone
                    ? "Being prepared — about a minute"
                    : "Opens when you submit the assessment",
            open: reportReady || assessmentDone,
        },
        mentorStage,
    ]
}

// `variant="home"` is the dashboard's larger stepper: done stages teal with their celebration line,
// the stage to do now highlighted as "You're here", the rest muted.
function JourneyProgress({ user, current, variant }) {
    const navigate = useNavigate()

    if (!user || !user.paid) return null

    const stages = journeyStages(user)
    const done = stages.filter((stage) => stage.state === "done").length
    const here = (stages.find((stage) => stage.open && stage.state !== "done") || {}).key
    const isHome = variant === "home"

    return (
        <div className={`journey${isHome ? " journey-home" : ""}`}>
            <p className="journey-label">
                <strong>Your journey</strong> · {done} of {stages.length} finished
            </p>

            {/* WRAPS, NEVER SCROLLS. On a 360px phone a four-across row either runs off the side or
                shrinks each step below a usable tap target. Wrapping keeps every one reachable. */}
            <div className="journey-steps">
                {stages.map((stage, index) => {
                    const isCurrent = stage.key === current
                    const isHere = stage.key === here

                    return (
                        <button
                            type="button"
                            key={stage.key}
                            onClick={() => stage.open && !isCurrent && navigate(stage.path)}
                            disabled={!stage.open || isCurrent}
                            title={stage.note}
                            className={`journey-step is-${stage.state}${isCurrent ? " is-current" : ""}${isHere ? " is-here" : ""}${stage.open ? "" : " is-closed"}`}
                        >
                            <span className="journey-mark" aria-hidden="true">{STAGE_MARK[stage.state] || STAGE_MARK.locked}</span>
                            <span className="journey-text">
                                {isHome && isHere && <span className="status-chip is-pending journey-here">You're here</span>}
                                <strong>{index + 1}. {stage.title}</strong>
                                <span className="journey-note">{stage.note}</span>
                                {isHome && stage.state === "done" && CELEBRATE[stage.key] && (
                                    <span className="journey-cheer">{CELEBRATE[stage.key]}</span>
                                )}
                            </span>
                        </button>
                    )
                })}
            </div>
        </div>
    )
}

export default JourneyProgress
