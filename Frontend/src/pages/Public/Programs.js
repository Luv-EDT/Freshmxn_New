import PublicNav from "./PublicNav"
import PublicFooter from "./PublicFooter"
import PricingCards from "./PricingCards"

// Our programs (owner, Round 25): where "Let's figure out your career" leads. The three plans side by
// side; choosing one opens Register (or the paywall when logged in) and carries on to payment.
function Programs() {
    return (
        <div>
            <PublicNav />
            <main>
                <section className="section">
                    <div className="page">
                        <div className="section-head">
                            <span className="eyebrow">Our programs</span>
                            <h1>Pick the help you need.</h1>
                            <p>Every plan starts with you. Choose one, create your account, and you're on your way.</p>
                        </div>
                        <PricingCards />
                    </div>
                </section>
            </main>
            <PublicFooter />
        </div>
    )
}

export default Programs
