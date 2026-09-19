import { useNavigate } from "react-router-dom"
import { useSelector } from "react-redux"
import Navbar from "../Navbar"

// Tier 2 buys a mentor. The real onboarding and waitlist tooling isn't built yet, so for now this
// page carries the promise; when the mentor flow exists it replaces this content at the same route.
function Mentorship() {
    const navigate = useNavigate()
    const { user } = useSelector((state) => state.user)

    if (!user) return null

    if (user.currentTier !== 2) {
        return (
            <div>
                <Navbar />
                <h2>Mentorship</h2>
                <p>Mentorship comes with Tier 2. Upgrade to join the waitlist.</p>
                <button type="button" onClick={() => navigate("/paywall")}>See plans</button>
            </div>
        )
    }

    return (
        <div>
            <Navbar />
            <h2>🤝 Mentorship</h2>

            <p><strong>You're on the waitlist.</strong></p>

            <p>
                We promise to bring you a mentor within <strong>20 days</strong> of you submitting your
                choice of profession from our recommendation list.
            </p>

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

            <button type="button" onClick={() => navigate("/")}>Back to home</button>
        </div>
    )
}

export default Mentorship
