import { useNavigate, Link } from "react-router-dom"
import { useSelector } from "react-redux"
import Navbar from "../Navbar"
import BackToDashboard from "../BackToDashboard"
import { hasMentor } from "../plans"
import dayjs from "dayjs"
import { formatDate, useMentorWaitlist, HelpLine, NextSteps, BookingCountdown, WHATSAPP } from "./mentorshipParts"
import CareerHelpBox from "./CareerHelpBox"
import AnotherSession from "./AnotherSession"
import { getMyWaitlist } from "../../apiCall/mentorWaitlistApi"
import { ContactCard } from "./ContactChoice"
import ReportMentor from "./ReportMentor"
import UpgradeToMentorship from "../UpgradeToMentorship"

// STEP 4, MENTORSHIP (owner, Rounds 20 and 34). WHERE THINGS STAND first — choose your mentor's job role,
// we're finding your mentor, book your session from your mentor's links, or fill your feedback — then
// what happens next, "How it works" (its own page) and a folded "How else can we help you?". The
// one-time form lives on /mentorship/choose (MentorshipChoose.js).
//
// Students and mentors never message each other to arrange a session: once matched, the mentor's two
// Calendly links show here, with a countdown to book (2.5 days). Round 35 (owner): the mentor tells us on
// WhatsApp when the student has booked and the admin logs it — the links then give way to the session
// times. Three days after the match with nothing logged, this page says the chance is lost (a no-show).
// Everything else goes through us on WhatsApp.
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
                    <h2 className="page-title-center">Mentorship</h2>
                    {/* Round 35: the dashboard's Mentor tab lands here — the full offer, from the report's own careers when there are any */}
                    {Number(user.currentTier) === 1 ? <UpgradeToMentorship user={user} to="/paywall" /> : <p>Mentorship comes with the Discovery + Mentor and Mentor Only plans.</p>}
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
                    <h2 className="page-title-center">🤝 Mentorship</h2>
                    <div className="skeleton skeleton-line" />
                    <div className="skeleton skeleton-block" />
                    <div className="skeleton skeleton-line short" />
                    <HelpLine />
                </main>
            </div>
        )
    }

    const status = waitlist && waitlist.matchStatus
    const chosen = waitlist && (waitlist.otherRequest
        ? waitlist.otherRequest
        : waitlist.chosenJobRole ? `${waitlist.chosenJobRole} (${waitlist.chosenProfessionName})` : waitlist.chosenProfessionName)
    const mentor = waitlist && waitlist.mentor

    return (
        <div>
            <Navbar />
            <BackToDashboard />
            <main className="page">
                <h2 className="page-title-center">🤝 Mentorship</h2>

                {/* Round 28: a choice sent before we asked how to reach them — no match until answered */}
                {waitlist && ["matching", "matched"].includes(status) && !waitlist.contactConsented && (
                    <ContactCard onSaved={(saved) => setWaitlist((prev) => ({ ...prev, ...saved }))} />
                )}

                {/* 1. WHERE THINGS STAND */}
                {status === "awaiting_choice" && (
                    <section className="mentor-status">
                        <h3>Choose the job role you'd like a mentor in</h3>
                        <p>
                            Pick the <strong>one job role</strong> you'd like to move toward and tell us what you want from your
                            mentor — all on one page, sent once. We'll find your mentor within <strong>20 business days</strong> of it.
                        </p>
                        <p><Link to="/mentorship/choose" className="btn btn-primary tap">Choose your mentor's job role →</Link></p>
                    </section>
                )}

                {status === "matching" && (
                    <section className="mentor-status">
                        <h3>{waitlist.sameFieldNewMentor ? "We're finding you a new mentor" : "We're finding your mentor"}</h3>
                        <p>
                            You chose <strong>{chosen}</strong>{waitlist.chosenIndustry ? ` in ${waitlist.chosenIndustry}` : ""}
                            {waitlist.choiceSentAt ? ` on ${formatDate(waitlist.choiceSentAt)}` : ""}. We'll confirm your mentor by{" "}
                            <strong>{formatDate(waitlist.dueBy)}</strong> — by email, on WhatsApp and here.
                        </p>
                    </section>
                )}

                {status === "matched" && (
                    <section className="mentor-status mentor-matched">
                        {waitlist.bookedMainAt ? (
                            <>
                                <h3>Your sessions are booked</h3>
                                {mentor && <p><strong>{mentor.name}</strong> — {mentor.currentRole}{mentor.discipline ? `, ${mentor.discipline}` : ""}</p>}
                                <ul className="booked-times">
                                    <li><span>Main session (1 hour)</span><strong>{dayjs(waitlist.bookedMainAt).format("ddd D MMM, h:mm a")}</strong></li>
                                    <li><span>Follow-up (20 minutes)</span><strong>{waitlist.bookedFollowUpAt ? dayjs(waitlist.bookedFollowUpAt).format("ddd D MMM, h:mm a") : "Not booked"}</strong></li>
                                </ul>
                                <p>Now wait for the time you chose. You may also have a confirmation email from your mentor's Calendly.</p>
                                <p className="report-small">Join on time — more than 10 minutes late counts as a no-show. To reschedule, message us on WhatsApp.</p>
                            </>
                        ) : waitlist.bookingMissed ? (
                            <>
                                <h3>The booking time has passed</h3>
                                <p>
                                    You've lost the chance of booking within the time given, and it has been recorded as a no-show. If you
                                    still want the mentorship session, message us on WhatsApp and we'll try to arrange it with your mentor again.
                                </p>
                                <p><a className="btn btn-primary tap" href={WHATSAPP} target="_blank" rel="noreferrer">Message us on WhatsApp</a></p>
                            </>
                        ) : (
                            <>
                                <h3>Your mentor is confirmed — book your sessions</h3>
                                {mentor && <p><strong>{mentor.name}</strong> — {mentor.currentRole}{mentor.discipline ? `, ${mentor.discipline}` : ""}</p>}
                                <p>Career: {chosen}.</p>
                                <p>Book within <strong>2.5 days</strong>, or it counts as a no-show. Book both together:</p>
                                {waitlist.bookBy && <BookingCountdown until={waitlist.bookBy} />}
                                <div className="btn-row booking-links">
                                    {mentor && mentor.calendlyMain && (
                                        <a className="btn btn-primary tap" href={mentor.calendlyMain} target="_blank" rel="noreferrer">Book the 1-hour session (next 4 days)</a>
                                    )}
                                    {mentor && mentor.calendlyFollowUp && (
                                        <a className="btn btn-ghost tap" href={mentor.calendlyFollowUp} target="_blank" rel="noreferrer">Book the 20-min follow-up (day 3–6, after your main session)</a>
                                    )}
                                </div>
                                <p className="booking-rule"><strong>Pick one slot on each link.</strong> More than one slot on a link counts as no session chosen — your mentor reports it to us, and it can cost you your whole mentorship.</p>
                                <p className="report-small">
                                    Can't find a slot that works? Message us on WhatsApp at{" "}
                                    <a href={WHATSAPP} target="_blank" rel="noreferrer">+91 8882756287</a> and we'll help you directly.
                                    Add both to your calendar; joining more than 10 minutes late counts as a no-show.
                                </p>
                            </>
                        )}
                    </section>
                )}

                {status === "completed" && (
                    <section className="mentor-status">
                        <h3>Your session is done</h3>
                        <p>Please fill the short feedback form — once, after your follow-up too if you booked one. Don't share it with your mentor.</p>
                        <p><Link to="/mentorship/review" className="btn btn-primary tap">Fill your feedback form →</Link></p>
                    </section>
                )}

                {status === "closed" && (
                    <section className="mentor-status">
                        <h3>Your mentor ticket is closed</h3>
                        <p>
                            {waitlist.resolution === "refund_requested"
                                ? <>You asked for a refund of the mentor part{waitlist.mentorRefundInr ? ` (₹${Number(waitlist.mentorRefundInr).toLocaleString("en-IN")})` : ""}. We'll email you when it's on its way.</>
                                : waitlist.resolution === "student_no_show"
                                    ? <>Your session was marked a no-show — it wasn't booked in time, or nobody joined within 10 minutes. If you still want the mentorship session, <a href={WHATSAPP} target="_blank" rel="noreferrer">message us on WhatsApp</a> and we'll try to arrange it with your mentor again.</>
                                    : "We've refunded the mentor part. You'll find it under Profile → Payment history."}
                        </p>
                    </section>
                )}

                {status === "unmatchable" && (
                    <section className="mentor-status">
                        <h3>We couldn't match you in time</h3>
                        <p>
                            {waitlist.resolution === "refunded"
                                ? waitlist.mentorOnly
                                    ? "We've arranged your full refund."
                                    : "We've moved you back to Career Discovery and arranged the refund of the difference."
                                : "We'll be in touch on WhatsApp."}
                        </p>
                    </section>
                )}

                {/* Round 28: a finished session is logged; another can be booked (paid) */}
                {(status === "completed" || (status === "closed" && waitlist.resolution === "student_no_show" && waitlist.extraSessionCredit > 0)) && <AnotherSession waitlist={waitlist} onChanged={reload} />}

                {/* 2. WHAT HAPPENS NEXT — from the moment the choice is sent until the session is done */}
                {["matching", "matched"].includes(status) && <NextSteps />}

                {/* what they sent, read-only */}
                {waitlist && status !== "awaiting_choice" && chosen && (
                    <p><Link to="/mentorship/choose" className="btn btn-ghost btn-sm tap">What you sent us →</Link></p>
                )}

                <HelpLine />

                {/* Round 28 / 34 (owner): report a mentor — a small button; a refund or a new mentor */}
                {waitlist && mentor && ["matched", "completed"].includes(status) && (
                    <ReportMentor refundInr={waitlist.mentorRefundInr} onSent={reload} />
                )}

                {/* 3. HOW IT WORKS — its own page (MentorshipHowItWorks.js) */}
                <p><Link to="/mentorship/how-it-works" className="btn btn-ghost tap mentor-how-link">How it works →</Link></p>

                {/* 4. HOW ELSE CAN WE HELP — folded (owner, Round 26) */}
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
