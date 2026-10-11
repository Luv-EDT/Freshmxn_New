import { Link } from "react-router-dom"
import usePricing, { formatInr } from "./usePricing"

// The three plans, shared by /programs and How it works (owner, Round 25). Amounts come from the
// server. Choosing a plan starts the flow straight to payment: a visitor registers first (the plan
// rides along as ?plan=N and the paywall preselects it); someone already logged in goes to the paywall.
export const HELP_NOTE = "In every program we also ask how else we can help your career — a starter skill kit, internships and jobs, a master's or settling abroad. Join the waitlist and we help through partner affiliates or new products."

const PLANS = [
    {
        tier: 1,
        text: "The complete experience, your detailed profile, and your ranked career matches with a readiness guide.",
    },
    {
        tier: 2,
        featured: true,
        text: "Everything above plus two sessions with a working professional in your matched field (1-hour clarity + 20-min follow-up).",
        more: true,
    },
    {
        tier: 3,
        text: "Already know the field you want? Skip the assessment — choose a career and job role, and we match you with a mentor (the same two sessions).",
        more: true,
    },
]

function PricingCards() {
    const { tier1, tier2, tier3, upgrade, names } = usePricing()
    const amounts = { 1: tier1, 2: tier2, 3: tier3 }
    const isLoggedIn = Boolean(localStorage.getItem("token"))
    const startFor = (tier) => (isLoggedIn ? `/paywall?plan=${tier}` : `/register?plan=${tier}`)

    return (
        <>
            <div className="pricing pricing-three">
                {PLANS.map((plan) => (
                    <div key={plan.tier} className={`price-card${plan.featured ? " featured" : ""}`}>
                        <h3>{names[plan.tier]}</h3>
                        <div className="price">{formatInr(amounts[plan.tier])}</div>
                        <p>{plan.text}</p>
                        <p className="price-help">*{HELP_NOTE}</p>
                        <Link to={startFor(plan.tier)} className="btn btn-primary tap">Choose {names[plan.tier]} →</Link>
                        {plan.more && <Link to="/mentor-waitlist" className="price-more">How mentoring works</Link>}
                    </div>
                ))}
            </div>
            <p className="upgrade-note">
                <em>
                    Did {names[1]} first? Add a mentor for just <strong>{formatInr(upgrade)} more</strong> after you
                    see your matches — no paying twice.
                </em>
            </p>
        </>
    )
}

export default PricingCards
