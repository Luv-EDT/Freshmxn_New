import { useState } from "react"
import { useNavigate, Link, Navigate } from "react-router-dom"
import { useSelector } from "react-redux"
import { Modal, message } from "antd"
import Navbar from "../Navbar"
import BackToDashboard from "../BackToDashboard"
import { chooseProfession } from "../../apiCall/mentorWaitlistApi"
import CareerRolePicker, { pickerComplete, pickerSummary } from "../CareerRolePicker"
import { hasMentor } from "../plans"
import { formatDate, useMentorWaitlist, HelpLine, HelpWanted } from "./mentorshipParts"

// EVERYTHING THE STUDENT FILLS IN FOR THEIR MENTOR, on its own page (owner, Round 20): the job role
// (sent once — it starts the 20-business-day clock), what help they want for it, what they want to
// know and the abroad-help tick. /mentorship itself only says where things stand and how it works.
// Discovery + Mentor students choose from their own matches; Mentor Only students (Round 12) from all
// our careers, or one we don't list. A change after sending goes through WhatsApp and the admin.
function MentorshipChoose() {
    const navigate = useNavigate()
    const { user } = useSelector((state) => state.user)
    const isTier2 = hasMentor(user)   // Discovery + Mentor or Mentor Only
    const { waitlist, setWaitlist, options, loading } = useMentorWaitlist(isTier2)
    const [selected, setSelected] = useState(null)   // { professionId, profession, jobRole }
    const [ownChoice, setOwnChoice] = useState({})   // Mentor Only: the picker's value

    const sendChoice = async () => {
        const payload = waitlist && waitlist.mentorOnly
            ? (typeof ownChoice.other === "string"
                ? { other: ownChoice.other, industryCode: ownChoice.industryCode || null }
                : { professionId: ownChoice.professionId, jobRole: ownChoice.jobRole, jobRoleOther: ownChoice.jobRoleOther, industryCode: ownChoice.industryCode || null })
            : { professionId: selected.professionId, jobRole: selected.jobRole }
        const response = await chooseProfession(payload)

        if (!response || response.data.success === false) {
            message.error(response?.data?.message || "Could not send your choice")
            return
        }

        message.success(response.data.message)
        setWaitlist((prev) => ({ ...prev, ...response.data.data }))
        navigate("/mentorship")
    }

    const confirmChoice = () => {
        const mentorOnly = waitlist && waitlist.mentorOnly
        if (mentorOnly ? !pickerComplete(ownChoice) : !selected) return

        Modal.confirm({
            title: mentorOnly ? `Send "${pickerSummary(ownChoice)}" as your choice?` : `Send "${selected.jobRole}" (${selected.profession}) as your choice?`,
            content: "This starts your 20-business-day mentor match. You can't change it here afterwards — if you need to, message us on WhatsApp.",
            okText: "Send my choice",
            cancelText: "Not yet",
            onOk: sendChoice,
        })
    }

    if (!user) return null
    if (!isTier2) return <Navigate to="/mentorship" replace />

    const chosenText = waitlist && (waitlist.otherRequest
        ? waitlist.otherRequest
        : waitlist.chosenJobRole ? `${waitlist.chosenJobRole} (${waitlist.chosenProfessionName})` : waitlist.chosenProfessionName)

    return (
        <div>
            <Navbar />
            <BackToDashboard />
            <main className="page" aria-busy={loading}>
                <p><Link to="/mentorship">← Mentorship</Link></p>
                <h2>Your choices for your mentor</h2>

                {loading && <div className="skeleton skeleton-block" />}

                {waitlist && waitlist.mentorOnly && waitlist.matchStatus === "awaiting_choice" && (
                    <section>
                        <h3>Choose the job role you'd like a mentor in</h3>
                        <p>
                            Find the career you're interested in and pick the <strong>one job role</strong> you'd like to
                            move toward. If it isn't in our list, tell us in your own words. We'll confirm your mentor and
                            schedule your two sessions within <strong>20 business days</strong> of your choice.
                        </p>
                        <CareerRolePicker value={ownChoice} onChange={setOwnChoice} allowAnyCareer />
                        <p>
                            {pickerComplete(ownChoice) ? <>Your choice: <strong>{pickerSummary(ownChoice)}</strong>{" "}</> : ""}
                            <button type="button" className="btn btn-primary" disabled={!pickerComplete(ownChoice)} onClick={confirmChoice}>
                                Send my choice
                            </button>
                        </p>
                    </section>
                )}

                {waitlist && !waitlist.mentorOnly && waitlist.matchStatus === "awaiting_choice" && (
                    <section>
                        <h3>Choose the job role you'd like a mentor in</h3>
                        <p>
                            Open a career from your matches and pick the <strong>one job role</strong> you'd genuinely like to
                            move toward — we'll look for a mentor who does that work. We'll confirm your mentor and schedule
                            your two sessions within <strong>20 business days</strong> of your choice.
                        </p>

                        {options.length === 0 ? (
                            <p>
                                Finish your assessment first — your matches appear here once your report is ready.{" "}
                                <button type="button" className="tap" onClick={() => navigate("/dashboard")}>Go to my journey</button>
                            </p>
                        ) : (
                            <>
                                {/* Round 18 (owner): why "Suits you" appears on some roles and not others */}
                                <p className="report-small">
                                    Job roles are listed by how well they fit you. "Suits you" marks the best fits; careers
                                    without distinct role types list their roles as one group.
                                </p>
                                <div className="role-picker">
                                    {options.map((option) => (
                                        <details key={option.professionId} className="role-picker-career">
                                            <summary>
                                                <span>#{option.rank} {option.profession}</span>
                                                {selected && selected.professionId === option.professionId && <span className="role-picker-chosen">✓ {selected.jobRole}</span>}
                                            </summary>
                                            <div className="role-picker-roles" role="radiogroup" aria-label={`Job roles in ${option.profession}`}>
                                                {option.jobRoles.map((role) => (
                                                    <label key={role} className="choice">
                                                        <input
                                                            type="radio"
                                                            name="jobRole"
                                                            value={`${option.professionId}::${role}`}
                                                            checked={Boolean(selected && selected.professionId === option.professionId && selected.jobRole === role)}
                                                            onChange={() => setSelected({ professionId: option.professionId, profession: option.profession, jobRole: role })}
                                                        />
                                                        <span>{role}</span>
                                                        {option.suitsYou.includes(role) && <span className="role-picker-suits">Suits you</span>}
                                                    </label>
                                                ))}
                                            </div>
                                        </details>
                                    ))}
                                </div>
                                <p>
                                    {selected ? <>Your choice: <strong>{selected.jobRole}</strong> ({selected.profession}){" "}</> : "Pick one job role. "}
                                    <button type="button" className="btn btn-primary" disabled={!selected} onClick={confirmChoice}>
                                        Send my choice
                                    </button>
                                </p>
                            </>
                        )}
                    </section>
                )}

                {/* ALREADY SENT: shown, not editable — the clock is running on it */}
                {waitlist && waitlist.matchStatus !== "awaiting_choice" && chosenText && (
                    <section>
                        <h3>Your mentor's job role</h3>
                        <p>
                            You chose <strong>{chosenText}</strong>{waitlist.chosenIndustry ? ` in ${waitlist.chosenIndustry}` : ""}
                            {waitlist.choiceSentAt ? ` on ${formatDate(waitlist.choiceSentAt)}` : ""}.
                        </p>
                        <p>
                            Need to change your choice?{" "}
                            <a href="https://wa.me/918882756287" target="_blank" rel="noreferrer">Message us on WhatsApp</a>.
                        </p>
                    </section>
                )}

                {waitlist && (
                    <HelpWanted waitlist={waitlist} onSaved={(saved) => setWaitlist((prev) => ({ ...prev, ...saved }))} />
                )}

                <HelpLine />
            </main>
        </div>
    )
}

export default MentorshipChoose
