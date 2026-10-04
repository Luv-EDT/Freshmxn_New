const mongoose = require("mongoose")

// MENTORS' SUGGESTED CHANGES, ONE ROW PER PROFESSION (owner, Round 15). Only what a mentor says should
// CHANGE reaches here — "needs a change" on a section, "should be higher / lower" on a quality, or a
// skill we're missing; "looks right" stays on the mentor's own sheet (mentorReviewsModel). A second
// mentor of the same profession adds to the same row's list. When the admin approves the row, its
// suggestions move to `approved` (for Export patch) and `mentor_suggestions` is empty again.
//
// Shaped like the `mentor_suggestions` list that Export patch → tools/applyDataPatch.js writes into
// that profession in ALL-professions.json — the live copy is here because Render's disk is wiped on
// every deploy, so the server can never write the data file itself.

const suggestionSchema = new mongoose.Schema(
    {
        mentor: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        mentorName: { type: String, default: "" },
        section: { type: String, required: true },   // a SECTIONS id, "qualities" or "skills_missing"
        factor: { type: String },                    // qualities only
        direction: { type: String },                 // higher | lower (qualities only)
        note: { type: String, default: "" },
        sourceUrl: { type: String, default: "" },
        suggestedAt: { type: Date, default: Date.now },
        approvedAt: { type: Date },                  // set when it moves to `approved`
    },
    { _id: false }
)

const professionSuggestionsSchema = new mongoose.Schema(
    {
        professionId: { type: String, required: true, unique: true },
        professionName: { type: String, default: "" },
        mentor_suggestions: { type: [suggestionSchema], default: [] },
        approved: { type: [suggestionSchema], default: [] },
    },
    { timestamps: true }
)

const ProfessionSuggestions = mongoose.model("ProfessionSuggestions", professionSuggestionsSchema)

module.exports = ProfessionSuggestions
