import { Link } from "react-router-dom"
import LegalPage, { COMPANY } from "./LegalPage"
import MentorRolloverPolicy from "./MentorRolloverPolicy"

// Terms and Conditions. Like the Privacy Policy, it describes the product as the code actually
// runs it — the tiers, the refund flow on the Profile page, and the mentor rollover policy quoted
// from the same component the waitlist and /mentorship pages show, so the three can never differ.
//
// ⚠ A DRAFT FOR LEGAL REVIEW, not legal advice.
const SECTIONS = [
    {
        id: "about",
        title: "About these terms",
        body: (
            <p>
                These terms are an agreement between you and <strong>{COMPANY.name}</strong> (CIN {COMPANY.cin}),
                registered at {COMPANY.address} ("Freshmxn", "we", "us"), for your use of Freshmxn's Lab at
                www.freshmxn.com. By creating an account you agree to these terms and to our{" "}
                <Link to="/privacy">Privacy Policy</Link>. If you don't agree, please don't use the service.
            </p>
        ),
    },
    {
        id: "service",
        title: "The service",
        body: (
            <>
                <p>Freshmxn's Lab offers two paid plans:</p>
                <ul>
                    <li>
                        <strong>Career Discovery + Full Profile</strong> — an interest form, a psychometric
                        assessment, your profile, and a report with your ranked career matches and a readiness guide.
                    </li>
                    <li>
                        <strong>Mentor Connection</strong> — everything above, plus two sessions with a working
                        professional in a career you choose from your matches (a 1-hour clarity session and a
                        20-minute follow-up), arranged by us.
                    </li>
                </ul>
                <p>
                    We may add, change or remove features over time. If a change materially reduces something you
                    have already paid for, we will tell you and offer a fair remedy.
                </p>
            </>
        ),
    },
    {
        id: "eligibility",
        title: "Who can use it",
        body: (
            <>
                <p>
                    The service is for students and early professionals in India. <strong>If you are under 18, you
                    need your parent or guardian's permission</strong> to use it, and you must give their name and
                    mobile number when you sign up. By continuing, your parent or guardian also agrees to these
                    terms on your behalf. We may contact them to confirm, and we will ask them to confirm through a
                    verified consent step once it launches.
                </p>
                <p>
                    You must give accurate information. Your results depend on it — a profile built on answers that
                    aren't yours isn't worth much to you.
                </p>
            </>
        ),
    },
    {
        id: "account",
        title: "Your account",
        body: (
            <p>
                Keep your password to yourself and tell us straight away if you think someone else has used your
                account. You're responsible for what happens under your account. One account is for one person —
                please don't share it or take the assessment for someone else.
            </p>
        ),
    },
    {
        id: "pricing",
        title: "Prices and payment",
        body: (
            <p>
                Prices are shown in Indian Rupees on the site (see <Link to="/how-it-works">How it works</Link>)
                and are the amount you pay at checkout. If you buy Career
                Discovery first, you can upgrade to Mentor Connection later by paying only the difference. Coupons
                and financial aid are offered at our discretion. Payments are made through our payment partner or
                arranged directly with our team; we never store your card or bank details.
            </p>
        ),
    },
    {
        id: "refunds",
        title: "Refunds",
        body: (
            <>
                <p>
                    <strong>Career Discovery:</strong> once your interest form, assessment and report have been
                    delivered, you can request a refund from your Profile page. Each request is reviewed
                    individually, and we'll tell you the outcome.
                </p>
                <p><strong>Mentor Connection:</strong></p>
                <blockquote className="legal-quote"><MentorRolloverPolicy /></blockquote>
                <p>
                    Nothing in these terms limits any refund you are entitled to under Indian consumer law.
                </p>
            </>
        ),
    },
    {
        id: "guidance",
        title: "Guidance, not guarantees",
        body: (
            <>
                <p>
                    Freshmxn's Lab gives <strong>guidance</strong>. Your profile and matches are based on your own
                    answers and are <strong>provisional</strong> — they describe you as you were when you answered,
                    not a fixed verdict.
                </p>
                <ul>
                    <li>
                        The assessment is <strong>not a clinical or psychological diagnosis</strong>, and it is not
                        a substitute for professional medical or mental-health advice.
                    </li>
                    <li>
                        Career information (pay, demand, exams, AI exposure) comes from published research and our
                        own analysis. It is our best reading, it can change, and it may not apply to every person
                        or place.
                    </li>
                    <li>
                        <strong>We don't guarantee admissions, jobs, earnings or any other outcome.</strong> The
                        decisions you make with our guidance are yours.
                    </li>
                </ul>
            </>
        ),
    },
    {
        id: "mentors",
        title: "Mentors",
        body: (
            <p>
                Mentors are independent working professionals, not our employees, and their views are their own.
                We check who they are and match them to you carefully, and we arrange the sessions. Please be
                respectful; tell us straight away if anything in a session makes you uncomfortable, and we will act
                on it.
            </p>
        ),
    },
    {
        id: "third-party",
        title: "Third-party tests and links",
        body: (
            <p>
                Parts of the assessment ask you to take free tests on third-party websites (for example
                AssessmentDay) and bring back your result. Those sites are run by others under their own terms
                and privacy policies, and we aren't responsible for them.
            </p>
        ),
    },
    {
        id: "acceptable-use",
        title: "Acceptable use",
        body: (
            <>
                <p>Please don't:</p>
                <ul>
                    <li>give false information, or use someone else's account or identity;</li>
                    <li>copy, scrape, resell or republish our reports, career data or content;</li>
                    <li>try to break, overload or get around the security of the service;</li>
                    <li>harass mentors, students or our team.</li>
                </ul>
                <p>We may suspend or close an account that breaks these rules.</p>
            </>
        ),
    },
    {
        id: "ip",
        title: "Our content and yours",
        body: (
            <p>
                The service, its design, career data, questions and report formats belong to us or our licensors.
                Your report is yours to keep and share for your own use. Your answers remain yours; you allow us to
                use them to provide the service, as described in the <Link to="/privacy">Privacy Policy</Link>.
            </p>
        ),
    },
    {
        id: "liability",
        title: "Liability",
        body: (
            <>
                <p>
                    We provide the service with reasonable care and skill, but "as is" beyond that. To the extent
                    the law allows, we aren't liable for indirect or consequential loss, or for decisions made on
                    the basis of our guidance, and our total liability to you is limited to the amount you paid us
                    in the 12 months before the claim.
                </p>
                <p>
                    Nothing here limits liability that cannot be limited under Indian law. You agree to be
                    responsible for loss caused to us by your breach of these terms or misuse of the service.
                </p>
            </>
        ),
    },
    {
        id: "ending",
        title: "Ending your account",
        body: (
            <p>
                You can stop using the service and ask us to delete your account at any time (see the{" "}
                <Link to="/privacy">Privacy Policy</Link>). We may suspend or close accounts that break these
                terms. Sections that by their nature should survive — such as refunds due, liability and
                governing law — continue after an account ends.
            </p>
        ),
    },
    {
        id: "changes",
        title: "Changes to these terms",
        body: (
            <p>
                We may update these terms. We will change the date at the top and, for significant changes, tell
                you by email or when you next sign in. Continuing to use the service after that means you accept
                the new terms.
            </p>
        ),
    },
    {
        id: "law",
        title: "Governing law and disputes",
        body: (
            <p>
                These terms are governed by the laws of India. Please talk to us first — most problems are solved
                with a message. If a dispute can't be resolved, the courts at Delhi have exclusive jurisdiction,
                without affecting your rights to approach a consumer commission.
            </p>
        ),
    },
    {
        id: "contact",
        title: "Contact",
        body: (
            <p>
                {COMPANY.name}
                <br />
                {COMPANY.address}
                <br />
                Email: <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a> · WhatsApp / Call:{" "}
                <a href={`tel:${COMPANY.phone}`}>{COMPANY.phone}</a>
            </p>
        ),
    },
]

function Terms() {
    return (
        <LegalPage
            title="Terms and Conditions"
            intro={(
                <p className="legal-intro">
                    In short: we give you honest, evidence-based career guidance and help you reach a mentor; it's
                    guidance, not a guarantee; under-18s need a parent's permission; and if we can't deliver a
                    mentor match, you're never out of pocket.
                </p>
            )}
            sections={SECTIONS}
        />
    )
}

export default Terms
