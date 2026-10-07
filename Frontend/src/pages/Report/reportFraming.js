// The report's shared framing (Round 19): the five bands, the per-journey wording and two small
// helpers, used by the report overview (ReportPage.js) and the matches page (MatchesPage.js).
//
// Stage 3 — the report.
//
// THE LIST IS THE REPORT. An earlier version opened with about 1,500 words of prose and then listed
// professions four lines at a time; a fifteen-year-old scrolled past all of it. Now the prose is
// four short paragraphs, the list is headings, and everything the taxonomy knows about a profession
// lives one tap away inside it. A report nobody reads is worth the same as no report.
//
// THREE RELEASE STATES, and they are the point rather than an edge case:
//   release            the full picture
//   release_with_note  findings shown, plus what is still missing and what completing it buys
//   withhold           below 75% of the matching vector. The completion prompt INSTEAD of findings,
//                      because a confident-looking report built on a fifth of the evidence is worse
//                      than no report.
//
// ONE LIST, TWO ORDERS (owner, Round 6). DECISIONS.md §5 is explicit that fit × switching-cost makes
// the engine structurally timid — it will never advise the hard change even when that is the true
// answer. The worth-the-switch careers used to be a second list under their own heading; students
// could not tell the headings apart. Now they are one tap away as a primary sort, "Best fit, ignoring
// switching cost", which adds them to the same list with the cost shown inside each card.
//
// match_confidence is already stripped by reportsRouter, and every factor slug is already
// translated there. Nothing here needs to know either exists.

// ── THE SIXTEEN TIERS, MADE VISIBLE ─────────────────────────────────────────────────────────────
//
// `tiers.js` sorts every profession into one of sixteen buckets from three signals. Sixteen
// headings on a screen would be noise, so they collapse into five bands — and since Round 6 the
// bands are no longer headings in the list at all (students could not tell them apart). The RULE
// behind each one is shown inside "How this list is ordered", because a ranking a student cannot
// interrogate is just an opinion with a number on it.
//
// The three signals, and the exact tier boundaries they produce (see Backend/matching/tiers.js):
//
//   list      A = something you have pursued long-term points here
//             B = something you do now points here
//             C = neither; it reached you on profile alone
//   comfort   does the psychometric profile clear 0.7 against what the work demands
//             (tiers 1-11 yes, 12-16 no)
//   evidence  passion → achievement → expressed confidence, in that order of weight.
//             "Loved it" beats "won at it" beats "sure about it", and self-report ranks last
//             because it is the softest of the three.
export const TIER_GROUPS = [
    {
        upTo: 2,
        label: "Strongest matches",
        why: "You love the thing that leads here, you have achieved something in it, and it fits how you think and work.",
    },
    {
        upTo: 6,
        label: "Strong matches",
        why: "Something you do points here and it fits your profile. You said you love it.",
    },
    {
        upTo: 8,
        label: "Worth a look",
        why: "You have achieved something that points here and it fits your profile — even though you did not mark it as a passion.",
    },
    {
        upTo: 11,
        label: "Fits how you work",
        why: "The profile fit is there and something connects you to it, but there is no passion or achievement behind it yet.",
    },
    {
        upTo: 16,
        label: "Further from your current shape",
        why: "Reachable, and something links you to it — but the way this work is usually done sits further from how you currently work.",
    },
]


// "a, b and c" — because "spatial thinking, reasoning" reads like a truncated list rather than a
// finished sentence, and these strings sit inside prose.
// how many careers show before "Show the other N" (owner, Round 13; three since Round 18)
export const TOP_SHOWN = 3

// the band a tier sits in, for "why it ranked there"
export const tierGroupFor = (tier) => (typeof tier === "number" ? TIER_GROUPS.find((group) => tier <= group.upTo) : null)

export const listOf = (items) => {
    if (items.length === 0) return ""
    if (items.length === 1) return items[0]
    return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`
}

// THE FOUR JOURNEYS DO NOT GET THE SAME REPORT, and the difference is not decoration.
//
// "Worth the switch" is the clearest case. For a class 9-10 student nothing has been invested yet,
// so there is nothing to switch FROM — the heading is meaningless and the framing implies they have
// already committed to something, which is exactly the anxiety the product should not create. For
// someone four years into a job it is the most important section on the page.
//
// The engine already knows this: τ is Infinity for class9_10, so the switching-cost multiplier is
// exactly 1.0 and both lists come out identical. Showing them as two lists with different
// explanations would be presenting the same ranking twice and implying a distinction the maths did
// not make.
export const JOURNEY_FRAMING = {
    class9_10: {
        switchHeading: "Worth knowing about",
        switchIntro: "Nothing is decided at your stage, so nothing here costs you anything to consider. These are the strongest fits full stop.",
        // Both lists are the same ranking when nothing is sunk. Say so instead of staging a contrast.
        switchIsDistinct: false,
        runwayNote: "Years to qualify counts from the end of school, so it is the same for everyone your age — it is about the path, not about you being behind.",
    },
    class11_12: {
        switchHeading: "Worth the switch",
        switchIntro: "The strongest fits even if they need a different stream or an extra subject — still possible at your stage.",
        switchIsDistinct: true,
        runwayNote: null,
    },
    college: {
        switchHeading: "Worth the switch",
        switchIntro: "The strongest fits even if changing course would cost you time — because the safe answer is not always the right one.",
        switchIsDistinct: true,
        runwayNote: null,
    },
    early_professional: {
        switchHeading: "Worth the switch",
        switchIntro: "The strongest fits even if leaving your current track would cost you time. Work skills carry further between fields than qualifications do.",
        switchIsDistinct: true,
        runwayNote: null,
    },
}

export const framingFor = (journey) => JOURNEY_FRAMING[journey] || JOURNEY_FRAMING.college
