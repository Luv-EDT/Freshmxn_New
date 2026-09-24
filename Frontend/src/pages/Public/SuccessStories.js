import { Link } from "react-router-dom"
import PublicNav from "./PublicNav"
import PublicFooter from "./PublicFooter"

// Verbatim from success_stories_page.md. BOTH STORIES ARE ILLUSTRATIVE — representative, not real
// individuals — and say so on the page, twice: in the intro and on each card.
const STORIES = [
    {
        id: "aarav",
        title: "Aarav, Class 11 → Product Designer",
        name: "Aarav",
        told: [
            ["Interests", "sketching, tinkering with gadgets, video game level design, watching \"how it's made\" videos"],
            ["Activities he'd actually done", "rebuilt his cycle's gears, modded his PC case, ran the school fest stage-design team for two years"],
            ["Problems he cared about", "\"things that look good but are annoying to use\""],
            ["A belief he held", "\"I learn by building, not by reading theory\""],
        ],
        strengths: [
            ["Spatial intelligence", "High"],
            ["Divergent thinking / creativity", "High"],
            ["Bodily / hands-on", "High"],
            ["Openness", "High"],
            ["Interest in abstract theory", "Low"],
        ],
        rankedFor: "him",
        ranked: ["Product / Industrial Designer", "Robotics & Mechatronics Engineer", "UX / Interaction Designer", "Architect", "Automotive Designer"],
        chosen: 0,
        insight: (
            <>
                Everyone had told Aarav "just do software engineering." His profile said otherwise — generic
                software was a <em>weak</em> fit for how he's wired. His spatial-creative-hands-on combination made{" "}
                <strong>design and build-oriented engineering</strong> the natural home.
            </>
        ),
        now: (
            <>
                Aarav is in a <strong>product design</strong> program, building real things, and — in his words —
                "finally studying something where the way my brain works is the whole point, not a problem."
            </>
        ),
    },
    {
        id: "meera",
        title: "Meera, College 2nd year → Sustainability Analyst",
        name: "Meera",
        told: [
            ["Interests", "nature documentaries, organising community clean-ups, spreadsheets (genuinely), reading about climate policy"],
            ["Activities she'd actually done", "ran her college's waste-segregation drive, interned at a local NGO, maintained her family's monthly budget for years"],
            ["Problems she cared about", "\"we know what's wrong with the planet but not how to make the fixes actually pay\""],
            ["A belief she held", "\"impact and income don't have to be opposites\""],
        ],
        strengths: [
            ["Naturalistic intelligence", "High"],
            ["Logical + reasoning", "High"],
            ["Conscientiousness", "High"],
            ["Existential (meaning-driven)", "High"],
            ["Convergent thinking (structured problem-solving)", "High"],
        ],
        rankedFor: "her",
        ranked: ["Environmental Scientist", "ESG / Sustainability Analyst", "Urban & Environmental Planner", "Green-Finance Analyst", "Conservation Program Manager"],
        chosen: 1,
        insight: (
            <>
                Meera assumed "caring about the environment" meant a low-paying NGO track. Her strong
                logical-analytical-conscientious profile pointed at the <strong>analytical, in-demand, financially
                solid</strong> end of sustainability — a corner she didn't know existed.
            </>
        ),
        now: (
            <>
                Meera is training as a <strong>sustainability analyst</strong>, combining the cause she cares about
                with the numbers she's good at — "the part I thought I had to give up to do good."
            </>
        ),
    },
]

function StoryCard({ story }) {
    return (
        <article className="story">
            <div className="story-head">
                <h2>{story.title}</h2>
            </div>
            <div className="story-body">
                <h3>🧾 What {story.name} told us</h3>
                <ul>
                    {story.told.map(([label, text]) => (
                        <li key={label}><strong>{label}:</strong> {text}</li>
                    ))}
                </ul>

                <h3>🧠 Psychometric strengths that shaped the match</h3>
                <div className="table-scroll">
                    <table>
                        <thead>
                            <tr><th>Strength</th><th>Signal</th></tr>
                        </thead>
                        <tbody>
                            {story.strengths.map(([strength, signal]) => (
                                <tr key={strength}>
                                    <td>{strength}</td>
                                    <td className={signal === "High" ? "signal-high" : "muted"}>{signal}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <h3>🎯 What we recommended (ranked to <em>{story.rankedFor}</em>)</h3>
                <ol>
                    {story.ranked.map((career, index) => (
                        <li key={career}>
                            {index === story.chosen
                                ? <span className="chosen"><strong>{career}</strong> ✅ <em>(chose this)</em></span>
                                : career}
                        </li>
                    ))}
                </ol>
                <blockquote>{story.insight}</blockquote>

                <h3>🚀 Where {story.rankedFor === "him" ? "he" : "she"} is now</h3>
                <blockquote>{story.now}</blockquote>

                <p className="illustrative"><em>(Illustrative example.)</em></p>
            </div>
        </article>
    )
}

function SuccessStories() {
    return (
        <div>
            <PublicNav />

            <main>
                <section className="page-hero">
                    <div className="page">
                        <h1>Success stories</h1>
                        <p>
                            These are illustrative examples of how a Freshmxn result comes together — from a student's
                            own story and strengths, to a shortlist, to a choice that fit. (Representative, not real
                            individuals.)
                        </p>
                    </div>
                </section>

                <section className="section">
                    <div className="page stories">
                        {STORIES.map((story) => <StoryCard key={story.id} story={story} />)}
                    </div>
                </section>

                <section className="section closing">
                    <div className="page">
                        <h2>Your story is different from both of these. That's the point.</h2>
                        {/* the copy doc links /start, which doesn't exist — sign-up is where the journey starts */}
                        <Link to="/register" className="btn btn-light tap">Let's figure out your career →</Link>
                    </div>
                </section>
            </main>

            <PublicFooter />
        </div>
    )
}

export default SuccessStories
