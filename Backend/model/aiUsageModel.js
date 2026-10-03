const mongoose = require("mongoose")

// WHAT THE AI CALLS ACTUALLY COST (Round 11) — one row per day, per job, per model, counted up by
// utils/aiUsage.recordUsage after every Claude call. The admin's "AI usage" card sums a month.
// Token counts only: nothing a student wrote is stored here.

const aiUsageSchema = new mongoose.Schema(
    {
        day: {
            type: String,      // "2026-10-03" (UTC)
            required: true,
        },
        job: {
            type: String,
            required: true,
        },
        model: {
            type: String,
            required: true,
        },
        calls: { type: Number, default: 0 },
        inputTokens: { type: Number, default: 0 },
        outputTokens: { type: Number, default: 0 },
        cacheReadTokens: { type: Number, default: 0 },
        cacheWriteTokens: { type: Number, default: 0 },
        webSearches: { type: Number, default: 0 },
    },
    {
        timestamps: true,
    }
)

aiUsageSchema.index({ day: 1, job: 1, model: 1 }, { unique: true })

const AiUsage = mongoose.model("AiUsage", aiUsageSchema)

module.exports = AiUsage
