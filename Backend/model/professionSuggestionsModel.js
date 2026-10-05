const mongoose = require("mongoose")

// WHAT MENTORS SAY ABOUT THEIR OWN PROFESSION, ONE ROW PER PROFESSION — KEPT FOR GOOD (owner, Round 17).
//
// `mentor_suggestions` is a permanent STACK of opinions, one per mentor per topic (a section of the
// sheet, or one quality — "qualities:focus"). A mentor who answers a topic again replaces their own
// earlier opinion on it; their other topics stay. "Looks right" is kept too (`agrees: true`), because
// agreement with what we show is part of the consensus. As more mentors of a field answer, the stack
// grows and the monthly check (housekeeping/mentorPass.js) sees the consensus.
//
// Nothing is ever emptied. The only deletion is the admin's "Remove as wrong" during the monthly
// review in Data updates, and every removal is logged in `removedOpinions`.
//
// `topics` remembers, per topic, when Claude last weighed it, what it concluded and what the admin
// decided — so a topic is weighed again only when a mentor adds or changes an opinion on it.
//
// Shaped like the `mentor_suggestions` list that Export patch → tools/applyDataPatch.js writes into
// that profession in ALL-professions.json — the live copy is here because Render's disk is wiped on
// every deploy, so the server can never write the data file itself.

const opinionSchema = new mongoose.Schema(
    {
        mentor: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        mentorName: { type: String, default: "" },
        section: { type: String, required: true },   // a SECTIONS id, "qualities" or "skills_missing"
        factor: { type: String },                    // qualities only
        direction: { type: String },                 // higher | lower (qualities only)
        agrees: { type: Boolean, default: false },   // "looks right" / "about right" (Round 17)
        note: { type: String, default: "" },
        sourceUrl: { type: String, default: "" },
        suggestedAt: { type: Date, default: Date.now },   // first said
        updatedAt: { type: Date, default: Date.now },     // last changed — what makes the topic due again
        approvedAt: { type: Date },                       // Round 15 approvals only
        // Round 16 only (kept so an older row still reads)
        outcome: { type: String },
        reason: { type: String },
        proposalId: { type: mongoose.Schema.Types.ObjectId, ref: "DataProposal" },
        processedAt: { type: Date },
    },
    { _id: false }
)

const topicSchema = new mongoose.Schema(
    {
        key: { type: String, required: true },       // "pay", "qualities:focus", …
        lastCheckedAt: { type: Date, default: null },
        lastOutcome: {
            decision: { type: String },              // proposed | not_changed
            reason: { type: String, default: "" },
            proposalId: { type: mongoose.Schema.Types.ObjectId, ref: "DataProposal", default: null },
            at: { type: Date },
        },
        adminDecision: { type: String, default: null },   // approved | rejected — on the last proposal
        adminDecidedAt: { type: Date, default: null },
    },
    { _id: false }
)

const professionSuggestionsSchema = new mongoose.Schema(
    {
        professionId: { type: String, required: true, unique: true },
        professionName: { type: String, default: "" },
        mentor_suggestions: { type: [opinionSchema], default: [] },
        topics: { type: [topicSchema], default: [] },
        removedOpinions: {
            type: [{ _id: false, mentorName: String, topic: String, note: String, at: Date, by: String }],
            default: [],
        },
        approved: { type: [opinionSchema], default: [] },    // Round 15 approvals, still exported
        processed: { type: [opinionSchema], default: [] },   // Round 16; folded back into the stack on use
    },
    { timestamps: true }
)

const ProfessionSuggestions = mongoose.model("ProfessionSuggestions", professionSuggestionsSchema)

module.exports = ProfessionSuggestions
