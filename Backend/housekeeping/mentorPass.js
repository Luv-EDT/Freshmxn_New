// CLAUDE'S MONTHLY LOOK AT WHAT MENTORS SAY (owner, Round 16; reworked Round 17) — run at the end of
// the data refresh on the 1st, so "Run now" for the refresh runs it too.
//
// THE OWNER'S FLOW:
//   1. Mentors send their sheets. Their opinions are STACKED per profession and topic — a section of
//      the sheet, or one quality — disagreements and "looks right" included. Kept for good; a mentor
//      answering a topic again replaces only their own earlier opinion on it.
//   2. Each month, for up to MENTOR_PASS_MAX professions, Claude weighs every topic that has NEW or
//      CHANGED input since it last looked — the whole stack for that topic, old and new, with each
//      mentor's years in the field, what we show today, and what it concluded and the admin decided
//      last time. A topic with nothing new is not asked again, so a rejected change only comes back
//      when new mentor input arrives.
//   3. MENTOR EXPERIENCE IS EVIDENCE. Claude may propose a change on mentors' consensus alone; web
//      sources (the refresh's public sources, official Indian domains, any page a mentor linked)
//      support a decision but are not required. One mentor's outlier against several who disagree is
//      not enough.
//   4. A proposed change becomes an ordinary proposal in admin → Data updates, marked as coming from
//      mentors, with the whole stack beside it:
//        pay / demand        → a "career" proposal (live on approval)
//        master's / abroad   → a "study_fact" proposal (live on approval)
//        everything else     → a "mentor_text" proposal: exact wording, which on approval goes to
//                              Export patch (mentorNotes) for Claude Code to write into the data files
//      The rule that a newer open proposal for the same thing replaces an older one keeps the refresh
//      and the mentors from ever putting two competing answers in front of the admin.
//   5. The admin approves or rejects. The stack stays. The admin's "Remove as wrong" on one opinion
//      is the only deletion (mentorReviewsRouter), and it is logged.
//
// Matching never reads any of this.

const taxonomy = require("../data/ALL-professions.json")
const abroadData = require("../data/abroad.json")
const { SOURCE_DOMAINS } = require("./claudeResearch")
const { validateProposal, currentValues } = require("./dataRefresh")
const { validateFactChange, hostOf, FACT_DOMAINS } = require("./studyRefresh")
const { FACTOR_LABELS } = require("../workers/reportComposer")

const maxProfessions = () => Number(process.env.MENTOR_PASS_MAX) || 20
const professionById = new Map(taxonomy.professions.map((profession) => [profession.id, profession]))

const CAREER_SECTIONS = { pay: ["early_earnings_lpa", "mid_career_lpa"], demand: ["india_demand"] }
const FACT_SECTIONS = { masters: "after_undergrad", abroad: "abroad" }
const CONFIDENCE = ["low", "medium", "high"]
const TEXT_MAX = 600

const timeOf = (value) => (value ? new Date(value).getTime() : 0)

// ── the stack ───────────────────────────────────────────────────────────────────────────────────

const topicOf = (opinion) => (opinion.section === "qualities" ? `qualities:${opinion.factor}` : opinion.section)
const ownerOf = (opinion) => `${String(opinion.mentor || "")}#${topicOf(opinion)}`
const sameWords = (left, right) => Boolean(left.agrees) === Boolean(right.agrees)
    && (left.direction || "") === (right.direction || "")
    && (left.note || "").trim() === (right.note || "").trim()
    && (left.sourceUrl || "") === (right.sourceUrl || "")

// the same opinion, however often it is re-sent (Round 16; still used to recognise a repeat)
const signatureOf = (opinion) => [opinion.section, opinion.factor || "", opinion.direction || "", (opinion.note || "").trim().toLowerCase()].join("|")

// A row's stack, with any Round 16 `processed` entries folded back in: one opinion per mentor per
// topic, the most recent winning.
const stackOf = (row) => {
    const byOwner = new Map()
    ;[...((row && row.processed) || []), ...((row && row.mentor_suggestions) || [])].forEach((entry) => {
        const { outcome, reason, proposalId, processedAt, ...opinion } = entry
        const at = timeOf(opinion.updatedAt || opinion.suggestedAt)
        const held = byOwner.get(ownerOf(opinion))
        if (!held || at >= timeOf(held.updatedAt || held.suggestedAt)) byOwner.set(ownerOf(opinion), { ...opinion, updatedAt: opinion.updatedAt || opinion.suggestedAt })
    })
    return [...byOwner.values()]
}

