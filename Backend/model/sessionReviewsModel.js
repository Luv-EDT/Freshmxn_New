const mongoose = require("mongoose")

// A STUDENT'S FEEDBACK ON A MENTOR SESSION (owner, Rounds 28 and 34). It opens once the admin presses
// "Session done" (after the mentor confirms on WhatsApp), and is filled once. Submitting it says both
// sessions are over and closes the student's mentor ticket; it is also what makes the mentor's payout due.
//
// Round 34 (owner) asks what the mentor covered, how they were, whether they stayed within limits, and a
// rating out of 10. Reviews written before Round 34 keep their two old answers.

const COVERED = ["overview", "journey", "relate", "success", "resources"]   // yes | partly | no
const QUALITIES = ["empathetic", "knowledgeable", "clear", "clarity", "recommend"]   // yes | somewhat | no

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
        covered: { type: Object, default: null },         // { overview: "yes" | "partly" | "no", … }
        qualities: { type: Object, default: null },       // { empathetic: "yes" | "somewhat" | "no", … }
        withinLimits: { type: String, enum: ["yes", "no", null], default: null },
        concern: { type: String, default: "" },           // anything about their behaviour that bothered the student
        // before Round 34
        helpedDecide: { type: String, enum: ["yes", "somewhat", "no", null], default: null },
        wouldRecommend: { type: String, enum: ["yes", "no", null], default: null },
        comment: { type: String, default: "" },
    },
    { timestamps: true }
)

reviewSchema.index({ user: 1, waitlist: 1, sessionIndex: 1 }, { unique: true })
reviewSchema.index({ mentor: 1, createdAt: -1 })

module.exports = mongoose.model("SessionReview", reviewSchema)
module.exports.COVERED = COVERED
module.exports.QUALITIES = QUALITIES
