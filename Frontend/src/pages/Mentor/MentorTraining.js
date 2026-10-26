import { useState } from "react"

// THE MENTOR TRAINING DOCUMENTS (owner, Round 34) — rewritten from the owner's three documents into
// clean pages: 1) Freshmxn and the mentorship programme, 2) how to get onboarded (with the owner's
// Calendly screenshots and their markings), 3) how to run a session. A new mentor reads them before the
// test; an approved one comes back to them any time.
//
// The screenshots live in public/mentor-training/ (calendly-01.png …), in the order the owner's document
// shows them. A missing one is simply not shown.

const WHATSAPP = "+91 8882756287"

function Shot({ n, caption }) {
    const [missing, setMissing] = useState(false)
    if (missing) return null
    const file = `/mentor-training/calendly-${String(n).padStart(2, "0")}.png`
    return (
        <figure className="training-shot">
            <img src={file} alt={caption} loading="lazy" onError={() => setMissing(true)} />
            <figcaption>{caption}</figcaption>
        </figure>
    )
}

const Introduction = () => (
    <article className="training-doc">
        <h3>Welcome to Freshmxn's Career Clarity Mentoring Programme</h3>
        <p>
            <strong>Our vision:</strong> every person deserves a personal career journey, not a one-size-fits-all plan.
            As a mentor, you bridge the gap between a student's interests and real work.
        </p>

        <h4>Why we built this</h4>
        <p>
            Most students choose a career by following trends, marks or what relatives say, and then take random courses
            to "explore". Time, money and motivation are wasted. Freshmxn's Lab matches a student's own story and
            strengths to careers that are in demand and AI-resilient, then helps them get there with mentors who've done
            it. Read more on our <a href="/" target="_blank" rel="noreferrer">home page</a>.
        </p>
        <p><strong>You are the key link between confusion and clarity.</strong></p>

        <h4>The student's journey — exposure, clarity, action</h4>
        <ol>
            <li><strong>Exposure.</strong> Our career recommendations, built from the student's own story and a research-based assessment. Every career we recommend is in demand, financially viable and AI-resilient.</li>
            <li><strong>Clarity.</strong> Understanding real careers through mentors' real stories. <strong>This is where we need you.</strong></li>
            <li><strong>Action.</strong> Taking steps — internships, skills, projects.</li>
        </ol>
        <p>Each stage loops back: clarity deepens with every action.</p>

        <h4>Your role as a mentor</h4>
        <ul>
            <li>Give real-world exposure to the work, through honest conversation.</li>
            <li>Help students find <em>fit</em>, not perfection.</li>
            <li>Guide, don't prescribe — help them think; don't decide for them.</li>
            <li>Carry our ethos: careers aren't straight lines, and that's okay.</li>
        </ul>

        <h4>How you're paid</h4>
        <p>Every session is paid once the student's feedback comes in. Your tier and where you live set the amount:</p>
        <div className="table-scroll">
            <table className="training-table">
                <thead><tr><th>Tier</th><th>How you get there</th><th>Living in India</th><th>Living abroad</th></tr></thead>
                <tbody>
                    <tr><td>Tier 1</td><td>New, approved mentor</td><td>₹1,000</td><td>₹1,500 ($15)</td></tr>
                    <tr><td>Tier 2</td><td>Automatic after 7 sessions with good ratings (8/10 or more on average)</td><td>₹1,300</td><td>₹1,900 ($19)</td></tr>
                    <tr><td>Tier 3</td><td>After 10+ sessions with good ratings, a starter skills roadmap and a review of your profession's data</td><td>₹1,500+</td><td>₹2,200+ ($22+)</td></tr>
                </tbody>
            </table>
        </div>
        <p>
            Your first session is also our check on quality: after it, we confirm that you'll stay on the platform. A
            later follow-up (beyond the first, which is included) pays 30% of your main-session rate.
        </p>

        <h4>The philosophy behind every session</h4>
        <ul>
            <li><strong>Authenticity over perfection</strong> — real stories inspire more than polished ones.</li>
            <li><strong>Empathy over advice</strong> — understand before you guide.</li>
            <li><strong>Clarity over completeness</strong> — focus on what matters most.</li>
            <li><strong>Adaptability</strong> — the structure is a guide, not a script.</li>
        </ul>
        <p>Questions any time: WhatsApp {WHATSAPP} or email <a href="mailto:luvgoel@freshmxn.com">luvgoel@freshmxn.com</a>.</p>
    </article>
)

