// THE MONTHLY DATA REFRESH (owner, Round 10) — run by the housekeeping worker on the 1st.
//
// For up to REFRESH_MAX_CAREERS careers, the ones checked longest ago first:
//   1. Adzuna India — how many live postings, and advertised pay (skipped without keys)
//   2. Claude, searching only the named public sources (claudeResearch.SOURCE_DOMAINS), is shown
//      the career's current demand and pay and the Adzuna figures, and says what, if anything, the
//      sources say has changed
//   3. every change that passes validateProposal becomes a DataProposal for the admin
//
// NOTHING AUTO-CHANGES. The admin approves in "Data updates"; only then does a value reach a career
// page (utils/professionOverrides.js). Matching inputs are never proposed, never changed.

const taxonomy = require("../data/ALL-professions.json")
const { createResearchClient } = require("./claudeResearch")
const { createAdzuna } = require("./adzuna")
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
// only ever sees changes worth deciding.
const validateProposal = (change, current, sources) => {
    if (!change || !FIELDS.includes(change.field)) return null
    const proposed = String(change.proposed || "").replace(/\s+/g, "").toLowerCase()
    if (!isValidValue(change.field, proposed)) return null
    const now = current[change.field]
    if (now !== null && (proposed === String(now).toLowerCase() || sameRange(proposed, now))) return null
    if (!Array.isArray(sources) || sources.length === 0) return null

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

const runDataRefresh = async ({
    research = createResearchClient(),
    adzuna = createAdzuna(),
    professions = taxonomy.professions,
    limit = maxCareers(),
    now = new Date(),
} = {}) => {
    if (!research) return { skipped: "ANTHROPIC_API_KEY is not set" }

    const DataProposal = require("../model/dataProposalsModel")
    const ProfessionOverride = require("../model/professionOverridesModel")

    const overrides = await ProfessionOverride.find().lean()
    const overridesById = new Map(overrides.map((row) => [row.professionId, row]))
    const careers = pickCareersToCheck(professions, overridesById, limit)

    const result = { checked: 0, proposals: 0, adzuna: adzuna ? "used" : "skipped (no keys)", refused: [], failed: [] }

    for (const profession of careers) {
        // the value shown today is the approved one where there is one
        const override = overridesById.get(profession.id)
        const current = { ...currentValues(profession), ...((override && override.values) || {}) }
        Object.keys(current).forEach((key) => { if (current[key] === undefined) current[key] = null })

        try {
            const board = await adzunaFor(adzuna, profession)
            const reply = await research.askJson({
                system: SYSTEM,
                user: promptFor(profession, current, board),
                check: (json) => Array.isArray(json.changes),
            })

            if (reply.refused) result.refused.push(profession.id)
            if (reply.unreadable) result.failed.push(profession.id)

            const changes = reply.json
                ? reply.json.changes.map((change) => validateProposal(change, current, reply.sources)).filter(Boolean)
                : []

            for (const change of changes) {
                // a newer suggestion replaces an undecided older one for the same field
                await DataProposal.updateMany({ professionId: profession.id, field: change.field, status: "open" }, { status: "superseded" })
                await DataProposal.create({
                    professionId: profession.id,
                    profession: profession.profession,
                    ...change,
                    sources: reply.sources.slice(0, 8),
                    adzuna: board ? { count: board.count, meanLpa: board.meanLpa, medianLpa: board.medianLpa } : {},
                })
                result.proposals += 1
            }

            // an unreadable reply is not a check — that career stays at the front for next month
            if (!reply.unreadable) {
                await ProfessionOverride.updateOne({ professionId: profession.id }, { $set: { lastCheckedAt: now } }, { upsert: true })
                result.checked += 1
            }
        } catch (error) {
            console.error(`data_refresh: ${profession.id} failed — ${error.message}`)
            result.failed.push(profession.id)
        }
    }

    return result
}

module.exports = { runDataRefresh, pickCareersToCheck, validateProposal, currentValues, FIELDS }
