import { useNavigate } from "react-router-dom"

// The Tier 1 → Tier 2 upgrade prompt — Stage 4C.
//
// IT NAMES THE STUDENT'S OWN PROFESSIONS, and that is the whole design. "Upgrade to Mentorship" is
// a generic ask that could appear on any product; "talk to someone who actually works as a marine
// biologist" is an offer about the thing they just read. The professions come from their own
// ranking, so the CTA cannot promise a mentor in a field the report did not raise.
//
// IT IS SHOWN ONLY TO TIER 1, AND ONLY AFTER THE REPORT EXISTS. Selling the next tier to someone
// who has not yet seen what they paid for is the behaviour that makes a product feel like it is
// working against them, and the report is also the only place the offer can be specific.
//
// NO FALSE SCARCITY, NO COUNTDOWN, NO "MOST POPULAR" BADGE. Most readers here are minors, several
// are spending family money, and a manufactured deadline on a career decision is indefensible. The
// offer is stated once, plainly, with what it costs and what it does.

function UpgradeToMentorship({ user, professions = [], compact = false }) {
    const navigate = useNavigate()

    // Tier 2 already: nothing to sell.
    if (!user || user.currentTier !== 1) return null

    const named = professions.filter(Boolean).slice(0, 3)

    if (compact) {
        return (
            <p>
                <button
                    type="button"
                    style={{ padding: "12px 18px", minHeight: "44px", fontSize: "16px" }}
                    onClick={() => navigate("/mentorship")}
                >
                    Add a mentor to your plan
                </button>
            </p>
        )
    }

    return (
        <div style={{ border: "1px solid #999", padding: "16px", margin: "24px 0", maxWidth: "620px" }}>
            <h2 style={{ marginTop: 0 }}>Talk it through with someone who has done it</h2>

            {named.length > 0 ? (
                <p>
                    Your report puts <strong>{named.join(", ")}</strong> near the top. Tier 2 pairs you
                    with someone working in one of them — not a careers advisor, someone who actually
                    does the job.
                </p>
            ) : (
                <p>
                    Tier 2 pairs you with someone working in one of the professions your report
                    raised — not a careers advisor, someone who actually does the job.
                </p>
            )}

            <p>
                A report can tell you a path fits. It cannot tell you what the first two years are
                really like, which entrance exams matter, or what people in that field wish they had
                known at your age. That is the part a conversation is for.
            </p>

            <p>
                <em>
                    Your report does not change if you stay on Tier 1 — nothing in it is held back.
                    This adds a person, not a section.
                </em>
            </p>

            <button
                type="button"
                style={{ padding: "12px 20px", minHeight: "48px", fontSize: "16px" }}
                onClick={() => navigate("/mentorship")}
            >
                See what Tier 2 includes
            </button>
        </div>
    )
}

export default UpgradeToMentorship
