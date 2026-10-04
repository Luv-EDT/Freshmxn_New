// CLAUDE'S MONTHLY PASS OVER MENTORS' SUGGESTIONS (owner, Round 16) — run at the end of the data
// refresh on the 1st, so "Run now" for the refresh runs it too.
//
// Mentors tell us what should change on their own profession's sheet (mentorReviewsRouter →
// ProfessionSuggestions, one waiting list per profession). Once a month, for up to MENTOR_PASS_MAX
// professions, oldest suggestion first, Claude reads the waiting list beside our current record and
// searches the same public and official sources the other monthly jobs use (plus any page a mentor
// linked). For each suggestion it says USE — a source supports it — or DISCARD, with a reason.
//
// ONE QUEUE. A suggestion it uses becomes an ordinary proposal in admin → Data updates, marked as
// coming from mentors:
//   pay / demand          → a "career" proposal, checked like the refresh's (dataRefresh.validateProposal)
//   master's / abroad     → a "study_fact" proposal (studyRefresh.validateFactChange)
//   everything else       → a "mentor_text" proposal — words for a person to turn into a data change;
//                           approving it only sends it to Export patch, never to a live page
// The existing rule that a newer open proposal for the same field replaces an older one means the
// refresh and the mentors can never put two competing answers in front of the admin.
//
// Every handled suggestion leaves the waiting list for `processed` (with what happened and why), so
// the list empties. One with no answer this month stays waiting. NOTHING CHANGES WITHOUT THE ADMIN,
// and matching never reads any of it.

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

// the same suggestion, however often it is re-sent
const signatureOf = (suggestion) => [suggestion.section, suggestion.factor || "", suggestion.direction || "", (suggestion.note || "").trim().toLowerCase()].join("|")
// one particular suggestion in the list: its mentor, what it says and when it came
const identityOf = (suggestion) => `${String(suggestion.mentor || "")}#${signatureOf(suggestion)}#${timeOf(suggestion.suggestedAt)}`

// Professions with something waiting, the longest-waiting first; stable on id
const pickProfessionsWithSuggestions = (rows, limit) => rows
    .filter((row) => (row.mentor_suggestions || []).length > 0 && professionById.has(row.professionId))
    .map((row) => ({ row, oldest: Math.min(...row.mentor_suggestions.map((suggestion) => timeOf(suggestion.suggestedAt))) }))
    .sort((left, right) => left.oldest - right.oldest || left.row.professionId.localeCompare(right.row.professionId))
    .slice(0, limit)
    .map((entry) => entry.row)

const describe = (suggestion) => (suggestion.section === "qualities"
    ? `${FACTOR_LABELS[suggestion.factor] || suggestion.factor} should be ${suggestion.direction}`
    : suggestion.section.replace(/_/g, " "))

const SYSTEM = `You check suggestions from working professionals ("mentors") about the career data of an Indian
career-guidance service used by students aged 14 to 25.

You are given what we show today for ONE career, and a numbered list of changes mentors in that career
suggested. Mentors know the work, but a suggestion is used only when a page you find supports it for India
today. Search the allowed sources (and any page a mentor linked). Never change something just because a
mentor said so, and never from general knowledge alone.

For each suggestion, decide:
  use      a source supports it — say exactly what should change
  discard  no source supports it, it is about another country, it is already what we show, or it is unclear

Suggestions that say the same thing may share one decision ("indexes": [0, 2]).

What "change" holds, by section:
  pay       {"field": "early_earnings_lpa" | "mid_career_lpa", "proposed": "a-b" (lakh a year), "confidence": "low"|"medium"|"high"}
  demand    {"field": "india_demand", "proposed": "declining" | "low" | "moderate" | "high", "confidence": ...}
  masters   {"proposed": "masters_required" | "masters_is_the_entry" | "masters_advantage" | "work_first", "confidence": ...}
  abroad    {"proposed": {"need": "not_needed" | "helps" | "often_needed", "stage": "undergrad" | "masters" | "doctorate" | "training", "why": "one short reason"}, "confidence": ...}
  any other section, or a quality
            {"text": "the corrected wording, or exactly what to change, in one to three plain sentences", "confidence": ...}

Reply with ONLY this JSON object:
{"decisions": [{"indexes": [0], "outcome": "use" | "discard", "reason": "one sentence naming the source, or why it was discarded", "change": {...}}]}`