const Onboarding = () => (
    <article className="training-doc">
        <h3>How to get onboarded</h3>
        <p>Two steps, done once. After that, each new student needs only a small change to your Calendly slots.</p>

        <h4>Step 1 — your profile and inputs</h4>
        <ul>
            <li><strong>Basic information</strong> (required) — the profile form on your dashboard.</li>
            <li><strong>Check our data on your profession</strong> — you're the best person to tell us what's right and what isn't. Your answers help us train the student recommendation model (My profession tab).</li>
            <li><strong>Extra, voluntary:</strong> a starter skills roadmap — free or cheap resources (YouTube, Coursera, Udemy and others), in order, that give someone the first 20% of skills to start in your field. These extra inputs help you reach Tier 3.</li>
        </ul>

        <h4>Step 2 — set up Calendly (once)</h4>
        <p>Students book their sessions from your Calendly links, so we never have to pass messages back and forth.</p>
        <ol>
            <li>Sign up at <a href="https://calendly.com/signup" target="_blank" rel="noreferrer">calendly.com/signup</a> with Google, Microsoft or your email.</li>
            <li>Follow the setup screens, choosing what the screenshots below show.</li>
        </ol>
        <Shot n={1} caption="Calendly's first setup screen — choose as marked" />
        <Shot n={2} caption="The next setup screen — choose as marked" />

        <h4>Create the two session types</h4>
        <p><strong>The 1-hour main session</strong></p>
        <ol>
            <li>Open <strong>Scheduling</strong> on the left of your home page, press <strong>+ Create</strong> and choose <strong>One-on-one</strong>.</li>
            <li>Set the duration to <strong>1 hour</strong>, the location to <strong>Google Meet</strong>, and under Availability the <strong>date range to 4 days</strong>.</li>
        </ol>
        <Shot n={3} caption="Create → One-on-one" />
        <Shot n={4} caption="Duration 1 hour, location Google Meet, date range 4 days" />
        <ol start={3}>
            <li>Still under Availability, open <strong>Weekly hours</strong>. Press <strong>+ Hours</strong>.</li>
            <li>Pick each of the next 4 days one by one and add every slot you can take for that student with <strong>+</strong>, then press <strong>Apply</strong>. Leave a day empty if you're busy — just give plenty of choice.</li>
        </ol>
        <Shot n={5} caption="Weekly hours, inside Availability" />
        <Shot n={6} caption="+ Hours" />
        <Shot n={7} caption="Choose a day and add the hours you're free" />
        <Shot n={8} caption="Four days set up — days you're busy can stay empty" />
        <p>
            If several session types share the same slots (for example, two students at once), Calendly offers
            <strong> "Apply to 2 event types"</strong> — choose it.
        </p>

        <p><strong>The 20-minute follow-up</strong></p>
        <ol>
            <li>Create another One-on-one the same way: duration <strong>20 minutes</strong>, date range <strong>6 days</strong> (the 4 days plus 2).</li>
            <li>In Weekly hours, open slots from day 3 to day 6 — set each slot to 20 minutes.</li>
            <li>For location, add <strong>Phone call</strong> beside Google Meet; you and the student decide which.</li>
        </ol>
        <Shot n={9} caption="The 20-minute follow-up — date range 6 days" />
        <Shot n={10} caption="Add phone as a location as well" />

        <h4>Save your links</h4>
        <p>Save, then copy the link of each session type and paste both into <strong>My profile</strong> on your dashboard. Students book from them there.</p>
        <Shot n={11} caption="Copy each session's link" />

        <h4>Each time we have a student for you</h4>
        <ul>
            <li>We'll message you on WhatsApp first. <strong>Change only the weekly hours</strong> — the links stay the same.</li>
            <li>Open at least <strong>5 slots of each type</strong> (10 or more if you have two students at once): main sessions in the next 4 days, follow-ups on days 5 and 6.</li>
            <li>Honour every slot you open. You can be flexible only if the student agrees; otherwise the time they booked stands. No-shows and late cancellations lower your rating and your future sessions.</li>
        </ul>
    </article>
)

