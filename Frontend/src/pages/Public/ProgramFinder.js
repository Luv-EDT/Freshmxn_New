import { useState } from "react"
import { Link } from "react-router-dom"
import { useSelector } from "react-redux"
import PublicNav from "./PublicNav"
import PublicFooter from "./PublicFooter"
import usePricing, { formatInr } from "./usePricing"

// FIND YOUR PROGRAM (owner, Round 36) — /find-your-program, the page after the demo's "Check out our
// programs". One question first, then only the plans that fit, each in a line or two:
//   A. completely lost — figure out what's right for me          → Career Discovery and Discovery + Mentor
//   B. looking for specific help, then on the same page:
//      B1. a very specific need                                  → Mentor Only
//      B2. I know the field and want to see what's inside it     → Career Discovery and Discovery + Mentor
// Prices and plan names come from the server (usePricing). "For more details" is the full programs page.
const PLAN_LINES = {
    1: "Virtual career counselling, the full 31-factor assessment, and your ranked career report — with the road to each career from where you stand.",
    2: "Everything in Career Discovery, plus a one-to-one session (and a follow-up) with a mentor who does the work.",
    3: "Go straight to a mentor in the career you have in mind — a 1-hour session and a follow-up, no assessment.",
}

const PLANS_FOR = { lost: [1, 2], specific: [3], field: [1, 2] }

function ProgramFinder() {
    const { user } = useSelector((state) => state.user)
    const pricing = usePricing()
    const [need, setNeed] = useState(null)        // lost | targeted
    const [target, setTarget] = useState(null)    // specific | field
    const prices = { 1: pricing.tier1, 2: pricing.tier2, 3: pricing.tier3 }
    const choice = need === "lost" ? "lost" : need === "targeted" ? target : null
    const plans = choice ? PLANS_FOR[choice] : []
    const goTo = (tier) => (user ? `/paywall?plan=${tier}` : `/register?plan=${tier}`)

    return (
        <div>
            <PublicNav />
            <main className="page finder-page">
                <h1 className="page-title-center">How can we help you?</h1>
                <p className="finder-lead">Pick what sounds most like you — we'll show the program that fits.</p>

                <div className="finder-choices" role="radiogroup" aria-label="What do you need?">
                    <button type="button" role="radio" aria-checked={need === "lost"} className={`finder-card${need === "lost" ? " is-on" : ""}`} onClick={() => { setNeed("lost"); setTarget(null) }}>
                        <span className="finder-tag">Lost guidance</span>
                        <strong>I'm completely lost</strong>
                        <span>I want to figure out what's right for me and move forward.</span>
                    </button>
                    <button type="button" role="radio" aria-checked={need === "targeted"} className={`finder-card${need === "targeted" ? " is-on" : ""}`} onClick={() => setNeed("targeted")}>
                        <span className="finder-tag">Targeted guidance</span>
                        <strong>I'm looking for specific help</strong>
                        <span>I know roughly what I need.</span>
                    </button>
                </div>

                {need === "targeted" && (
                    <div className="finder-choices finder-sub" role="radiogroup" aria-label="What kind of help?">
                        <button type="button" role="radio" aria-checked={target === "specific"} className={`finder-card${target === "specific" ? " is-on" : ""}`} onClick={() => setTarget("specific")}>
                            <strong>A very specific need</strong>
                            <span>I want to talk to someone who does a particular job.</span>
                        </button>
                        <button type="button" role="radio" aria-checked={target === "field"} className={`finder-card${target === "field" ? " is-on" : ""}`} onClick={() => setTarget("field")}>
                            <strong>I know the field I want to enter</strong>
                            <span>I want to find out what's inside it and where I fit.</span>
                        </button>
                    </div>
                )}

                {plans.length > 0 && (
                    <section className="finder-plans" aria-live="polite">
                        <h2>{plans.length === 1 ? "Your program" : "Your programs"}</h2>
                        <div className="finder-plan-grid">
                            {plans.map((tier) => (
                                <div key={tier} className={`finder-plan${tier === 2 ? " is-full" : ""}`}>
                                    <h3>{pricing.names[tier]}</h3>
                                    <p className="finder-price">{formatInr(prices[tier])}</p>
                                    <p>{PLAN_LINES[tier]}</p>
                                    <Link to={goTo(tier)} className="btn btn-primary tap">Choose {pricing.names[tier]}</Link>
                                </div>
                            ))}
                        </div>
                        <p className="finder-more"><Link to="/programs">For more details →</Link></p>
                        <p className="demo-hint">
                            <strong>Need help with the price?</strong> After signing up you can ask for financial aid — we look at every request.
                            {" "}<strong>Refunds:</strong> don't like your results? Give us quick feedback and we'll refund you — on any plan.
                        </p>
                    </section>
                )}
            </main>
            <PublicFooter />
        </div>
    )
}

export default ProgramFinder