// what we show today, in a few lines, then the numbered suggestions
const promptFor = (sheet, suggestions) => {
    const { sections } = sheet
    const qualities = sheet.qualities.map((quality) => `${quality.label}: ${quality.level}`).join("; ")
    return [
        `Career: ${sheet.profession}`,
        "WHAT WE SHOW TODAY",
        JSON.stringify(sections),
        `Qualities this work needs (High / Medium / Low): ${qualities}`,
        "",
        "MENTORS' SUGGESTIONS",
        ...suggestions.map((suggestion, index) => `${index}. [${describe(suggestion)}] ${suggestion.note || "(no note)"}${suggestion.sourceUrl ? ` — source: ${suggestion.sourceUrl}` : ""}`),
    ].join("\n")
}

const check = (json) => Array.isArray(json.decisions)

// One decision → what happens to its suggestions, and the proposal to file if it is used.
// A "use" that does not hold up (no cited page, a malformed value, nothing different from today) is
// a discard: the admin only ever sees changes worth deciding.
const routeDecision = (decision, suggestion, current, sources) => {
    const reason = String(decision.reason || "").trim().slice(0, TEXT_MAX)
    if (decision.outcome !== "use") return { outcome: "discarded", reason: reason || "Not supported by a source we could find" }
    const change = decision.change || {}
    const confidence = CONFIDENCE.includes(change.confidence) ? change.confidence : "low"
    const unsupported = { outcome: "discarded", reason: "No source we found supports a clear change" }
    if (!Array.isArray(sources) || sources.length === 0) return unsupported

    if (CAREER_SECTIONS[suggestion.section]) {
        if (!CAREER_SECTIONS[suggestion.section].includes(change.field)) return unsupported
        const valid = validateProposal({ field: change.field, proposed: change.proposed, reason, confidence }, current.career, sources)
        return valid ? { outcome: "used", reason, kind: "career", change: valid } : unsupported
    }
    if (FACT_SECTIONS[suggestion.section]) {
        const valid = validateFactChange({ field: FACT_SECTIONS[suggestion.section], proposed: change.proposed, reason, confidence }, current.fact, sources)
        return valid ? { outcome: "used", reason, kind: "study_fact", change: valid } : unsupported
    }
    const text = typeof change.text === "string" ? change.text.trim().slice(0, TEXT_MAX) : ""
    if (text.length < 3) return unsupported
    return {
        outcome: "used",
        reason,
        kind: "mentor_text",
        change: {
            field: "mentor_text",
            section: suggestion.section,
            ...(suggestion.factor ? { factor: suggestion.factor, direction: suggestion.direction } : {}),
            currentValue: current.text(suggestion),
            proposedValue: text,
            reason,
            confidence,
        },
    }
}

// what a mentor_text proposal shows as "today": the level for a quality, the section as we show it
const currentTextFor = (sheet) => (suggestion) => {
    if (suggestion.section === "qualities") {
        const quality = sheet.qualities.find((entry) => entry.factor === suggestion.factor)
        return quality ? `${quality.label}: ${quality.level}` : null
    }
    const section = sheet.sections[suggestion.section]
    return section === undefined || section === null ? null : JSON.stringify(section).slice(0, TEXT_MAX)
}

// the profession's question, with what its answer is checked against
const prepareItem = (row, sheet, current) => {
    const suggestions = row.mentor_suggestions
    const linked = suggestions.map((suggestion) => hostOf(suggestion.sourceUrl)).filter(Boolean)
    return {
        kind: "mentor",
        id: row.professionId,
        name: sheet.profession,
        request: { system: SYSTEM, user: promptFor(sheet, suggestions), onlyDomains: [...new Set([...SOURCE_DOMAINS, ...FACT_DOMAINS, ...linked])].slice(0, 20), maxUses: 4 },
        context: { suggestions, current: { ...current, text: currentTextFor(sheet) } },
    }
}

