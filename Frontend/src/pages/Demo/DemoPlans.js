import { Link } from "react-router-dom"
import usePricing, { formatInr } from "../Public/usePricing"

// THE THREE REAL PLANS, prices live from the server (owner, Round 32: never written in the copy) — in
// the owner's order for the demo: Mentor Only, Career Discovery, Discovery + Mentor. The main button is
// Career Discovery; Register remembers the plan through to the paywall (?plan=, Round 25).
const PLANS = [
    { tier: 3, line: "Skip the assessment — a mentor in any career and job role you choose." },
    { tier: 1, line: "The full picture: your whole story, all 31 factors, and every career it points to — ranked, with the road to each.", main: true },
    { tier: 2, line: "Everything in Career Discovery, plus a mentor in a job role from your matches." },
]

function DemoPlans() {
    const pricing = usePricing()
    const priceOf = { 1: pricing.tier1, 2: pricing.tier2, 3: pricing.tier3 }

    return (
        <section className="demo-plans">
            <h2>This was a glimpse. The program is the depth.</h2>
            <p className="demo-lead">Your demo answers carry over — sign up with the same email and you won't repeat them.</p>
            <div className="demo-plan-list">
                {PLANS.map((plan) => (
                    <div key={plan.tier} className={`demo-plan${plan.main ? " is-main" : ""}`}>
                        <h3>{pricing.names[plan.tier]}</h3>
                        <p className="demo-plan-price">{formatInr(priceOf[plan.tier])}</p>
                        <p>{plan.line}</p>
                        <Link to={`/register?plan=${plan.tier}`} className={`btn ${plan.main ? "btn-primary" : "btn-ghost"} tap`}>
                            {plan.main ? "Start Career Discovery" : `Choose ${pricing.names[plan.tier]}`}
                        </Link>
                    </div>
                ))}
            </div>
            <p className="demo-hint"><Link to="/programs">Compare the plans in full →</Link></p>
        </section>
    )
}

export default DemoPlans
