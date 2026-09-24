import { Link } from "react-router-dom"
import PublicNav from "./PublicNav"
import PublicFooter from "./PublicFooter"
import MentorRolloverPolicy from "./MentorRolloverPolicy"
import usePricing, { formatInr } from "./usePricing"

// The public Mentor Connection page — copy verbatim from mentor_waitlist_page.md. This tier is live
// and payable now (a paid waitlist), not "coming soon". Paying goes through the existing paywall:
// a visitor who isn't logged in is sent to log in first.
function MentorWaitlistPublic() {
    const { tier1, tier2, upgrade } = usePricing()

    return (
        <div>
            <PublicNav />

            <main className="page">
                <section>
                    <h1>Talk to someone who's already where you want to go.</h1>
                    <p>
                        Two sessions with a working professional in your chosen field — a 1-hour clarity session and
                        a 20-minute follow-up. Someone who was once exactly where you are, ready to show you the real
                        picture of the field, not the glossy one.
                    </p>
                    <p><Link to="/paywall" className="tap">Join the waitlist &amp; pay — {formatInr(tier2)}</Link></p>
                </section>

                <section>
                    <h2>Here's exactly what happens</h2>
                    <div className="grid grid-3">
                        <div>
                            <h3>1. Complete Step 1 first.</h3>
                            <p>
                                Do your career discovery and profile, and get your ranked matches. Mentorship only works
                                once you know which direction you're exploring — so this comes first.
                            </p>
                        </div>
                        <div>
                            <h3>2. Choose a career and send it to us.</h3>
                            <p>Pick the profession from your matches that you'd genuinely like to move toward, and let us know.</p>
                        </div>
                        <div>
                            <h3>3. We find your best-fit mentor — within 15 business days.</h3>
                            <p>
                                Once we have your chosen direction, we work to match you with a mentor actually inside that
                                field. We'll confirm your mentor and schedule your two sessions within{" "}
                                <strong>15 business days</strong> of your choice.
                            </p>
                        </div>
                    </div>
                    <blockquote>
                        <strong>Why the wait?</strong> We don't hand you a random name from a list. We match on your
                        specific chosen field so the person you talk to has genuinely walked that exact path — which
                        takes a little time to get right.
                    </blockquote>
                </section>

                <section>
                    <h2>What you get</h2>
                    <ul>
                        <li>
                            <strong>Session 1 — Clarity (1 hour):</strong> the honest, insider view of the field — what
                            the work is really like, how to break in, what nobody tells you.
                        </li>
                        <li>
                            <strong>Session 2 — Follow-up (20 min):</strong> your questions and doubts after you've had
                            time to reflect.
                        </li>
                    </ul>
                </section>

                <section>
                    <h2>Reserve your mentor match</h2>
                    <ul>
                        <li>Pay {formatInr(tier2)} now to join the mentor waitlist.</li>
                        <li>
                            <strong>Already bought the {formatInr(tier1)} Career Discovery profile?</strong> Upgrade here
                            for just <strong>{formatInr(upgrade)} more</strong> — you won't pay the full {formatInr(tier2)} again.
                        </li>
                        <li>Your place is held the moment payment clears.</li>
                        <li>
                            Complete Step 1 and send us your chosen career whenever you're ready — the 15-business-day
                            match clock starts from <em>that</em> point, not from payment.
                        </li>
                    </ul>
                    <p><Link to="/paywall" className="tap">Pay &amp; join the waitlist →</Link></p>
                    <MentorRolloverPolicy />
                </section>
            </main>

            <PublicFooter />
        </div>
    )
}

export default MentorWaitlistPublic
