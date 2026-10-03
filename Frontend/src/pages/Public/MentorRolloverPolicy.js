import usePricing, { formatInr } from "./usePricing"

// Verbatim from mentor_waitlist_page.md. Shown on the public waitlist page AND on the student's own
// /mentorship page, so the promise a student paid against is word-for-word the one they see after.
//
// "Your money back" means MOVING BACK TO CAREER DISCOVERY and getting the difference — the Tier 2 →
// Tier 1 refund the refund tooling actually performs (owner, Round 10). The old line promised a
// refund "in full", which no code path did. The amount is the server's upgrade price, never typed.
//
// Mentor Only (Round 12) has nothing to move back to, so its promise is a full refund on request
// (owner). The public page shows both; a student's own page shows the one for their plan.
function MentorRolloverPolicy({ mentorOnly = false, both = false }) {
    const { upgrade, tier3, names } = usePricing()

    const mentorOnlyLine = (
        <p>
            <strong>{names[3]}: if we can't match you, a full refund on request.</strong> If we cannot find a
            suitable mentor within 20 business days, we keep searching for as long as you like — or ask us and we'll
            refund the full {formatInr(tier3)}.
        </p>
    )

    if (mentorOnly) return mentorOnlyLine

    return (
        <>
        <p>
            <strong>If we can't match you — rollover first, refund on request.</strong> If we cannot find a
            suitable mentor in your chosen field within 20 business days, your payment <strong>rolls over</strong>:
            we keep searching, or you can redirect it to a mentor for a <em>different</em> career from your
            matches. Prefer your money back instead? <strong>Ask us and we'll move you back to Career Discovery
            and refund the difference — {formatInr(upgrade)} — no questions.</strong> You keep everything Career
            Discovery gives you, and you're never out of pocket for a match we couldn't make.
        </p>
        {both && mentorOnlyLine}
        </>
    )
}

export default MentorRolloverPolicy
