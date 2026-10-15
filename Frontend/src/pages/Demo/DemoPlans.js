import { Link } from "react-router-dom"

// WHERE TO GO FROM HERE (owner, Round 33): just the three options, no plan details or prices here, and one
// button to the programs page — which has the plans, the prices (from the server) and the refund rules.
const OPTIONS = [
    "Talk to a mentor in one of these two careers",
    "Take the whole journey — 3+ hours to know yourself better, get your career recommendations and see how to get there",
    "Both",
]

function DemoPlans() {
    return (
        <section className="demo-plans">
            <h2>Where to go from here</h2>
            <p className="demo-lead">You have three options now:</p>
            <ol className="demo-options">
                {OPTIONS.map((option) => <li key={option}>{option}</li>)}
            </ol>
            <p className="demo-hint">Sign up with the same email and your story carries over — you won't repeat it.</p>
            <div className="demo-money-note">
                <p>
                    <strong>Need help with the price?</strong> After signing up you can ask for financial aid — we look
                    at every request.
                </p>
                <p>
                    <strong>Refunds:</strong> don't like your results? Give us quick feedback and we'll refund you — on
                    any plan.
                </p>
            </div>
            <Link to="/programs" className="btn btn-primary tap demo-programs-btn">See the programs →</Link>
        </section>
    )
}

export default DemoPlans
