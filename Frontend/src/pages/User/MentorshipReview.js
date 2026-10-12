import { useEffect, useState } from "react"
import { Link, Navigate } from "react-router-dom"
import { useSelector } from "react-redux"
import { message } from "antd"
import Navbar from "../Navbar"
import BackToDashboard from "../BackToDashboard"
import { hasMentor } from "../plans"
import { HelpLine } from "./mentorshipParts"
import ReportMentor from "./ReportMentor"
import { getMySessionState, saveMyReview } from "../../apiCall/mentorSessionsApi"

// THE REVIEW AFTER A MENTOR SESSION (owner, Round 28). The link comes with the match email; the form
// opens once we've marked the session done (the student is emailed then too). A rating out of 10 and
// two plain questions — only what matters.
function MentorshipReview() {
    const { user } = useSelector((state) => state.user)
    const [state, setState] = useState(null)
    const [rating, setRating] = useState(null)
    const [helpedDecide, setHelpedDecide] = useState(null)
    const [wouldRecommend, setWouldRecommend] = useState(null)
    const [comment, setComment] = useState("")
    const [busy, setBusy] = useState(false)

    const load = async () => setState((await getMySessionState())?.data?.data || { review: { state: "none" } })
    useEffect(() => { load() }, [])

    if (!user) return null
    if (!hasMentor(user)) return <Navigate to="/mentorship" replace />

    const send = async () => {
        setBusy(true)
        const response = await saveMyReview({ rating, helpedDecide, wouldRecommend, comment })
        setBusy(false)
        if (!response || response.data.success === false) {
            message.error(response?.data?.message || "Could not send your review")
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
                <h2>Your mentor session</h2>

                {!state && <div className="skeleton skeleton-block" />}

                {review && review.state === "waiting" && (
                    <p>Come back after your session. This opens once we've marked it done — we'll email you then.</p>
                )}
                {review && review.state === "none" && <p>Your review opens after your first mentor session.</p>}
                {review && review.state === "done" && <p><strong>Thank you</strong> — your review is in. It helps us choose mentors for the next student.</p>}

                {review && review.state === "open" && (
                    <section>
                        <p>
                            Your session{review.session.mentorName ? ` with ${review.session.mentorName}` : ""} about{" "}
                            <strong>{review.session.jobRole || review.session.profession}</strong>.
                        </p>
                        <fieldset>
                            <legend>How useful was your session? (1 = not at all, 10 = extremely)</legend>
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
                        <fieldset>
                            <legend>Did it help you decide about this career?</legend>
                            {[["yes", "Yes"], ["somewhat", "Somewhat"], ["no", "No"]].map(([value, label]) => (
                                <label key={value} className="choice">
                                    <input type="radio" name="helpedDecide" checked={helpedDecide === value} onChange={() => setHelpedDecide(value)} />
                                    <span>{label}</span>
                                </label>
                            ))}
                        </fieldset>
                        <fieldset>
                            <legend>Would you recommend this mentor to a friend?</legend>
                            {[["yes", "Yes"], ["no", "No"]].map(([value, label]) => (
                                <label key={value} className="choice">
                                    <input type="radio" name="wouldRecommend" checked={wouldRecommend === value} onChange={() => setWouldRecommend(value)} />
                                    <span>{label}</span>
                                </label>
                            ))}
                        </fieldset>
                        <label htmlFor="review-comment">Anything else to tell us?</label>
                        <textarea id="review-comment" rows={3} maxLength={600} value={comment} onChange={(event) => setComment(event.target.value)} />
                        <button type="button" className="btn btn-primary tap" disabled={!rating || !helpedDecide || !wouldRecommend || busy} onClick={send}>
                            {busy ? "Sending…" : "Send my review"}
                        </button>
                    </section>
                )}

                {state && state.canReport && <ReportMentor openReport={state.openReport} onSent={load} />}

                <HelpLine />
            </main>
        </div>
    )
}

export default MentorshipReview
