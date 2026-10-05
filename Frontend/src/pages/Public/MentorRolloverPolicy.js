import usePricing, { formatInr } from "./usePricing"

// Matches mentor_waitlist_page.md. Shown on the public waitlist page AND on the student's own
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

    // Round 17 (owner): said once, in short sentences — the same promise, without the repeats
    const mentorOnlyLine = (
        <p>
            <strong>{names[3]}: if we can't find you a mentor in 20 business days,</strong> we keep looking for as
            long as you like — or ask, and we'll refund the full {formatInr(tier3)}.
        </p>
    )

    if (mentorOnly) return mentorOnlyLine

    return (
        <>
        <p>
            <strong>If we can't find you a mentor in 20 business days,</strong> we keep looking — or you can switch to a
            different career from your matches. Prefer a refund? We'll move you back to Career Discovery and refund the
            difference ({formatInr(upgrade)}). You keep everything from Career Discovery.
        </p>
        {both && mentorOnlyLine}
        </>
    )
}

export default MentorRolloverPolicy
