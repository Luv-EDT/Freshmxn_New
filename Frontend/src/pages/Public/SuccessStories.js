import { Navigate } from "react-router-dom"

// From success_stories_page.md. Three stories, one per audience the product serves (school,
// college, early career). Round 6 (owner): rewritten to be realistic — plausible timelines ("is
// preparing for", not "is already in"), careers that exist in the taxonomy under their real names.
// They are representative composites, not individual students.
//
// Round 10 (owner): lighter, testimonial-style cards — a quote, a name, where they started and what
// they chose — with the full story folded away under "Read the story". Names Dhvanika, Dhriti and
// Raghav. Since Round 26 (owner) they live inside About us, and one plain line under them says the
// names and details are changed — no per-card label.
const STORIES = [
    {
        id: "dhvanika",
        title: "Dhvanika, Class 12 (PCM) → Industrial & Product Designer",
        name: "Dhvanika",
        pronoun: "she",
        told: [
            ["Interests", "sketching, taking gadgets apart, designing levels in video games, \"how it's made\" videos"],
            ["What she had actually done", "rebuilt the gears on her cycle, modded her PC case, ran the stage-design team for her school fest two years running"],
            ["A problem she cared about", "\"things that look good but are annoying to use\""],
            ["A belief she held", "\"I learn by building, not by reading theory\""],
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
        stage: "Class 12, PCM",
        quote: "Everyone said JEE, then computer science. I had never even heard of product design — now it's the thing I wake up wanting to do.",
        insight: (
            <>
                Everyone had told Dhvanika "JEE, then computer science." Her profile pointed somewhere else:
                generic software work was a <em>weak</em> fit for how she thinks. Her mix of spatial, creative and
                hands-on strengths made <strong>design-and-build careers</strong> the natural home — and she had
                never heard of product design as a career.
            </>
        ),
        now: (
            <>
                Dhvanika is preparing for <strong>UCEED and NID DAT</strong> alongside her board exams, and has started
                a portfolio of the things she has built. In her words: "For the first time, the way my brain works
                feels like the point, not a problem."
            </>
        ),
    },
    {
        id: "dhriti",
        title: "Dhriti, B.Com 2nd year → Sustainability & ESG Professional",
        name: "Dhriti",
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
        stage: "B.Com, 2nd year",
        quote: "I thought caring about the planet meant giving up commerce. It turns out my accounts classes are exactly what ESG work runs on.",
        insight: (
            <>
                Dhriti assumed that caring about the environment meant either a low-paying NGO job or dropping
                commerce altogether. Her report showed the opposite: companies now have to report on their
                environmental impact, and <strong>ESG reporting runs on exactly the accounting and analysis</strong>{" "}
                she was already studying. Her degree was an asset, not something to walk away from.
            </>
        ),
        now: (
            <>
                Dhriti is finishing her B.Com while doing a <strong>part-time ESG reporting internship</strong> with
                a consulting firm, and has started a certificate course in sustainability reporting — "the cause I
                care about, with the numbers I'm good at."
            </>
        ),
    },
    {
        id: "raghav",
        title: "Raghav, 2 years in IT support → Cybersecurity Specialist",
        name: "Raghav",
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
        stage: "2 years in IT support",
        quote: "I assumed switching meant quitting and a two-year degree. It took one certification and eight months — from the same desk.",
        insight: (
            <>
                Raghav thought changing anything meant quitting and doing a two-year MCA. His report showed that
                his helpdesk years — users, access, incidents — are <strong>where security teams actually
                start</strong>, so the switch would cost him about a year of focused learning, not a fresh degree.
            </>
        ),
        now: (
            <>
                Raghav earned an entry-level security certification while still in his job, and eight months later
                moved into a <strong>security operations (SOC) analyst trainee</strong> role at the same company.
            </>
        ),
    },
]

function StoryCard({ story }) {
    return (
        <article className="testimonial">
            <blockquote className="testimonial-quote">“{story.quote}”</blockquote>
            <div className="testimonial-who">
                <span className="testimonial-avatar" aria-hidden="true">{story.name.charAt(0)}</span>
                <span>
                    <strong>{story.name}</strong>
                    <span className="testimonial-stage">{story.stage}</span>
                </span>
            </div>
            <p className="testimonial-chose">Chose: <strong>{story.ranked[story.chosen]}</strong></p>

            <details className="faq-item testimonial-more">
                <summary>Read {story.name}'s story</summary>
                <div className="story-body">
                    <h3>What {story.name} told us</h3>
                    <ul>
                        {story.told.map(([label, text]) => (
                            <li key={label}><strong>{label}:</strong> {text}</li>
                        ))}
                    </ul>

                    <h3>Strengths that shaped the match</h3>
                    <ul className="strength-chips">
                        {story.strengths.map(([strength, signal]) => (
                            <li key={strength} className={signal === "High" ? "signal-high" : "muted"}>{strength} · {signal}</li>
                        ))}
                    </ul>

                    <h3>What we recommended</h3>
                    <ol>
                        {story.ranked.map((career, index) => (
                            <li key={career}>
                                {index === story.chosen ? <strong>{career} (chose this)</strong> : career}
                            </li>
                        ))}
                    </ol>
                    <p>{story.insight}</p>

                    <h3>Where {story.pronoun} is now</h3>
                    <p>{story.now}</p>
                </div>
            </details>
        </article>
    )
}

// the stories as a section of About us (owner, Round 26)
export function StoriesSection() {
    return (
        <section className="section" id="stories">
            <div className="page section-head">
                <h2>Success stories</h2>
                <p>
                    How a Freshmxn result comes together — from a student's own story and strengths, to a shortlist,
                    to a choice that fit.
                </p>
            </div>
            <div className="page testimonials">
                {STORIES.map((story) => <StoryCard key={story.id} story={story} />)}
            </div>
            <p className="page stories-label">
                Names and details are changed; the stories are representative of real student journeys.
            </p>
        </section>
    )
}

// the old address still works: it opens the stories on About us
function SuccessStories() {
    return <Navigate to="/about#stories" replace />
}

export default SuccessStories
