import { Link } from "react-router-dom"

// HOW CAN WE HELP YOU? (owner, Round 36) — under "what the full program gives you": one question and a
// button to the program finder (/find-your-program), which asks what kind of help they need and shows
// the plans that fit, with prices from the server.
function DemoPlans() {
    return (
        <section className="demo-plans demo-cta">
            <h2>How can we help you in our program?</h2>
            <p className="demo-lead">Tell us what you need — we'll show you the program that fits.</p>
            <Link to="/find-your-program" className="btn demo-programs-btn tap">Check out our programs →</Link>
        </section>
    )
}

export default DemoPlans
