// THE MONTHLY DATA REFRESH (owner, Round 10) — run by the housekeeping worker on the 1st.
//
// For up to REFRESH_MAX_CAREERS careers, the ones checked longest ago first:
//   1. Adzuna India — how many live postings, and advertised pay (skipped without keys)
//   2. Claude, searching only the named public sources (claudeResearch.SOURCE_DOMAINS), is shown
//      the career's current demand and pay and the Adzuna figures, and says what, if anything, the
//      sources say has changed
//   3. every change that passes validateProposal becomes a DataProposal for the admin
//
// HALF PRICE BY DEFAULT (Round 12): the questions go out as one Message Batch and batch_collect files
// the answers within the hour (housekeeping/researchBatch.js). RESEARCH_BATCH=false asks directly.
//
// NOTHING AUTO-CHANGES. The admin approves in "Data updates"; only then does a value reach a career
// page (utils/professionOverrides.js). Matching inputs are never proposed, never changed.
//
// MENTORS' SUGGESTIONS (Round 16): after the careers, Claude reads what mentors said should change
// (housekeeping/mentorPass.js) and files the suggestions a source supports into the same Data updates
// queue. Always asked directly — at most MENTOR_PASS_MAX questions a month.

const taxonomy = require("../data/ALL-professions.json")
const { createResearchClient } = require("./claudeResearch")
const { createAdzuna } = require("./adzuna")
const { researchModel } = require("../utils/researchModel")
const { submitBatch, batchEnabled } = require("./researchBatch")
const { isValidValue, parseRange } = require("../utils/professionOverrides")

const FIELDS = ["india_demand", "early_earnings_lpa", "mid_career_lpa"]
const CONFIDENCE = ["low", "medium", "high"]

const maxCareers = () => Number(process.env.REFRESH_MAX_CAREERS) || 60

const currentValues = (profession) => ({
    india_demand: profession.demand_signal ? profession.demand_signal.india_demand || null : null,
    early_earnings_lpa: profession.economics ? profession.economics.early_earnings_lpa || null : null,
    mid_career_lpa: profession.economics ? profession.economics.mid_career_lpa || null : null,
})

const timeOf = (value) => (value ? new Date(value).getTime() : 0)

// Never checked first, then the longest since this job looked, then the oldest hand check in the
// data file. Stable on id, so two runs on the same day pick the same careers.
const pickCareersToCheck = (professions, overridesById, limit) => professions
    .map((profession) => {
        const override = overridesById.get(profession.id)
        const fileChecked = profession.economics && profession.economics.verification ? profession.economics.verification.checked_on : null
        return { profession, lastChecked: override ? timeOf(override.lastCheckedAt) : 0, fileChecked: timeOf(fileChecked) }
    })
    .sort((left, right) => left.lastChecked - right.lastChecked || left.fileChecked - right.fileChecked || left.profession.id.localeCompare(right.profession.id))
    .slice(0, limit)
    .map((entry) => entry.profession)

const sameRange = (left, right) => {
    const a = parseRange(left)
    const b = parseRange(right)
    return Boolean(a && b && a.low === b.low && a.high === b.high)
}

// A change is kept only if it names a field we allow, carries a well-formed value that differs from
// today's, and the reply cited at least one page. Everything else is dropped silently — the admin
// only ever sees changes worth deciding. Mentor-backed changes (Round 17) pass requireSources: false:
// the mentors' consensus is the evidence there, and a source only supports it.
const validateProposal = (change, current, sources, { requireSources = true } = {}) => {
    if (!change || !FIELDS.includes(change.field)) return null
    const proposed = String(change.proposed || "").replace(/\s+/g, "").toLowerCase()
    if (!isValidValue(change.field, proposed)) return null
    const now = current[change.field]
    if (now !== null && (proposed === String(now).toLowerCase() || sameRange(proposed, now))) return null
    if (requireSources && (!Array.isArray(sources) || sources.length === 0)) return null

    return {
        field: change.field,
        currentValue: now === null ? null : String(now),
        proposedValue: proposed,
        reason: String(change.reason || "").slice(0, 600),
        confidence: CONFIDENCE.includes(change.confidence) ? change.confidence : "low",
    }
}

const SYSTEM = `You check career data for an Indian career-guidance service used by students aged 14 to 25.

For ONE career you are given what we currently show: India demand (declining / low / moderate / high), early-career
pay and mid-career pay (5–8 years, employed only), both as ranges in lakh rupees a year written "a-b".
You may also be given live job-board figures.

Search the allowed public sources. Propose a change ONLY where a source you found clearly supports a
different value for India today. Do not propose a change from general knowledge, from one anecdote, or
from a source about another country. Most careers need no change — an empty list is a good answer.

Reply with ONLY this JSON object:
{"changes": [{"field": "india_demand" | "early_earnings_lpa" | "mid_career_lpa", "proposed": "high" or "4.0-9.0", "reason": "one sentence naming the source and the figure", "confidence": "low" | "medium" | "high"}]}`

