import { useNavigate } from "react-router-dom"
import { useSelector } from "react-redux"
import Navbar from "../Navbar"
import JourneyProgress, { journeyStages } from "../JourneyProgress"
import UpgradeToMentorship from "../UpgradeToMentorship"

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

    const assessmentLabel = {
        not_started: "Start the assessment",
        in_progress: "Continue the assessment",
        done: "Review your answers",
    }

    // The assessment opens only once the interest form is done: Program 2 matches professions
    // against the activities that form collects, so an assessment taken first would score a
    // profile with nothing to match it to.
    const assessmentOpen = user.progress?.interestForm === "done"

    // The first stage that is open and not finished — what "carry on" means for this student right
    // now. Read from the same function the bar uses, so the button and the bar can never disagree
    // about where they are.
    const nextStage = journeyStages(user).find((stage) => stage.open && stage.state !== "done")

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
                    <JourneyProgress user={user} />

                    {/* ONE OBVIOUS NEXT ACTION, above the list. The bar shows the whole journey; this
                        says which part of it to do now. A student who lands here after a week away
                        should not have to work that out by reading four statuses. */}
                    {nextStage && (
                        <p>
                            <button
                                type="button"
                                style={{ padding: "12px 20px", minHeight: "48px", fontSize: "16px" }}
                                onClick={() => navigate(nextStage.path)}
                            >
                                {nextStage.key === "interest" && (interestFormLabel[user.progress?.interestForm] || "Open the interest form")}
                                {nextStage.key === "assessment" && (assessmentLabel[user.progress?.psychometric] || "Open the assessment")}
                                {nextStage.key === "report" && (user.progress?.report === "ready" ? "Read your report" : "See how your report is coming")}
                                {nextStage.key === "mentor" && "See your mentor status"}
                            </button>
                        </p>
                    )}

                    {!assessmentOpen && (
                        <p><em>The assessment opens once the interest form is finished — it needs what you tell us there to match against.</em></p>
                    )}

                    <UpgradeToMentorship user={user} />
                </div>
            )}
        </div>
    )
}

export default Home
