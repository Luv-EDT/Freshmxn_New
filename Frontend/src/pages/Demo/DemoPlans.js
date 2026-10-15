import { Link } from "react-router-dom"
import usePricing, { formatInr } from "../Public/usePricing"

// WHAT NEXT — THE THREE REAL PLANS, prices live from the server (never written in the copy), framed from the
// demo (owner, Round 33): go straight to a mentor in one of these two careers; or take the whole process;
// or both. Register remembers the plan through to the paywall (?plan=, Round 25), and after paying their
// demo careers are offered first when they choose a mentor (Routers/demoResumeRouter.js).
const PLANS = [
    { tier: 3, title: "Talk to a mentor in one of these two careers", line: "Skip the full process for now — a professional in the career and job role you choose, one-hour session plus a follow-up. Your two demo careers are waiting when you choose." },
    { tier: 1, title: "Take the whole journey", line: "The full Virtual Career Counselling, all 31 factors, and every career your story points to — ranked, with the road from where you stand to each.", main: true },
    { tier: 2, title: "Both", line: "The whole journey, plus a mentor in a job role from your matches." },
]

function DemoPlans() {
    const pricing = usePricing()
    const priceOf = { 1: pricing.tier1, 2: pricing.tier2, 3: pricing.tier3 }

    return (
        <section className="demo-plans">
            <h2>Where to go from here</h2>
            <p className="demo-lead">Sign up with the same email and your story carries over — you won't repeat it.</p>
            <div className="demo-plan-list">
                {PLANS.map((plan) => (
                    <div key={plan.tier} className={`demo-plan${plan.main ? " is-main" : ""}`}>
                        <p className="demo-plan-kicker">{plan.title}</p>
                        <h3>{pricing.names[plan.tier]}</h3>
                        <p className="demo-plan-price">{formatInr(priceOf[plan.tier])}</p>
                        <p>{plan.line}</p>
                        <Link to={`/register?plan=${plan.tier}`} className={`btn ${plan.main ? "btn-primary" : "btn-ghost"} tap`}>
                            {plan.main ? "Start Career Discovery" : `Choose ${pricing.names[plan.tier]}`}
                        </Link>
                    </div>
                ))}
            </div>
            <div className="demo-money-note">
                <p>
                    <strong>Price a stretch for your family?</strong> After signing up you can ask for financial aid —
                    we look at every request.
                </p>
                <p>
                    <strong>Refunds:</strong> if we can't match you with a mentor within 20 business days, Mentor Only is
                    refunded in full, and Discovery + Mentor moves back to Career Discovery with the difference refunded.
                </p>
                <p><Link to="/programs">See the plans and the refund rules in full →</Link></p>
            </div>
        </section>
    )
}

export default DemoPlans
