const mongoose = require("mongoose")

// THE EMERGING-CAREERS WATCHLIST (owner, Round 10) — written by the weekly scout
// (housekeeping/careerScout.js), read in the admin "Emerging careers" tab.
//
// ONE LIST, TWO SOURCES. A title gets here from new job-board postings, from careers students said
// they wanted but that matched none of our 223, or both — and the tag says which, because "students
// keep asking for it" and "employers keep hiring for it" are different reasons to add a career.
//
// One row per normalised title, updated every week it shows up, so the posting counts build a trend.
// Approving records the decision only; the career itself is then built through the normal data
// process (combined: combined_careers.json; new: a full record), never generated here.

const scoutCandidateSchema = new mongoose.Schema(
    {
        key: {
            type: String,
            required: true,
            unique: true, // careerScout.normaliseTitle
        },
        title: {
            type: String,
            required: true,
        },
        source: {
            type: String,
            enum: ["job_board", "student_aspirations", "both"],
            required: true,
        },
        kind: {
            type: String,
            enum: ["new", "between"], // far from every career / sitting between two of them
            required: true,
        },
        nearest: {
            type: [{ id: String, name: String, similarity: Number }],
            default: [],
        },
        postingCounts: {
            type: [{ at: Date, count: Number }],
            default: [], // one per weekly run it appeared in
        },
        aspirationCount: {
            type: Number,
            default: 0, // students whose unmatched aspiration was this
        },
        assessment: {
            payLpa: { type: String, default: null },        // "a-b", lakh a year
            aiResilience: { type: String, default: null },  // low | medium | high
            growth: { type: String, default: null },        // falling | flat | rising
            oneLiner: { type: String, default: null },
            reason: { type: String, default: null },
            sources: { type: [{ url: String, title: String }], default: [] },
            assessedAt: { type: Date, default: null },
        },
        status: {
            type: String,
            enum: ["watch", "approved_combined", "approved_new", "dismissed"],
            default: "watch",
        },
        adminNote: {
            type: String,
            default: "",
        },
        lastSeenAt: {
            type: Date,
            default: null,
        },
    },
    {
        timestamps: true,
    }
)

scoutCandidateSchema.index({ status: 1, lastSeenAt: -1 })

const ScoutCandidate = mongoose.model("ScoutCandidate", scoutCandidateSchema)

module.exports = ScoutCandidate
