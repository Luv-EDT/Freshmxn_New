import { useEffect, useState } from "react"
import { Modal, Input, Button, message } from "antd"
import { getMentorTestForAdmin, decideMentorTestForAdmin } from "../../apiCall/mentorTestApi"

// REVIEWING A MENTOR'S TEST (owner, Round 34): the 5 steps as they ordered them, their Calendly links,
// the video (a 15-minute private link), and the 7 multiple-choice answers pre-marked. The admin decides;
// either way the video is deleted at once.
function MentorTestReview({ mentor, onClose, onDecided }) {
    const [test, setTest] = useState(null)
    const [note, setNote] = useState("")
    const [busy, setBusy] = useState(false)

    useEffect(() => {
        getMentorTestForAdmin(mentor.user).then((response) => setTest((response && response.data && response.data.data) || { failed: true }))
    }, [mentor.user])

    const decide = async (decision) => {
        setBusy(true)
        const response = await decideMentorTestForAdmin(mentor.user, { decision, note })
        setBusy(false)
        if (!response || response.data.success === false) {
            message.error(response?.data?.message || "Could not save")
            return
        }
        message.success(response.data.message)
        onDecided()
    }

    return (
        <Modal open title={`${mentor.name}'s test`} onCancel={onClose} footer={null} width={760}>
            {!test && <p>Loading…</p>}
            {test && test.failed && <p>Couldn't load the test.</p>}
            {test && !test.failed && (
                <div className="test-review">
                    <p>
                        <strong>{test.autoScore.correct} of {test.autoScore.of}</strong> multiple-choice right ·
                        steps {test.autoScore.stepsInOrder ? "in the right order" : "NOT in the right order"}
                    </p>

                    <h4>1. The 5 steps, as they ordered them</h4>
                    <ol>{test.steps.map((step, index) => <li key={step.id} className={step.id === test.rightSteps[index].id ? "" : "test-wrong"}>{step.text}</li>)}</ol>

                    <h4>2. Calendly links</h4>
                    <p>Main: {test.calendlyMain ? <a href={test.calendlyMain} target="_blank" rel="noreferrer">{test.calendlyMain}</a> : "—"}</p>
                    <p>Follow-up: {test.calendlyFollowUp ? <a href={test.calendlyFollowUp} target="_blank" rel="noreferrer">{test.calendlyFollowUp}</a> : "—"}</p>

                    <h4>3. The video</h4>
                    <p className="report-small">For: {test.sample}</p>
                    {test.videoUrl && <video src={test.videoUrl} controls style={{ maxWidth: "100%" }} />}
                    {test.videoLink && <p><a href={test.videoLink} target="_blank" rel="noreferrer">Open their video link</a></p>}
                    {test.videoDeleted && <p className="report-small">The video has been deleted.</p>}

                    <h4>The 7 questions</h4>
                    <ol>
                        {test.questions.map((question) => (
                            <li key={question.id}>
                                <p>{question.q}</p>
                                <p className={question.picked === question.answer ? "test-right" : "test-wrong"}>
                                    Picked: {question.picked === null ? "—" : question.options[question.picked]}
                                    {question.picked !== question.answer && ` · right answer: ${question.options[question.answer]}`}
                                </p>
                            </li>
                        ))}
                    </ol>

                    {test.decision ? (
                        <p><strong>Decided: {test.decision}</strong>{test.decisionNote ? ` — ${test.decisionNote}` : ""}</p>
                    ) : (
                        <>
                            <Input.TextArea rows={3} placeholder="Note for the mentor (needed to reject)" value={note} onChange={(event) => setNote(event.target.value)} />
                            <p style={{ marginTop: 12 }}>
                                <Button type="primary" disabled={busy} onClick={() => decide("approved")}>Approve</Button>{" "}
                                <Button danger disabled={busy || note.trim().length < 3} onClick={() => decide("rejected")}>Reject</Button>
                            </p>
                            <p className="report-small">Either decision emails the mentor and deletes the video.</p>
                        </>
                    )}
                </div>
            )}
        </Modal>
    )
}

export default MentorTestReview
