import { useNavigate, Link } from "react-router-dom"
import { useSelector } from "react-redux"
import Navbar from "../Navbar"
import BackToDashboard from "../BackToDashboard"
import { hasMentor } from "../plans"
import { formatDate, useMentorWaitlist, HelpLine } from "./mentorshipParts"
import CareerHelpBox from "./CareerHelpBox"
import AnotherSession from "./AnotherSession"
import { getMyWaitlist } from "../../apiCall/mentorWaitlistApi"

// The mentor waitlist, after payment (mentor_waitlist_page.md). Since Round 20 (owner) this page says
// WHERE THINGS STAND first — choose your mentor's job role, we're finding your mentor, or your mentor
// is confirmed. Then (Round 26, owner) a "How it works" button to its own page
// (MentorshipHowItWorks.js) and a folded "How else can we help you?". The choice and the answers for
// the mentor live on /mentorship/choose (MentorshipChoose.js).
//
// For Discovery + Mentor: 1. complete Step 1 → 2. choose ONE JOB ROLE inside one of YOUR OWN MATCHES
// → 3. we match a mentor within 20 BUSINESS DAYS OF THAT CHOICE (not of payment). The choice is sent
// once; changing it goes through WhatsApp, and an admin resets it (Admin → Mentor Matches).
function Mentorship() {
    const navigate = useNavigate()
    const { user } = useSelector((state) => state.user)
    const isTier2 = hasMentor(user)   // Discovery + Mentor or Mentor Only — the name is kept from before
    const { waitlist, setWaitlist, loading } = useMentorWaitlist(isTier2)
    const reload = async () => setWaitlist((await getMyWaitlist())?.data?.data || null)

    if (!user) return null

    if (!isTier2) {
        return (
            <div>
                <Navbar />
                <BackToDashboard />
                <main className="page">
                    <h2>Mentorship</h2>
                    <p>Mentorship comes with the Discovery + Mentor and Mentor Only plans.</p>
                    <HelpLine />
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
                <BackToDashboard />
                <main className="page" aria-busy="true">
                    <h2>🤝 Mentorship</h2>
                    <div className="skeleton skeleton-line" />
                    <div className="skeleton skeleton-block" />
                    <div className="skeleton skeleton-line short" />
                    <HelpLine />
                </main>
            </div>
        )
    }

    return (
        <div>
            <Navbar />
            <BackToDashboard />
            <main className="page">
                <h2>🤝 Mentorship</h2>

                {/* 1. WHERE THINGS STAND */}
                {waitlist && waitlist.matchStatus === "awaiting_choice" && (
                    <section>
                        <h3>Choose the job role you'd like a mentor in</h3>
                        <p>
                            Pick the <strong>one job role</strong> you'd like to move toward. We'll confirm your mentor
                            within <strong>20 business days</strong> of your choice.
                        </p>
                        <p><Link to="/mentorship/choose" className="btn btn-primary tap">Choose your mentor's job role →</Link></p>
                    </section>
                )}

                {waitlist && waitlist.matchStatus === "matching" && (
                    <section>
                        <h3>{waitlist.sameFieldNewMentor ? "We're finding you a different mentor" : "We're finding your mentor"}</h3>
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

                {/* Round 28 (owner): a finished session is logged; another can be booked (paid) */}
                {waitlist && waitlist.matchStatus === "completed" && <AnotherSession waitlist={waitlist} onChanged={reload} />}

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

                {/* 2. WHAT YOU'VE TOLD US — all the inputs are on their own page */}
                {waitlist && waitlist.matchStatus !== "awaiting_choice" && (
                    <p><Link to="/mentorship/choose" className="btn btn-ghost btn-sm tap">Your answers for your mentor →</Link></p>
                )}

                <HelpLine />

                {/* 3. HOW IT WORKS — its own page since Round 26 (owner): the framing, who your mentor will be,
                    the sessions and the policy (MentorshipHowItWorks.js) */}
                <p><Link to="/mentorship/how-it-works" className="btn btn-ghost tap mentor-how-link">How it works →</Link></p>

                {/* 4. HOW ELSE CAN WE HELP — folded, below How it works (owner, Round 26); once a career is
                    chosen it is asked about that career */}
                <details className="faq-item mentor-help-fold">
                    <summary>How else can we help you?</summary>
                    <CareerHelpBox fixedCareer={waitlist && waitlist.chosenProfessionId ? { id: waitlist.chosenProfessionId, name: waitlist.chosenProfessionName } : null} />
                </details>

                <button type="button" className="tap" onClick={() => navigate("/dashboard")}>Back to dashboard</button>
            </main>
        </div>
    )
}

export default Mentorship
