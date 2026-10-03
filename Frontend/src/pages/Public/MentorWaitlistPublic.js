import { Link } from "react-router-dom"
import PublicNav from "./PublicNav"
import PublicFooter from "./PublicFooter"
import MentorRolloverPolicy from "./MentorRolloverPolicy"
import usePricing, { formatInr } from "./usePricing"
import { StepIcon } from "./illustrations"

// The public mentor page — copy verbatim from mentor_waitlist_page.md. Two plans include a mentor
// (Round 12): Discovery + Mentor, and Mentor Only for a student who wants just the mentor. Both are live
// and payable now (a paid waitlist), not "coming soon". Paying goes through the existing paywall:
// a visitor who isn't logged in is sent to log in first.
function MentorWaitlistPublic() {
    const { tier1, tier2, tier3, upgrade, names } = usePricing()

    return (
        <div>
            <PublicNav />

            <main>
                <section className="hero">
                    <div className="page hero-grid">
                        <div>
                            <span className="eyebrow">Mentors</span>
                            <h1>Talk to someone who's already where you want to go.</h1>
                            <p className="lead">
                                Two sessions with a working professional in your chosen field — a 1-hour clarity session
                                and a 20-minute follow-up. Someone who was once exactly where you are, ready to show you
                                the real picture of the field, not the glossy one.
                            </p>
                            <div className="btn-row">
                                <Link to="/paywall" className="btn btn-primary tap">Join the waitlist &amp; pay — {formatInr(tier2)}</Link>
                                <Link to="/paywall" className="btn btn-ghost tap">Just the mentor — {formatInr(tier3)}</Link>
                            </div>
                        </div>
                        <div className="hero-visual" aria-hidden="true">
                            <div className="blob" />
                            <div className="dot-pink" />
                            <div className="preview-card mentor-art">
                                <StepIcon name="mentor" />
                            </div>
                        </div>
                    </div>
                </section>

                <section className="section">
                    <div className="page">
                        <div className="section-head">
                            <h2>Here's exactly what happens</h2>
                        </div>
                        <div className="numbered">
                            <div className="card">
                                <h3>1. Complete Step 1 first.</h3>
                                <p>
                                    Do your career discovery and profile, and get your ranked matches. Mentorship only
                                    works once you know which direction you're exploring — so this comes first.
                                    <em> Already know the field you want? With {names[3]} you skip this step and choose from
                                    our full list of careers — or tell us in your own words.</em>
                                </p>
                            </div>
                            <div className="card">
                                <h3>2. Choose a job role and send it to us.</h3>
                                <p>Open a career from your matches and pick the one job role you'd genuinely like to move toward, and let us know.</p>
                            </div>
                            <div className="card">
                                <h3>3. We find your best-fit mentor — within 20 business days.</h3>
                                <p>
                                    Once we have your chosen direction, we work to match you with a mentor actually inside
                                    that field. We'll confirm your mentor and schedule your two sessions within{" "}
                                    <strong>20 business days</strong> of your choice.
                                </p>
                            </div>
                        </div>
                        <blockquote className="rank-note">
                            <strong>Why the wait?</strong> We don't hand you a random name from a list. We match on your
                            specific chosen field so the person you talk to has genuinely walked that path — which
                            takes a little time to get right.
                        </blockquote>
                    </div>
                </section>

                <section className="section section-alt">
                    <div className="page">
                        <div className="section-head">
                            <h2>What you get</h2>
                        </div>
                        <div className="pricing">
                            <div className="card">
                                <h3>Session 1 — Clarity (1 hour)</h3>
                                <p>
                                    The honest, insider view of the field — what the work is really like, how to break
                                    in, what nobody tells you.
                                </p>
                            </div>
                            <div className="card">
                                <h3>Session 2 — Follow-up (20 min)</h3>
                                <p>Your questions and doubts after you've had time to reflect.</p>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="section">
                    <div className="page" style={{ maxWidth: 820 }}>
                        <div className="section-head">
                            <h2>Reserve your mentor match</h2>
                        </div>
                        <div className="price-card featured">
                            <div className="price">{formatInr(tier2)}</div>
                            <ul className="check-list">
                                <li>Pay {formatInr(tier2)} now to join the mentor waitlist.</li>
                                <li>
                                    <strong>Already bought the {formatInr(tier1)} Career Discovery profile?</strong> Upgrade
                                    here for just <strong>{formatInr(upgrade)} more</strong> — you won't pay the
                                    full {formatInr(tier2)} again.
                                </li>
                                <li>Your place is held the moment payment clears.</li>
                                <li>
                                    Complete Step 1 and send us your chosen career whenever you're ready — the
                                    20-business-day match clock starts from <em>that</em> point, not from payment.
                                </li>
                            </ul>
                            <Link to="/paywall" className="btn btn-primary tap">Pay &amp; join the waitlist →</Link>
                        </div>
                        <div className="price-card" style={{ marginTop: 24 }}>
                            <h3>{names[3]}</h3>
                            <div className="price">{formatInr(tier3)}</div>
                            <ul className="check-list">
                                <li>For students who already know the field they want and just need a mentor.</li>
                                <li>No assessment or report — choose a career and job role from our full list, add an industry if you like, or describe it in your own words.</li>
                                <li>The same two sessions and the same 20-business-day match, counted from your choice.</li>
                                <li>Want your career report later? Add Career Discovery for the difference.</li>
                            </ul>
                            <Link to="/paywall" className="btn btn-ghost tap">Choose {names[3]} →</Link>
                        </div>
                        <div className="policy" style={{ marginTop: 24 }}>
                            <MentorRolloverPolicy both />
                        </div>
                    </div>
                </section>
            </main>

            <PublicFooter />
        </div>
    )
}

export default MentorWaitlistPublic