const Session = () => (
    <article className="training-doc">
        <h3>How to run a session</h3>

        <h4>When we match you — 2.5 days to prepare (about 30 minutes)</h4>
        <p>You'll get an email and see the student's brief under <strong>Home</strong>. If you don't prepare and keep your slots in that time, we find the student another mentor in your profession, and it counts against your rating.</p>
        <ul>
            <li><strong>Read the brief:</strong> their interests, achievements, challenges and education, what they want help with, and their languages. Our data on your profession is under <strong>My profession</strong>, if you want it.</li>
            <li><strong>Find connection points</strong> from your own journey — similar fears, a similar path, a similar background, similar struggles at school or college.</li>
            <li><strong>Set your mindset:</strong> be real, not perfect. Lead with empathy and clarity, not salesmanship. Vulnerability creates connection.</li>
        </ul>

        <h4>The 60-minute session</h4>
        <div className="table-scroll">
            <table className="training-table">
                <thead><tr><th>Part</th><th>Time</th><th>What to do</th></tr></thead>
                <tbody>
                    <tr><td>Welcome and rapport</td><td>5 min</td><td>Introduce yourself; say "this is a safe space — no wrong questions"; share a light story about your own early doubts.</td></tr>
                    <tr><td>Profession overview</td><td>7–8 min</td><td>A real day, the routine and the unexpected; common myths; how careers grow; hours, stress and balance — the bad parts too.</td></tr>
                    <tr><td>Your journey</td><td>10 min</td><td>How you got in, key skills and decisions, struggles, breaks and detours — and why you kept going.</td></tr>
                    <tr><td>Relating to the student</td><td>8–10 min</td><td>Use your connection points: "I noticed you're interested in X — when I started, I felt similarly…"; "You mentioned struggling with Y — here's how I managed…". Say honestly who the field suits.</td></tr>
                    <tr><td>Success requirements</td><td>7–8 min</td><td>Answer: "If you were in the student's position today, what would you do to reach your level or beyond?" Time, competition, habits, support and how long momentum takes. If you can, a light skills roadmap — start with A, get a grasp of B, skip C for now; the 20% that gives 80%.</td></tr>
                    <tr><td>Questions</td><td>10–12 min</td><td>Invite any question. Prompts: "Want to hear what I'd do differently?", "Curious about salary or location?"</td></tr>
                    <tr><td>Wrap-up</td><td>5 min</td><td>The three next steps on the student's dashboard: building their fundamentals, a skills pathway (80/20), internships and projects. If they didn't book a follow-up, ask whether they'd like one — it's optional.</td></tr>
                </tbody>
            </table>
        </div>
        <p className="training-quote">
            "The student sees you as a window into their possible future. Be real and reassuring. You don't need all the
            answers — just your story, your clarity, and encouragement to explore."
        </p>

        <h4>The follow-up (20 minutes)</h4>
        <p>No preparation needed: it's the student's questions and reflections, and they should speak more than you. The first follow-up is included in your fee.</p>

        <h4>After the session</h4>
        <ul>
            <li>Tell us on WhatsApp ({WHATSAPP}) that it's done. We send the student the feedback form — remind them to fill it after the follow-up.</li>
            <li>There's nothing else to report on the platform. Your payment follows the student's feedback.</li>
            <li>Students may ask for later follow-ups; we arrange them, and they pay 30% of your main rate.</li>
        </ul>

        <h4>Rules that keep students safe</h4>
        <ul>
            <li>Use a student's name and contact only to arrange and hold these sessions. Never share them, never add them to groups, and delete the chat after the follow-up.</li>
            <li>Be punctual, empathetic and authentic — your rating and opportunities depend on it.</li>
            <li><strong>Never take students off the platform.</strong> If a student asks you directly for a session, tell us. Mentors found running their own services with our students are blacklisted. Please respect our intellectual property.</li>
        </ul>
    </article>
)

const DOCS = [
    { key: "intro", title: "1. Freshmxn and the mentorship programme", body: <Introduction /> },
    { key: "onboard", title: "2. How to get onboarded", body: <Onboarding /> },
    { key: "session", title: "3. How to run a session", body: <Session /> },
]

function MentorTraining() {
    return (
        <section className="mentor-training">
            <p>Read all three before your test — they're also your reference for every session.</p>
            {DOCS.map((doc, index) => (
                <details key={doc.key} className="faq-item training-fold" open={index === 0}>
                    <summary>{doc.title}</summary>
                    {doc.body}
                </details>
            ))}
        </section>
    )
}

export default MentorTraining