const promptFor = (profession, current, adzuna) => [
    `Career: ${profession.profession}`,
    `What it is: ${profession.one_liner || ""}`,
    `Job titles: ${(profession.job_roles || []).slice(0, 6).join(", ")}`,
    `We show — demand: ${current.india_demand || "unknown"}; early pay: ${current.early_earnings_lpa || "unknown"} LPA; mid-career pay: ${current.mid_career_lpa || "unknown"} LPA`,
    adzuna
        ? `Job board (Adzuna India) — live postings: ${adzuna.count === null ? "unknown" : adzuna.count}; mean advertised pay: ${adzuna.meanLpa === null ? "unknown" : `${adzuna.meanLpa} LPA`}; median advertised pay: ${adzuna.medianLpa === null ? "too few salaried postings" : `${adzuna.medianLpa} LPA`}`
        : "No job-board figures this month.",
].join("\n")

const adzunaFor = async (adzuna, profession) => {
    if (!adzuna) return null
    const what = (profession.job_roles && profession.job_roles[0]) || profession.profession
    try {
        const counts = await adzuna.search(what)
        const pay = await adzuna.histogram(what)
        return { query: what, count: counts.count, meanLpa: counts.meanLpa, medianLpa: pay.medianLpa }
    } catch (error) {
        console.error(`data_refresh: Adzuna failed for ${profession.id} — ${error.message}`)
        return null
    }
}

const check = (json) => Array.isArray(json.changes)
const newResult = () => ({ checked: 0, proposals: 0, refused: [], failed: [] })

// one career's question, with what its answer will be checked against
const prepareItem = (profession, current, board) => ({
    kind: "career",
    id: profession.id,
    name: profession.profession,
    request: { system: SYSTEM, user: promptFor(profession, current, board) },
    context: { current, board },
})

// one answer → proposals for the admin. The same whether it came back directly or in a batch.
const handleItem = async (item, reply, { now, result }) => {
    const DataProposal = require("../model/dataProposalsModel")
    const ProfessionOverride = require("../model/professionOverridesModel")
    const { current, board } = item.context

    if (reply.refused) result.refused.push(item.id)
    if (reply.unreadable) result.failed.push(item.id)

    const changes = reply.json
        ? reply.json.changes.map((change) => validateProposal(change, current, reply.sources)).filter(Boolean)
        : []

    for (const change of changes) {
        // a newer suggestion replaces an undecided older one for the same field
        await DataProposal.updateMany({ professionId: item.id, field: change.field, status: "open" }, { status: "superseded" })
        await DataProposal.create({
            professionId: item.id,
            profession: item.name,
            ...change,
            sources: reply.sources.slice(0, 8),
            adzuna: board ? { count: board.count, meanLpa: board.meanLpa, medianLpa: board.medianLpa } : {},
        })
        result.proposals += 1
    }

    // an unreadable reply is not a check — that career stays at the front for next month
    if (!reply.unreadable) {
        await ProfessionOverride.updateOne({ professionId: item.id }, { $set: { lastCheckedAt: now } }, { upsert: true })
        result.checked += 1
    }
}

// the mentors' part of the month; its failure never undoes the careers' part
const mentorPassFor = async (research, enabled, now) => {
    if (!enabled) return "not run"
    try {
        return await require("./mentorPass").runMentorPass({ research, now })
    } catch (error) {
        console.error(`data_refresh: the mentor pass failed — ${error.message}`)
        return { failed: error.message }
    }
}

const runDataRefresh = async ({
    research,             // injected in the fixtures; otherwise built on the chosen research model
    batch,                // true / false to force; by default batched unless RESEARCH_BATCH=false
    adzuna = createAdzuna(),
    professions = taxonomy.professions,
    limit = maxCareers(),
    now = new Date(),
    mentorPass = true,    // the fixtures that drive the careers alone turn it off
} = {}) => {
    const injected = research !== undefined
    if (!injected) research = createResearchClient({ job: "data_refresh", model: await researchModel() })
    if (!research) return { skipped: "ANTHROPIC_API_KEY is not set" }

    const ProfessionOverride = require("../model/professionOverridesModel")

    const overrides = await ProfessionOverride.find().lean()
    const overridesById = new Map(overrides.map((row) => [row.professionId, row]))
    const careers = pickCareersToCheck(professions, overridesById, limit)

    // The job-board figures are fetched now, in either mode, and travel with the question.
    const items = []
    for (const profession of careers) {
        // the value shown today is the approved one where there is one
        const override = overridesById.get(profession.id)
        const current = { ...currentValues(profession), ...((override && override.values) || {}) }
        Object.keys(current).forEach((key) => { if (current[key] === undefined) current[key] = null })
        items.push(prepareItem(profession, current, await adzunaFor(adzuna, profession)))
    }
    const adzunaState = adzuna ? "used" : "skipped (no keys)"

    if (batch === undefined ? !injected && batchEnabled() : batch) {
        const submitted = await submitBatch({ job: "data_refresh", items, model: research.model })
        if (submitted) return { batched: submitted.batchId, questions: submitted.items, adzuna: adzunaState, note: "answers are filed by batch_collect, usually within the hour", mentorPass: await mentorPassFor(research, mentorPass, now) }
    }

    const result = { ...newResult(), adzuna: adzunaState }
    for (const item of items) {
        try {
            const reply = await research.askJson({ ...item.request, check })
            await handleItem(item, reply, { now, result })
        } catch (error) {
            console.error(`data_refresh: ${item.id} failed — ${error.message}`)
            result.failed.push(item.id)
        }
    }

    return { ...result, mentorPass: await mentorPassFor(research, mentorPass, now) }
}

module.exports = { runDataRefresh, handleItem, newResult, check, prepareItem, pickCareersToCheck, validateProposal, currentValues, FIELDS, SYSTEM, promptFor }
