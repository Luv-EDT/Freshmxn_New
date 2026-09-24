const mongoose = require("mongoose")

// THE STUDENT-FACING REPORT — the prose a model wrote about the ranking, kept apart from the
// ranking itself.
//
// WHY A SEPARATE COLLECTION, and it is not filing tidiness. Rewriting a paragraph must never touch
// the recommendations it describes, and re-running the match must never be blocked by a report that
// failed to generate. They also fail differently: matching is deterministic and reproducible, report
// prose is a model call that can be slow, refused or briefly unavailable. One of those belongs
// behind a retry and the other does not.
//
// AN ADDITION TO 01_Build_PRD §B. The PRD lists `recommendations` (B.7) but gives the composed
// report nowhere to live. This is that place.
//
// WHAT MUST NEVER APPEAR IN `sections`:
//   · match_confidence — computed and stored, never displayed, never an input. A student reading
//     "we are 62% confident" would treat it as a score, which it is not.
//   · data_quality — it records how much INPUT was available per factor, not how confident the
//     student should be. Shown to a student it reads as a verdict on them.
// The report-generation fixture asserts both are absent from the rendered text, because "we did not
// mean to include it" is not a control.

const reportSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            unique: true, // one current report per student
        },
        generatedAt: {
            type: Date,
            required: true,
        },
        report_version: {
            type: String,
            required: true, // which prompt + composition rules produced this
        },
        // The ranking this prose describes. Stored so a report can never be read against a ranking
        // it was not written for — if these drift, the report is stale and must be regenerated.
        matching_version: {
            type: String,
            required: true,
        },
        scoring_version: {
            type: String,
            required: true,
        },
        journey: {
            type: String, // class9_10 | class11_12 | college | early_professional — the report is journey-shaped
        },
        // "release" | "release_with_note" | "withhold", copied from the profile's completeness.
        // A withheld report is still generated and stored; the page renders the completion prompt
        // instead of the findings. Storing it means we can see who was withheld and why.
        release: {
            type: String,
            required: true,
        },
        sections: {
            type: Object,
            default: {}, // the composed prose, keyed by section. Mixed — always $set
        },
        model: {
            type: String, // which model composed it
        },
        reviewStatus: {
            type: String,
            default: "unreviewed", // unreviewed | approved | flagged — minors' reports are safety-sensitive
        },
        adminReview: {
            required: {
                type: Boolean,
                default: false,
            },
            reason: {
                type: String,
                default: null,
            },
        },
    },
    {
        timestamps: true,
        minimize: false,
    }
)

// The review queue reads newest first, and a prompt change re-reads by version to find what needs
// regenerating.
reportSchema.index({ report_version: 1, generatedAt: -1 })
reportSchema.index({ "adminReview.required": 1, generatedAt: -1 })

const Report = mongoose.model("Report", reportSchema)

module.exports = Report