// A mentor's latest answers laid onto the stack: each topic they answered replaces their own earlier
// opinion on it (kept as it was, dates and all, when nothing changed — so re-sending the same words
// doesn't make the topic due again); topics they didn't answer this time keep their earlier opinion.
const mergeOpinions = (stack, mentorId, opinions, now = new Date()) => {
    const mine = new Map((stack || []).filter((entry) => String(entry.mentor) === String(mentorId)).map((entry) => [topicOf(entry), entry]))
    const answered = new Set(opinions.map(topicOf))
    const others = (stack || []).filter((entry) => String(entry.mentor) !== String(mentorId) || !answered.has(topicOf(entry)))
    const fresh = opinions.map((opinion) => {
        const before = mine.get(topicOf(opinion))
        if (before && sameWords(before, opinion)) return before
        return { ...opinion, mentor: mentorId, suggestedAt: before ? before.suggestedAt : now, updatedAt: now }
    })
    return [...others, ...fresh]
}

// Topics worth weighing: at least one mentor wants a change, and something on the topic is newer
// than Claude's last look at it.
const dueTopics = (stack, topics) => {
    const lastLook = new Map((topics || []).map((topic) => [topic.key, timeOf(topic.lastCheckedAt)]))
    const byTopic = new Map()
    stack.forEach((opinion) => byTopic.set(topicOf(opinion), [...(byTopic.get(topicOf(opinion)) || []), opinion]))
    return [...byTopic.entries()]
        .filter(([key, opinions]) => opinions.some((opinion) => !opinion.agrees)
            && opinions.some((opinion) => timeOf(opinion.updatedAt || opinion.suggestedAt) > (lastLook.get(key) || 0)))
        .map(([key, opinions]) => ({ key, opinions }))
}

// Professions with something due, the longest-waiting first; stable on id
const pickProfessionsWithSuggestions = (rows, limit) => rows
    .filter((row) => professionById.has(row.professionId))
    .map((row) => ({ row, due: dueTopics(stackOf(row), row.topics) }))
    .filter((entry) => entry.due.length > 0)
    .map((entry) => ({ ...entry, oldest: Math.min(...entry.due.flatMap((topic) => topic.opinions.map((opinion) => timeOf(opinion.updatedAt || opinion.suggestedAt)))) }))
    .sort((left, right) => left.oldest - right.oldest || left.row.professionId.localeCompare(right.row.professionId))
    .slice(0, limit)
    .map((entry) => entry.row)

const describeTopic = (key) => (key.startsWith("qualities:")
    ? `quality — ${FACTOR_LABELS[key.slice(10)] || key.slice(10)}`
    : key.replace(/_/g, " "))

const describeOpinion = (opinion, years) => {
    const who = `${opinion.mentorName || "a mentor"}${typeof years === "number" ? ` (${years} yrs in the field)` : ""}`
    if (opinion.agrees) return `${who}: agrees with what we show`
    const what = opinion.direction ? `should be ${opinion.direction}` : "needs a change"
    return `${who}: ${what}${opinion.note ? ` — "${opinion.note}"` : ""}${opinion.sourceUrl ? ` (link: ${opinion.sourceUrl})` : ""}`
}

