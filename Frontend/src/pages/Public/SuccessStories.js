import { Link } from "react-router-dom"
import PublicNav from "./PublicNav"
import PublicFooter from "./PublicFooter"

// From success_stories_page.md. Three stories, one per audience the product serves (school,
// college, early career). Round 6 (owner): rewritten to be realistic — plausible timelines ("is
// preparing for", not "is already in"), careers that exist in the taxonomy under their real names.
// They are representative composites, not individual students; the page says so once, quietly, at
// the bottom (owner's choice), because presenting invented stories as real would mislead.
const STORIES = [
    {
        id: "aarav",
        title: "Aarav, Class 12 (PCM) → Industrial & Product Designer",
        name: "Aarav",
        pronoun: "he",
        told: [
            ["Interests", "sketching, taking gadgets apart, designing levels in video games, \"how it's made\" videos"],
            ["What he had actually done", "rebuilt the gears on his cycle, modded his PC case, ran the stage-design team for his school fest two years running"],
            ["A problem he cared about", "\"things that look good but are annoying to use\""],
            ["A belief he held", "\"I learn by building, not by reading theory\""],
        ],
        strengths: [
            ["Spatial intelligence", "High"],
            ["Creativity (divergent thinking)", "High"],
            ["Hands-on, practical intelligence", "High"],
            ["Openness to experience", "High"],
            ["Interest in abstract theory", "Low"],
        ],
        ranked: ["Industrial & Product Designer", "UI/UX Designer", "Mechanical Engineer", "Architect", "Game Designer"],
        chosen: 0,
        insight: (
            <>
                Everyone had told Aarav "JEE, then computer science." His profile pointed somewhere else:
                generic software work was a <em>weak</em> fit for how he thinks. His mix of spatial, creative and
                hands-on strengths made <strong>design-and-build careers</strong> the natural home — and he had
                never heard of product design as a career.
            </>
        ),
        now: (
            <>
                Aarav is preparing for <strong>UCEED and NID DAT</strong> alongside his board exams, and has started
                a portfolio of the things he has built. In his words: "For the first time, the way my brain works
                feels like the point, not a problem."
            </>
        ),
    },
    {
        id: "meera",
        title: "Meera, B.Com 2nd year → Sustainability & ESG Professional",
        name: "Meera",
        pronoun: "she",
        told: [
            ["Interests", "nature documentaries, community clean-ups, spreadsheets (genuinely), news about climate policy"],
            ["What she had actually done", "ran her college's waste-segregation drive, volunteered with a local environmental NGO for a summer, has managed her family's monthly budget for years"],
            ["A problem she cared about", "\"we know what's wrong with the planet, but not how to make the fixes pay\""],
            ["A belief she held", "\"impact and income don't have to be opposites\""],
        ],
        strengths: [
            ["Naturalistic intelligence", "High"],
            ["Logical reasoning", "High"],
            ["Conscientiousness", "High"],
            ["Meaning-driven (existential)", "High"],
            ["Structured problem-solving (convergent thinking)", "High"],
        ],
        ranked: ["Sustainability & ESG Professional", "Financial Analyst", "Environmental Scientist", "Data Analyst", "Market Research Analyst"],
        chosen: 0,
        insight: (
            <>
                Meera assumed that caring about the environment meant either a low-paying NGO job or dropping
                commerce altogether. Her report showed the opposite: companies now have to report on their
                environmental impact, and <strong>ESG reporting runs on exactly the accounting and analysis</strong>{" "}
                she was already studying. Her degree was an asset, not something to walk away from.
            </>
        ),
        now: (
            <>
                Meera is finishing her B.Com while doing a <strong>part-time ESG reporting internship</strong> with
                a consulting firm, and has started a certificate course in sustainability reporting — "the cause I
                care about, with the numbers I'm good at."
            </>
        ),
    },
    {
        id: "rohan",
        title: "Rohan, 2 years in IT support → Cybersecurity Specialist",
        name: "Rohan",
        pronoun: "he",
        told: [
            ["Interests", "online capture-the-flag puzzles, reading how data breaches happened, tinkering with his home network"],
            ["What he had actually done", "two years on an IT helpdesk after his BCA — access requests, password resets, laptop set-ups — and ran his office's first phishing-awareness session"],
            ["A problem he cared about", "\"people click on anything, and nobody notices until it's too late\""],
            ["A belief he held", "\"I'm good at spotting the thing that doesn't fit\""],
        ],
        strengths: [
            ["Logical reasoning", "High"],
            ["Focus and attention", "High"],
            ["Conscientiousness", "High"],
            ["Structured problem-solving (convergent thinking)", "High"],
            ["Comfort with uncertainty", "Medium"],
        ],
        ranked: ["Cybersecurity Specialist", "Cloud & DevOps Engineer", "IT Business & Systems Analyst", "Data Analyst", "Software Tester"],
        chosen: 0,
        insight: (
            <>
                Rohan thought changing anything meant quitting and doing a two-year MCA. His report showed that
                his helpdesk years — users, access, incidents — are <strong>where security teams actually
                start</strong>, so the switch would cost him about a year of focused learning, not a fresh degree.
            </>
        ),
        now: (
            <>
                Rohan earned an entry-level security certification while still in his job, and eight months later
                moved into a <strong>security operations (SOC) analyst trainee</strong> role at the same company.
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

                <h3>🎯 What we recommended (ranked for {story.pronoun === "he" ? "him" : "her"})</h3>
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

                <h3>🚀 Where {story.pronoun} is now</h3>
                <blockquote>{story.now}</blockquote>
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
                            How a Freshmxn result comes together — from a student's own story and strengths, to a
                            shortlist, to a choice that fit.
                        </p>
                    </div>
                </section>

                <section className="section">
                    <div className="page stories">
                        {STORIES.map((story) => <StoryCard key={story.id} story={story} />)}
                    </div>
                    <p className="page stories-note">
                        Names and details changed; stories are representative of real student journeys.
                    </p>
                </section>

                <section className="section closing">
                    <div className="page">
                        <h2>Your story is different from all of these. That's the point.</h2>
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
