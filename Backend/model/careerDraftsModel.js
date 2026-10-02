const mongoose = require("mongoose")

// A CAREER DRAFTED FROM AN APPROVED SCOUT ROW (owner, Round 11) — housekeeping/draftCareer.js builds
// it the way ALL-professions.json was built: the record in the DECISIONS.md §1 schema, three rating
// passes against factor_anchors.json, and its embedding. The admin reads it in "Emerging careers"
// and accepts it or sends it back with a note. An accepted draft goes into Export patch; it reaches
// students only when the patch is applied to the data files, committed and deployed.

const careerDraftSchema = new mongoose.Schema(
    {
        candidate: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "ScoutCandidate",
            required: true,
            unique: true, // one draft per watchlist row; a redraft replaces it
        },
        kind: {
            type: String,
            enum: ["new", "combined"],
            required: true,
        },
        status: {
            type: String,
            enum: ["drafting", "ready", "failed", "accepted", "sent_back"],
            default: "drafting",
        },
        record: {
            type: Object,
            default: null, // the ALL-professions.json record (new) or the combined_careers.json row (combined)
        },
        rating: {
            type: Object,
            default: null, // the baseline_rating.json entry (new only)
        },
        embedding: {
            type: [Number],
            default: [], // the profession_embeddings.json vector (new only)
        },
        warnings: {
            type: [String],
            default: [], // rule checks the draft did not pass — shown to the admin, never hidden
        },
        attempts: {
            type: Number,
            default: 0,
        },
        adminNote: {
            type: String,
            default: "", // "send back" feedback, given to the next attempt
        },
        error: {
            type: String,
            default: null,
        },
    },
    {
        timestamps: true,
    }
)

const CareerDraft = mongoose.model("CareerDraft", careerDraftSchema)

module.exports = CareerDraft
