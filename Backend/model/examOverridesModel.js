const mongoose = require("mongoose")

// THE LIVE LAYER OVER exam_calendar.json (Round 11), one row per exam the monthly study bot has
// looked at — the same idea as professionOverrides, for the same reason (Render's disk is wiped on
// every deploy; Export patch turns approved values into a file the owner commits).
//
//     values         admin-approved "usually" window, exam month and eligibility
//     newExam        an exam the calendar did not have, approved by the admin — it reaches the file
//                    through Export patch, and a career shows it once that career lists it
//     lastCheckedAt  when the bot last looked, changed or not
//
// Display only. Nothing in matching reads exams.

const examOverrideSchema = new mongoose.Schema(
    {
        examId: {
            type: String,
            required: true,
            unique: true,
        },
        values: {
            usual_application_window: { type: String, default: undefined },
            usual_exam_month: { type: String, default: undefined },
            eligibility: { type: String, default: undefined },
        },
        newExam: {
            type: Object,
            default: null,
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

const ExamOverride = mongoose.model("ExamOverride", examOverrideSchema)

module.exports = ExamOverride
