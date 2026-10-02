const mongoose = require("mongoose")

// THE 6- AND 12-MONTH FOLLOW-UP (owner, Round 10). Six and twelve months after a student's FIRST
// report (reports.generatedAt, which is never overwritten for exactly this reason), they are emailed
// a link to four short questions: what they are doing now, which career, whether they followed one of
// their matches, how satisfied they are. These answers are the outcome data the V3 "fitted weights"
// need — the only way the model's expert-judgement weights can ever be checked against real lives.
//
// The link carries a random token; only its hash is stored, and it expires.

const followUpSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        wave: {
            type: Number,
            required: true, // 6 | 12 (months after the student's follow-up clock started)
        },
        anchorAt: {
            type: Date,
            default: null, // the clock this wave counts from (User.followUpAnchorAt, Round 11)
        },
        tokenHash: {
            type: String,
            required: true,
        },
        sentAt: {
            type: Date,
            default: null,
        },
        reminderSentAt: {
            type: Date,
            default: null,
        },
        expiresAt: {
            type: Date,
            required: true,
        },
        respondedAt: {
            type: Date,
            default: null,
        },
        answers: {
            doingNow: { type: String },            // studying | working | preparing_for_exam | between_things | other
            careerId: { type: String },            // one of their own matches, or null
            careerText: { type: String },          // "other", in their own words
            followedMatch: { type: String },       // yes | partly | no
            satisfaction: { type: Number },        // 1-5
            note: { type: String },
        },
    },
    {
        timestamps: true,
    }
)

// one of each wave per student PER CLOCK — a student who says they are heading somewhere new starts a
// new clock and is asked again (Round 11)
followUpSchema.index({ user: 1, wave: 1, anchorAt: 1 }, { unique: true })
followUpSchema.index({ tokenHash: 1 })
followUpSchema.index({ respondedAt: 1, sentAt: 1 })

const FollowUp = mongoose.model("FollowUp", followUpSchema)

module.exports = FollowUp
