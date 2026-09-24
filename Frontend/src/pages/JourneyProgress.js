import { useNavigate } from "react-router-dom"

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

const STAGE_STATE = {
    done: { mark: "✓", tone: "#1a7f37" },
    active: { mark: "●", tone: "#0b62d6" },
    locked: { mark: "·", tone: "#767676" },
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
        {
            key: "mentor",
            title: "Mentor",
            path: "/mentorship",
            state: user && user.currentTier === 2 ? "active" : "locked",
            note: user && user.currentTier === 2
                ? progress.mentor === "waitlisted" ? "You are on the waitlist" : "Included in your plan"
                : "Part of Tier 2",
            open: true,
        },
    ]
}

function JourneyProgress({ user, current }) {
    const navigate = useNavigate()

    if (!user || !user.paid) return null

    const stages = journeyStages(user)
    const done = stages.filter((stage) => stage.state === "done").length

    return (
        <div className="journey">
            <p className="journey-label">
                <strong>Your journey</strong> · {done} of {stages.length} finished
            </p>

            {/* WRAPS, NEVER SCROLLS. On a 360px phone a four-across row either runs off the side or
                shrinks each step below a usable tap target. Wrapping keeps every one reachable. */}
            <div className="journey-steps">
                {stages.map((stage, index) => {
                    const style = STAGE_STATE[stage.state] || STAGE_STATE.locked
                    const isCurrent = stage.key === current

                    return (
                        <button
                            type="button"
                            key={stage.key}
                            onClick={() => stage.open && !isCurrent && navigate(stage.path)}
                            disabled={!stage.open || isCurrent}
                            title={stage.note}
                            className={`journey-step is-${stage.state}${isCurrent ? " is-current" : ""}${stage.open ? "" : " is-closed"}`}
                        >
                            <span className="journey-mark" aria-hidden="true">{style.mark}</span>
                            <span className="journey-text">
                                <strong>{index + 1}. {stage.title}</strong>
                                <span className="journey-note">{stage.note}</span>
                            </span>
                        </button>
                    )
                })}
            </div>
        </div>
    )
}

export default JourneyProgress
