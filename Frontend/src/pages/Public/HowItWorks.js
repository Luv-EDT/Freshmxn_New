import { Link } from "react-router-dom"
import PublicNav from "./PublicNav"
import PublicFooter from "./PublicFooter"
import usePricing, { formatInr } from "./usePricing"
import { StepIcon } from "./illustrations"

// How it works — its own page since Round 5 (owner, 2026-09-24). It opens on the demand-side
// promise, then the four steps and how we rank, the invitation-only bonus, and pricing. The copy
// moved here VERBATIM from the landing page (landing_page_content_v3.md §3–5, §7); prices still
// come from the server.
function HowItWorks() {
    const { tier1, tier2, upgrade } = usePricing()

    return (
        <div>
            <PublicNav />

            <main>
                {/* 1. THE DEMAND-SIDE PROMISE — the first thing this page shows (owner, Round 5) */}
                <section className="section promise promise-lead">
                    <div className="page promise-inner">
                        <span className="eyebrow">How it works</span>
                        <StepIcon name="compass" />
                        <h1>We don't just train you for a dead end.</h1>
                        <p>
                            Most career advice prepares students for jobs — often crowded or fading ones. That's the
                            education-to-employment mismatch, on repeat. We do it the other way round: we start from{" "}
                            <strong>where the demand actually is and where it's heading</strong> — careers that are
                            AI-resilient, financially viable and genuinely in demand — and help match you <em>toward</em> it.
                            You're not being pointed at a road that ends.
                        </p>
                    </div>
                </section>

                {/* 2. THE FOUR STEPS */}
                <section className="section" id="steps">
                    <div className="page">
                        <div className="section-head">
                            <h2>4 steps. <span className="highlight-pink">0 gyaan.</span></h2>
                        </div>
                        <div className="steps">
                            <article className="step">
                                <div className="step-art"><StepIcon name="listen" /></div>
                                <div className="step-body">
                                    <span className="step-num">01</span>
                                    <h3>We get to know you. Properly.</h3>
                                    <p>
                                        Your interests, the problems you've faced, what you believe about yourself.
                                        Career gyanis guess. We ask.
                                    </p>
                                </div>
                            </article>
                            <article className="step">
                                <div className="step-art"><StepIcon name="measure" /></div>
                                <div className="step-body">
                                    <span className="step-num">02</span>
                                    <h3>We measure what you're wired for.</h3>
                                    <p>
                                        An X-ray of how your brain works — minus the radiation. Personality, thinking
                                        style, strengths.
                                    </p>
                                </div>
                            </article>
                            <article className="step">
                                <div className="step-art"><StepIcon name="compass" /></div>
                                <div className="step-body">
                                    <span className="step-num">03</span>
                                    <h3>Find out where you fit, and what lasts.</h3>
                                    <p>
                                        223 Indian careers that are in demand, pay well, and won't get eaten by AI.
                                        Ranked for <em>you</em>, not for "log kya kahenge."
                                    </p>
                                </div>
                            </article>
                            <article className="step">
                                <div className="step-art"><StepIcon name="mentor" /></div>
                                <div className="step-body">
                                    <span className="step-num">04</span>
                                    <h3>Meet someone who's been there. (Mentor tier)</h3>
                                    <p>
                                        A 1-on-1 with a working professional in your matched field — someone who was
                                        once exactly where you are.
                                    </p>
                                </div>
                            </article>
                        </div>
                        <blockquote className="rank-note">
                            <strong>How we rank — read this, it matters.</strong> We do <strong>not</strong> shut you out
                            of a career because of your "intelligence" scores. We match <em>first</em> on what you've
                            already done and discovered — your interests, activities, problems, beliefs — and{" "}
                            <em>then</em> add a psychometric layer only to <strong>sort</strong> the best fit. Your story
                            goes first. Your marks never get a veto.
                        </blockquote>
                    </div>
                </section>

                {/* 3. THE INVITATION-ONLY BONUS */}
                <section className="section section-alt">
                    <div className="page">
                        <div className="invite">
                            <h2><span aria-hidden="true">🔒</span> We help you get there. (By invitation only)</h2>
                            <p>
                                The report is the beginning, not the end. For select students, we go further — turning a
                                recommendation into real momentum.
                            </p>
                        </div>
                    </div>
                </section>

                {/* 4. PRICING — amounts from the server */}
                <section className="section section-alt">
                    <div className="page">
                        <div className="section-head">
                            <h2>Pricing</h2>
                        </div>
                        <div className="pricing">
                            <div className="price-card">
                                <h3>Career Discovery + Full Profile</h3>
                                <div className="price">{formatInr(tier1)}</div>
                                <p>
                                    The complete experience, your detailed profile, and your ranked career matches with a
                                    readiness guide.
                                </p>
                                <Link to="/register" className="btn btn-primary tap">Let's figure out your career →</Link>
                            </div>
                            <div className="price-card featured">
                                <h3>Mentor Connection</h3>
                                <div className="price">{formatInr(tier2)}</div>
                                <p>
                                    Everything above plus two sessions with a working professional in your matched field
                                    (1-hour clarity + 20-min follow-up).
                                </p>
                                <Link to="/mentor-waitlist" className="btn btn-primary tap">Join the waitlist →</Link>
                            </div>
                        </div>
                        <p className="upgrade-note">
                            <em>
                                Did the {formatInr(tier1)} profile first? Upgrade to mentorship for just{" "}
                                <strong>{formatInr(upgrade)} more</strong> after you see your matches — no paying twice.
                            </em>
                        </p>
                    </div>
                </section>
            </main>

            <PublicFooter />
        </div>
    )
}

export default HowItWorks
