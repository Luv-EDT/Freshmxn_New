// THE DEMO'S RESULT — the real engines with fewer inputs (owner, Round 32). Nothing here is a new
// algorithm, and none of the real files is changed to make it work:
//
//     the visitor's words  → the real activity resolver → candidate careers   (interests lead)
//     8 Openness answers   → the real scoreProfile()    → raw_scores.openness   (a real IPIP-50 score)
//     6 reasoning puzzles  → their share right, 0-10    → raw_scores.reasoning  (in memory only)
//     all of it            → the real matchProfile()    → tiers, then fit on the two factors
//
// THE 25 OTHER FACTORS ARE SIMPLY MISSING, and matching already handles that: a missing factor is
// skipped and the fit renormalises over what was measured (similarity.js). Every one of the 223 careers
// weights openness or reasoning, so every candidate gets a fit — a light sort, as the owner asked.
//
// WHY THE REASONING TASTE IS NOT THE REAL SCORER'S. The real scorer (scoring/reasoningInHouse.js)
// refuses fewer than 16 answers on purpose — an unfinished test is "not measured". The demo's taste is
// the same share (right ÷ answered × 10) over six puzzles, labelled "6 of 16", used only to sort the two
// careers here, and never written to any profile. A student who buys carries the six ANSWERS into the
// real test and finishes it there; the real scorer then scores all sixteen.
//
// Pure apart from the resolver it is given — the fixtures pass a stub.
const scoreProfile = require("../scoring/scoreProfile")
const matchProfile = require("../matching/matchProfile")
const { studentFacing } = require("../Routers/professionsRouter")
const { levelFor } = require("../Routers/reportsRouter")
const { stripInternal } = require("./strip")
const { DEMO_REASONING_ITEMS } = require("./reasoningMarks")

// eight of the ten real Openness items — the real scorer needs 8 of 10 (0.8 coverage) to score a trait,
// so this is the fewest that gives a real score. O7 ("quick to understand") and O8 ("use difficult
// words") are left for the full assessment.
const OPENNESS_ITEMS = ["IPIP_O1", "IPIP_O2", "IPIP_O3", "IPIP_O4", "IPIP_O5", "IPIP_O6", "IPIP_O9", "IPIP_O10"]
const ANSWER_LETTERS = ["A", "B", "C", "D", "E"]

const keyOf = (text) => String(text || "").trim().replace(/\s+/g, " ").toLowerCase()

// THE INTEREST OBJECT PROGRAM 1 READS (matching/program1.js), built from the two open questions:
// everything that pulls them → persistentInterests; what stuck → longTermPursuits (list A); why it
// stuck → the four real "why" groups (dominant reasons → lists B/C); the profession they named →
// aspirationalProfessions (seeds that career directly when it is one of ours).
const demoInterest = (interests = {}) => {
    const draws = interests.draws || []
    const aspiration = interests.aspiration && interests.aspiration.text ? interests.aspiration : null
    const reasons = { curiosityDriven: [], personalGrowth: [], socialRecognition: [], effortlessEngagement: [] }
    ;(interests.stuck || []).forEach((row) => (row.reasons || []).forEach((reason) => {
        if (reasons[reason]) reasons[reason].push(row.text)
    }))

    return {
        highSchool: reasons,
        currentInterests: {
            persistentInterests: [
                ...draws.map((draw) => ({ activity: draw.text, confidence: null, source: "activity" })),
                ...(aspiration ? [{ activity: aspiration.text, confidence: null, source: "aspiration" }] : []),
            ],
            longTermPursuits: (interests.stuck || []).map((row) => row.text),
            passion: [],
            achievementRelated: [],
        },
        aspirationalProfessions: aspiration ? [{ professionText: aspiration.text, professionId: aspiration.professionId || null }] : [],
    }
}

const reasoningRight = (block) => ((block && block.responses) || []).filter((response) => response.correct === true).length

// the share right, 0-10 — the real scorer's own formula, over the six
const reasoningTaste = (block) => {
    const responses = (block && block.responses) || []
    if (responses.length < DEMO_REASONING_ITEMS) return null
    return Math.round((reasoningRight(block) / responses.length) * 10 * 100) / 100
}

// a career's facts for the card — the real studentFacing record, without the going-abroad parts (their
// waitlist button needs an account)
const demoDetail = (profession) => {
    if (!profession) return null
    const { abroad, goingAbroad, ...detail } = studentFacing(profession)
    return { ...detail, abroad: null, goingAbroad: null }
}

const runDemo = async ({ session, resolver, data }) => {
    const interests = session.interests || {}
    const interest = demoInterest(interests)

    const profile = scoreProfile({ ipip50: { answers: session.openness || {} } })
    profile.raw_scores.reasoning = reasoningTaste(session.reasoning)

    const rows = interest.currentInterests.persistentInterests
        .filter((row) => keyOf(row.activity) !== "")
        .map((row) => ({ activity: row.activity, key: keyOf(row.activity) }))

    let resolved = []
    try {
        resolved = (await resolver.resolveActivities(rows)).filter((row) => !row.unresolved)
    } catch (error) {
        console.error(`demo: activity resolution failed — ${error.message.slice(0, 160)}`)
    }

    const match = matchProfile({
        profile,
        interest,
        user: {},
        professions: data.professions.professions,
        baseline: data.baseline,
        resolvedActivities: resolved,
    })

    const byId = new Map(data.professions.professions.map((profession) => [profession.id, profession]))
    const saidAs = new Map([...(interests.draws || []), ...(interests.aspiration ? [interests.aspiration] : [])].map((row) => [keyOf(row.text), row.text]))
    const whyOf = new Map((interests.stuck || []).map((row) => [keyOf(row.text), row.why || ""]))

    // the two strongest, in Best match order — and the visitor's own words that led to each
    const careers = match.ranked.slice(0, 2).map((entry) => {
        const lead = (entry.matchedBy || [])[0]
        const key = lead ? keyOf(lead.key || lead.activity) : null
        return {
            entry: stripInternal(entry),
            words: key ? { said: saidAs.get(key) || lead.activity, why: whyOf.get(key) || "" } : null,
        }
    })

    // identity-free rows for our data processing (model/demoSignalsModel.js)
    const aspirationSignal = (match.aspirationSignals || [])[0]
    const signals = [
        ...resolved.map((row) => ({ text: row.activity, kind: "activity", matched: !row.unrateable && (row.candidateProfessionIds || []).length > 0, nearestCareerIds: (row.candidateProfessionIds || []).slice(0, 5) })),
        ...(interests.aspiration && interests.aspiration.text
            ? [{ text: interests.aspiration.text, kind: "aspiration", matched: !aspirationSignal || aspirationSignal.outcome !== "unmatched", nearestCareerIds: aspirationSignal && aspirationSignal.professionId ? [aspirationSignal.professionId] : [] }]
            : []),
    ]

    return {
        careers,
        details: Object.fromEntries(careers.map(({ entry }) => [entry.professionId, demoDetail(byId.get(entry.professionId))])),
        pointedTo: match.ranked.length,
        opennessLevel: levelFor(profile.raw_scores.openness),
        reasoningRight: reasoningRight(session.reasoning),
        signals,
    }
}

module.exports = { runDemo, demoInterest, reasoningTaste, demoDetail, OPENNESS_ITEMS, ANSWER_LETTERS, keyOf }
