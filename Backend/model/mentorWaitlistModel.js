const mongoose = require("mongoose")

// a Tier-2 student's place on the mentor waitlist (PRD §B.10).
//
// The PAYMENT is not recorded here — grantAccess already writes it and flips progress.mentor to
// "waitlisted". This row records what happens after: the career and the ONE job role in it they choose (Round 11),
// and the match.
//
// THE 20-BUSINESS-DAY CLOCK STARTS AT choiceSentAt, NEVER AT PAYMENT. Both the PRD and the public
// waitlist page promise that; a student who pays today and chooses in a month must not find their
// match "overdue" the day they choose.

const mentorWaitlistSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            unique: true, // one place per student
        },
        chosenProfessionId: {
            type: String, // taken from the student's own ranked_professions, never from the request body
        },
        chosenProfessionName: {
            type: String,
        },
        chosenJobRole: {
            type: String, // one of that career's job_roles (Round 11) — read from the data file, never trusted from the body
        },
        choiceSentAt: {
            type: Date, // the clock starts here
        },
        matchStatus: {
            type: String,
            default: "awaiting_choice", // awaiting_choice | matching | matched | unmatchable
        },
        assignedMentor: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User", // a user with role "mentor" whose profile is onboarded
        },
        matchedAt: {
            type: Date,
        },
        resolution: {
            type: String, // matched | rolled_over | refunded | left_tier2 (set automatically when the student moves off Tier 2) — recorded here; money still moves through the refund tooling
        },
        adminNote: {
            type: String,
        },
    },
    {
        timestamps: true,
    }
)

// admin list by state
mentorWaitlistSchema.index({ matchStatus: 1, choiceSentAt: 1 })

const MentorWaitlist = mongoose.model("MentorWaitlist", mentorWaitlistSchema)

module.exports = MentorWaitlist
