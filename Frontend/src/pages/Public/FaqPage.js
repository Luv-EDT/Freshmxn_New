import { useEffect } from "react"
import { Link, useLocation } from "react-router-dom"
import PublicNav from "./PublicNav"
import PublicFooter from "./PublicFooter"
import { AUDIENCE_NAMES, questionsFor } from "./audienceQuestions"
import useMyAudience from "./useMyAudience"

// FAQ (owner, Round 37) — /faq, every question we're asked, opened from "See all questions" on the home page
// (which shows each audience's first five). A visitor sees all three audiences, each with its whole list; a
// logged-in student sees only their own. `#school` / `#college` / `#professional` jumps to one.
const AUDIENCE_KEYS = ["school", "college", "professional"]

function FaqPage() {
    const mine = useMyAudience()
    const { hash } = useLocation()
    const shown = mine ? [mine] : AUDIENCE_KEYS

    // open at the audience the home page was showing
    useEffect(() => {
        const target = hash && document.getElementById(hash.slice(1))
        if (target) target.scrollIntoView({ block: "start" })
    }, [hash, mine])

    return (
        <div>
            <PublicNav />
            <main className="page faq-page">
                <h1 className="page-title-center">{mine ? `What ${AUDIENCE_NAMES[mine].short.toLowerCase()} ask us` : "Questions we're asked"}</h1>
                {!mine && (
                    <nav className="asks-tabs" aria-label="Jump to">
                        {AUDIENCE_KEYS.map((key) => (
                            <a key={key} href={`#${key}`} className="asks-tab">{AUDIENCE_NAMES[key].short}</a>
                        ))}
                    </nav>
                )}

                {shown.map((key) => (
                    <section key={key} id={key} className="faq-group">
                        {!mine && (
                            <div className="section-head">
                                <h2>{AUDIENCE_NAMES[key].title}</h2>
                                <p className="audience-tag">{AUDIENCE_NAMES[key].tag}</p>
                            </div>
                        )}
                        <div className="faq">
                            {questionsFor(key).map((item) => (
                                <details key={item.q} className="faq-item">
                                    <summary>{item.q}</summary>
                                    <p>{item.a}</p>
                                </details>
                            ))}
                        </div>
                    </section>
                ))}

                <p className="asks-more">
                    <Link to="/try-demo" className="btn btn-primary tap">Try a Free Demo — 5 minutes</Link>
                </p>
            </main>
            <PublicFooter />
        </div>
    )
}

export default FaqPage
