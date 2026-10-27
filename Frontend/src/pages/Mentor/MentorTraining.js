import { useState } from "react"

// THE MENTOR TRAINING DOCUMENTS (owner, Rounds 34–35) — rewritten from the owner's three documents into
// short pages: 1) Freshmxn and the mentorship programme (~10 min), 2) how to get onboarded, with the
// owner's Calendly screenshots and their markings (~20 min), 3) how to run a session (~15 min). All three
// start folded. A new mentor reads them before the profile and the test; an approved one comes back any time.
//
// The screenshots live in public/mentor-training/ (calendly-01.png … calendly-16.png), cut from the owner's
// document in its order with the owner's red marks kept (Round 35; the owner's email blurred on 05). A
// missing one is simply not shown.

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
        <p className="training-lead">
            Every person deserves a personal career journey, not a one-size-fits-all plan. Freshmxn matches a student's
            own story and strengths to careers that are in demand and AI-resilient — and you show them what that work is
            really like. More on our <a href="/" target="_blank" rel="noreferrer">home page</a>.
        </p>

        <h4>Where you come in</h4>
        <ol className="training-steps">
            <li><strong>Exposure</strong> — our career recommendations, from the student's story and a research-based assessment.</li>
            <li><strong>Clarity</strong> — a real career through a real person's story. <strong>This is you.</strong></li>
            <li><strong>Action</strong> — skills, internships, projects.</li>
        </ol>

        <h4>Your role</h4>
        <ul className="training-ticks">
            <li>Show the real work — the good and the hard parts.</li>
            <li>Help them find <em>fit</em>, not perfection.</li>
            <li>Guide, don't decide for them.</li>
            <li>Be real, not polished — careers aren't straight lines.</li>
        </ul>

        <h4>How you're paid</h4>
        <p>Per session, once the student's feedback comes in. Your tier and where you live set the amount:</p>
        <div className="table-scroll">
            <table className="training-table">
                <thead><tr><th>Tier</th><th>How you get there</th><th>In India</th><th>Abroad</th></tr></thead>
                <tbody>
                    <tr><td>1</td><td>Approved</td><td>₹1,000</td><td>₹1,500 ($15)</td></tr>
                    <tr><td>2</td><td>Automatic: 7 sessions averaging 8/10+, and the check of your profession's data</td><td>₹1,300</td><td>₹1,900 ($19)</td></tr>
                    <tr><td>3</td><td>10+ sessions averaging 8/10+, a skills roadmap and a data review</td><td>₹1,500+</td><td>₹2,200+ ($22+)</td></tr>
                </tbody>
            </table>
        </div>
        <p className="report-small">After your first session we confirm you stay on the platform. The first follow-up is included; a later one pays 30% of your rate.</p>
    </article>
)

const Onboarding = () => (
    <article className="training-doc">
        <p className="training-lead">Done once. After that, each new student needs only a small change to your Calendly slots.</p>

        <h4>1. Your profile</h4>
        <p>Step 2 on your dashboard — about you, and how we pay you.</p>

        <h4>2. Set up Calendly</h4>
        <p>Students book from your links, so nobody passes messages back and forth. Sign up at <a href="https://calendly.com/signup" target="_blank" rel="noreferrer">calendly.com/signup</a> with Google, Microsoft or your email, then choose what each setup screen shows.</p>
        <Shot n={1} caption="Sign up with Google, Microsoft or your email" />
        <Shot n={2} caption="How you plan to use Calendly — choose as shown" />
        <Shot n={3} caption="Your role — choose as shown" />
        <Shot n={4} caption="Connect the calendar you use (Google here)" />
        <Shot n={5} caption="How your calendar will be used — keep the sync ticked" />
        <Shot n={6} caption="Your usual availability — you'll change it for each student" />
        <Shot n={7} caption="How you'd like to meet — Google Meet" />

        <h4>3. The 1-hour main session</h4>
        <ol>
            <li><strong>Scheduling → + Create → One-on-one.</strong></li>
            <li>Duration <strong>1 hour</strong>, location <strong>Google Meet</strong>, Availability → date range <strong>4 days</strong>.</li>
            <li>Weekly hours → the pencil → <strong>+ Hours</strong>: pick each of the next 4 days and add the slots you're free → <strong>Apply</strong>.</li>
        </ol>
        <Shot n={8} caption="Create → One-on-one" />
        <Shot n={9} caption="1 hour, Google Meet, date range 4 days" />
        <Shot n={10} caption="Weekly hours, inside Availability — press the pencil" />
        <Shot n={11} caption="+ Hours" />
        <Shot n={12} caption="Choose a day, add the hours you're free with +, then Apply" />
        <Shot n={13} caption="Four days set up — busy days can stay empty" />

        <h4>4. The 20-minute follow-up</h4>
        <ol>
            <li>Another One-on-one: <strong>20 minutes</strong>, date range <strong>6 days</strong>.</li>
            <li>Open slots on <strong>days 3 to 6</strong> — the student picks one after their main session.</li>
            <li>Add <strong>Phone call</strong> beside Google Meet.</li>
        </ol>
        <Shot n={14} caption="The 20-minute follow-up — date range 6 days" />
        <Shot n={15} caption="Phone as a location as well" />

        <h4>5. Save your links</h4>
        <p>Save, then copy each session's link into your <strong>test</strong> (step 3) — they become your booking links.</p>
        <Shot n={16} caption="Copy each session's link" />

        <h4>Each time we have a student for you</h4>
        <ul className="training-ticks">
            <li>We message you on WhatsApp. <strong>Change only the weekly hours</strong> — the links stay the same.</li>
            <li>Open at least <strong>5 slots of each type</strong>: main sessions in the next 4 days, follow-ups on days 3–6.</li>
            <li>Honour every slot you open — the booked time stands unless the student agrees to move it.</li>
        </ul>
    </article>
)

