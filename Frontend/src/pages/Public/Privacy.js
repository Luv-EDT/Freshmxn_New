import { Link } from "react-router-dom"
import LegalPage, { COMPANY } from "./LegalPage"

// The Privacy Policy, written against the Digital Personal Data Protection Act, 2023 and the DPDP
// Rules, 2025. It states only what the code actually does — every "we collect" line maps to a model
// in Backend/model, every processor to a real integration. If the code changes what it collects or
// who it sends data to, this page changes in the same commit.
//
// ⚠ A DRAFT FOR LEGAL REVIEW, not legal advice. DPDP sign-off remains a go-live gate.
const SECTIONS = [
    {
        id: "who-we-are",
        title: "Who we are",
        body: (
            <>
                <p>
                    Freshmxn's Lab ("Freshmxn", "we", "us") is run by <strong>{COMPANY.name}</strong> (CIN{" "}
                    {COMPANY.cin}), registered at {COMPANY.address}. Under the Digital Personal Data Protection
                    Act, 2023 ("DPDP Act") we are the <strong>Data Fiduciary</strong> for the personal data you
                    give us, and you are the <strong>Data Principal</strong>.
                </p>
                <p>
                    This policy explains what we collect, why, who helps us process it, how long we keep it, and
                    the rights you have. It applies to www.freshmxn.com and everything you do after signing in.
                </p>
            </>
        ),
    },
    {
        id: "what-we-collect",
        title: "What we collect",
        body: (
            <>
                <p>We collect only what we need to give you your results and your mentor:</p>
                <ul>
                    <li>
                        <strong>Account details:</strong> your name, email address, password (stored only as a
                        secure hash), mobile number, age, where you are in your education or career (for example
                        "Class 11, science" or "college, 2nd year") and your preferred language. If you sign in
                        with Google, we receive your name and email address from Google.
                    </li>
                    <li>
                        <strong>For students under 18:</strong> your parent or guardian's name and mobile number,
                        and a record of their permission (see <a href="#children">Children and parental consent</a>).
                    </li>
                    <li>
                        <strong>Your answers:</strong> everything you tell us in Virtual Career Counselling (interests,
                        activities, achievements, problems you care about, beliefs, aspirations) and your
                        responses to the assessment, including written answers and task timings.
                    </li>
                    <li>
                        <strong>External test results:</strong> if you take a third-party test and upload a
                        screenshot of your result, we read the scores off it. <strong>The image itself is never
                        stored</strong> — it is discarded as soon as the numbers are read, and we keep only the
                        scores you confirm.
                    </li>
                    <li>
                        <strong>Results we create:</strong> your psychometric profile, your ranked career matches
                        and your report.
                    </li>
                    <li>
                        <strong>Payments and requests:</strong> what you bought, the amount, the date and its
                        status; coupon use; and any access, refund or financial-aid request you make (including the
                        reason you give and the time you'd like us to call). Card and bank details are handled by
                        the payment provider — <strong>we never see or store them</strong>.
                    </li>
                    <li>
                        <strong>Mentorship:</strong> the career you choose for your mentor and the progress of your
                        match.
                    </li>
                    <li>
                        <strong>Technical data:</strong> the IP address recorded when consent is given, and the
                        server logs any website keeps (time, page requested, IP address, browser). Your browser
                        stores a sign-in token so you stay logged in. We use <strong>no advertising or tracking
                        cookies</strong> and no third-party analytics.
                    </li>
                </ul>
                <p>
                    <strong>If you are a mentor,</strong> we also collect your professional details (current role,
                    discipline, sectors, years of experience, languages, why you want to mentor, the kind of career
                    transition you made), whether you live in India or abroad, and your Calendly booking links. To pay
                    you, we keep your payout details (UPI ID or bank account and IFSC, or how you're paid abroad, and
                    your PAN) — these are used only to pay you and are seen only by our team. Before we approve you,
                    you take a short test: your answers and the short video you record are stored privately, seen
                    only by our team, and the video is deleted once we approve or decline you, and within 30 days at
                    most. Your signed Mentor Agreement — the scan or photo you upload — is kept for as long as you
                    mentor with us and seen only by you and our team. Students see only your name, current role and
                    discipline, and your Calendly links once they're matched with you.
                </p>
            </>
        ),
    },
    {
        id: "why",
        title: "Why we use it",
        body: (
            <>
                <p>Every use is tied to delivering the service you signed up for:</p>
                <ul>
                    <li>creating and securing your account, and verifying your email address;</li>
                    <li>building your profile, ranking careers that fit you and writing your report;</li>
                    <li>finding and arranging your mentor, and contacting you about it (including on WhatsApp);</li>
                    <li>taking payments, handling refunds, coupons and financial-aid requests;</li>
                    <li>sending service emails (verification, password resets, updates about your report or mentor);</li>
                    <li>keeping the service safe, fixing problems, and meeting our legal obligations;</li>
                    <li>
                        improving how well our matches work — for example, asking you later how your chosen path is
                        going. We use this to check our method, never to sell to you.
                    </li>
                </ul>
                <p>
                    <strong>We do not sell your data. We do not use it for advertising.</strong> We do not track,
                    behaviourally monitor or target advertising at children.
                </p>
                <p>
                    We process your data on the basis of your consent, which you give when you create your
                    account (and, for under-18s, with your parent's permission), and where the DPDP Act otherwise
                    allows it — for example, to comply with a law.
                </p>
            </>
        ),
    },
    {
        id: "sensitive",
        title: "Sensitive answers: disability and difficult experiences",
        body: (
            <>
                <p>
                    Virtual Career Counselling asks whether you have a disability and whether you or your family have been
                    through difficult or traumatic experiences. Every one of these questions has a "Prefer not to
                    say" answer, and the details box is always up to you.
                </p>
                <p>
                    <strong>Disability.</strong> If you tell us about a difficulty that would make a timed or
                    on-screen test harder, we use it to let you skip that test — it is then marked "not measured",
                    never counted as low — and, once our team has checked it, to show you the support you are
                    entitled to (reserved seats, a scribe, extra exam time). We share it with your mentor only if
                    you tick the box that says they can know. It is <strong>never used to rank or remove a
                    career</strong>.
                </p>
                <p>
                    <strong>Difficult experiences (trauma).</strong> These answers are kept, and are{" "}
                    <strong>not used for anything today</strong> — not in your scores, not in your matches, not in
                    your report, and they are never sent to the AI services we use. We keep them because we intend
                    to build support features around them, and only after those have been reviewed; we will update
                    this policy, and tell you, before they are used for anything. They are never shared, and you can
                    ask us to delete them at any time without deleting the rest of your account.
                </p>
            </>
        ),
    },
    {
        id: "children",
        title: "Children and parental consent",
        body: (
            <>
                <p>
                    Many of our users are under 18. The DPDP Act requires the verifiable consent of a parent or
                    lawful guardian before we process a child's personal data, and we take that seriously.
                </p>
                <p>
                    <strong>How it works:</strong> a student under 18 confirms that they have their parent or
                    guardian's permission and gives that parent's name, mobile number and email address. We then
                    email the <strong>parent</strong> a 6-digit code; the parent confirms by giving that code back
                    (or entering it themselves). We record each step with the time, the IP address and the version
                    of this policy that applied. Until the parent has confirmed, nothing can be paid for.
                </p>
                <p>
                    Students who signed up before this step existed are asked to have their parent confirm in the
                    same way. Confirmation by SMS is coming later.
                </p>
                <p>
                    <strong>Parents and guardians</strong> can at any time ask to see their child's data, withdraw
                    consent, or have the account and its data deleted — contact us using the details in{" "}
                    <a href="#contact">Contact and grievances</a>.
                </p>
                <p>
                    Results are shared with the student who took the assessment. We never use a child's data for
                    tracking, behavioural monitoring or targeted advertising.
                </p>
            </>
        ),
    },
    {
        id: "who-helps",
        title: "Who helps us (processors)",
        body: (
            <>
                <p>
                    We use a small number of service providers ("Data Processors") who process data only on our
                    instructions and only to provide their service to us:
                </p>
                <div className="table-scroll">
                    <table>
                        <thead>
                            <tr><th>Provider</th><th>What they do for us</th></tr>
                        </thead>
                        <tbody>
                            <tr><td>Anthropic</td><td>AI that grades written answers, reads uploaded test-result screenshots and drafts your report; reads a résumé you attach to list its activities (the file is not kept)</td></tr>
                            <tr><td>Voyage AI</td><td>Text matching between your answers and careers</td></tr>
                            <tr><td>MongoDB Atlas</td><td>Our database</td></tr>
                            <tr><td>Render</td><td>Hosting for the website and servers</td></tr>
                            <tr><td>Cloudflare</td><td>Domain name (DNS) services, and the spam check on the sign-up form (Turnstile)</td></tr>
                            <tr><td>Resend</td><td>Sending service emails</td></tr>
                            <tr><td>Google</td><td>"Sign in with Google", if you choose it</td></tr>
                            <tr><td>Razorpay</td><td>Card, UPI and bank payments, once online payments are switched on</td></tr>
                        </tbody>
                    </table>
                </div>
                <p>
                    <strong>Transfers outside India:</strong> some of these providers process data outside India
                    (for example in the United States). The DPDP Act allows this except to countries the
                    Government of India restricts, and we will stop any such transfer if a restriction applies.
                </p>
                <p>
                    We also share data where the law requires it — for example, with a court or government
                    authority acting lawfully. When we match you with a mentor, we share only what they need to
                    prepare: your first name, the career and role you chose, what you'd like to know, the languages
                    you're comfortable in, and a few highlights from your Virtual Career Counselling (your interests,
                    achievements, challenges and education — never your family details or beliefs, and support needs
                    only if you chose to share them with a mentor). Your WhatsApp number <em>or</em> email — whichever
                    you choose — is shared only with your agreement, and only after the mentor has agreed to keep it
                    private and use it just to arrange and hold your sessions.
                    Reviews you leave after a session, and any report about a mentor, are seen by our team only.
                </p>
                <p>
                    <strong>Study-abroad partner — only if you ask.</strong> If studying abroad helps for one of your
                    top career matches, your report offers to connect you with a study-abroad partner. We share your
                    name, email, phone and those careers with that partner only after you tick the box agreeing to it
                    and press "Connect me". You can ask us to withdraw this at any time.
                </p>
                <p>
                    <strong>Your plans to go abroad.</strong> If you tell us in Virtual Career Counselling that you hope to
                    study or work outside India, we use that only to show you how each of your careers
                    travels and what those countries ask first, and to offer the study-abroad partner above. It is
                    never used to rank your careers, and it is shared with no one unless you ask to be connected.
                </p>
                <p>
                    <strong>"How else can we help?" — only if you ask.</strong> After you have chosen a career, we
                    ask whether you'd like help with a starter skill kit, internships and jobs, a master's or
                    settling abroad, or anything else. If you tick the box and join that waitlist, we use your name,
                    email, phone and answers to call you, and — only if you ask — to introduce you to a partner
                    affiliate. You can ask us to remove you at any time.
                </p>
                <p>
                    <strong>Voice typing.</strong> If you press the microphone beside an answer, your browser's own
                    speech service (for example Google's, in Chrome) turns what you say into text. We receive only
                    that text, which you can read and edit before it is saved — never any audio. Whether you type or
                    speak, in English, Hindi or Hinglish, our AI processor (Anthropic) may restate each activity as a
                    short English name (for example "playing cricket") so it can be matched to careers.
                </p>
            </>
        ),
    },
    {
        id: "demo",
        title: "The demo, and a résumé you attach",
        body: (
            <>
                <p>
                    "Try a Free Demo" is a short taste you can start without an account. It keeps your first name,
                    what you tell us about yourself and why it stuck, and a short result from its three quick tasks
                    (never your individual answers or timings). We keep no address, device details or cookies for it,
                    and nothing for advertising.
                </p>
                <p>
                    <strong>Seeing your result needs an account.</strong> Before the result you sign up — the same
                    details as on our sign-up page, including where you are now (school, college or work) and, if you
                    are under 18, your parent or guardian's details and permission — and confirm your email with a
                    6-digit code we send; or you log in, if your email already has an account. Your account is made only
                    when you type that code. You then see the result signed in, and the demo is linked to your account.
                    If you stop before this step, no account is made and the demo is deleted with the rest after 30 days.
                </p>
                <p>
                    <strong>Your résumé.</strong> Right after your first name in the demo, and at the start of Virtual Career
                    Counselling, you can attach a résumé (PDF, Word or a photo). Our AI processor (Anthropic) reads it
                    once to list the activities in it — short names like "Debating". In the demo they go into your
                    answers, where you remove or add to them; in Virtual Career Counselling they are shown first in each
                    stage's activity list, kept only in your browser, until you write them in yourself. The file itself
                    is never stored, by us or in our database. We ask the AI to leave out names, schools, companies and
                    contact details, and we check its answer for them again.
                </p>
                <p>
                    <strong>How long:</strong> a demo is deleted by itself after 30 days. If you later sign up and pay
                    with the same, confirmed email, your dashboard offers to carry what you told us into your Virtual
                    Career Counselling and to keep the demo's two careers on your account for choosing a mentor — you
                    choose, and either way the demo is then deleted. Nothing the demo's tasks measured is carried.
                </p>
                <p>
                    What you type may also help us improve our career data — the activities that point to careers,
                    and professions we don't cover yet — kept as the words alone, never with your name or email.
                </p>
            </>
        ),
    },
    {
        id: "retention",
        title: "How long we keep it",
        body: (
            <>
                <p>
                    We keep your data while your account is active and for as long as we need it to deliver the
                    service and check that our matches worked. When you ask us to delete your account, we erase
                    your personal data within 30 days, except:
                </p>
                <ul>
                    <li>payment and refund records, which Indian tax and accounting law requires us to keep;</li>
                    <li>logs, which we keep for at least one year as the DPDP Rules require;</li>
                    <li>anything we must keep because of a legal claim or a lawful request.</li>
                </ul>
                <p>Uploaded screenshots are never kept at all (see above).</p>
            </>
        ),
    },
    {
        id: "rights",
        title: "Your rights",
        body: (
            <>
                <p>Under the DPDP Act you can:</p>
                <ul>
                    <li><strong>ask for a summary</strong> of the personal data we hold about you and who we've shared it with;</li>
                    <li><strong>correct, complete or update</strong> it;</li>
                    <li><strong>have it erased</strong>, unless the law requires us to keep it;</li>
                    <li><strong>withdraw your consent</strong> at any time — as easily as you gave it. Withdrawing doesn't undo processing already done, and we won't be able to continue the service without the data it needs;</li>
                    <li><strong>nominate someone</strong> to exercise these rights for you if you die or become unable to;</li>
                    <li><strong>complain to us</strong> and have your grievance answered.</li>
                </ul>
                <p>
                    To use any of these rights, contact us using the details below from the email or phone number
                    on your account (a parent can do this for a child). We may need to confirm it's you. We aim to
                    respond within 30 days, and never later than the period the DPDP Rules allow.
                </p>
            </>
        ),
    },
    {
        id: "security",
        title: "Security and breaches",
        body: (
            <>
                <p>
                    Data travels over encrypted connections (HTTPS). Passwords are stored only as secure hashes.
                    Access to student data is limited to the people who need it to run the service, and provider
                    accounts are protected by strong credentials.
                </p>
                <p>
                    No system is perfectly secure. If a personal data breach happens, we will inform the Data
                    Protection Board of India and the people affected, without delay and in the manner the DPDP
                    Rules require, and tell you what we are doing about it and what you can do.
                </p>
            </>
        ),
    },
    {
        id: "changes",
        title: "Changes to this policy",
        body: (
            <p>
                If we change this policy we will update the date at the top and, for significant changes, tell you
                by email or when you next sign in. Where a change needs fresh consent, we will ask for it.
            </p>
        ),
    },
    {
        id: "contact",
        title: "Contact and grievances",
        body: (
            <>
                <p>
                    <strong>Grievance Officer:</strong> Luv Goel
                    <br />
                    Email: <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>
                    <br />
                    WhatsApp / Call: <a href={`tel:${COMPANY.phone}`}>{COMPANY.phone}</a>
                    <br />
                    Post: {COMPANY.name}, {COMPANY.address}
                </p>
                <p>
                    If you're not satisfied with our answer, you can complain to the{" "}
                    <strong>Data Protection Board of India</strong> after first raising it with us.
                </p>
                <p>See also our <Link to="/terms">Terms and Conditions</Link>.</p>
            </>
        ),
    },
]

function Privacy() {
    return (
        <LegalPage
            title="Privacy Policy"
            intro={(
                <p className="legal-intro">
                    In short: we collect what we need to match you to careers and mentors, we don't sell it or use
                    it for ads, students under 18 need a parent's permission, and you can see, correct or delete
                    your data at any time.
                </p>
            )}
            sections={SECTIONS}
        />
    )
}

export default Privacy
