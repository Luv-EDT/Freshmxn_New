import { useState } from "react"
import ResumeAttach from "../ResumeAttach"
import { readMyResume } from "../../apiCall/resumeApi"
import { countOf } from "./resumeActivities"

// Shown each time the form is opened. Round 10 (S10): the welcome is down to what a student needs to
// start; the tips and the privacy note fold away under "How to answer" — they were about 400 words
// between a student and the first question.
// Round 36-37 (owner): "Start" opens a page of its own for a résumé — its activities go first in each stage's
// activity list, ready to add with a tap, and the file is not kept. A student editing a finished form goes
// straight to their answers.
function InterestIntro({ handleNext, hasSubmitted, resumeActivities, onResume, onClearResume }) {
    const [page, setPage] = useState("welcome")
    const kept = countOf(resumeActivities)

    if (page === "resume") {
        return (
            <div className="if-intro if-resume-page">
                <h2>Got a résumé?</h2>
                <p className="if-lead">
                    Attach it and we'll use it only to make the next stages easier: the activities we find appear first in
                    each stage's activity list, ready to add with a tap. You choose what goes into your answers and can
                    change anything. We delete your résumé as soon as it's read.
                </p>
                <ResumeAttach
                    read={readMyResume}
                    onRead={onResume}
                    title={null}
                    addedNote={(added) => `Found ${added} activities — each stage's "Stuck?" list now shows them first.`}
                />
                {kept > 0 && (
                    <p className="if-resume-kept">
                        {kept} activities from your résumé are in your stage lists.{" "}
                        <button type="button" className="link-button" onClick={onClearResume}>Remove them</button>
                    </p>
                )}
                <div className="btn-row">
                    <button type="button" className="btn btn-primary" onClick={handleNext}>{kept > 0 ? "Continue" : "Continue without a résumé"}</button>
                    <button type="button" className="link-button" onClick={() => setPage("welcome")}>Back</button>
                </div>
            </div>
        )
    }

    return (
        <div className="if-intro">
            <h2>Welcome to Virtual Career Counselling</h2>

            <p className="if-lead">
                Your career guidance starts here. You'll go through each stage of your life — what you did,
                what you enjoyed, what got in your way — and build a picture of what really motivates you.
            </p>
            <p>
                There are no right answers and nothing is graded: the more honestly you write, the sharper your
                results. It takes about 60–75 minutes, and your answers save as you go, so you can stop and come
                back any time.
            </p>

            <details className="if-examples if-how">
                <summary className="if-chip-summary"><span className="if-q" aria-hidden="true">?</span> How to answer</summary>
                <ul>
                    <li><strong>For each stage of your life you'll fill in two things:</strong> the activities you did, and the problems or challenges you faced.</li>
                    <li><strong>Write down everything</strong> — even things you did once, stopped, or can't do now. A later stage asks which still feel like you.</li>
                    <li><strong>Short and specific beats long.</strong> "Played district-level cricket" says more than "sports".</li>
                    <li><strong>Stuck?</strong> Each stage has a list of activities to jog your memory, and each problem question has examples you can tap to add and then edit in your own words.</li>
                    <li><strong>"See examples"</strong> under a question explains what it is asking for.</li>
                    <li><strong>You don't have to finish in one sitting.</strong> Press <strong>Save</strong> on any page and carry on later, on any device.</li>
                    <li><strong>Revisit your earlier sections once at the end.</strong> People almost always remember more after they've warmed up.</li>
                </ul>
                <p><strong>Your privacy.</strong> Your responses are confidential and used only to generate your personalised analysis. We never share your information with anyone.</p>
            </details>

            <button type="button" className="btn btn-primary" onClick={hasSubmitted ? handleNext : () => setPage("resume")}>
                {hasSubmitted ? "Continue to my answers" : "Start"}
            </button>
        </div>
    )
}

export default InterestIntro
