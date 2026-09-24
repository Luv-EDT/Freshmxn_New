import { Link } from "react-router-dom"
import PublicNav from "./PublicNav"
import PublicFooter from "./PublicFooter"
import usePricing, { formatInr } from "./usePricing"

// The public landing page. Copy is VERBATIM from landing_page_content_v3.md (the finalised copy) —
// every statistic there already carries its source, so nothing here is invented or rounded.
// Functionality first: Stage 2 applies the Kira-style design, the Orelega One / Lato type and the
// one pink highlighter swipe per section.
function Landing() {
    const { tier1, tier2, upgrade } = usePricing()

    return (
        <div>
            <PublicNav />

            <main className="page">
                {/* 1. HERO */}
                <section>
                    <p><strong>FRESHMXN'S LAB</strong></p>
                    {/* the company tagline leads; "Careers that fit you" closes the page (owner, 2026-09-24) */}
                    <h1>Explore. Get clarity. Take action.</h1>
                    <p>
                        Everybody is different — so why does everyone get similar career advice? Stuck between what
                        you love, what you're studying, and what the market wants? Scared AI will take your job?
                        Freshmxn's Lab matches your story and strengths to careers that are <strong>in demand and
                        AI-resilient</strong> — then helps you get there, with mentors who've already done it.
                    </p>
                    <p>
                        <Link to="/register" className="tap">Let's figure out your career →</Link>
                        {" "}
                        <a href="#how-it-works" className="tap">See how it works</a>
                    </p>
                </section>

                {/* 2. THE PROBLEM */}
                <section>
                    <h2>You don't need more <s>career gyaan</s>. You need a <strong>system</strong>.</h2>
                    <p>
                        Most students don't choose a career — they inherit one. Picked from the handful they've heard
                        of. Nudged by which subjects they scored well in. Pushed by what worked for someone else. And
                        the world is changing faster than that advice can keep up.
                    </p>
                    <ul>
                        <li>
                            <strong>The list is too short.</strong> 93% of Indian students are aware of only seven
                            career options (India Today survey) — out of hundreds that exist and pay well. You can't
                            choose what you've never heard of.
                        </li>
                        <li>
                            <strong>Marks aren't the whole story.</strong> India's own skills data shows why so many
                            graduates struggle: the gap is between what colleges teach and what work actually demands —
                            problem-solving, communication, digital skills — not raw marks (Mercer-Mettl Graduate Skill
                            Index).
                        </li>
                        <li>
                            <strong>About 44% of Indian graduates still aren't considered job-ready</strong> (India
                            Skills Report 2026, employability 56.3%). The problem usually isn't ability — it's a
                            direction that never fit.
                        </li>
                        <li>
                            <strong>AI is redrawing the map.</strong> AI, data, cloud and cybersecurity are now the most
                            in-demand skills in India, with new fields appearing fast while routine roles shrink (India
                            Skills Report 2026).
                        </li>
                    </ul>
                </section>

                {/* 3. THE DEMAND-SIDE PROMISE */}
                <section>
                    <h2>We don't just train you for a dead end.</h2>
                    <p>
                        Most career advice prepares students for jobs — often crowded or fading ones. That's the
                        education-to-employment mismatch, on repeat. We do it the other way round: we start from{" "}
                        <strong>where the demand actually is and where it's heading</strong> — careers that are
                        AI-resilient, financially viable and genuinely in demand — and help match you <em>toward</em> it.
                        You're not being pointed at a road that ends.
                    </p>
                </section>

                {/* 4. HOW IT WORKS */}
                <section id="how-it-works">
                    <h2>Four steps. Zero gyaan.</h2>
                    <div className="grid grid-2 grid-4">
                        <div>
                            <h3>01 · We get to know you. Properly.</h3>
                            <p>
                                Your interests, the problems you've faced, what you believe about yourself. Career gyanis
                                guess. We ask.
                            </p>
                        </div>
                        <div>
                            <h3>02 · We measure what you're wired for.</h3>
                            <p>
                                An X-ray of how your brain works — minus the radiation. Personality, thinking style,
                                strengths.
                            </p>
                        </div>
                        <div>
                            <h3>03 · Find out where you fit, and what lasts.</h3>
                            <p>
                                223 Indian careers that are in demand, pay well, and won't get eaten by AI. Ranked for{" "}
                                <em>you</em>, not for "log kya kahenge."
                            </p>
                        </div>
                        <div>
                            <h3>04 · Meet someone who's been there. (Mentor tier)</h3>
                            <p>
                                A 1-on-1 with a working professional in your matched field — someone who was once exactly
                                where you are.
                            </p>
                        </div>
                    </div>
                    <blockquote>
                        <strong>How we rank — read this, it matters.</strong> We do <strong>not</strong> shut you out of a
                        career because of your "intelligence" scores. We match <em>first</em> on what you've already done
                        and discovered — your interests, activities, problems, beliefs — and <em>then</em> add a
                        psychometric layer only to <strong>sort</strong> the best fit. Your story goes first. Your marks
                        never get a veto.
                    </blockquote>
                </section>

                {/* 5. THE INVITATION-ONLY BONUS */}
                <section>
                    <h2><span aria-hidden="true">🔒</span> We help you get there. (By invitation only)</h2>
                    <p>
                        The report is the beginning, not the end. For select students, we go further — turning a
                        recommendation into real momentum. Your story goes first; your marks never get a veto.
                    </p>
                </section>

                {/* 6. WHY WE'RE DIFFERENT */}
                <section>
                    <h2>Why we're different</h2>
                    <div className="grid grid-3">
                        <div>
                            <h3>vs. Career Counsellors</h3>
                            <ul>
                                <li><strong>Affordable</strong> — versus ₹5,000–₹25,000 a session.</li>
                                <li><strong>Explore, don't just decide</strong> — try on multiple paths, not one forced pick.</li>
                                <li><strong>Structured, evidence-based matching</strong> — data-driven, not one person's opinion.</li>
                            </ul>
                        </div>
                        <div>
                            <h3>vs. Mentorship Platforms</h3>
                            <ul>
                                <li><strong>Mainstream + alternative paths</strong> — including careers you've never heard of.</li>
                                <li><strong>Smarter matching based on your story</strong> — not a generic list.</li>
                                <li><strong>Deep cognitive + personal-development focus</strong> — the whole picture.</li>
                            </ul>
                        </div>
                        <div>
                            <h3>vs. AI Tools (LLMs)</h3>
                            <ul>
                                <li>
                                    <strong>Human connection — via our mentorship tier.</strong> Real people in the field, not
                                    generic chat. → <Link to="/mentor-waitlist">Join the mentor waitlist</Link>
                                </li>
                                <li><strong>Personalized tracking</strong> — guidance built on your profile.</li>
                            </ul>
                        </div>
                    </div>
                </section>

                {/* 7. PRICING — amounts from the server */}
                <section>
                    <h2>Pricing</h2>
                    <div className="grid grid-2">
                        <div>
                            <h3>Career Discovery + Full Profile — {formatInr(tier1)}</h3>
                            <p>
                                The complete experience, your detailed profile, and your ranked career matches with a
                                readiness guide.
                            </p>
                            <p><Link to="/register" className="tap">Let's figure out your career →</Link></p>
                        </div>
                        <div>
                            <h3>Mentor Connection — {formatInr(tier2)}</h3>
                            <p>
                                Everything above plus two sessions with a working professional in your matched field
                                (1-hour clarity + 20-min follow-up).
                            </p>
                            <p><Link to="/mentor-waitlist" className="tap">Join the waitlist →</Link></p>
                        </div>
                    </div>
                    <p>
                        <em>
                            Did the {formatInr(tier1)} profile first? Upgrade to mentorship for just{" "}
                            <strong>{formatInr(upgrade)} more</strong> after you see your matches — no paying twice.
                        </em>
                    </p>
                </section>

                {/* CLOSING STATEMENT — moved here from the hero when the tagline took the headline */}
                <section>
                    <h2>Careers that fit <em>you</em>. And the future.</h2>
                    <p><Link to="/register" className="tap">Let's figure out your career →</Link></p>
                </section>

                {/* 8. ABOUT — the owner adds their own 2–3 lines later; nothing is written in their voice */}
                <section>
                    <h2>About</h2>
                    <p>
                        Built by <strong>Luv Goel</strong> (
                        <a href="https://www.linkedin.com/in/luv-goel/" target="_blank" rel="noreferrer">LinkedIn</a>
                        ) and the Freshmxn Labs team — because choosing a career in India shouldn't come down to a short
                        list of options and someone else's expectations.
                    </p>
                </section>
            </main>

            {/* 9. CONTACT */}
            <PublicFooter />
        </div>
    )
}

export default Landing
