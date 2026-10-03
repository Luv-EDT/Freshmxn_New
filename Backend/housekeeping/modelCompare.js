// WHICH MODEL SHOULD RUN THE MONTHLY RESEARCH? (owner, Round 12) — asked once, measured, then decided
// by the admin. Not on a schedule: the admin presses "Run the comparison" in Data updates.
//
// The same 20 careers (a fixed spread across the list, so a re-run compares like with like) get the
// data refresh's own question, asked directly of Claude Opus 5.5 and Claude Sonnet 5.5, with the
// same search limits. Each answer is checked by the refresh's own validateProposal. Recorded per
// model: how many changes it would propose, how many pages it cited, whether it failed, and what it
// cost (tokens from the API's usage block, priced by utils/aiUsage).
//
// NOTHING IS FILED. No DataProposal, no lastCheckedAt — the careers are still due next month.
// Cost: a few dollars, once, logged as "model_compare" on the AI usage card.

const taxonomy = require("../data/ALL-professions.json")
const { createResearchClient } = require("./claudeResearch")
const { SYSTEM, promptFor, currentValues, validateProposal, check } = require("./dataRefresh")
const { countsOf, costOf } = require("../utils/aiUsage")
const { RESEARCH_MODELS } = require("../utils/researchModel")

const SAMPLE_SIZE = 20

// every 11th career by id — the same 20 every time, spread across the sectors
const sampleCareers = (professions, size = SAMPLE_SIZE) => {
    const sorted = [...professions].sort((left, right) => left.id.localeCompare(right.id))
    const step = Math.max(1, Math.floor(sorted.length / size))
    return sorted.filter((profession, index) => index % step === 0).slice(0, size)
}

// a fetch that adds up the usage of every reply it carries, for one model's tally
const countingFetch = (fetchImpl, tally) => async (url, options) => {
    const response = await fetchImpl(url, options)
    if (!response.ok) return response
    const text = await response.text()
    const counts = countsOf(JSON.parse(text))
    Object.keys(counts).forEach((key) => { tally[key] = (tally[key] || 0) + counts[key] })
    return { ok: true, status: response.status, headers: response.headers, text: async () => text, json: async () => JSON.parse(text) }
}

const fieldsOf = (changes) => changes.map((change) => change.field).sort().join(",")

const summarise = (models, careers, perMonth) => {
    const summary = { perModel: {}, agreement: null }
    models.forEach((model) => {
        const rows = careers.map((career) => career.results[model])
        const priced = rows.filter((row) => typeof row.cost === "number")
        const cost = priced.reduce((sum, row) => sum + row.cost, 0)
        summary.perModel[model] = {
            changes: rows.reduce((sum, row) => sum + row.changes.length, 0),
            averageSources: Math.round((rows.reduce((sum, row) => sum + row.sources, 0) / Math.max(rows.length, 1)) * 10) / 10,
            failures: rows.filter((row) => row.refused || row.unreadable || row.error).length,
            costPerCareer: priced.length ? Math.round((cost / priced.length) * 1000) / 1000 : null,
            // the data refresh's monthly careers, at full price (a batch halves the tokens)
            monthlyCost: priced.length ? Math.round((cost / priced.length) * perMonth * 100) / 100 : null,
            averageSeconds: Math.round(rows.reduce((sum, row) => sum + (row.seconds || 0), 0) / Math.max(rows.length, 1)),
        }
    })
    const both = careers.filter((career) => models.every((model) => !career.results[model].error && !career.results[model].unreadable))
    summary.agreement = both.length
        ? Math.round((both.filter((career) => fieldsOf(career.results[models[0]].changes) === fieldsOf(career.results[models[1]].changes)).length / both.length) * 100)
        : null
    return summary
}

const runModelCompare = async ({
    models = RESEARCH_MODELS,
    professions = taxonomy.professions,
    apiKey = process.env.ANTHROPIC_API_KEY,
    fetchImpl = fetch,
    save = true,
} = {}) => {
    if (!apiKey) return { skipped: "ANTHROPIC_API_KEY is not set" }

    const careers = sampleCareers(professions).map((profession) => ({ id: profession.id, name: profession.profession, results: {} }))
    const sample = new Map(professions.map((profession) => [profession.id, profession]))

    for (const model of models) {
        for (const career of careers) {
            const profession = sample.get(career.id)
            const current = currentValues(profession)
            const tally = {}
            const research = createResearchClient({ apiKey, model, job: "model_compare", fetchImpl: countingFetch(fetchImpl, tally) })
            const started = Date.now()
            const row = { changes: [], sources: 0, refused: false, unreadable: false, error: null }
            try {
                // the refresh's own question, without job-board figures, so both models see the same thing
                const reply = await research.askJson({ system: SYSTEM, user: promptFor(profession, current, null), check })
                row.refused = Boolean(reply.refused)
                row.unreadable = Boolean(reply.unreadable)
                if (reply.json) {
                    row.changes = reply.json.changes.map((change) => validateProposal(change, current, reply.sources)).filter(Boolean)
                        .map((change) => ({ field: change.field, from: change.currentValue, to: change.proposedValue, reason: change.reason }))
                    row.sources = reply.sources.length
                }
            } catch (error) {
                row.error = error.message.slice(0, 200)
            }
            row.seconds = Math.round((Date.now() - started) / 1000)
            Object.assign(row, { inputTokens: tally.inputTokens || 0, outputTokens: tally.outputTokens || 0, webSearches: tally.webSearches || 0 })
            row.cost = costOf({ model, job: "model_compare", inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, webSearches: 0, ...tally })
            career.results[model] = row
        }
    }

    const summary = summarise(models, careers, Number(process.env.REFRESH_MAX_CAREERS) || 60)
    if (save) {
        const ModelComparison = require("../model/modelComparisonsModel")
        await ModelComparison.create({ models, careers, summary })
    }
    return { careers: careers.length, models, summary }
}

module.exports = { runModelCompare, sampleCareers, summarise, countingFetch, SAMPLE_SIZE }
