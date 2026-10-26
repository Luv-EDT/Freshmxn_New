import { useEffect, useState } from "react"
import { useNavigate, Link, Navigate } from "react-router-dom"
import { useSelector } from "react-redux"
import { Modal, message } from "antd"
import Navbar from "../Navbar"
import BackToDashboard from "../BackToDashboard"
import { chooseProfession } from "../../apiCall/mentorWaitlistApi"
import { getMyDemo } from "../../apiCall/demoApi"
import CareerRolePicker, { pickerComplete, pickerSummary } from "../CareerRolePicker"
import { hasMentor } from "../plans"
import { formatDate, useMentorWaitlist, HelpLine, HelpFields, helpReady, HELP_FOCUS } from "./mentorshipParts"
import { ContactChoice, contactReady } from "./ContactChoice"

// EVERYTHING THE STUDENT TELLS US FOR THEIR MENTOR, ON ONE PAGE, SENT ONCE (owner, Rounds 20 and 34): the
// job role, what help they want, what they want to know, their languages and how we reach them — then
// ONE "Send my choice" at the very end. Sending starts the 20-business-day clock; after that nothing can
// be edited here (a change goes through WhatsApp, and only within 7 days).
// Discovery + Mentor students choose from their own matches; Mentor Only students (Round 12) from all
// our careers, or one we don't list.
function MentorshipChoose() {
    const navigate = useNavigate()
    const { user } = useSelector((state) => state.user)
    const isTier2 = hasMentor(user)   // Discovery + Mentor or Mentor Only
    const { waitlist, options, loading } = useMentorWaitlist(isTier2)
    const [selected, setSelected] = useState(null)   // { professionId, profession, jobRole }
    const [ownChoice, setOwnChoice] = useState({})   // Mentor Only: the picker's value
    const [help, setHelp] = useState({ helpFocus: null, helpWanted: "", languages: [], languageOther: "" })
    const [contact, setContact] = useState({ contactVia: null, consent: false })
    const [linkedDemoCareers, setLinkedDemoCareers] = useState([])
    const [sending, setSending] = useState(false)

    // a demo done with this (verified) email: its two careers are offered even before carrying it forward
    useEffect(() => {
        if (!user || (user.demoCareers || []).length) return
        getMyDemo().then((response) => setLinkedDemoCareers(((response.data.data || {}).careers) || [])).catch(() => setLinkedDemoCareers([]))
    }, [user])

    if (!user) return null
    if (!isTier2) return <Navigate to="/mentorship" replace />

    const mentorOnly = Boolean(waitlist && waitlist.mentorOnly)
    const choiceReady = mentorOnly ? pickerComplete(ownChoice) : Boolean(selected)
    const ready = choiceReady && helpReady(help) && contactReady(contact)
    const choiceText = mentorOnly ? (choiceReady ? pickerSummary(ownChoice) : "") : selected ? `${selected.jobRole} (${selected.profession})` : ""
    const languageList = [...(help.languages || []), ...((help.languageOther || "").trim().length >= 2 ? [help.languageOther.trim()] : [])]

    const sendChoice = async () => {
        const payload = mentorOnly
            ? (typeof ownChoice.other === "string"
                ? { other: ownChoice.other, industryCode: ownChoice.industryCode || null }
                : { professionId: ownChoice.professionId, jobRole: ownChoice.jobRole, jobRoleOther: ownChoice.jobRoleOther, industryCode: ownChoice.industryCode || null })
            : { professionId: selected.professionId, jobRole: selected.jobRole }
        setSending(true)
        const response = await chooseProfession({
            ...payload,
            helpFocus: help.helpFocus,
            helpWanted: help.helpWanted,
            languages: help.languages,
            languageOther: help.languageOther,
            contactVia: contact.contactVia,
            contactConsent: contact.consent,
        })
        setSending(false)

        if (!response || response.data.success === false) {
            message.error(response?.data?.message || "Could not send your choice")
            return
        }

        message.success(response.data.message)
        navigate("/mentorship")
    }

    // one last look at everything, because none of it can be changed here afterwards
    const confirmChoice = () => {
        if (!ready) return
        Modal.confirm({
            title: "Send your choice?",
            content: (
                <div>
                    <p><strong>{choiceText}</strong></p>
                    <p>Help with: {(HELP_FOCUS.find((option) => option.value === help.helpFocus) || {}).label}</p>
                    {help.helpWanted && <p>You'd like to know: {help.helpWanted}</p>}
                    <p>Languages: {languageList.join(", ")}</p>
                    <p>We'll reach you on: {contact.contactVia === "email" ? "email" : "WhatsApp"}</p>
                    <p>This starts your 20-business-day mentor match. <strong>You can't change any of this here afterwards</strong> — to change the career, message us on WhatsApp within 7 days.</p>
                </div>
            ),
            okText: "Send my choice",
            cancelText: "Not yet",
            onOk: sendChoice,
        })
    }

    // the demo's two careers (Round 33): quick picks for Mentor Only; on Discovery + Mentor, lifted to the top
    // of their matches when they are among them — also before "Carry them forward"
    const demoCareers = (user.demoCareers || []).length ? user.demoCareers : linkedDemoCareers
    const demoIds = demoCareers.map((career) => career.professionId)
    const orderedOptions = [...options.filter((option) => demoIds.includes(option.professionId)), ...options.filter((option) => !demoIds.includes(option.professionId))]

    const chosenText = waitlist && (waitlist.otherRequest
        ? waitlist.otherRequest
        : waitlist.chosenJobRole ? `${waitlist.chosenJobRole} (${waitlist.chosenProfessionName})` : waitlist.chosenProfessionName)
    const choosing = waitlist && waitlist.matchStatus === "awaiting_choice"
    const noMatchesYet = choosing && !mentorOnly && options.length === 0

    return (
        <div>
            <Navbar />
            <BackToDashboard />
            <main className="page" aria-busy={loading}>
                <p><Link to="/mentorship">← Mentorship</Link></p>
                <h2 className="page-title-center">Your choices for your mentor</h2>

                {loading && <div className="skeleton skeleton-block" />}

                {choosing && (
                    <p className="mentor-once-note">
                        Fill everything below, then press <strong>Send my choice</strong> at the end. It's sent once and
                        can't be edited afterwards.
                    </p>
                )}

                {/* 1. THE JOB ROLE */}
                {choosing && mentorOnly && (
                    <section>
                        <h3>1. Choose the job role you'd like a mentor in</h3>
                        <p>
                            Find the career you're interested in and pick the <strong>one job role</strong> you'd like to
                            move toward. If it isn't in our list, tell us in your own words.
                        </p>
                        {/* the two careers from their demo, offered first (owner, Round 33) */}
                        {demoCareers.length > 0 && !ownChoice.professionId && typeof ownChoice.other !== "string" && (
                            <div className="demo-career-picks">
                                <p className="next-card-label">From your demo</p>
                                <div className="btn-row">
                                    {demoCareers.map((career) => (
                                        <button type="button" key={career.professionId} className="btn btn-ghost" onClick={() => setOwnChoice({ professionId: career.professionId, profession: career.profession })}>
                                            {career.profession}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                        <CareerRolePicker value={ownChoice} onChange={setOwnChoice} allowAnyCareer />
                    </section>
                )}

                {choosing && !mentorOnly && (
                    <section>
                        <h3>1. Choose the job role you'd like a mentor in</h3>
                        <p>
                            Open a career from your matches and pick the <strong>one job role</strong> you'd genuinely like to
                            move toward — we'll look for a mentor who does that work.
                        </p>

                        {noMatchesYet ? (
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
                                    {orderedOptions.map((option) => (
                                        <details key={option.professionId} className="role-picker-career">
                                            <summary>
                                                <span>#{option.rank} {option.profession}</span>
                                                {demoIds.includes(option.professionId) && <span className="role-picker-suits">From your demo</span>}
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
                            </>
                        )}
                    </section>
                )}

                {/* 2–4. WHAT HELP, LANGUAGES, HOW WE REACH YOU — then ONE send, at the very end */}
                {choosing && !noMatchesYet && (
                    <>
                        <HelpFields value={help} onChange={setHelp} />
                        <section>
                            <h3>How we reach you</h3>
                            <ContactChoice value={contact} onChange={setContact} />
                        </section>
                        <div className="mentor-send">
                            {choiceText ? <p>Your choice: <strong>{choiceText}</strong></p> : <p>Pick one job role above.</p>}
                            {!ready && (
                                <p className="report-small">
                                    Still needed: {[!choiceReady && "a job role", !help.helpFocus && "what help you want", !helpReady({ ...help, helpFocus: "x" }) && "a language", !contactReady(contact) && "how we reach you and your OK to share"].filter(Boolean).join(", ")}.
                                </p>
                            )}
                            <button type="button" className="btn btn-primary tap" disabled={!ready || sending} onClick={confirmChoice}>
                                {sending ? "Sending…" : "Send my choice"}
                            </button>
                        </div>
                    </>
                )}

                {/* ALREADY SENT: shown, never editable — the clock is running on it */}
                {waitlist && !choosing && chosenText && (
                    <section className="mentor-sent">
                        <h3>What you sent us</h3>
                        <ul>
                            <li>Job role: <strong>{chosenText}</strong>{waitlist.chosenIndustry ? ` in ${waitlist.chosenIndustry}` : ""}{waitlist.choiceSentAt ? `, sent on ${formatDate(waitlist.choiceSentAt)}` : ""}</li>
                            {waitlist.helpFocus && <li>Help with: {(HELP_FOCUS.find((option) => option.value === waitlist.helpFocus) || {}).label}</li>}
                            {waitlist.helpWanted && <li>You'd like to know: {waitlist.helpWanted}</li>}
                            {(waitlist.languages || []).length > 0 && <li>Languages: {waitlist.languages.join(", ")}</li>}
                            {waitlist.contactVia && <li>We reach you on: {waitlist.contactVia === "email" ? "email" : "WhatsApp"}</li>}
                        </ul>
                        <p className="report-small">
                            These can't be edited. To change the career, message us on WhatsApp
                            {waitlist.changeableUntil ? ` before ${formatDate(waitlist.changeableUntil)}` : " within 7 days of sending"}.
                        </p>
                    </section>
                )}

                <HelpLine />
            </main>
        </div>
    )
}

export default MentorshipChoose
