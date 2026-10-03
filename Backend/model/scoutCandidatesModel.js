const mongoose = require("mongoose")

// THE EMERGING-CAREERS WATCHLIST (owner, Round 10) — written by the weekly scout
// (housekeeping/careerScout.js), read in the admin "Emerging careers" tab.
//
// ONE LIST, THREE SOURCES. A title gets here from new job-board postings, from careers students said
// they wanted but that matched none of our 223, or from the official reports naming it as new or
// growing (Round 11) — and the tags say which, because "students keep asking for it", "employers
// keep hiring for it" and "the reports call it emerging" are different reasons to add a career.
//
// One row per normalised title, updated every week it shows up, so the posting counts build a trend.
// Approving as a new or combined career queues a draft built the way the 223 were
// (housekeeping/draftCareer.js, careerDraftsModel); it reaches students only through an accepted
// draft, an exported patch, a commit and a deploy.

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
        sources: {
            type: [{ type: String, enum: ["job_board", "student_aspirations", "reports"] }],
            default: [],
        },
        reportUrl: {
            type: String,
            default: null, // where the reports source named it
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
        nearestRoles: {
            type: [{ role: String, professionId: String, similarity: Number }],
            default: [], // the closest of our job titles — why it was not dropped as already known
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
