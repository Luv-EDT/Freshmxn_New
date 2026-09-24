import { Link } from "react-router-dom"
import PublicNav from "./PublicNav"
import PublicFooter from "./PublicFooter"
import usePricing, { formatInr } from "./usePricing"
import { StepIcon, ArrowDoodle } from "./illustrations"

// The public landing page. Copy is VERBATIM from landing_page_content_v3.md (the finalised copy) —
// every statistic there already carries its source, so nothing here is invented or rounded.
// Design: Kira's structure (light hero + preview, the strikethrough "system" beat, a four-card
// how-it-works, a differentiator grid, clean pricing, friendly footer), teal as the star colour and
// the pastel pink as ONE highlighter swipe per section at most.
function Landing() {
    const { tier1, tier2, upgrade } = usePricing()

    return (
        <div>
            <PublicNav />

            <main>
                {/* 1. HERO */}
                <section className="hero">
                    <div className="page hero-grid">
                        <div>
                            <span className="eyebrow">FRESHMXN'S LAB</span>
                            {/* the company tagline leads; "Careers that fit you" closes the page (owner, 2026-09-24) */}
                            <h1 className="tagline"><span>Explore.</span> <span>Get clarity.</span> <span className="accent">Take action.</span></h1>
                            <p className="lead">
                                Everybody is different — so why does everyone get similar career advice? Stuck between
                                what you love, what you're studying, and what the market wants? Scared AI will take your
                                job? Freshmxn's Lab matches your story and strengths to careers that are{" "}
                                <strong className="highlight-pink">in demand and AI-resilient</strong> — then helps you
                                get there, with mentors who've already done it.
                            </p>
                            <div className="btn-row">
                                <Link to="/register" className="btn btn-primary tap">Let's figure out your career →</Link>
                                <a href="#how-it-works" className="btn btn-ghost tap">See how it works</a>
                            </div>
                        </div>

                        {/* an illustration of what a student gets — labelled, never a real result */}
                        <div className="hero-visual" aria-hidden="true">
                            <div className="blob" />
                            <div className="dot-pink" />
                            <ArrowDoodle className="doodle" />
                            <div className="preview-card">
                                <div className="preview-title">Your ranked matches</div>
                                {[
                                    ["1", "Product / Industrial Designer", ["Fits your story", "In demand"]],
                                    ["2", "UX / Interaction Designer", ["AI-resilient", "Pays well"]],
                                    ["3", "Architect", ["Fits how you think"]],
                                ].map(([rank, name, chips]) => (
                                    <div className="preview-row" key={rank}>
                                        <strong><span className="preview-rank">{rank}</span>{name}</strong>
                                        <span className="preview-chips">
                                            {chips.map((chip) => <span className="chip" key={chip}>{chip}</span>)}
                                        </span>
                                    </div>
                                ))}
                                <p className="preview-note">Illustrative example</p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* 2. THE PROBLEM */}
                <section className="section problem">
                    <div className="page">
                        <div className="section-head">
                            <h2>
                                You don't need more <s className="strike">career gyaan</s>. You need
                                a <strong className="highlight-pink">system</strong>.
                            </h2>
                            <p>
                                Most students don't choose a career — they inherit one. Picked from the handful they've
                                heard of. Nudged by which subjects they scored well in. Pushed by what worked for someone
                                else. And the world is changing faster than that advice can keep up.
                            </p>
                        </div>
                        <ul className="stat-list">
                            <li>
                                <strong>The list is too short.</strong> 93% of Indian students are aware of only seven
                                career options (India Today survey) — out of hundreds that exist and pay well. You can't
                                choose what you've never heard of.
                            </li>
                            <li>
                                <strong>Marks aren't the whole story.</strong> India's own skills data shows why so many
                                graduates struggle: the gap is between what colleges teach and what work actually
                                demands — problem-solving, communication, digital skills — not raw marks (Mercer-Mettl
                                Graduate Skill Index).
                            </li>
                            <li>
                                <strong>About 44% of Indian graduates still aren't considered job-ready</strong> (India
                                Skills Report 2026, employability 56.3%). The problem usually isn't ability — it's a
                                direction that never fit.
                            </li>
                            <li>
                                <strong>AI is redrawing the map.</strong> AI, data, cloud and cybersecurity are now the most
                                in-demand skills in India, with new fields appearing fast while routine roles shrink
                                (India Skills Report 2026).
                            </li>
                        </ul>
                    </div>
                </section>

                {/* 3. THE DEMAND-SIDE PROMISE */}
                <section className="section promise">
                    <div className="page promise-inner">
                        <StepIcon name="compass" />
                        <h2>We don't just train you for a dead end.</h2>
                        <p>
                            Most career advice prepares students for jobs — often crowded or fading ones. That's the
                            education-to-employment mismatch, on repeat. We do it the other way round: we start from{" "}
                            <strong>where the demand actually is and where it's heading</strong> — careers that are
                            AI-resilient, financially viable and genuinely in demand — and help match you <em>toward</em> it.
                            You're not being pointed at a road that ends.
                        </p>
                    </div>
                </section>

                {/* 4. HOW IT WORKS */}
                <section className="section" id="how-it-works">
                    <div className="page">
                        <div className="section-head">
                            <h2>Four steps. <span className="highlight-pink">Zero gyaan.</span></h2>
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

                {/* 5. THE INVITATION-ONLY BONUS */}
                <section className="section section-alt">
                    <div className="page">
                        <div className="invite">
                            <h2><span aria-hidden="true">🔒</span> We help you get there. (By invitation only)</h2>
                            <p>
                                The report is the beginning, not the end. For select students, we go further — turning a
                                recommendation into real momentum. Your story goes first; your marks never get a veto.
                            </p>
                        </div>
                    </div>
                </section>

                {/* 6. WHY WE'RE DIFFERENT */}
                <section className="section">
                    <div className="page">
                        <div className="section-head">
                            <h2>Why we're different</h2>
                        </div>
                        <div className="compare">
                            <div className="card">
                                <h3>vs. Career Counsellors</h3>
                                <ul>
                                    <li><strong>Affordable</strong> — versus ₹5,000–₹25,000 a session.</li>
                                    <li><strong>Explore, don't just decide</strong> — try on multiple paths, not one forced pick.</li>
                                    <li><strong>Structured, evidence-based matching</strong> — data-driven, not one person's opinion.</li>
                                </ul>
                            </div>
                            <div className="card">
                                <h3>vs. Mentorship Platforms</h3>
                                <ul>
                                    <li><strong>Mainstream + alternative paths</strong> — including careers you've never heard of.</li>
                                    <li><strong>Smarter matching based on your story</strong> — not a generic list.</li>
                                    <li><strong>Deep cognitive + personal-development focus</strong> — the whole picture.</li>
                                </ul>
                            </div>
                            <div className="card">
                                <h3>vs. AI Tools (LLMs)</h3>
                                <ul>
                                    <li>
                                        <strong>Human connection — via our mentorship tier.</strong> Real people in the
                                        field, not generic chat. → <Link to="/mentor-waitlist">Join the mentor waitlist</Link>
                                    </li>
                                    <li><strong>Personalized tracking</strong> — guidance built on your profile.</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </section>

                {/* 7. PRICING — amounts from the server */}
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

                {/* CLOSING STATEMENT — moved here from the hero when the tagline took the headline */}
                <section className="section closing">
                    <div className="page">
                        <h2>Careers that fit <em>you</em>. And the future.</h2>
                        <Link to="/register" className="btn btn-light tap">Let's figure out your career →</Link>
                    </div>
                </section>

                {/* 8. ABOUT — the owner adds their own 2–3 lines later; nothing is written in their voice */}
                <section className="section">
                    <div className="page about">
                        <h2>About</h2>
                        <p>
                            Built by <strong>Luv Goel</strong> (
                            <a href="https://www.linkedin.com/in/luv-goel/" target="_blank" rel="noreferrer">LinkedIn</a>
                            ) and the Freshmxn Labs team — because choosing a career in India shouldn't come down to a
                            short list of options and someone else's expectations.
                        </p>
                    </div>
                </section>
            </main>

            {/* 9. CONTACT */}
            <PublicFooter />
        </div>
    )
}

export default Landing
