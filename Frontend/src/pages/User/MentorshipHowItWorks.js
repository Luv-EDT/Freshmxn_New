import { Link } from "react-router-dom"
import { useSelector } from "react-redux"
import Navbar from "../Navbar"
import BackToDashboard from "../BackToDashboard"
import MentorRolloverPolicy from "../Public/MentorRolloverPolicy"
import { hasMentor } from "../plans"
import { Framing, useMentorWaitlist, HelpLine } from "./mentorshipParts"

// How mentoring works, on its own page (owner, Round 26): the "How it works" button on /mentorship
// opens it. Contribution and interest, who your mentor will be, the sessions, and the 20-business-day
// policy — the policy only until a mentor is confirmed, when it has done its job (owner, Round 13).
function MentorshipHowItWorks() {
    const { user } = useSelector((state) => state.user)
    const { waitlist } = useMentorWaitlist(hasMentor(user))

    if (!user) return null

    const matched = Boolean(waitlist && waitlist.matchStatus === "matched")

    return (
        <div>
            <Navbar />
            <BackToDashboard />
            <main className="page mentor-how">
                <p><Link to="/mentorship">← Mentorship</Link></p>
                <h2>How it works</h2>
                <Framing />

                <h3>Who your mentor will be</h3>
                <p>
                    Your mentor will be a <strong>mid-level professional</strong> — and that's a deliberate choice, not a
                    compromise. We don't pair you with industry veterans or highly qualified outliers, because the
                    further someone is from where you're standing, the harder it is to relate to them.
                </p>
                <p>
                    We want someone whose own start is still near enough in time to be useful to you — an older-sibling
                    kind of relationship rather than a lecture. They will be competent; that part is a given. What we're
                    really after is relatability, and above all a good mentor–mentee relationship.
                </p>

                <h3>The sessions</h3>
                <p>
                    We connect the two of you here and you have a couple of sessions together. After that you can book
                    further sessions whenever you want more clarity. In the best case, they simply become your mentor
                    for the long run.
                </p>

                {!matched && <MentorRolloverPolicy mentorOnly={Boolean(waitlist && waitlist.mentorOnly)} />}

                <HelpLine />
            </main>
        </div>
    )
}

export default MentorshipHowItWorks
