import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useSelector } from "react-redux"
import { Modal, message } from "antd"
import dayjs from "dayjs"
import Navbar from "../Navbar"
import MentorRolloverPolicy from "../Public/MentorRolloverPolicy"
import { getMyWaitlist, chooseProfession } from "../../apiCall/mentorWaitlistApi"
import CareerRolePicker, { pickerComplete, pickerSummary } from "../CareerRolePicker"
import { hasMentor } from "../plans"

// The mentor waitlist, after payment (mentor_waitlist_page.md). Discovery + Mentor students choose
// from their own matches; Mentor Only students (Round 12) have no report, so they choose from all
// our careers, or describe one we don't list. For Discovery + Mentor:
//   1. complete Step 1 → 2. choose ONE JOB ROLE inside one of YOUR OWN MATCHES and send it →
//   3. we match a mentor within 20 BUSINESS DAYS OF THAT CHOICE (not of payment).
// The choice is sent once: it starts the clock and our search. Changing it goes through WhatsApp,
// and an admin resets it (Admin → Mentor Matches).

const formatDate = (date) => (date ? dayjs(date).format("D MMM YYYY") : "")

function Mentorship() {
    const navigate = useNavigate()
    const { user } = useSelector((state) => state.user)
    const [waitlist, setWaitlist] = useState(null)
    // the careers and their job roles, built on the server from the student's own ranking
    const [options, setOptions] = useState([])
    const [selected, setSelected] = useState(null)   // { professionId, profession, jobRole }
    const [loading, setLoading] = useState(true)

    const isTier2 = hasMentor(user)   // Discovery + Mentor or Mentor Only — the name is kept from before
    const [ownChoice, setOwnChoice] = useState({})   // Mentor Only: the picker's value

    useEffect(() => {
        if (!isTier2) {
            setLoading(false)
            return
        }

        const load = async () => {
            try {
                const waitlistResponse = await getMyWaitlist()
                const place = waitlistResponse?.data?.data || null
                setWaitlist(place)
                setOptions((place && place.options) || [])
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [isTier2])

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

    // Round 13 (owner): help is one tap away on every state of this page
    const help = (
        <p className="help-line">
            Need help? <a href="https://wa.me/918882756287" target="_blank" rel="noreferrer">WhatsApp us</a>
        </p>
    )

    if (!user) return null

    if (!isTier2) {
        return (
            <div>
                <Navbar />
                <main className="page">
                    <h2>Mentorship</h2>
                    <p>Mentorship comes with the Discovery + Mentor and Mentor Only plans.</p>
                    {help}
                    <button type="button" className="tap" onClick={() => navigate("/paywall")}>See plans</button>
                </main>
            </div>
        )
    }

    // NOTHING UNTIL THE WAITLIST IS IN. Rendering the static half first and the student's own state a
    // moment later read as the page loading twice (owner, Round 13).
    if (loading) {
        return (
            <div>
                <Navbar />
                <main className="page" aria-busy="true">
                    <h2>🤝 Mentorship</h2>
                    <div className="skeleton skeleton-line" />
                    <div className="skeleton skeleton-block" />
                    <div className="skeleton skeleton-line short" />
                    {help}
                </main>
            </div>
        )
    }

    const matched = Boolean(waitlist && waitlist.matchStatus === "matched")

    return (
        <div>
            <Navbar />
            <main className="page">
                <h2>🤝 Mentorship</h2>

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

                {waitlist && waitlist.matchStatus === "matching" && (
                    <section>
                        <h3>We're finding your mentor</h3>
                        <p>
                            You chose <strong>{waitlist.otherRequest ? waitlist.otherRequest : waitlist.chosenJobRole ? `${waitlist.chosenJobRole} (${waitlist.chosenProfessionName})` : waitlist.chosenProfessionName}</strong>
                            {waitlist.chosenIndustry ? ` in ${waitlist.chosenIndustry}` : ""} on {formatDate(waitlist.choiceSentAt)}.
                            We'll confirm your mentor <strong>via WhatsApp</strong> by <strong>{formatDate(waitlist.dueBy)}</strong> — 20 business days
                            from your choice.
                        </p>
                        <p>
                            Need to change your choice?{" "}
                            <a href="https://wa.me/918882756287" target="_blank" rel="noreferrer">Message us on WhatsApp</a>.
                        </p>
                    </section>
                )}

                {waitlist && waitlist.matchStatus === "matched" && (
                    <section>
                        <h3>Your mentor is confirmed</h3>
                        {waitlist.mentor && (
                            <p>
                                <strong>{waitlist.mentor.name}</strong> — {waitlist.mentor.currentRole}
                                {waitlist.mentor.discipline ? `, ${waitlist.mentor.discipline}` : ""}
                            </p>
                        )}
                        <p>Career: {waitlist.otherRequest || `${waitlist.chosenProfessionName}${waitlist.chosenJobRole ? ` — ${waitlist.chosenJobRole}` : ""}`}. We'll contact you to schedule your two sessions.</p>
                    </section>
                )}

                {waitlist && waitlist.matchStatus === "unmatchable" && (
                    <section>
                        <h3>We couldn't match you in time</h3>
                        <p>
                            {waitlist.resolution === "refunded"
                                ? waitlist.mentorOnly
                                    ? "We've arranged your full refund."
                                    : "We've moved you back to Career Discovery and arranged the refund of the difference."
                                : "Your payment has rolled over — we're still searching, or you can redirect it. We'll be in touch."}
                        </p>
                    </section>
                )}

                {help}

                {/* once matched, the policy and the explainer have done their job (owner, Round 13) */}
                {!matched && (
                <>
                <MentorRolloverPolicy mentorOnly={Boolean(waitlist && waitlist.mentorOnly)} />

                <h3>Who your mentor will be</h3>
                <p>
                    Your mentor will be a <strong>mid-level professional</strong> — and that's a deliberate
                    choice, not a compromise. We don't pair you with industry veterans or highly qualified
                    outliers, because the further someone is from where you're standing, the harder it is to
                    relate to them.
                </p>
                <p>
                    We want someone whose own start is still near enough in time to be useful to you — an
                    older-sibling kind of relationship rather than a lecture. They will be competent; that
                    part is a given. What we're really after is relatability, and above all a good
                    mentor–mentee relationship.
                </p>

                <h3>How it works</h3>
                <p>
                    We connect the two of you here and you have a couple of sessions together. After that you
                    can book further sessions whenever you want more clarity. In the best case, they simply
                    become your mentor for the long run.
                </p>
                </>
                )}

                <button type="button" className="tap" onClick={() => navigate("/dashboard")}>Back to home</button>
            </main>
        </div>
    )
}

export default Mentorship