// Which suggestions each decision covers (by their place in the list), first decision wins; anything
// out of range or already covered is ignored. Pure — the fixture drives it.
const decide = (item, reply) => {
    const { suggestions, current } = item.context
    const outcomes = []
    const covered = new Set()
    for (const decision of (reply.json && reply.json.decisions) || []) {
        const raw = Array.isArray(decision.indexes) ? decision.indexes : [decision.index]
        const indexes = [...new Set(raw.map(Number))].filter((index) => Number.isInteger(index) && index >= 0 && index < suggestions.length && !covered.has(index))
        if (indexes.length === 0) continue
        indexes.forEach((index) => covered.add(index))
        outcomes.push({ indexes, ...routeDecision(decision, suggestions[indexes[0]], current, reply.sources || []) })
    }
    return outcomes
}

// one answer → proposals for the admin, and the waiting list moved on
const handleItem = async (item, reply, { now, result }) => {
    const DataProposal = require("../model/dataProposalsModel")
    const ProfessionSuggestions = require("../model/professionSuggestionsModel")

    if (reply.refused) result.refused.push(item.id)
    if (reply.unreadable) {
        result.failed.push(item.id)
        return
    }

    const { suggestions } = item.context
    const sources = (reply.sources || []).slice(0, 8)
    const processed = []
    for (const outcome of decide(item, reply)) {
        const covered = outcome.indexes.map((index) => suggestions[index])
        let proposalId = null
        if (outcome.outcome === "used") {
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
                fromMentors: covered.map((suggestion) => ({ mentorName: suggestion.mentorName, note: suggestion.note, sourceUrl: suggestion.sourceUrl || "" })),
                sources,
            })
            proposalId = proposal._id
            result.used += covered.length
            result.proposals += 1
        } else {
            result.discarded += covered.length
        }
        covered.forEach((suggestion) => processed.push({ ...suggestion, outcome: outcome.outcome, reason: outcome.reason, proposalId, processedAt: now }))
    }

    // Re-read the row: a mentor may have re-sent while Claude was reading. Only the exact suggestions
    // handled here leave the list (read, filter, then $set — the form FerretDB accepts).
    const handled = new Set(processed.map(identityOf))
    const row = await ProfessionSuggestions.findOne({ professionId: item.id }).lean()
    if (row) {
        await ProfessionSuggestions.updateOne({ _id: row._id }, {
            $set: {
                mentor_suggestions: (row.mentor_suggestions || []).filter((suggestion) => !handled.has(identityOf(suggestion))),
                processed: [...(row.processed || []), ...processed].slice(-200),
            },
        })
    }
    result.professions += 1
}

const newResult = () => ({ professions: 0, used: 0, discarded: 0, proposals: 0, refused: [], failed: [] })

const runMentorPass = async ({ research, limit = maxProfessions(), now = new Date() } = {}) => {
    if (!research) return { skipped: "ANTHROPIC_API_KEY is not set — suggestions keep waiting" }
    const ProfessionSuggestions = require("../model/professionSuggestionsModel")
    const ProfessionOverride = require("../model/professionOverridesModel")
    const StudyFactOverride = require("../model/studyFactOverridesModel")
    const { buildSheet } = require("../Routers/mentorReviewsRouter")
    const { getOverrides } = require("../utils/professionOverrides")
    const { getStudyOverrides } = require("../utils/studyPlaces")

    const rows = await ProfessionSuggestions.find({ "mentor_suggestions.0": { $exists: true } }).lean()
    const chosen = pickProfessionsWithSuggestions(rows, limit)
    if (chosen.length === 0) return { nothing: "no mentor suggestions waiting" }

    const [overrides, studyOverrides, careerRows, factRows] = await Promise.all([
        getOverrides(), getStudyOverrides(), ProfessionOverride.find().lean(), StudyFactOverride.find().lean(),
    ])
    const careerById = new Map(careerRows.map((row) => [row.professionId, row]))
    const factById = new Map(factRows.map((row) => [row.professionId, row]))

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

            const item = prepareItem(row, buildSheet(profession, overrides, studyOverrides), { career, fact })
            const reply = await research.askJson({ ...item.request, check })
            await handleItem(item, reply, { now, result })
        } catch (error) {
            console.error(`mentor_pass: ${row.professionId} failed — ${error.message}`)
            result.failed.push(row.professionId)
        }
    }
    return result
}

module.exports = { runMentorPass, handleItem, decide, routeDecision, prepareItem, pickProfessionsWithSuggestions, signatureOf, identityOf, promptFor, check, SYSTEM, CAREER_SECTIONS, FACT_SECTIONS }
