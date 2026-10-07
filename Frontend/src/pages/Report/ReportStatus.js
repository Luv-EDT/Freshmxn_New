import { useNavigate } from "react-router-dom"
import Navbar from "../Navbar"
import BackToDashboard from "../BackToDashboard"

// The screens a report shows INSTEAD of findings — loading, not started, failed, being built, and
// withheld — shared by the overview and the matches page. Returns null once there is a report to show.
//
// THREE RELEASE STATES, and they are the point rather than an edge case:
//   release            the full picture
//   release_with_note  findings shown, plus what is still missing and what completing it buys
//   withhold           below 75% of the matching vector. The completion prompt INSTEAD of findings,
//                      because a confident-looking report built on a fifth of the evidence is worse
//                      than no report.
function ReportStatus({ state, retry, retrying }) {
    const navigate = useNavigate()

    const screen = (children) => (
        <div className="report-page">
            <Navbar />
            <BackToDashboard />
            {children}
        </div>
    )

    if (state.loading) return screen(<p>Loading your report…</p>)
    if (state.error) return screen(<p>{state.error}</p>)

    const { status, release } = state.data

    if (status === "not_started") {
        return screen(
            <>
                <h1>Your report</h1>
                <p>Finish the assessment and your report will be built from it.</p>
                <button type="button" onClick={() => navigate("/assessment/start")}>Go to the assessment</button>
            </>
        )
    }

    if (status === "failed") {
        return screen(
            <>
                <h1>We hit a problem preparing your report</h1>
                <p>
                    <strong>Your answers are safe.</strong> Something went wrong on our side while building
                    your report. Trying again usually fixes it.
                </p>
                <button type="button" className="btn btn-primary tap" onClick={retry} disabled={retrying}>
                    {retrying ? "Starting again…" : "Try again"}
                </button>
                <p className="report-small">
                    If it happens again,{" "}
                    <a href="https://wa.me/918882756287" target="_blank" rel="noreferrer">message us on WhatsApp</a>{" "}
                    and we will sort it out.
                </p>
            </>
        )
    }

    if (status === "generating") {
        return screen(
            <>
                <h1>We are preparing your report</h1>
                <p>
                    This usually takes about a minute. We are scoring your answers and matching them
                    against 1,000+ careers and job roles.
                </p>
                <p>
                    <em>This page checks for itself every few seconds — you can also close it and
                    come back whenever you like.</em>
                </p>
            </>
        )
    }

    // Below the release threshold: say what is missing instead of showing findings that would read
    // as more certain than they are.
    if (release === "withhold") {
        return screen(
            <>
                <h1>Not enough to go on yet</h1>
                <p>
                    You have finished part of the assessment, but not enough of it for us to say
                    anything useful about which careers fit you. We would rather tell you that than
                    give you a confident answer built on a fraction of the picture.
                </p>
                <button type="button" onClick={() => navigate("/assessment/start")}>
                    Finish the assessment
                </button>
            </>
        )
    }

    return null
}

export default ReportStatus
