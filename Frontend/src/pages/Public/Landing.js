import { useCallback, useState } from "react"
import { Link } from "react-router-dom"
import DemoSplash, { splashSeen } from "./DemoSplash"
import PublicNav from "./PublicNav"
import PublicFooter from "./PublicFooter"
import HappyStudent from "./HappyStudent"
import { StepIcon, ArrowDoodle } from "./illustrations"

// The public landing page. Copy comes from landing_page_content_v3.md — every statistic there
// carries its source, so nothing here is invented or rounded.
//
// ROUND 5 (owner, 2026-09-24): the landing page is SHORT. Hero → the problem as four collapsed
// questions → who it's for → why we're different → the closing band. The promise, the four steps,
// the invitation and pricing moved to /how-it-works; the founder's story is on /about.
// Teal is the star colour, and the pastel pink is ONE highlighter swipe per section at most.

// THE QUESTIONS STUDENTS ASK THEMSELVES (owner, Round 33) — no "career gyaan" heading any more: the page goes
// straight to the ten questions school and college students ask most, the ones that hook first on top. Each
// answer is a hidden fact (with its source kept) and what Freshmxn does about it — never a feature that isn't
// built: help with internships, jobs and a starter kit is a waitlist, and every career shows its AI exposure
// rather than claiming any career is "AI-proof".
export const QUESTIONS = [
    {
        q: "Will AI take my job?",
        a: (
            <>
                AI is redrawing the map: AI, data, cloud and cybersecurity are now the most in-demand skills in India,
                and routine roles are shrinking (India Skills Report 2026). Every career we recommend shows{" "}
                <strong>how exposed it is to AI</strong> — and which part of the work AI touches — next to how much
                India needs it, so you can pick work that lasts.
            </>
        ),
    },
    {
        q: "Why do I only know a handful of careers?",
        a: (
            <>
                Because nobody shows you the rest. <strong>93% of Indian students are aware of only seven career
                options</strong> (India Today survey). We rank your matches from <strong>1,000+ careers and job
                roles</strong> — including ones you've never heard of, and careers that combine two fields.
            </>
        ),
    },
    {
        q: "I don't know what I'm interested in — where do I start?",
        a: (
            <>
                With your story, not a quiz. <strong>Virtual Career Counselling</strong> walks through four stages of
                your life and asks what you did, what stuck and why — small things count. Then we find the thread.
                Try the free 6-minute demo to see how it works.
            </>
        ),
    },
    {
        q: "Will my degree make me job-ready?",
        a: (
            <>
                Not on its own. <strong>About 44% of Indian graduates still aren't considered job-ready</strong>{" "}
                (India Skills Report 2026). Usually it isn't ability — it's a direction that never fit. We count every
                career from where you stand: what your degree already covers, and what's left.
            </>
        ),
    },
    {
        q: "How do I explore without wasting years on a degree or random online courses?",
        a: (
            <>
                Find the direction before you spend the years and the money. Your matches are ranked from your own story
                and strengths, each with its road, exams, where to study and <strong>your next 12 months</strong> — and
                a mentor who has done the job can tell you what it's really like.
            </>
        ),
    },
    {
        q: "Is that master's or expensive course worth it?",
        a: (
            <>
                Check before you pay. Each career shows the <strong>cost to qualify, starting and mid-career pay</strong>{" "}
                in India, and whether a master's is needed, helps, or usually isn't needed.
            </>
        ),
    },
    {
        q: "How do I get job- or internship-ready fast?",
        a: (
            <>
                Start with the right first step. Your first steps for each career are right on its card — and help with
                internships, jobs and a starter skill kit is on our waitlist.
            </>
        ),
    },
    {
        q: "Can I talk to someone who's done it?",
        a: (
            <>
                Yes. With a mentor plan you get <strong>a professional in the job role you choose</strong> — a one-hour
                clarity session and a 20-minute follow-up, matched within 20 business days. Real experience, not generic
                advice.
            </>
        ),
    },
    {
        q: "I've found something new I love — how do I make it real?",
        a: (
            <>
                Every career shows the path and your next 12 months, and your mentor can help you make it your work — or
                carry it forward as a passion alongside whatever pays.
            </>
        ),
    },
    {
        q: "My past choices feel wrong — is it too late?",
        a: (
            <>
                No. Your past doesn't define you. We show what carries over, how many years a switch would leave behind
                and how long from now each career takes — so a change is a plan, not a leap.
            </>
        ),
    },
]

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
    // the front door (owner, Round 33): visitors first see the demo invitation, once per visit
    const [showSplash, setShowSplash] = useState(() => !localStorage.getItem("token") && !splashSeen())
    const closeSplash = useCallback(() => setShowSplash(false), [])

    return (
        <div>
            {showSplash && <DemoSplash onClose={closeSplash} />}
            <div className={showSplash ? "behind-splash" : undefined} aria-hidden={showSplash || undefined}>
                <PublicNav />

                <main>
                    {/* 1. HERO */}
                    <section className="hero">
                        <div className="page hero-grid">
                            <div>
                                <p className="hero-brand">Freshmxn's Lab</p>
                                {/* the company tagline leads; "Careers that fit you" closes the page (owner, 2026-09-24) */}
                                <h1 className="tagline"><span>Explore.</span> <span>Get clarity.</span> <span className="accent">Take action.</span></h1>
                                <p className="lead">
                                    We match your story and strengths to careers that are{" "}
                                    <strong className="highlight-pink">in demand and AI-resilient</strong>, then help you
                                    get there with mentors who've done it.
                                </p>
                                <div className="btn-row">
                                    <Link to="/programs" className="btn btn-primary tap">Let's figure out your career →</Link>
                                    {/* Round 32/33 (owner): a free taste before any login; "How it works" is in the nav */}
                                    <Link to="/try-demo" className="btn btn-ghost tap btn-demo">Try a Free Demo</Link>
                                </div>
                            </div>

                            {/* a picture, not a mock result list (owner, Round 10: the ranked-matches card was text-heavy) */}
                            <div className="hero-visual" aria-hidden="true">
                                <div className="blob" />
                                <div className="dot-pink" />
                                <ArrowDoodle className="doodle" />
                                <HappyStudent className="hero-student" />
                            </div>
                        </div>
                    </section>

                    {/* 2. THE QUESTIONS (owner, Round 33) — straight to what students ask, collapsed: the question
                        is the hook, the answer one tap away */}
                    <section className="section problem">
                        <div className="page">
                            <div className="section-head">
                                <h2>What students ask us</h2>
                            </div>
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
                                            <strong>Human connection — via our mentor plans.</strong> Real people in the
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
                            <h2>Careers that fit you. And the future.</h2>
                            <Link to="/programs" className="btn btn-light tap">Let's figure out your career →</Link>
                        </div>
                    </section>

                    {/* 6. FOR WORKING PROFESSIONALS (owner, Round 12) — near the bottom but above the
                        footer, where it gets noticed. Visitors only: a logged-in student isn't the audience. */}
                    {!localStorage.getItem("token") && (
                        <section className="section mentor-band">
                            <div className="page">
                                <div className="card">
                                    <div>
                                        <h2>Working professional? Mentor a student who's where you once were.</h2>
                                        <p>
                                            Two short conversations — an hour and a 20-minute follow-up — can save a student years
                                            of guessing. Tell us about your work; we'll match you with students heading your way.
                                        </p>
                                    </div>
                                    <Link to="/mentor/register" className="btn btn-primary tap">Become a mentor →</Link>
                                </div>
                            </div>
                        </section>
                    )}

                </main>

                <PublicFooter />
            </div>
        </div>
    )
}

export default Landing
