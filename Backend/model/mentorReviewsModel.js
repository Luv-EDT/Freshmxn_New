const mongoose = require("mongoose")

// A MENTOR'S REVIEW OF OUR DATA FOR THEIR OWN PROFESSION (owner, Round 12). Most of a career's facts
// were built by Claude and checked only partly; a working professional is the best second reader.
//
// One row per mentor per profession. Each item is one section of the career as students see it —
// "looks right" or "needs a change" with a note and a source — or one quality the career needs,
// "about right / should be higher / should be lower". NOTHING CHANGES FROM HERE: the admin decides
// each item, and accepted ones travel in Export patch to a reviewed data commit.

const reviewItemSchema = new mongoose.Schema(
    {
        section: { type: String, required: true },     // see SECTIONS in mentorReviewsRouter.js
        verdict: { type: String },                      // right | change (sections)
        factor: { type: String },                       // a factor slug (qualities)
        direction: { type: String },                    // right | higher | lower (qualities)
        note: { type: String, default: "" },
        sourceUrl: { type: String, default: "" },
        decision: { type: String, default: null },      // accepted | noted | rejected — the admin's
    },
    { _id: false }
)

const mentorReviewSchema = new mongoose.Schema(
    {
        mentor: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        professionId: {
            type: String,
            required: true,
        },
        professionName: {
            type: String,
        },
        items: {
            type: [reviewItemSchema],
            default: [],
        },
        skillsMissing: {
            type: String,
            default: "",
        },
        status: {
            type: String,
            default: "open",   // open | reviewed (every item decided)
        },
        submittedAt: {
            type: Date,
            default: null,
        },
        adminNote: {
            type: String,
            default: "",
        },
    },
    {
        timestamps: true,
    }
)

mentorReviewSchema.index({ mentor: 1, professionId: 1 }, { unique: true })

const MentorReview = mongoose.model("MentorReview", mentorReviewSchema)

module.exports = MentorReview
