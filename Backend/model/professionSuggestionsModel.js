const mongoose = require("mongoose")

// MENTORS' SUGGESTED CHANGES, ONE ROW PER PROFESSION (owner, Round 15). Only what a mentor says should
// CHANGE reaches here — "needs a change" on a section, "should be higher / lower" on a quality, or a
// skill we're missing; "looks right" stays on the mentor's own sheet (mentorReviewsModel). A second
// mentor of the same profession adds to the same row's list.
//
// Round 16 (owner): once a month Claude reads the list (housekeeping/mentorPass.js). What a source
// supports becomes a proposal in admin → Data updates; the rest is discarded with a reason. Either
// way the suggestion moves to `processed`, so `mentor_suggestions` empties. (`approved` holds the
// Round 15 approvals made before this pass existed; Export patch still carries them.)
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
        approvedAt: { type: Date },                  // set when it moves to `approved` (Round 15)
        // Round 16, `processed` only — what Claude's monthly pass did with it
        outcome: { type: String },                   // used | discarded
        reason: { type: String },
        proposalId: { type: mongoose.Schema.Types.ObjectId, ref: "DataProposal" },
        processedAt: { type: Date },
    },
    { _id: false }
)

const professionSuggestionsSchema = new mongoose.Schema(
    {
        professionId: { type: String, required: true, unique: true },
        professionName: { type: String, default: "" },
        mentor_suggestions: { type: [suggestionSchema], default: [] },
        approved: { type: [suggestionSchema], default: [] },
        processed: { type: [suggestionSchema], default: [] },
    },
    { timestamps: true }
)

const ProfessionSuggestions = mongoose.model("ProfessionSuggestions", professionSuggestionsSchema)

module.exports = ProfessionSuggestions
