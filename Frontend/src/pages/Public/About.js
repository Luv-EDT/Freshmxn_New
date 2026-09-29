import { useState } from "react"
import { Link } from "react-router-dom"
import PublicNav from "./PublicNav"
import PublicFooter from "./PublicFooter"

// About us (owner, Round 5, 2026-09-24). The founder's story is the owner's own words, edited only
// for spelling and flow and kept in the first person — nothing here is invented in their voice.
// The founder's photo is served from Frontend/public/founder.jpg. Until that file is added the
// portrait simply is not drawn — no broken-image icon on a public page.
const FOUNDER_PHOTO = "/founder.jpg"

function About() {
    const [photoOk, setPhotoOk] = useState(true)

    return (
        <div>
            <PublicNav />

            <main>
                <section className="page-hero">
                    <div className="page">
                        <span className="eyebrow">About us</span>
                        <h1>Why Freshmxn's Lab exists</h1>
                        <p>Choosing a career in India shouldn't come down to a short list of options and someone else's expectations.</p>
                    </div>
                </section>

                <section className="section">
                    <div className="page founder">
                        <div className="founder-head">
                            {photoOk && (
                                <img
                                    src={FOUNDER_PHOTO}
                                    alt="Luv Goel, founder of Freshmxn's Lab"
                                    className="founder-photo"
                                    width="200"
                                    height="200"
                                    onError={() => setPhotoOk(false)}
                                />
                            )}
                            <h2>My story</h2>
                        </div>
                        <p>
                            My own journey has been quite unconventional. Nothing was planned from the start. My parents
                            didn't have the educational background to guide me through these choices, and I was an
                            average student trying to do outlier things.
                        </p>
                        <p>
                            I was a good student until Class 12. Then, frustrated with pursuing science and preparing for
                            IIT-JEE, I gave up — and started questioning life and the education system itself. Walking
                            away was easy; what I decided next was harder: that the system needed fixing.
                        </p>
                        <p>
                            I entered a tier-2/3 engineering college with a single goal: to explore as much as I could,
                            gather varied experiences and move abroad. The plan worked — I got admission calls from some of
                            my dream graduate schools in the US. That's when I chose to stay and improve the system here
                            instead.
                        </p>
                        <p>
                            Since then I've been building ways to help students figure out what they can do — not just in
                            school, but later in life too. <strong>Freshmxn's Lab is one such attempt.</strong>
                        </p>
                        <p className="founder-sign">
                            — Luv Goel, founder (
                            <a href="https://www.linkedin.com/in/luv-goel/" target="_blank" rel="noreferrer">LinkedIn</a>)
                        </p>

                        <div className="card founder-company">
                            <p>
                                Built by <strong>Luv Goel</strong> and the Freshmxn Labs team.
                                Freshmxn's Lab is a product of <strong>Freshmxn Education India Private Limited</strong>.
                            </p>
                        </div>
                    </div>
                </section>

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

export default About
