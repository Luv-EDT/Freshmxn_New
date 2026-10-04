import { useNavigate } from "react-router-dom"
import { useSelector } from "react-redux"
import Navbar from "../Navbar"
import JourneyProgress, { journeyStages } from "../JourneyProgress"
import UpgradeToMentorship from "../UpgradeToMentorship"
import ParentConsentBanner from "./ParentConsentBanner"
import { PLAN_NAMES as TIER_NAMES, isMentorOnly } from "../plans"


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
            <main className="page app-page">
            <section className="welcome">
                <h1 className="page-title">Hi {user.name}</h1>
                <p>Your plan: <span className="chip">{TIER_NAMES[user.currentTier] || TIER_NAMES[0]}</span></p>
            </section>

            <ParentConsentBanner />

            {!user.paid && (
                <div className="section-card">
                    <p>Pick a plan to unlock your journey.</p>
                    <button type="button" className="btn btn-primary" onClick={() => navigate("/paywall")}>See plans</button>
                </div>
            )}

            {user.paid && (
                <div>
                    {/* Round 13 (owner): a rewarding look — how far they are, at a glance */}
                    {(() => {
                        const stages = journeyStages(user)
                        const doneCount = stages.filter((stage) => stage.state === "done").length
                        const share = stages.length ? doneCount / stages.length : 0
                        return (
                            <div className="home-ring">
                                <svg viewBox="0 0 36 36" aria-hidden="true">
                                    <circle cx="18" cy="18" r="15.9155" className="home-ring-track" />
                                    <circle cx="18" cy="18" r="15.9155" className="home-ring-fill" strokeDasharray={`${share * 100} 100`} />
                                </svg>
                                <p>
                                    <strong>{doneCount} of {stages.length} done</strong>
                                    <span>{doneCount === stages.length ? "Every stage finished — well done." : doneCount === 0 ? "Let's get you started." : "You're on your way."}</span>
                                </p>
                            </div>
                        )
                    })()}

                    <JourneyProgress user={user} variant="home" />

                    {/* ONE OBVIOUS NEXT ACTION, above the list. The bar shows the whole journey; this
                        says which part of it to do now. A student who lands here after a week away
                        should not have to work that out by reading four statuses. */}
                    {nextStage && (
                        <div className="next-card">
                            <p className="next-card-label">Your next step</p>
                            <button
                                type="button"
                                className="btn btn-primary btn-next"
                                onClick={() => navigate(nextStage.path)}
                            >
                                {nextStage.key === "interest" && (interestFormLabel[user.progress?.interestForm] || "Open the interest form")}
                                {nextStage.key === "assessment" && (assessmentLabel[user.progress?.psychometric] || "Open the assessment")}
                                {nextStage.key === "report" && (user.progress?.report === "ready" ? "Read your report" : "See how your report is coming")}
                                {nextStage.key === "mentor" && "See your mentor status"}
                            </button>
                        </div>
                    )}

                    {/* Mentor Only (Round 12): no assessment to open — say what else exists, once */}
                    {isMentorOnly(user) && (
                        <div className="section-card">
                            <p>Want to see which careers fit you, too? Add Career Discovery — the assessment and your ranked career report.</p>
                            <button type="button" className="btn btn-ghost" onClick={() => navigate("/paywall")}>See what it adds</button>
                        </div>
                    )}

                    {!assessmentOpen && !isMentorOnly(user) && (
                        <p><em>The assessment opens once the interest form is finished — it needs what you tell us there to match against.</em></p>
                    )}

                    <UpgradeToMentorship user={user} />
                </div>
            )}
            </main>
        </div>
    )
}

export default Home
