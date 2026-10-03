const mongoose = require("mongoose")

// A CLOSING RANK AN ADMIN HAS APPROVED (Round 12) — the study bot read it off the official result
// page (JoSAA, MCC, the CLAT consortium) and the admin approved it in Data updates. One row per
// row id in data/cutoffs.json. Export patch writes it back into the file.

const cutoffOverrideSchema = new mongoose.Schema(
    {
        rowId: {
            type: String,
            required: true,
            unique: true,
        },
        values: {
            type: mongoose.Schema.Types.Mixed,   // { closing_rank, year, round, source_url }
            default: null,
        },
        sources: {
            type: [{ url: String, title: String }],
            default: [],
        },
        approvedAt: {
            type: Date,
            default: null,
        },
        lastCheckedAt: {
            type: Date,
            default: null,
        },
    },
    {
        timestamps: true,
    }
)

const CutoffOverride = mongoose.model("CutoffOverride", cutoffOverrideSchema)

module.exports = CutoffOverride
