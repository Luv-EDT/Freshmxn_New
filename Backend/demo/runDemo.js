// THE DEMO'S RESULT — the real engines with fewer inputs (owner, Rounds 32-33). Nothing here is a new
// algorithm, and none of the real files is changed to make it work:
//
//     the visitor's words   → the real activity resolver → candidate careers     (interests lead)
//     where they are now    → the journey matching reads  → what carries over, how long from here
//     the tastes (demoTaste.js: 7 MI statements, 4 puzzles, 90 s of SART)
//                           → raw_scores in memory        → the 10 factors they touch
//     all of it             → the real matchProfile()     → tiers, then fit on what was measured
//
// THE OTHER 21 FACTORS ARE SIMPLY MISSING, and matching already handles that: a missing factor is skipped
// and the fit renormalises over what was measured (similarity.js) — so the two careers come from the
// visitor's story first, and the tastes only order them. Nothing here is written to any profile.
//
// Pure apart from the resolver it is given — the fixtures pass a stub.
const scoreProfile = require("../scoring/scoreProfile")
const matchProfile = require("../matching/matchProfile")
const { studentFacing } = require("../Routers/professionsRouter")
const { levelFor } = require("../Routers/reportsRouter")
const { stripInternal } = require("./strip")
const { MEASURED_PCT } = require("./demoTaste")
const { PROBLEM_KEYS } = require("../model/demoSessionsModel")
const { FACTOR_GUIDE, GUIDE_GROUPS } = require("../utils/factorGuide")

const ANSWER_LETTERS = ["A", "B", "C", "D", "E"]
const STAGES = ["class9_10", "class11_12", "college", "early_professional"]

// where the visitor is now, as the journey matching reads it (Backend/matching/journey.js)
const stageUser = (stage) => {
    if (!stage || !STAGES.includes(stage.journey)) return {}
    const years = stage.journey === "early_professional" && typeof stage.years === "number" ? stage.years : null
    return { journey: stage.journey, journeyDetail: years === null ? {} : { experienceYears: years } }
}

// what the career card's "from where you stand" needs (the report's youFor, from a stage alone)
const youOf = (stage) => ({
    stage: stage && stage.journey ? stage.journey : null,
    preAdmission: false,
    courseYear: null,
    degreeYearsLeft: null,
    experienceYears: stage && typeof stage.years === "number" ? stage.years : null,
    hasDegree: Boolean(stage && stage.journey === "early_professional"),
})

const keyOf = (text) => String(text || "").trim().replace(/\s+/g, " ").toLowerCase()

// THE INTEREST OBJECT PROGRAM 1 READS (matching/program1.js), built from the two open questions:
// everything that pulls them → persistentInterests; what stuck → longTermPursuits (list A); why it
// stuck → the four real "why" groups (dominant reasons → lists B/C); the profession they named →
// aspirationalProfessions (seeds that career directly when it is one of ours).
const demoInterest = (interests = {}) => {
    const draws = interests.draws || []
    const aspiration = interests.aspiration && interests.aspiration.text ? interests.aspiration : null
    const reasons = { curiosityDriven: [], personalGrowth: [], socialRecognition: [], effortlessEngagement: [], individualInternalProblems: [], interpersonalInternalProblems: [], externalProblems: [] }
    // a "why" group lists the thing; a problem group (Round 33: "it helps me deal with a problem in my life")
    // is a row in the real form's shape — the problem, and the thing that helps with it
    ;(interests.stuck || []).forEach((row) => (row.reasons || []).forEach((reason) => {
        if (!reasons[reason]) return
        reasons[reason].push(PROBLEM_KEYS.includes(reason) ? { problem: row.text, source: "typed", activities: [row.text] } : row.text)
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

// every factor of the 31, grouped as the profile groups them: the ones the demo touched carry a word level
// and how much of them it measured; the rest are listed as not measured (owner: shown faded, at 0%)
const factorList = (scores) => GUIDE_GROUPS.map((group) => ({
    title: group.title,
    factors: group.factors.map((factor) => {
        const value = scores[factor]
        const measured = typeof value === "number" && MEASURED_PCT[factor]
        return {
            factor,
            name: (FACTOR_GUIDE[factor] || {}).name || factor,
            meaning: (FACTOR_GUIDE[factor] || {}).meaning || "",
            level: measured ? levelFor(value) : null,
            measuredPct: measured ? MEASURED_PCT[factor] : 0,
        }
    }),
}))

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
    const tastes = session.tastes || {}

    // the tastes, in memory only — the real profile shape with only these ten filled
    const profile = scoreProfile({})
    const scores = { ...(tastes.mi || {}), reasoning: tastes.reasoning, processing_speed: tastes.speed, focus: tastes.focus }
    Object.entries(scores).forEach(([factor, value]) => { profile.raw_scores[factor] = typeof value === "number" ? value : null })

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
        user: stageUser(session.stage),
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
    // what they wrote in "what you aspire to" is an aspiration for the scout (Round 33): "matched" when it is
    // the name of one of our careers or job roles, so the scout looks only at the ones we don't cover
    const aspired = new Set((interests.draws || []).filter((draw) => draw.when === "future").map((draw) => keyOf(draw.text)))
    const knownNames = new Set(data.professions.professions.flatMap((profession) => [profession.profession, ...(profession.job_roles || [])]).map(keyOf))
    const signals = [
        ...resolved.map((row) => (aspired.has(keyOf(row.activity))
            ? { text: row.activity, kind: "aspiration", matched: knownNames.has(keyOf(row.activity)), nearestCareerIds: (row.candidateProfessionIds || []).slice(0, 5) }
            : { text: row.activity, kind: "activity", matched: !row.unrateable && (row.candidateProfessionIds || []).length > 0, nearestCareerIds: (row.candidateProfessionIds || []).slice(0, 5) })),
        ...(interests.aspiration && interests.aspiration.text
            ? [{ text: interests.aspiration.text, kind: "aspiration", matched: !aspirationSignal || aspirationSignal.outcome !== "unmatched", nearestCareerIds: aspirationSignal && aspirationSignal.professionId ? [aspirationSignal.professionId] : [] }]
            : []),
    ]

    return {
        careers,
        details: Object.fromEntries(careers.map(({ entry }) => [entry.professionId, demoDetail(byId.get(entry.professionId))])),
        pointedTo: match.ranked.length,
        factors: factorList(scores),
        sart: tastes.sart || null,
        reasoningRight: tastes.reasoningRight,
        you: youOf(session.stage),
        signals,
    }
}

module.exports = { runDemo, demoInterest, demoDetail, stageUser, factorList, ANSWER_LETTERS, STAGES, keyOf }
