const mongoose = require("mongoose")

// SOMETHING WENT WRONG WITH A STUDENT'S TEST (owner, Round 10): "how do I, as an admin, know that an
// assessment failed because of a technical glitch, and how do they get a retake?"
//
// One row per problem, written by the code that noticed it (utils/assessmentIssues.js) or by the
// student pressing "Something went wrong with this test". The admin's "Assessment issues" tab reads
// these, and "Allow one retake" resolves one. Nothing here is ever shown to another student.

const assessmentIssueSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        module: {
            type: String,
            required: true, // the psychometric block: sartRaw, digitSpan, storyRecall, reasoning, wordRecall, extReasoning, extVerbal — or "report"
        },
        kind: {
            type: String,
            required: true,
            // sart_invalid | digit_span_unfinished | word_recall_unfinished | reasoning_timeouts | grading_failed | report_failed |
            // report_prose_failed | result_disputed | student_reported
        },
        detail: {
            type: String,
            default: "",
        },
        raisedBy: {
            type: String,
            default: "system", // system | student
        },
        status: {
            type: String,
            default: "open", // open | retake_granted | dismissed | resolved
        },
        handledByAdmin: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
        handledAt: {
            type: Date,
        },
        adminNote: {
            type: String,
        },
    },
    {
        timestamps: true,
    }
)

assessmentIssueSchema.index({ status: 1, createdAt: -1 })
assessmentIssueSchema.index({ user: 1, module: 1, kind: 1, status: 1 })

const AssessmentIssue = mongoose.model("AssessmentIssue", assessmentIssueSchema)

module.exports = AssessmentIssue
