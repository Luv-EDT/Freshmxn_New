import { Link } from "react-router-dom"

// WHERE TO GO FROM HERE (owner, Round 33): just the three options, no plan details or prices here, and one
// button to the programs page — which has the plans, the prices (from the server) and the refund rules.
const OPTIONS = [
    { title: "Talk to a mentor", line: "in one of these two careers" },
    { title: "Take the whole journey", line: "3+ hours to know yourself better, get your career recommendations and see how to get there" },
    { title: "Both", line: "the whole journey, plus a mentor" },
]

function DemoPlans() {
    return (
        <section className="demo-plans">
            <h2>Where to go from here</h2>
            <p className="demo-lead">You have three options now:</p>
            {/* a small flowchart: you today → three paths (owner, Round 33) */}
            <div className="demo-tree" role="list" aria-label="Your three options">
                <div className="demo-tree-root">You, with two careers in hand</div>
                <div className="demo-tree-legs">
                    {OPTIONS.map((option, index) => (
                        <div key={option.title} className="demo-tree-node" role="listitem">
                            <span className="demo-tree-num">{index + 1}</span>
                            <strong>{option.title}</strong>
                            {option.line && <span>{option.line}</span>}
                        </div>
                    ))}
                </div>
            </div>
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