const SYSTEM = `You weigh what working professionals ("mentors") say about the career data of an Indian
career-guidance service used by students aged 14 to 25.

For ONE career you are given what we show today and, for each TOPIC that has new mentor input, every
mentor opinion on it — who agrees with what we show, who wants a change, and their years in the field —
plus what was concluded last time.

Mentors' experience IS evidence. Decide what is best for students in India:
  - several experienced mentors agreeing is strong; one opinion against several who disagree is weak
  - you may search the allowed sources (and any page a mentor linked) to support or check a decision,
    but a source is not required when the mentors' consensus is clear
  - if the admin rejected a change last time, propose it again only if the newer input is clearly stronger

For each topic, decide:
  propose     change what we show — say exactly what to
  no_change   keep what we show — say why (e.g. "one opinion; two others agree with what we show")

What "change" holds, by topic:
  pay       {"field": "early_earnings_lpa" | "mid_career_lpa", "proposed": "a-b" (lakh a year), "confidence": "low"|"medium"|"high"}
  demand    {"field": "india_demand", "proposed": "declining" | "low" | "moderate" | "high", "confidence": ...}
  masters   {"proposed": "masters_required" | "masters_is_the_entry" | "masters_advantage" | "work_first", "confidence": ...}
  abroad    {"proposed": {"need": "not_needed" | "helps" | "often_needed", "stage": "undergrad" | "masters" | "doctorate" | "training", "why": "one short reason"}, "confidence": ...}
  any other topic, or a quality
            {"text": "the corrected wording, or exactly what to change, in one to three plain sentences", "confidence": ...}

Reply with ONLY this JSON object:
{"decisions": [{"topic": "<the topic key as given>", "outcome": "propose" | "no_change", "reason": "one sentence: the consensus and any source", "change": {...}}]}`

// what we show today, then each due topic's stack and its history
const promptFor = (sheet, due, topics, yearsOf) => {
    const history = new Map((topics || []).map((topic) => [topic.key, topic]))
    const qualities = sheet.qualities.map((quality) => `${quality.label}: ${quality.level}`).join("; ")
    return [
        `Career: ${sheet.profession}`,
        "WHAT WE SHOW TODAY",
        JSON.stringify(sheet.sections),
        `Qualities this work needs (High / Medium / Low): ${qualities}`,
        "",
        "TOPICS WITH NEW MENTOR INPUT",
        ...due.map(({ key, opinions }) => {
            const before = history.get(key)
            const last = before && before.lastOutcome && before.lastOutcome.decision
                ? `Last time: ${before.lastOutcome.decision === "proposed" ? "a change was proposed" : "no change"} (${before.lastOutcome.reason || "no reason recorded"})${before.adminDecision ? `; the admin ${before.adminDecision} it` : ""}.`
                : "Not weighed before."
            const wanting = opinions.filter((opinion) => !opinion.agrees).length
            return [
                `TOPIC ${key} — ${describeTopic(key)} · ${wanting} want a change, ${opinions.length - wanting} agree with what we show`,
                ...opinions.map((opinion) => `  - ${describeOpinion(opinion, yearsOf(opinion.mentor))}`),
                `  ${last}`,
            ].join("\n")
        }),
    ].join("\n")
}

const check = (json) => Array.isArray(json.decisions)

// One topic's decision → a proposal, or a recorded "no change". A proposal that does not hold up (a
// malformed value, nothing different from today) is a "no change" with that reason: the admin only
// ever sees changes worth deciding. Sources are welcome, never required — the mentors are the evidence.
const routeDecision = (decision, key, current, sources) => {
    const reason = String(decision.reason || "").trim().slice(0, TEXT_MAX)
    if (decision.outcome !== "propose") return { outcome: "not_changed", reason: reason || "Kept as it is" }
    const change = decision.change || {}
    const confidence = CONFIDENCE.includes(change.confidence) ? change.confidence : "low"
    const unclear = { outcome: "not_changed", reason: "The proposed change was not clear or matched what we already show" }
    const section = key.startsWith("qualities:") ? "qualities" : key
    const opts = { requireSources: false }

    if (CAREER_SECTIONS[section]) {
        if (!CAREER_SECTIONS[section].includes(change.field)) return unclear
        const valid = validateProposal({ field: change.field, proposed: change.proposed, reason, confidence }, current.career, sources, opts)
        return valid ? { outcome: "proposed", reason, kind: "career", change: valid } : unclear
    }
    if (FACT_SECTIONS[section]) {
        const valid = validateFactChange({ field: FACT_SECTIONS[section], proposed: change.proposed, reason, confidence }, current.fact, sources, opts)
        return valid ? { outcome: "proposed", reason, kind: "study_fact", change: valid } : unclear
    }
    const text = typeof change.text === "string" ? change.text.trim().slice(0, TEXT_MAX) : ""
    if (text.length < 3) return unclear
    const factor = section === "qualities" ? key.slice(10) : null
    return {
        outcome: "proposed",
        reason,
        kind: "mentor_text",
        change: {
            field: "mentor_text",
            section,
            ...(factor ? { factor } : {}),
            currentValue: current.text(section, factor),
            proposedValue: text,
            reason,
            confidence,
        },
    }
}

