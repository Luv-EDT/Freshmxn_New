import { useEffect, useState } from "react"
import { message } from "antd"
import { getMyStudents, acceptPrivacy, markBookingLinkSent } from "../../apiCall/mentorSessionsApi"

// THE MENTOR'S STUDENTS (owner, Round 28). Each match arrives as an invite (email, and WhatsApp from
// our team). The mentor accepts our privacy rules here first; only then does the student's contact
// show — WhatsApp or email, whichever the student agreed to. Then they send their Calendly (booking)
// link and say so, so the student and our team know it's on its way.
function MentorStudents() {
    const [data, setData] = useState(null)
    const [agreed, setAgreed] = useState({})

    const load = async () => setData((await getMyStudents())?.data?.data || { students: [], privacyRules: [] })
    useEffect(() => { load() }, [])

    const act = async (request, id) => {
        const response = await request(id)
        if (!response || response.data.success === false) {
            message.error(response?.data?.message || "Could not save")
            return
        }
        message.success(response.data.message)
        load()
    }

    if (!data || data.students.length === 0) return null

    return (
        <section>
            <h2>Your students</h2>
            <div className="mentor-students">
                {data.students.map((student) => (
                    <div key={student.id} className="mentor-student">
                        <p>
                            <strong>{student.firstName}</strong> · {student.profession}{student.jobRole ? ` — ${student.jobRole}` : ""}
                            {student.status === "done" ? " · session done" : ""}
                        </p>
                        {student.focus && <p>Help with: {student.focus}</p>}
                        {student.helpWanted && <p>They'd like to know: {student.helpWanted}</p>}

                        {student.status === "current" && !student.privacyAccepted && (
                            <>
                                <p><strong>Before you contact them, please agree to our privacy rules:</strong></p>
                                <ul>{data.privacyRules.map((rule) => <li key={rule}>{rule}</li>)}</ul>
                                <label className="consent-check">
                                    <input type="checkbox" checked={agreed[student.id] === true} onChange={(event) => setAgreed({ ...agreed, [student.id]: event.target.checked })} />
                                    <span><span aria-hidden="true">🔒</span> I agree to keep this student's details private, as above.</span>
                                </label>
                                <button type="button" className="btn btn-primary tap" disabled={agreed[student.id] !== true} onClick={() => act(acceptPrivacy, student.id)}>
                                    I agree — show how to reach them
                                </button>
                            </>
                        )}

                        {student.contact && (
                            <>
                                <p>
                                    Reach them on <strong>{student.contact.via === "email" ? "email" : "WhatsApp"}</strong>: <strong>{student.contact.value}</strong>
                                </p>
                                <p className="report-small">Send them your Calendly (booking) link there, for the 1-hour session and the 20-minute follow-up.</p>
                                {student.bookingLinkSent
                                    ? <p>✓ You've sent your booking link.</p>
                                    : <button type="button" className="btn btn-primary tap" onClick={() => act(markBookingLinkSent, student.id)}>I've sent my booking link</button>}
                            </>
                        )}
                    </div>
                ))}
            </div>
        </section>
    )
}

export default MentorStudents
