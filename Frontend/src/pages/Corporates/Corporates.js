import { useEffect } from "react"
import logo from "../../assets/brand/logo.png"

// FRESHMXN FOR COMPANIES (owner, Round 40) — /corporates, one page for HR and L&D teams. It stands on its own:
// no student nav, no footer links, and the logo doesn't lead to the student site — nothing on the student site
// links here either (anyone with the URL can open it). The only actions are WhatsApp (a message already typed)
// and email.
//
// What we offer (owner): a gap analysis (our Virtual Career Counselling, the psychometric assessment and a skill
// assessment), training for the gaps it finds, Assessment and Development Centres through our partners, an AI
// attrition predictor, training cut to the gaps only, HR analytics, custom content and leadership development.
// The competency model is Spencer & Spencer's iceberg (Competence at Work, 1993), drawn the owner's way.

const WHATSAPP = "918882756287"
const EMAIL = "luvgoel@freshmxn.com"
const WHATSAPP_TEXT = "Hi Luv, I'd like to know more about Freshmxn's programs for our employees. Company: ____ · Team size: ____"
const whatsappLink = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(WHATSAPP_TEXT)}`
const emailLink = `mailto:${EMAIL}?subject=${encodeURIComponent("Freshmxn for our team")}&body=${encodeURIComponent("Hi Luv,\n\nWe'd like to know more about Freshmxn's programs for our employees.\n\nCompany:\nTeam size:\nWhat we'd like to work on:\n")}`

const GAP_STEPS = [
    { n: "1", title: "Virtual Career Counselling", text: "Each employee's story — their role, department, the work they've done and what drives them." },
    { n: "2", title: "Psychometric analysis", text: "31 factors: personality, intelligence, cognitive abilities and thinking style. Research-backed." },
    { n: "3", title: "Skill assessment", text: "What the role needs against what the person can do today." },
]

const OFFERINGS = [
    { title: "Gap analysis", text: "By department and by person: the psychometric gaps and the skill gaps, side by side.", lead: true },
    { title: "Training for the gaps", text: "Programs for the psychometric gaps and the skill gaps the analysis finds — at every layer of the iceberg." },
    { title: "Training only where it's needed", text: "Each person gets the modules for their own gaps, not the whole catalogue — less time off the job, a smaller training bill." },
    { title: "Assessment & Development Centres", text: "Run with our ADC partners, for hiring, promotion and high-potential programs." },
    { title: "AI attrition predictor", text: "Who is at risk of leaving, and how much attrition a targeted plan could prevent." },
    { title: "HR analytics", text: "Dashboards on capability, gaps and progress, by team and by level." },
    { title: "Custom content", text: "Modules written for your roles, your tools and your culture." },
    { title: "Leadership development", text: "For first-time managers through senior leaders, built on the same assessment." },
]

function Iceberg() {
    return (
        <svg viewBox="0 0 520 440" role="img" aria-label="The competency iceberg: skills above the water; knowledge and beliefs, and psychometrics, below it" className="corp-iceberg">
            <rect x="0" y="0" width="520" height="140" fill="#FFFBEF" />
            <rect x="0" y="140" width="520" height="300" fill="#E3F2F3" />
            <path d="M0 140 Q65 128 130 140 T260 140 T390 140 T520 140" fill="none" stroke="#007582" strokeWidth="3" />
            <path d="M200 140 L240 40 L290 60 L320 140 Z" fill="#007582" />
            <path d="M200 140 L320 140 L380 260 L140 260 Z" fill="#0B5C66" />
            <path d="M140 260 L380 260 L420 380 L100 380 Z" fill="#1E2A38" />
            <text x="260" y="118" textAnchor="middle" fill="#FFFBEF" fontSize="17" fontWeight="700">Skills</text>
            <text x="260" y="198" textAnchor="middle" fill="#FFFBEF" fontSize="17" fontWeight="700">Knowledge &amp; beliefs</text>
            <text x="260" y="222" textAnchor="middle" fill="#CDE7EA" fontSize="13">what you know and believe</text>
            <text x="260" y="330" textAnchor="middle" fill="#FFFBEF" fontSize="17" fontWeight="700">Psychometrics</text>
            <text x="260" y="354" textAnchor="middle" fill="#CDE7EA" fontSize="13">traits, motives, how you think</text>
            <text x="20" y="40" fill="#4A5568" fontSize="13" fontWeight="700">VISIBLE —</text>
            <text x="20" y="58" fill="#4A5568" fontSize="13" fontWeight="700">easy to see and train</text>
            <text x="20" y="400" fill="#0B5C66" fontSize="13" fontWeight="700">HIDDEN —</text>
            <text x="20" y="418" fill="#0B5C66" fontSize="13" fontWeight="700">what drives performance</text>
        </svg>
    )
}

function Corporates() {
    useEffect(() => {
        const before = document.title
        document.title = "Freshmxn for companies — close the gaps that matter"
        return () => { document.title = before }
    }, [])

    const ctas = (
        <div className="corp-ctas">
            <a href={whatsappLink} target="_blank" rel="noreferrer" className="btn corp-btn-whatsapp tap">Message us on WhatsApp</a>
            <a href={emailLink} className="btn btn-ghost tap">Email {EMAIL}</a>
        </div>
    )

    return (
        <div className="corp">
            <header className="corp-header">
                <img src={logo} alt="Freshmxn" height="32" />
                <span className="corp-badge">For companies</span>
                <a href={whatsappLink} target="_blank" rel="noreferrer" className="btn btn-primary btn-sm tap corp-header-cta">Talk to us</a>
            </header>

            <main>
                <section className="corp-hero">
                    <div className="corp-wrap">
                        <p className="corp-eyebrow">Training that starts with the gaps</p>
                        <h1>Close the gaps that matter. <span>Keep the people who matter.</span></h1>
                        <p className="corp-lead">
                            We find what each employee is missing — in their skills, and beneath them — then train only those gaps.
                            Less spent on training, better performance, lower attrition.
                        </p>
                        {ctas}
                    </div>
                </section>

                <section className="corp-section">
                    <div className="corp-wrap">
                        <p className="corp-eyebrow">Where we start</p>
                        <h2>A gap analysis for every person and department</h2>
                        <div className="corp-steps">
                            {GAP_STEPS.map((step) => (
                                <div key={step.n} className="corp-step">
                                    <span className="corp-step-n">{step.n}</span>
                                    <h3>{step.title}</h3>
                                    <p>{step.text}</p>
                                </div>
                            ))}
                        </div>
                        <p className="corp-note">The result: by department and by person, the psychometric gaps and the skill gaps — side by side.</p>
                    </div>
                </section>

                <section className="corp-section corp-section-tint">
                    <div className="corp-wrap corp-iceberg-grid">
                        <div>
                            <p className="corp-eyebrow">Why skills training alone falls short</p>
                            <h2>Competence is an iceberg</h2>
                            <p>
                                Spencer &amp; Spencer’s competency model shows a competency as three layers. <strong>Skills</strong> sit
                                on top, where everyone can see them. Beneath the water are <strong>knowledge and beliefs</strong>, and
                                at the base, <strong>psychometrics</strong> — traits, motives and how a person thinks.
                            </p>
                            <p>
                                Most training works only on the tip. We measure all three layers, so you know whether a gap is a
                                skill to teach or something deeper — and train the right one.
                            </p>
                            <p className="corp-source">Spencer, L. M. &amp; Spencer, S. M. (1993). Competence at Work. Wiley.</p>
                        </div>
                        <Iceberg />
                    </div>
                </section>

                <section className="corp-section">
                    <div className="corp-wrap">
                        <p className="corp-eyebrow">What we offer</p>
                        <h2>From the gap analysis to the people you keep</h2>
                        <div className="corp-offers">
                            {OFFERINGS.map((offer, index) => (
                                <div key={offer.title} className={`corp-offer${offer.lead ? " is-lead" : ""}`}>
                                    <span className="corp-offer-n">{String(index + 1).padStart(2, "0")}</span>
                                    <h3>{offer.title}</h3>
                                    <p>{offer.text}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                <section className="corp-band">
                    <div className="corp-wrap">
                        <h2>Let’s find your team’s gaps.</h2>
                        <p>Tell us about your team on WhatsApp or by email.</p>
                        {ctas}
                    </div>
                </section>
            </main>

            <footer className="corp-footer">
                <p>© {new Date().getFullYear()} Freshmxn Education India Private Limited · WhatsApp +91 8882756287 · {EMAIL}</p>
            </footer>
        </div>
    )
}

export default Corporates
