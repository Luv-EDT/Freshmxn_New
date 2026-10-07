// The report's shared framing (Round 19): the sixteen tier names (Round 20), the per-journey wording and
// small helpers, used by the report overview (ReportPage.js) and the matches page (MatchesPage.js).
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

// ── THE SIXTEEN TIERS, MADE VISIBLE (owner, Round 20) ───────────────────────────────────────────
//
// `tiers.js` sorts every profession into one of sixteen tiers from three signals, and since Round 20
// the matches page shows them as headed groups when the list is opened — only the tiers that have
// careers in them. Until then five bands stood in for them; students could not see why a career sat
// where it did. A ranking a student cannot interrogate is just an opinion with a number on it.
//
// The three signals (see Backend/matching/tiers.js):
//
//   list      A = something you have done for a long time points here
//             B = something you do now points here, for a reason that drives you
//             C = something you do now points here, for other reasons
//   comfort   does the profile fit what the work demands — tiers 1-11 "fits you now", 12-16 "build
//             skills first"
//   evidence  passion → achievement → expressed confidence, in that order of weight.
//
// CRISP LABELS (owner, Round 24): two or three words each — "proven" = you have achieved at it,
// "confident" = you said you are sure, "passion" = you love it. "A stretch …" told a student nothing; the
// not-a-fit tiers now sit under one band, "Build skills first", shown once above them (`buildFirst`).
export const TIER_NAMES = [
    { tier: 1, name: "Proven long-time passion", buildFirst: false },
    { tier: 2, name: "Proven current passion", buildFirst: false },
    { tier: 3, name: "Confident long-time passion", buildFirst: false },
    { tier: 4, name: "Confident current passion", buildFirst: false },
    { tier: 5, name: "Long-time passion", buildFirst: false },
    { tier: 6, name: "Current passion", buildFirst: false },
    { tier: 7, name: "Long-time achievement", buildFirst: false },
    { tier: 8, name: "Current achievement", buildFirst: false },
    { tier: 9, name: "Long-time interest", buildFirst: false },
    { tier: 10, name: "Current interest", buildFirst: false },
    { tier: 11, name: "Other interests", buildFirst: false },
    { tier: 12, name: "Long-time favourites", buildFirst: true },
    { tier: 13, name: "Current favourites", buildFirst: true },
    { tier: 14, name: "Long-time interests", buildFirst: true },
    { tier: 15, name: "Current interests", buildFirst: true },
    { tier: 16, name: "Other interests", buildFirst: true },
]

// the band above the not-a-fit tiers, and the one line under it
export const BUILD_FIRST_TITLE = "Build skills first"
export const BUILD_FIRST_NOTE = "These link to what you do, but ask for more than your profile shows today — skills you can build."

// the heading a tier is shown under, and the words "why it ranked there" uses
export const tierNameFor = (tier) => {
    const found = TIER_NAMES.find((row) => row.tier === tier)
    return found ? found.name : null
}

// tiers 12-16: the work asks for more than the profile shows today
export const buildFirstFor = (tier) => {
    const found = TIER_NAMES.find((row) => row.tier === tier)
    return Boolean(found && found.buildFirst)
}


// "a, b and c" — because "spatial thinking, reasoning" reads like a truncated list rather than a
// finished sentence, and these strings sit inside prose.
// how many careers show before "Show the other N" (owner, Round 13; three since Round 18)
export const TOP_SHOWN = 3


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