// what a mentor_text proposal shows as "today": the level for a quality, the section as we show it
const currentTextFor = (sheet) => (section, factor) => {
    if (section === "qualities") {
        const quality = sheet.qualities.find((entry) => entry.factor === factor)
        return quality ? `${quality.label}: ${quality.level}` : null
    }
    const value = sheet.sections[section]
    return value === undefined || value === null ? null : JSON.stringify(value).slice(0, TEXT_MAX)
}

// the profession's question, with what its answer is checked against
const prepareItem = (row, sheet, current, yearsOf = () => null) => {
    const due = dueTopics(stackOf(row), row.topics)
    const linked = due.flatMap(({ opinions }) => opinions.map((opinion) => hostOf(opinion.sourceUrl))).filter(Boolean)
    return {
        kind: "mentor",
        id: row.professionId,
        name: sheet.profession,
        request: { system: SYSTEM, user: promptFor(sheet, due, row.topics, yearsOf), onlyDomains: [...new Set([...SOURCE_DOMAINS, ...FACT_DOMAINS, ...linked])].slice(0, 20), maxUses: 4 },
        context: { due, current: { ...current, text: currentTextFor(sheet) }, yearsOf },
    }
}

// One decision per due topic; a topic Claude did not answer stays due for next month. Pure.
const decide = (item, reply) => {
    const { due, current } = item.context
    const dueKeys = new Set(due.map((topic) => topic.key))
    const seen = new Set()
    const outcomes = []
    for (const decision of (reply.json && reply.json.decisions) || []) {
        const key = String(decision.topic || "")
        if (!dueKeys.has(key) || seen.has(key)) continue
        seen.add(key)
        outcomes.push({ key, ...routeDecision(decision, key, current, reply.sources || []) })
    }
    return outcomes
}

// one answer → proposals for the admin, and each weighed topic's history updated. The stack is untouched.
const handleItem = async (item, reply, { now, result }) => {
    const DataProposal = require("../model/dataProposalsModel")
    const ProfessionSuggestions = require("../model/professionSuggestionsModel")

    if (reply.refused) result.refused.push(item.id)
    if (reply.unreadable) {
        result.failed.push(item.id)
        return
    }

    const sources = (reply.sources || []).slice(0, 8)
    const opinionsOf = new Map(item.context.due.map((topic) => [topic.key, topic.opinions]))
    const looked = []
    for (const outcome of decide(item, reply)) {
        const opinions = opinionsOf.get(outcome.key)
        let proposalId = null
        if (outcome.outcome === "proposed") {
            const same = { professionId: item.id, field: outcome.change.field, status: "open" }
            if (outcome.kind === "mentor_text") Object.assign(same, { section: outcome.change.section, factor: outcome.change.factor || null })
            // a newer suggestion replaces an undecided older one for the same thing — mentors' or the refresh's
            await DataProposal.updateMany(same, { status: "superseded" })
            const proposal = await DataProposal.create({
                kind: outcome.kind,
                professionId: item.id,
                profession: item.name,
                ...outcome.change,
                origin: "mentor",
                topic: outcome.key,
                fromMentors: opinions.map((opinion) => ({
                    mentor: opinion.mentor,
                    mentorName: opinion.mentorName,
                    years: item.context.yearsOf(opinion.mentor),
                    agrees: Boolean(opinion.agrees),
                    direction: opinion.direction || "",
                    note: opinion.note || "",
                    sourceUrl: opinion.sourceUrl || "",
                })),
                support: { change: opinions.filter((opinion) => !opinion.agrees).length, today: opinions.filter((opinion) => opinion.agrees).length },
                sources,
            })
            proposalId = proposal._id
            result.proposals += 1
        } else {
            result.notChanged += 1
        }
        looked.push({ key: outcome.key, lastCheckedAt: now, lastOutcome: { decision: outcome.outcome, reason: outcome.reason, proposalId, at: now }, adminDecision: null, adminDecidedAt: null })
    }

    // Re-read the row: a mentor may have sent while Claude was reading. Only the topics weighed here
    // change their history; the stack is never trimmed (Round 16's `processed` is folded back in).
    const row = await ProfessionSuggestions.findOne({ professionId: item.id }).lean()
    if (row) {
        const weighed = new Set(looked.map((topic) => topic.key))
        await ProfessionSuggestions.updateOne({ _id: row._id }, {
            $set: {
                mentor_suggestions: stackOf(row),
                processed: [],
                topics: [...(row.topics || []).filter((topic) => !weighed.has(topic.key)), ...looked],
            },
        })
    }
    result.professions += 1
    result.topics += looked.length
}

