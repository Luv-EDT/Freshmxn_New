const mongoose = require("mongoose")

// A LICENCE ROUTE ABROAD AN ADMIN HAS APPROVED (Round 13) — the study bot re-read one row of
// data/abroad_work.json on the licensing body's own site and the admin approved the change. Keyed
// "<careerId>:<country code>". Export patch writes it back into the file.

const abroadLicenceOverrideSchema = new mongoose.Schema(
    {
        key: {
            type: String,
            required: true,
            unique: true,
        },
        values: {
            type: mongoose.Schema.Types.Mixed,   // { body, exam, steps, url }
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

const AbroadLicenceOverride = mongoose.model("AbroadLicenceOverride", abroadLicenceOverrideSchema)

module.exports = AbroadLicenceOverride
