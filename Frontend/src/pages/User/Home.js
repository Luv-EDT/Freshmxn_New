import { useNavigate } from "react-router-dom"
import { useSelector } from "react-redux"
import Navbar from "../Navbar"

const TIER_NAMES = {
    0: "No plan yet",
    1: "Tier 1 — Career Recommendation + Psychometric Analysis",
    2: "Tier 2 — Mentor Connection",
}

// Home is the journey. Money — payment history and refunds — lives on the profile page.
function Home() {
    const navigate = useNavigate()
    const { user } = useSelector((state) => state.user)

    if (!user) return null

    const interestFormLabel = {
        not_started: "Start the interest form",
        in_progress: "Continue the interest form",
        done: "Review / edit your interest form",
    }

    return (
        <div>
            <Navbar />
            <h2>Hi {user.name}</h2>
            <p>Your plan: <strong>{TIER_NAMES[user.currentTier] || TIER_NAMES[0]}</strong></p>

            {!user.paid && (
                <div>
                    <p>Pick a plan to unlock your journey.</p>
                    <button type="button" onClick={() => navigate("/paywall")}>See plans</button>
                </div>
            )}

            {user.paid && (
                <div>
                    {/* Staged flow — only Stage 1 exists on Day 1 */}
                    <h3>Your journey</h3>
                    <ol>
                        <li>
                            Interest Form — {user.progress?.interestForm}{" "}
                            <button type="button" onClick={() => navigate("/interest")}>
                                {interestFormLabel[user.progress?.interestForm] || "Open"}
                            </button>
                        </li>
                        <li>Psychometric Assessment — coming soon</li>
                        <li>Report — coming soon</li>
                        <li>Mentor — {user.currentTier === 2 ? "waitlisted" : "available with Tier 2"}</li>
                    </ol>

                    {user.currentTier === 1 && (
                        <button type="button" onClick={() => navigate("/paywall")}>Upgrade to Mentorship</button>
                    )}
                </div>
            )}
        </div>
    )
}

export default Home
