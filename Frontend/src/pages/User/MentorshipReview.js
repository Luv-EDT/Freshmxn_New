import { useEffect, useState } from "react"
import { Link, Navigate } from "react-router-dom"
import { useSelector } from "react-redux"
import { message } from "antd"
import Navbar from "../Navbar"
import BackToDashboard from "../BackToDashboard"
import { hasMentor } from "../plans"
import { HelpLine } from "./mentorshipParts"
import { getMySessionState, saveMyReview } from "../../apiCall/mentorSessionsApi"

// THE FEEDBACK FORM AFTER A MENTOR SESSION (owner, Rounds 28 and 34). It opens once the mentor tells us
// the session is done and we press "Session done" (the student gets an email and a notification too).
// First: have both sessions happened? Then what the mentor covered, how they were, whether they stayed
// within limits, and a rating out of 10. Sent once — it closes the mentor ticket. Never shared with the
// mentor.
const COVERED = [
    { key: "overview", label: "The profession — what a day looks like, and the bad parts" },
    { key: "journey", label: "Their own journey" },
    { key: "relate", label: "How it relates to you" },
    { key: "success", label: "What success needs — the qualities and skills" },
    { key: "resources", label: "Resources to get started" },
]
const QUALITIES = [
    { key: "empathetic", label: "Were they empathetic?" },
    { key: "knowledgeable", label: "Were they knowledgeable?" },
    { key: "clear", label: "Were they clear in how they communicated?" },
    { key: "clarity", label: "Did you find some clarity?" },
    { key: "recommend", label: "Would you recommend them to others?" },
]

function Choice({ name, value, options, onChange }) {
    return (
        <div className="feedback-choices" role="radiogroup">
            {options.map(([option, label]) => (
                <label key={option} className="choice feedback-choice">
                    <input type="radio" name={name} checked={value === option} onChange={() => onChange(option)} />
                    <span>{label}</span>
                </label>
            ))}
        </div>
    )
}

function MentorshipReview() {
    const { user } = useSelector((state) => state.user)
    const [state, setState] = useState(null)
    const [bothDone, setBothDone] = useState(null)
    const [covered, setCovered] = useState({})
    const [qualities, setQualities] = useState({})
    const [withinLimits, setWithinLimits] = useState(null)
    const [concern, setConcern] = useState("")
    const [rating, setRating] = useState(null)
    const [busy, setBusy] = useState(false)

    const load = async () => setState((await getMySessionState())?.data?.data || { review: { state: "none" } })
    useEffect(() => { load() }, [])

    if (!user) return null
    if (!hasMentor(user)) return <Navigate to="/mentorship" replace />

    const complete = rating && withinLimits && COVERED.every((item) => covered[item.key]) && QUALITIES.every((item) => qualities[item.key])

    const send = async () => {
        setBusy(true)
        const response = await saveMyReview({ bothDone: true, rating, covered, qualities, withinLimits, concern })
        setBusy(false)
        if (!response || response.data.success === false) {
            message.error(response?.data?.message || "Could not send your feedback")
            return
        }
        message.success(response.data.message)
        load()
    }

    const review = state && state.review

    return (
        <div>
            <Navbar />
            <BackToDashboard />
            <main className="page session-review" aria-busy={!state}>
                <p><Link to="/mentorship">← Mentorship</Link></p>
                <h2 className="page-title-center">Your mentor session — feedback</h2>

                {!state && <div className="skeleton skeleton-block" />}

                {review && review.state === "waiting" && (
                    <p>This opens once your mentor tells us your session is done — we'll email you then. Please fill it only after your session.</p>
                )}
                {review && review.state === "none" && <p>Your feedback form opens after your mentor session.</p>}
                {review && review.state === "done" && <p><strong>Thank you</strong> — your feedback is in and your mentor ticket is closed. It helps us choose mentors for the next student.</p>}

                {review && review.state === "open" && bothDone !== true && (
                    <section className="feedback-gate">
                        <p>
                            Your session{review.session.mentorName ? ` with ${review.session.mentorName}` : ""} about{" "}
                            <strong>{review.session.jobRole || review.session.profession}</strong>.
                        </p>
                        <p><strong>Have both sessions taken place</strong> — the main one, and the follow-up if you booked one?</p>
                        <div className="btn-row">
                            <button type="button" className="btn btn-primary tap" onClick={() => setBothDone(true)}>Yes, both are done</button>
                            <button type="button" className="btn btn-ghost tap" onClick={() => setBothDone(false)}>Not yet</button>
                        </div>
                        {bothDone === false && <p role="status">Please come back once your session (and follow-up) is over. This form will be here.</p>}
                    </section>
                )}

                {review && review.state === "open" && bothDone === true && (
                    <section>
                        <p className="report-small">
                            You can send this <strong>once</strong>. Sending it says your session is done and closes your
                            mentor ticket. It's for you and us only — please don't share it with your mentor.
                        </p>

                        <h3>Did your mentor cover…</h3>
                        {COVERED.map((item) => (
                            <fieldset key={item.key} className="feedback-q">
                                <legend>{item.label}</legend>
                                <Choice name={`covered-${item.key}`} value={covered[item.key]} options={[["yes", "Yes"], ["partly", "Partly"], ["no", "No"]]} onChange={(answer) => setCovered({ ...covered, [item.key]: answer })} />
                            </fieldset>
                        ))}

                        <h3>How was your mentor?</h3>
                        {QUALITIES.map((item) => (
                            <fieldset key={item.key} className="feedback-q">
                                <legend>{item.label}</legend>
                                <Choice name={`quality-${item.key}`} value={qualities[item.key]} options={[["yes", "Yes"], ["somewhat", "Somewhat"], ["no", "No"]]} onChange={(answer) => setQualities({ ...qualities, [item.key]: answer })} />
                            </fieldset>
                        ))}

                        <h3>Were you safe?</h3>
                        <fieldset className="feedback-q">
                            <legend>Did your mentor stay within limits?</legend>
                            <Choice name="withinLimits" value={withinLimits} options={[["yes", "Yes"], ["no", "No"]]} onChange={setWithinLimits} />
                        </fieldset>
                        <label htmlFor="feedback-concern">Anything about their behaviour that bothered you? (Only our team reads this.)</label>
                        <textarea id="feedback-concern" rows={3} maxLength={600} value={concern} onChange={(event) => setConcern(event.target.value)} />

                        <fieldset className="feedback-q">
                            <legend><strong>Rate your mentor</strong> (1 = poor, 10 = excellent)</legend>
                            <div className="rating-row" role="radiogroup" aria-label="Rating out of 10">
                                {Array.from({ length: 10 }, (unused, index) => index + 1).map((number) => (
                                    <button
                                        key={number}
                                        type="button"
                                        role="radio"
                                        aria-checked={rating === number}
                                        className={`rating-dot${rating === number ? " is-on" : ""}`}
                                        onClick={() => setRating(number)}
                                    >
                                        {number}
                                    </button>
                                ))}
                            </div>
                        </fieldset>

                        <button type="button" className="btn btn-primary tap" disabled={!complete || busy} onClick={send}>
                            {busy ? "Sending…" : "Send my feedback"}
                        </button>
                    </section>
                )}

                <HelpLine />
            </main>
        </div>
    )
}

export default MentorshipReview
