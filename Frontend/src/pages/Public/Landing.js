import { useCallback, useEffect, useRef, useState } from "react"
import { Link } from "react-router-dom"
import { useDispatch, useSelector } from "react-redux"
import { setUser } from "../../store/userSlice"
import { getCurrentUser } from "../../apiCall/userApi"
import DemoSplash, { splashSeen } from "./DemoSplash"
import PublicNav from "./PublicNav"
import PublicFooter from "./PublicFooter"
import HappyStudent from "./HappyStudent"
import { StepIcon, ArrowDoodle } from "./illustrations"
import { AUDIENCE_NAMES, AUDIENCE_OF_JOURNEY, AUDIENCE_QUESTIONS, COMMON_QUESTIONS } from "./audienceQuestions"

// The public landing page. Copy comes from landing_page_content_v3.md — every statistic there
// carries its source, so nothing here is invented or rounded.
//
// ROUND 5 (owner, 2026-09-24): the landing page is SHORT. Hero → who it's for → what each of them ask us
// (Round 36: one set of questions per audience, then what everyone asks) → why we're different → the closing
// band. A logged-in student sees only their own audience's questions (owner, Round 36). The promise, the four steps,
// the invitation and pricing moved to /how-it-works; the founder's story is on /about.
// Teal is the star colour, and the pastel pink is ONE highlighter swipe per section at most.

// WHO IT'S FOR (owner, Round 36): names and sub-names only. Each card opens that audience's questions below.
const AUDIENCES = [
    { key: "school", icon: "listen" },
    { key: "college", icon: "compass" },
    { key: "professional", icon: "mentor" },
]

function Landing() {
    // the front door (owner, Round 33): visitors first see the demo invitation, once per visit
    const [showSplash, setShowSplash] = useState(() => !localStorage.getItem("token") && !splashSeen())
    const closeSplash = useCallback(() => setShowSplash(false), [])

    // a logged-in student's category (their journey) decides which questions they see (owner, Round 36)
    const dispatch = useDispatch()
    const { user } = useSelector((state) => state.user)
    const hasToken = Boolean(localStorage.getItem("token"))
    useEffect(() => {
        if (!hasToken || user) return
        const load = async () => {
            const response = await getCurrentUser()
            if (response && response.data && response.data.success) dispatch(setUser({ user: response.data.userData }))
        }
        load()
    }, [hasToken, user, dispatch])
    const mine = user && user.role === "student" ? AUDIENCE_OF_JOURNEY[user.journey] || null : null
    const [picked, setPicked] = useState("school")
    const audience = mine || picked
    const asksRef = useRef(null)
    const openAudience = (key) => {
        setPicked(key)
        if (asksRef.current) asksRef.current.scrollIntoView({ behavior: "smooth", block: "start" })
    }

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
                                <p className="hero-brand">Freshmxn Lab</p>
                                {/* the company tagline leads; "Careers that fit you" closes the page (owner, 2026-09-24) */}
                                <h1 className="tagline"><span>Explore.</span> <span>Get clarity.</span> <span className="accent">Take action.</span></h1>
                                <p className="lead">
                                    We match your story and strengths to careers that are{" "}
                                    <strong className="highlight-pink">in demand and AI-resilient</strong>, then help you
                                    get there.
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

                    {/* 2. WHO IT'S FOR — names and sub-names only (owner, Round 36); a card opens its questions */}
                    <section className="section section-alt">
                        <div className="page">
                            <div className="section-head">
                                <h2>Who is it for</h2>
                                <p>Wherever you are on the road, we start from where you're standing.</p>
                            </div>
                            <div className="audience">
                                {AUDIENCES.map((item) => (
                                    <button
                                        type="button"
                                        key={item.key}
                                        className={`card audience-card${audience === item.key ? " is-on" : ""}`}
                                        onClick={() => openAudience(item.key)}
                                        disabled={Boolean(mine) && mine !== item.key}
                                    >
                                        <StepIcon name={item.icon} />
                                        <h3>{AUDIENCE_NAMES[item.key].title}</h3>
                                        <p className="audience-tag">{AUDIENCE_NAMES[item.key].tag}</p>
                                        {mine === item.key && <span className="audience-you">You</span>}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </section>

                    {/* 3. WHAT EACH OF THEM ASK US (owner, Round 36) — replaces "What students ask us": their own
                        questions first, then what everyone asks, collapsed. A logged-in student sees only theirs. */}
                    <section className="section problem" ref={asksRef}>
                        <div className="page">
                            <div className="section-head">
                                <h2>{mine ? `What ${AUDIENCE_NAMES[mine].short.toLowerCase()} ask us` : "What each of them ask us"}</h2>
                            </div>
                            {!mine && (
                                <div className="asks-tabs" role="tablist" aria-label="Who is asking">
                                    {AUDIENCES.map((item) => (
                                        <button
                                            type="button"
                                            role="tab"
                                            key={item.key}
                                            id={`asks-tab-${item.key}`}
                                            aria-selected={audience === item.key}
                                            aria-controls="asks-panel"
                                            className={`asks-tab${audience === item.key ? " is-on" : ""}`}
                                            onClick={() => setPicked(item.key)}
                                        >
                                            {AUDIENCE_NAMES[item.key].short}
                                        </button>
                                    ))}
                                </div>
                            )}
                            <div id="asks-panel" role={mine ? undefined : "tabpanel"} aria-labelledby={mine ? undefined : `asks-tab-${audience}`}>
                                <div className="faq">
                                    {AUDIENCE_QUESTIONS[audience].map((item) => (
                                        <details key={item.q} className="faq-item">
                                            <summary>{item.q}</summary>
                                            <p>{item.a}</p>
                                        </details>
                                    ))}
                                </div>
                                <h3 className="asks-common">What everyone asks</h3>
                                <div className="faq">
                                    {COMMON_QUESTIONS.map((item) => (
                                        <details key={item.q} className="faq-item">
                                            <summary>{item.q}</summary>
                                            <p>{item.a}</p>
                                        </details>
                                    ))}
                                </div>
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
