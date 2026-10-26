import { useEffect, useState } from "react"
import { message } from "antd"
import dayjs from "dayjs"
import { getMyStudents, acceptPrivacy } from "../../apiCall/mentorSessionsApi"

// THE MENTOR'S STUDENTS (owner, Rounds 28 and 34). The current student comes with the brief to prepare
// from and the date to be ready by (2.5 days from the match). The student books from the mentor's Calendly
// links, so there is nothing to send and nothing to report here — after the session the mentor tells us on
// WhatsApp. The student's contact shows only after the mentor accepts our privacy rules. Then the history.
const formatDate = (date) => (date ? dayjs(date).format("D MMM YYYY, h:mm a") : "")

function Brief({ brief }) {
    if (!brief) return null
    const rows = [
        ["Education", brief.education],
        ["Interests", (brief.interests || []).join(", ")],
        ["Achievements", (brief.achievements || []).join("; ")],
        ["Challenges", (brief.challenges || []).join("; ")],
        ["Support they asked us to share", (brief.support || []).join(", ")],
    ].filter(([, value]) => value)
    if (rows.length === 0) return <p className="report-small">They haven't filled their Virtual Career Counselling yet.</p>
    return (
        <dl className="student-brief">
            {rows.map(([label, value]) => (
                <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
            ))}
        </dl>
    )
}

function MentorStudents() {
    const [data, setData] = useState(null)
    const [agreed, setAgreed] = useState({})

    const load = async () => setData((await getMyStudents())?.data?.data || { current: [], history: [], privacyRules: [] })
    useEffect(() => { load() }, [])

    const accept = async (id) => {
        const response = await acceptPrivacy(id)
        if (!response || response.data.success === false) {
            message.error(response?.data?.message || "Could not save")
            return
        }
        message.success(response.data.message)
        load()
    }

    if (!data) return <div className="skeleton skeleton-block" />

    return (
        <section className="mentor-students">
            <h3>Your current student</h3>
            {data.current.length === 0 && (
                <p>
                    No student right now. When we have one in your field, we'll message you on WhatsApp first so you can
                    open slots on your Calendly links (main sessions in the next 4 days, follow-ups on days 5–6).
                </p>
            )}
            {data.current.map((student) => (
                <div key={student.id} className="mentor-student">
                    <p className="mentor-student-head">
                        <strong>{student.firstName}</strong> · {student.profession}{student.jobRole ? ` — ${student.jobRole}` : ""}
                    </p>
                    <p className="prepare-by">Read this and prepare by <strong>{formatDate(student.prepareBy)}</strong> (2.5 days from the match). They book from your Calendly links — keep the slots you opened free.</p>
                    {student.focus && <p><strong>Help with:</strong> {student.focus}</p>}
                    {student.helpWanted && <p><strong>They'd like to know:</strong> {student.helpWanted}</p>}
                    {(student.languages || []).length > 0 && <p><strong>Languages:</strong> {student.languages.join(", ")}</p>}
                    <Brief brief={student.brief} />

                    {!student.privacyAccepted && (
                        <div className="mentor-privacy">
                            <p><strong>To see their contact (for a reminder or to reschedule with our OK), agree to our privacy rules:</strong></p>
                            <ul>{data.privacyRules.map((rule) => <li key={rule}>{rule}</li>)}</ul>
                            <label className="consent-check">
                                <input type="checkbox" checked={agreed[student.id] === true} onChange={(event) => setAgreed({ ...agreed, [student.id]: event.target.checked })} />
                                <span><span aria-hidden="true">🔒</span> I'll keep this student's details private, as above.</span>
                            </label>
                            <button type="button" className="btn btn-ghost btn-sm tap" disabled={agreed[student.id] !== true} onClick={() => accept(student.id)}>I agree — show their contact</button>
                        </div>
                    )}
                    {student.contact && (
                        <p>Contact ({student.contact.via === "email" ? "email" : "WhatsApp"}): <strong>{student.contact.value}</strong></p>
                    )}
                    <p className="report-small">After the session, tell us on WhatsApp (+91 8882756287) that it's done, and remind the student to fill the feedback form after their follow-up. Your payment follows their feedback.</p>
                </div>
            ))}

            <h3>Your sessions so far</h3>
            {data.history.length === 0 ? <p className="report-small">None yet.</p> : (
                <ul className="refund-request-list">
                    {data.history.map((session, index) => (
                        <li key={index}>
                            {session.completedAt ? dayjs(session.completedAt).format("D MMM YYYY") : "—"} · {session.firstName} ·{" "}
                            {session.jobRole ? `${session.jobRole} (${session.profession})` : session.profession}
                            {session.noShow === "student" ? " · student didn't show (still paid)" : ""}
                        </li>
                    ))}
                </ul>
            )}
        </section>
    )
}

export default MentorStudents
