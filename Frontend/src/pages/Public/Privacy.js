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
                        <strong>Your answers:</strong> everything you tell us in the interest form (interests,
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
                    transition you made) and, for payouts only, your preferred currency and country of residence.
                    Students see only your name, current role and discipline.
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
        id: "children",
        title: "Children and parental consent",
        body: (
            <>
                <p>
                    Many of our users are under 18. The DPDP Act requires the verifiable consent of a parent or
                    lawful guardian before we process a child's personal data, and we take that seriously.
                </p>
                <p>
                    <strong>How it works today:</strong> a student under 18 must confirm that they have their
                    parent or guardian's permission and give that parent's name and mobile number. We record the
                    confirmation with the time, the IP address and the version of this policy that applied. We may
                    contact the parent to confirm.
                </p>
                <p>
                    <strong>What is coming:</strong> we are introducing a verified parental consent step, in which
                    the parent confirms directly. When it launches, we will ask existing under-18 users' parents to
                    confirm through it.
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
                            <tr><td>Anthropic</td><td>AI that grades written answers, reads uploaded test-result screenshots and drafts your report</td></tr>
                            <tr><td>Voyage AI</td><td>Text matching between your answers and careers</td></tr>
                            <tr><td>MongoDB Atlas</td><td>Our database</td></tr>
                            <tr><td>Upstash</td><td>The job queue that runs scoring and report generation</td></tr>
                            <tr><td>Render</td><td>Hosting for the website and servers</td></tr>
                            <tr><td>Cloudflare</td><td>Domain name (DNS) services</td></tr>
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
                    prepare, such as your name and the career you chose.
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
