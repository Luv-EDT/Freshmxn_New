// THE AI USAGE LOG (owner, Round 11): every Claude call adds its token counts to one row per day,
// job and model (model/aiUsageModel.js), so the monthly cost is measured, not guessed.
//
// FIRE AND FORGET. recordUsage is never awaited by a caller and never throws: a failed write to the
// log must not fail a student's grading or report. Without a database connection (the fixtures)
// it does nothing.

const mongoose = require("mongoose")

// Price per million tokens, from Anthropic's published list prices (claude-api reference, read
// 3 October 2026). Cache writes are billed at 1.25× input (5-minute cache). A model not listed
// here shows tokens only on the admin card — its cost is never guessed.
const PRICES = {
    "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2 },
    "claude-sonnet-5-5": { input: 2, output: 10, cacheRead: 0.2 },
    "claude-sonnet-5": { input: 2, output: 10, cacheRead: 0.2 },
}
const CACHE_WRITE_MULTIPLIER = 1.25
const WEB_SEARCH_PER_THOUSAND = 10

const countsOf = (payload) => {
    const usage = (payload && payload.usage) || {}
    const number = (value) => (typeof value === "number" && value > 0 ? value : 0)
    return {
        calls: 1,
        inputTokens: number(usage.input_tokens),
        outputTokens: number(usage.output_tokens),
        cacheReadTokens: number(usage.cache_read_input_tokens),
        cacheWriteTokens: number(usage.cache_creation_input_tokens),
        webSearches: number(usage.server_tool_use && usage.server_tool_use.web_search_requests),
    }
}

const recordUsage = (job, model, payload, now = new Date()) => {
    try {
        if (mongoose.connection.readyState !== 1) return
        const AiUsage = require("../model/aiUsageModel")
        // the model the API actually served, if it says (the server-side fallback can switch it)
        const served = (payload && payload.model) || model || "unknown"
        const key = { day: now.toISOString().slice(0, 10), job, model: served }
        const counts = { $inc: countsOf(payload) }
        // Two calls finishing together (grading runs answers in parallel) can both try to create the
        // day's row; the loser gets a duplicate-key error. The row exists by then, so once more is enough.
        AiUsage.updateOne(key, counts, { upsert: true })
            .catch((error) => (error.code === 11000 ? AiUsage.updateOne(key, counts, { upsert: true }) : Promise.reject(error)))
            .catch((error) => console.error(`aiUsage: could not record ${job} — ${error.message}`))
    } catch (error) {
        console.error(`aiUsage: could not record ${job} — ${error.message}`)
    }
}

// dollars for one row's counts, or null for a model with no listed price
const costOf = (row) => {
    const price = PRICES[row.model]
    if (!price) return null
    const tokens = (row.inputTokens * price.input)
        + (row.outputTokens * price.output)
        + (row.cacheReadTokens * price.cacheRead)
        + (row.cacheWriteTokens * price.input * CACHE_WRITE_MULTIPLIER)
    return Math.round(((tokens / 1e6) + (row.webSearches * WEB_SEARCH_PER_THOUSAND / 1000)) * 100) / 100
}

module.exports = { recordUsage, countsOf, costOf, PRICES }
