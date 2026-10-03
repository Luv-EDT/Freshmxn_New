const mongoose = require("mongoose")

// THE LIVE LAYER OVER TWO STUDY FACTS (Round 12): a career's master's need (`after_undergrad`, in
// ALL-professions.json) and whether studying abroad helps (data/abroad.json). The monthly study bot
// proposes changes with sources; an admin approval lands here and the career page reads it at once.
// Display only — matching ranks careers without either field. Export patch writes approved values
// into the files for a commit, as for the other overrides.

const studyFactOverrideSchema = new mongoose.Schema(
    {
        professionId: {
            type: String,
            required: true,
            unique: true,
        },
        values: {
            after_undergrad: { type: String, default: undefined },
            abroad: { type: Object, default: undefined },   // { need, stage, why }
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

const StudyFactOverride = mongoose.model("StudyFactOverride", studyFactOverrideSchema)

module.exports = StudyFactOverride
