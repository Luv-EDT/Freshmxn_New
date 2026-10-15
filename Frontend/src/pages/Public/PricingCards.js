import { Link } from "react-router-dom"
import usePricing, { formatInr } from "./usePricing"

// The three plans, shared by /programs and How it works (owner, Round 25). Amounts come from the
// server. Choosing a plan starts the flow straight to payment: a visitor registers first (the plan
// rides along as ?plan=N and the paywall preselects it); someone already logged in goes to the paywall.
export const HELP_NOTE = "In every program we also ask how else we can help your career — a starter skill kit, internships and jobs, a master's or settling abroad. Join the waitlist and we help through partner affiliates or new products."

// what each plan holds, as short bullets; the promise about matching is a note under them, not a
// bullet (owner, Rounds 26–27)
const PLANS = [
    {
        tier: 1,
        points: [
            "Virtual career counselling — your story, activities and goals",
            "A psychometric assessment of 31 research-backed factors",
            "Ranked matches from 1,000+ careers and job roles",
            "Compare careers and see your strengths",
        ],
    },
    {
        tier: 2,
        featured: true,
        points: [
            "Everything in Career Discovery",
            "A mentor in a job role from your matches",
            "1-hour clarity session + 20-min follow-up",
        ],
        note: "Matched within 20 business days — or move back to Career Discovery and get the difference back.",
        more: true,
    },
    {
        tier: 3,
        points: [
            "Skip the assessment — pick any career and job role, or describe your own",
            "The same two mentor sessions",
        ],
        note: "A full refund if we can't match you.",
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
                        <ul className="price-points">
                            {plan.points.map((point) => <li key={point}>{point}</li>)}
                        </ul>
                        {plan.note && <p className="price-note"><span aria-hidden="true">ⓘ </span>{plan.note}</p>}
                        {/* the button and the link sit together at the bottom, and Career Discovery keeps an
                            empty line where the link would be, so all three Choose buttons line up (Round 27) */}
                        <div className="price-actions">
                            <Link to={startFor(plan.tier)} className="btn btn-primary tap">Choose {names[plan.tier]} →</Link>
                            {plan.more
                                ? <Link to="/mentor-waitlist" className="price-more">How mentoring works</Link>
                                : <span className="price-more price-more-spacer" aria-hidden="true">&nbsp;</span>}
                        </div>
                    </div>
                ))}
            </div>
            {/* one note for all three (owner, Round 26) */}
            <p className="pricing-note">{HELP_NOTE}</p>
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
