import { useState } from "react"
import { reportIssue } from "../../apiCall/assessmentIssuesApi"
import {
    WHY_WE_DO_THIS, FACTOR_COUNT, MAJOR_FACTORS, MINOR_FACTORS, FOUNDATIONS,
    ONE_ATTEMPT_REASON, RETEST_REFERENCE, MODULE_RESEARCH,
} from "./researchNotes"

// The assessment page's research, in three small pieces (owner, Round 10, items 4 and 18). All of it
// is folded away by default — the page is a list of sections first, and the research is there for
// whoever wants it.

// "Why we do this" — the box at the top of the page.
export function ResearchBox() {
    return (
        <details className="faq-item research-box">
            <summary>Why we do this — {FACTOR_COUNT} research-backed factors</summary>
            <div className="research-body">
                {WHY_WE_DO_THIS.map((paragraph) => <p key={paragraph.slice(0, 24)}>{paragraph}</p>)}

                <h3>The {MAJOR_FACTORS.length} major factors</h3>
                <ul className="factor-chips">
                    {MAJOR_FACTORS.map((factor) => <li key={factor}>{factor}</li>)}
                </ul>

                <h3>The {MINOR_FACTORS.length} minor factors</h3>
                <ul className="factor-chips">
                    {MINOR_FACTORS.map((factor) => <li key={factor}>{factor}</li>)}
                </ul>

                <h3>Every section is built on published research</h3>
                <p>Press the <strong>?</strong> beside a section to see what it measures and where the method comes from.</p>

                <h3>Why some tests are taken once</h3>
                <p>{ONE_ATTEMPT_REASON}</p>

                <h3>The ideas behind it</h3>
                <ul className="research-refs">
                    {[...FOUNDATIONS, RETEST_REFERENCE].map((reference) => <li key={reference}>{reference}</li>)}
                </ul>
            </div>
        </details>
    )
}

// The "?" beside a section.
export function ModuleWhy({ moduleKey }) {
    const notes = MODULE_RESEARCH[moduleKey]
    if (!notes) return null

    return (
        <details className="module-why">
            <summary aria-label="The research behind this section" title="The research behind this section">?</summary>
            <div className="module-why-body">
                <p><strong>What it measures:</strong> {notes.measures}</p>
                <p><strong>Why it is here:</strong> {notes.why}</p>
                {notes.oneAttempt && <p><strong>One attempt:</strong> {ONE_ATTEMPT_REASON}</p>}
                <ul className="research-refs">
                    {notes.references.map((reference) => <li key={reference}>{reference}</li>)}
                </ul>
            </div>
        </details>
    )
}

// "Something went wrong with this test?" — the student's way to ask for a retake. It goes to the
// admin's Assessment issues tab and to the team's email; a person decides.
export function ReportProblem({ moduleKey }) {
    const [note, setNote] = useState("")
    const [state, setState] = useState("idle")    // idle | sending | sent | failed

    const send = async () => {
        setState("sending")
        try {
            await reportIssue({ module: moduleKey, note })
            setState("sent")
        } catch (error) {
            setState("failed")
        }
    }

    if (state === "sent") {
        return <p className="report-problem-sent">Thanks — our team will look at it. If something broke, we will open the test again for you and email you.</p>
    }

    return (
        <details className="report-problem">
            <summary>Something went wrong with this test?</summary>
            <label htmlFor={`problem-${moduleKey}`}>What happened? (the screen froze, the page closed, it would not load…)</label>
            <textarea
                id={`problem-${moduleKey}`}
                rows={3}
                maxLength={1000}
                value={note}
                onChange={(event) => setNote(event.target.value)}
            />
            <button type="button" className="btn btn-ghost btn-sm" onClick={send} disabled={state === "sending"}>
                {state === "sending" ? "Sending…" : "Tell the team"}
            </button>
            {state === "failed" && <p><em>That did not go through — check your connection and try again.</em></p>}
        </details>
    )
}
