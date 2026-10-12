const mongoose = require("mongoose")

// A STUDENT'S REVIEW OF A MENTOR SESSION (owner, Round 28). The link arrives with the match email; the
// form opens once the admin marks the session done (mentorWaitlist sessions[]), one review per
// session. A rating out of 10 and two plain questions — only what matters to us and to the mentor.

const reviewSchema = new mongoose.Schema(
    {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        waitlist: { type: mongoose.Schema.Types.ObjectId, ref: "MentorWaitlist", required: true },
        sessionIndex: { type: Number, required: true },   // its place in the row's sessions[]
        mentor: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        mentorName: { type: String, default: null },       // "Removed mentor" once that account is deleted
        profession: { type: String, default: null },
        jobRole: { type: String, default: null },
        rating: { type: Number, min: 1, max: 10, required: true },
        helpedDecide: { type: String, enum: ["yes", "somewhat", "no"], required: true },
        wouldRecommend: { type: String, enum: ["yes", "no"], required: true },
        comment: { type: String, default: "" },
    },
    { timestamps: true }
)

reviewSchema.index({ user: 1, waitlist: 1, sessionIndex: 1 }, { unique: true })
reviewSchema.index({ mentor: 1, createdAt: -1 })

module.exports = mongoose.model("SessionReview", reviewSchema)
