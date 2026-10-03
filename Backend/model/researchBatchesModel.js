const mongoose = require("mongoose")

// ONE HALF-PRICE BATCH of research questions (Round 12) — what the monthly data refresh or study bot
// handed to Anthropic's Message Batches API, waiting for the hourly batch_collect to pick up the
// answers (housekeeping/researchBatch.js).
//
// Each item keeps everything needed to finish it later without re-reading anything that may have
// changed in between: the question as sent, and the context its answer is checked against (today's
// values, the job-board figures fetched at submit time).

const batchItemSchema = new mongoose.Schema(
    {
        customId: { type: String, required: true },
        kind: { type: String, required: true },      // career | college | exam | fact
        id: { type: String, required: true },
        name: { type: String },
        request: { type: mongoose.Schema.Types.Mixed },
        context: { type: mongoose.Schema.Types.Mixed },
        outcome: { type: String, default: null },     // handled | retried | failed
    },
    { _id: false }
)

const researchBatchSchema = new mongoose.Schema(
    {
        batchId: {
            type: String,
            required: true,
            unique: true,
        },
        job: {
            type: String,           // data_refresh | study_refresh
            required: true,
        },
        model: {
            type: String,
        },
        items: {
            type: [batchItemSchema],
            default: [],
        },
        status: {
            type: String,
            default: "submitted",   // submitted | collecting | collected
        },
        submittedAt: { type: Date, default: Date.now },
        collectingAt: { type: Date, default: null },
        collectedAt: { type: Date, default: null },
        summary: { type: mongoose.Schema.Types.Mixed, default: null },
    },
    {
        timestamps: true,
    }
)

researchBatchSchema.index({ status: 1, submittedAt: 1 })

const ResearchBatch = mongoose.model("ResearchBatch", researchBatchSchema)

module.exports = ResearchBatch