const newResult = () => ({ professions: 0, topics: 0, proposals: 0, notChanged: 0, refused: [], failed: [] })

const runMentorPass = async ({ research, limit = maxProfessions(), now = new Date() } = {}) => {
    if (!research) return { skipped: "ANTHROPIC_API_KEY is not set — mentor input keeps waiting" }
    const ProfessionSuggestions = require("../model/professionSuggestionsModel")
    const ProfessionOverride = require("../model/professionOverridesModel")
    const StudyFactOverride = require("../model/studyFactOverridesModel")
    const Mentor = require("../model/mentorsModel")
    const { buildSheet } = require("../Routers/mentorReviewsRouter")
    const { getOverrides } = require("../utils/professionOverrides")
    const { getStudyOverrides } = require("../utils/studyPlaces")

    const rows = await ProfessionSuggestions.find({ "mentor_suggestions.0": { $exists: true } }).lean()
    const chosen = pickProfessionsWithSuggestions(rows, limit)
    if (chosen.length === 0) return { nothing: "no mentor topics with new input" }

    const [overrides, studyOverrides, careerRows, factRows, mentors] = await Promise.all([
        getOverrides(), getStudyOverrides(), ProfessionOverride.find().lean(), StudyFactOverride.find().lean(),
        Mentor.find({ user: { $in: chosen.flatMap((row) => stackOf(row).map((opinion) => opinion.mentor)) } }).select("user yearsExperience").lean(),
    ])
    const careerById = new Map(careerRows.map((row) => [row.professionId, row]))
    const factById = new Map(factRows.map((row) => [row.professionId, row]))
    const years = new Map(mentors.map((mentor) => [String(mentor.user), typeof mentor.yearsExperience === "number" ? mentor.yearsExperience : null]))
    const yearsOf = (mentorId) => (years.has(String(mentorId)) ? years.get(String(mentorId)) : null)

    const result = newResult()
    for (const row of chosen) {
        const profession = professionById.get(row.professionId)
        try {
            // what students see today: the approved values where there are some
            const careerValues = (careerById.get(profession.id) || {}).values || {}
            const career = { ...currentValues(profession), ...careerValues }
            Object.keys(career).forEach((key) => { if (career[key] === undefined) career[key] = null })
            const factOverride = factById.get(profession.id)
            const factValues = (factOverride && factOverride.approvedAt && factOverride.values) || {}
            const abroadRow = factValues.abroad || abroadData.careers[profession.id]
            const fact = { after_undergrad: factValues.after_undergrad || profession.after_undergrad, abroad: abroadRow && abroadRow.need !== "not_needed" ? abroadRow : null }

            const item = prepareItem(row, buildSheet(profession, overrides, studyOverrides), { career, fact }, yearsOf)
            const reply = await research.askJson({ ...item.request, check })
            await handleItem(item, reply, { now, result })
        } catch (error) {
            console.error(`mentor_pass: ${row.professionId} failed — ${error.message}`)
            result.failed.push(row.professionId)
        }
    }
    return result
}

module.exports = {
    runMentorPass, handleItem, decide, routeDecision, prepareItem, pickProfessionsWithSuggestions,
    stackOf, mergeOpinions, dueTopics, topicOf, signatureOf, promptFor, check, SYSTEM, CAREER_SECTIONS, FACT_SECTIONS,
}
