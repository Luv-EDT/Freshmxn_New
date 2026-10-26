const mongoose = require("mongoose")

// A MENTOR'S COMPETENCE TEST (owner, Round 34) — taken after their profile and the three training
// documents, before the admin approves them. 10 questions: 3 the same for everyone (the 5-step flow in
// order, their Calendly links, a 5–10 minute video for a sample student) and 7 drawn at random from
// the bank in mentors/testBank.js, stored here so a reload shows the same 7.
//
// THE VIDEO lives in Cloudflare R2 (utils/r2.js) under `video.key` until the admin decides; approving or
// rejecting deletes it, and a daily check deletes any undecided video older than 30 days. Before R2 is
// set up a mentor may paste a link instead (Loom, Google Drive) — `video.link`.
//
// The multiple-choice answers are pre-marked for the admin; pass or fail is the admin's call.

const testSchema = new mongoose.Schema(
    {
        mentor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
        drawnIds: { type: [String], default: [] },          // the 7 question ids from the bank
        sampleId: { type: String, default: null },          // the sample student for the video
        orders: { type: Object, default: {} },              // { questionId: [shown → bank option index] } — each mentor's own option order
        answers: { type: Object, default: {} },             // { questionId: optionIndex AS SHOWN }
        stepOrder: { type: [String], default: [] },         // the mentor's order of the 5 steps
        stepsArrangedAt: { type: Date, default: null },     // Round 35: when the mentor last put (or confirmed) the order — required to send
        calendlyMain: { type: String, default: "" },
        calendlyFollowUp: { type: String, default: "" },
        video: {
            key: { type: String, default: null },
            link: { type: String, default: null },
            contentType: { type: String, default: null },
            uploadedAt: { type: Date, default: null },
            deletedAt: { type: Date, default: null },
        },
        submittedAt: { type: Date, default: null },
        autoScore: { correct: Number, of: Number, stepsInOrder: Boolean },
        decision: { type: String, enum: ["approved", "rejected", null], default: null },
        decisionNote: { type: String, default: "" },
        decidedAt: { type: Date, default: null },
        decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    },
    { timestamps: true }
)

testSchema.index({ submittedAt: 1, decision: 1 })

module.exports = mongoose.model("MentorTest", testSchema)
