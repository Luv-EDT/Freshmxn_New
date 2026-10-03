const mongoose = require("mongoose")

// THE LIVE LAYER OVER study_places.json (Round 11), one row per discipline the monthly study bot has
// looked at. Each approved change is kept as it was decided — an institution added, one removed
// (stored as "name · city"), or one whose rank or basis changed — and laid over the file when a career page is served
// (utils/studyPlaces.js). Export patch writes them into the file for a commit.

const institutionShape = {
    name: String,
    city: String,
    ownership: String,
    basis: String,
    note: String,
}

const studyPlaceOverrideSchema = new mongoose.Schema(
    {
        disciplineId: {
            type: String,
            required: true,
            unique: true,
        },
        added: {
            type: [institutionShape],
            default: [],
        },
        removed: {
            type: [String],
            default: [],
        },
        updated: {
            type: [institutionShape],
            default: [],
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

const StudyPlaceOverride = mongoose.model("StudyPlaceOverride", studyPlaceOverrideSchema)

module.exports = StudyPlaceOverride