const Session = () => (
    <article className="training-doc">
        <h4>Tell us on WhatsApp ({WHATSAPP}) — three times</h4>
        <ol className="training-steps">
            <li>When you've <strong>opened your slots</strong>.</li>
            <li>When the student has <strong>booked</strong> — with the date and time of the main session and the follow-up.</li>
            <li>When the <strong>session is done</strong>. We then send the student the feedback form; your payment follows it.</li>
        </ol>
        <p className="training-note">
            <strong>Two slots on one link?</strong> If a student books more than one slot of the same type, don't hold
            either — tell us. We check with the student and let you know which one stands.
        </p>

        <h4>Prepare — within 2.5 days of the match (about 30 minutes)</h4>
        <ul className="training-ticks">
            <li>Read the student's brief under <strong>Home</strong>: interests, achievements, challenges, education, what they want to know, their languages.</li>
            <li>Find connection points in your own journey — similar fears, path, background or struggles.</li>
            <li>Be real, not perfect. Empathy and clarity, not salesmanship.</li>
        </ul>
        <p className="report-small">Not ready, or slots not kept, in that time: we find the student another mentor, and it counts against your rating.</p>

        <h4>The 60-minute session</h4>
        <div className="table-scroll">
            <table className="training-table">
                <thead><tr><th>Part</th><th>Time</th><th>What to do</th></tr></thead>
                <tbody>
                    <tr><td>Welcome</td><td>5 min</td><td>Introduce yourself; "no wrong questions here"; a light story about your own early doubts.</td></tr>
                    <tr><td>The profession</td><td>8 min</td><td>A real day; myths; how careers grow; hours, stress, balance — the bad parts too.</td></tr>
                    <tr><td>Your journey</td><td>10 min</td><td>How you got in, key decisions, struggles and detours — and why you kept going.</td></tr>
                    <tr><td>Relating to them</td><td>10 min</td><td>Use your connection points. Say honestly who the field suits.</td></tr>
                    <tr><td>What success needs</td><td>8 min</td><td>"In your shoes today, I'd…" — time, habits, competition; the 20% of skills that gives 80%.</td></tr>
                    <tr><td>Questions</td><td>12 min</td><td>Anything they want to ask.</td></tr>
                    <tr><td>Wrap-up</td><td>5 min</td><td>Next steps: fundamentals, a skills path, internships and projects. No follow-up booked? Ask if they'd like one.</td></tr>
                </tbody>
            </table>
        </div>

        <h4>The 20-minute follow-up</h4>
        <p>No preparation: their questions and reflections — they talk more than you.</p>

        <h4>Rules</h4>
        <ul className="training-ticks">
            <li>Keep what the student tells you private.</li>
            <li>Be on time — a student who isn't there 10 minutes in is a no-show; tell us.</li>
            <li><strong>Never take students off the platform.</strong> A student asking you directly? Tell us. Mentors running their own services with our students are blacklisted.</li>
        </ul>
    </article>
)

// Round 35 (owner): all three folded, each with how long it takes
const DOCS = [
    { key: "intro", title: "Freshmxn and the mentorship programme", minutes: 10, line: "What we do, your role, and how you're paid", body: <Introduction /> },
    { key: "onboard", title: "How to get onboarded", minutes: 20, line: "Your profile and your two Calendly links, step by step", body: <Onboarding /> },
    { key: "session", title: "How to run a session", minutes: 15, line: "Preparing, the 60 minutes, the follow-up and the rules", body: <Session /> },
]

function MentorTraining() {
    return (
        <section className="mentor-training">
            <p className="training-intro">
                Three short reads — about <strong>45 minutes</strong> in all. <strong>Read them carefully</strong>: your test, and setting up
                your profile and Calendly properly, depend on them. They stay saved here for you to refer to later — once you're
                onboarded, under your profile (the round icon at the top right).
            </p>
            {DOCS.map((doc, index) => (
                <details key={doc.key} className="training-fold">
                    <summary>
                        <span className="training-num" aria-hidden="true">{index + 1}</span>
                        <span className="training-head">
                            <strong>{doc.title}</strong>
                            <span>{doc.line}</span>
                        </span>
                        <span className="training-time">{doc.minutes} min</span>
                    </summary>
                    {doc.body}
                </details>
            ))}
        </section>
    )
}

export default MentorTraining
