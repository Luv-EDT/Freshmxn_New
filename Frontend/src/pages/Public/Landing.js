import { Link } from "react-router-dom"
import PublicNav from "./PublicNav"
import PublicFooter from "./PublicFooter"
import { StepIcon, ArrowDoodle } from "./illustrations"

// The public landing page. Copy comes from landing_page_content_v3.md — every statistic there
// carries its source, so nothing here is invented or rounded.
//
// ROUND 5 (owner, 2026-09-24): the landing page is SHORT. Hero → the problem as four collapsed
// questions → who it's for → why we're different → the closing band. The promise, the four steps,
// the invitation and pricing moved to /how-it-works; the founder's story is on /about.
// Teal is the star colour, and the pastel pink is ONE highlighter swipe per section at most.

// The four questions students actually ask, each with the trimmed answer and its source kept.
const QUESTIONS = [
    {
        q: "Why do I only know a handful of careers?",
        a: (
            <>
                Because nobody shows you the rest. <strong>93% of Indian students are aware of only seven career
                options</strong> (India Today survey) — out of hundreds that exist and pay well. You can't choose
                what you've never heard of.
            </>
        ),
    },
    {
        q: "Do my marks decide my career?",
        a: (
            <>
                Not on their own. The gap between graduates and jobs is in problem-solving, communication and digital skills —
                not raw marks (Mercer-Mettl Graduate Skill Index).
            </>
        ),
    },
    {
        q: "Will my degree make me job-ready?",
        a: (
            <>
                Not on its own. <strong>About 44% of Indian graduates still aren't considered job-ready</strong>{" "}
                (India Skills Report 2026, employability 56.3%). Usually it isn't ability — it's a direction that
                never fit.
            </>
        ),
    },
    {
        q: "Will AI take my job?",
        a: (
            <>
                AI is redrawing the map: AI, data, cloud and cybersecurity are now the most in-demand skills in
                India, new fields are appearing fast and routine roles are shrinking (India Skills Report 2026).
                We point you at work that lasts.
            </>
        ),
    },
]

// Who is it for — the four journeys the product already handles, as three audiences.
const AUDIENCES = [
    {
        icon: "listen",
        title: "School students",
        tag: "Class 9–12",
        body: "Before you pick a stream or a college. Discover careers you've never heard of, see which ones fit how you think, and know the subjects and exams that lead there.",
    },
    {
        icon: "compass",
        title: "College students",
        tag: "Any year, any course",
        body: "Already on a course and not sure it's right? See where your degree and what you've done can actually take you — and which changes are worth making.",
    },
    {
        icon: "mentor",
        title: "Early professionals",
        tag: "The first few years of work",
        body: "In a job that doesn't fit? Find where your experience carries over, what a switch would really cost, and talk to someone who has made the move.",
    },
]

function Landing() {
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
                                Everyone gets the same career advice — but you aren't everyone. Freshmxn's Lab matches
                                your story and strengths to careers that are{" "}
                                <strong className="highlight-pink">in demand and AI-resilient</strong>, then helps you
                                get there with mentors who've done it.
                            </p>
                            <div className="btn-row">
                                <Link to="/register" className="btn btn-primary tap">Let's figure out your career →</Link>
                                <Link to="/how-it-works" className="btn btn-ghost tap">See how it works</Link>
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
                            <p>Most students don't choose a career — they inherit one. Here's what they should actually ask.</p>
                        </div>
                        {/* COLLAPSED BY DEFAULT: the question is the hook, the answer is one tap away. */}
                        <div className="faq">
                            {QUESTIONS.map((item) => (
                                <details key={item.q} className="faq-item">
                                    <summary>{item.q}</summary>
                                    <p>{item.a}</p>
                                </details>
                            ))}
                        </div>
                    </div>
                </section>

                {/* 3. WHO IT'S FOR */}
                <section className="section section-alt">
                    <div className="page">
                        <div className="section-head">
                            <h2>Who is it for</h2>
                            <p>Wherever you are on the road, we start from where you're standing.</p>
                        </div>
                        <div className="audience">
                            {AUDIENCES.map((item) => (
                                <article key={item.title} className="card audience-card">
                                    <StepIcon name={item.icon} />
                                    <h3>{item.title}</h3>
                                    <p className="audience-tag">{item.tag}</p>
                                    <p>{item.body}</p>
                                </article>
                            ))}
                        </div>
                    </div>
                </section>

                {/* 4. WHY WE'RE DIFFERENT */}
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

                {/* 5. CLOSING STATEMENT — moved here from the hero when the tagline took the headline */}
                <section className="section closing">
                    <div className="page">
                        <h2>Careers that fit <em>you</em>. And the future.</h2>
                        <Link to="/register" className="btn btn-light tap">Let's figure out your career →</Link>
                    </div>
                </section>

            </main>

            <PublicFooter />
        </div>
    )
}

export default Landing
