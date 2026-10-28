import { useEffect, useState } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import PublicNav from "./PublicNav"
import PublicFooter from "./PublicFooter"
import { AUDIENCE_NAMES, questionsFor } from "./audienceQuestions"
import useMyAudience from "./useMyAudience"

// FAQ (owner, Round 37) — /faq, every question we're asked, opened from "See all questions" on the home page
// (which shows each audience's first five).
// Round 39 (owner): three tabs, one per audience — only the chosen audience's questions show, and another tab
// switches them. "See all questions" opens the tab the visitor was on (`#school` / `#college` / `#professional`).
// A logged-in student sees only their own, with no tabs.
const AUDIENCE_KEYS = ["school", "college", "professional"]
const fromHash = (hash) => (AUDIENCE_KEYS.includes((hash || "").slice(1)) ? hash.slice(1) : "school")

function FaqPage() {
    const mine = useMyAudience()
    const { hash } = useLocation()
    const navigate = useNavigate()
    const [picked, setPicked] = useState(() => fromHash(hash))
    useEffect(() => { setPicked(fromHash(hash)) }, [hash])
    const audience = mine || picked

    const pick = (key) => {
        setPicked(key)
        navigate(`/faq#${key}`, { replace: true })
    }

    return (
        <div>
            <PublicNav />
            <main className="page faq-page">
                <h1 className="page-title-center">{mine ? `What ${AUDIENCE_NAMES[mine].short.toLowerCase()} ask us` : "Questions we're asked"}</h1>
                {!mine && (
                    <div className="asks-tabs" role="tablist" aria-label="Who is asking">
                        {AUDIENCE_KEYS.map((key) => (
                            <button
                                type="button"
                                role="tab"
                                key={key}
                                id={`faq-tab-${key}`}
                                aria-selected={audience === key}
                                aria-controls="faq-panel"
                                className={`asks-tab${audience === key ? " is-on" : ""}`}
                                onClick={() => pick(key)}
                            >
                                {AUDIENCE_NAMES[key].short}
                            </button>
                        ))}
                    </div>
                )}

                <section id="faq-panel" className="faq-group" role={mine ? undefined : "tabpanel"} aria-labelledby={mine ? undefined : `faq-tab-${audience}`}>
                    {!mine && <p className="audience-tag faq-tag">{AUDIENCE_NAMES[audience].tag}</p>}
                    <div className="faq">
                        {questionsFor(audience).map((item) => (
                            <details key={item.q} className="faq-item">
                                <summary>{item.q}</summary>
                                <p>{item.a}</p>
                            </details>
                        ))}
                    </div>
                </section>

                <p className="asks-more">
                    <Link to="/try-demo" className="btn btn-primary tap">Try a Free Demo — 5 minutes</Link>
                </p>
            </main>
            <PublicFooter />
        </div>
    )
}

export default FaqPage
