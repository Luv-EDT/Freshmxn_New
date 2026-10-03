const mongoose = require("mongoose")

// THE ONE-TIME MODEL COMPARISON (owner, Round 12) — the same 20 data-refresh questions asked of two
// models, side by side, so the admin can choose which one runs the monthly research. Nothing from a
// comparison reaches a career page: no proposals are written and no career is marked checked.

const modelComparisonSchema = new mongoose.Schema(
    {
        models: {
            type: [String],
            default: [],
        },
        // per career: { id, name, results: { <model>: { changes, sources, refused, unreadable, cost, inputTokens, outputTokens, webSearches, seconds } } }
        careers: {
            type: [mongoose.Schema.Types.Mixed],
            default: [],
        },
        // per model: { changes, averageSources, failures, costPerCareer, monthlyCost }; agreement: share of careers where both chose the same fields
        summary: {
            type: mongoose.Schema.Types.Mixed,
            default: null,
        },
    },
    {
        timestamps: true,
    }
)

const ModelComparison = mongoose.model("ModelComparison", modelComparisonSchema)

module.exports = ModelComparison
