const mongoose = require("mongoose")

// everything a student answers on a form. `interest` is deliberately loose because its fields
// will keep expanding. Current shape of `interest`:
//
//   preHighSchool { skipped, ...lifeStage }  highSchool / college / postCollege { ...lifeStage }
//     lifeStage = personalGrowth[], curiosityDriven[], socialRecognition[], effortlessEngagement[],
//                 individualInternalProblems / interpersonalInternalProblems / externalProblems
//                     [{ problem, source: "typed" | "prompt", activities[] }],
//                 additionalInterests [{ activity, reason }]
//   currentInterests { persistentInterests [{ activity, confidence, source: "activity" | "aspiration" }],
//                      passion[], longTermPursuits[],
//                      discontinuedPursuits [{ activity, reason[], otherReason, youOrThem }],
//                      achievementRelated [{ activity, achievement }] }
//   currentChallenges { presentConcerns [{ problem, youOrThem, source }] }
//   persistentProblems { internal / interpersonal / external [{ problem, reason, activityFailure }] }
//   backgroundInfo { ...22 keys, culturalIdentity[], supportNetwork[] }
//   aspirationalProfessions [{ professionText, professionId }]
//   extractedActivities [{ activity, reason }]   extractedProblems [{ problem, reason, activityFailure }]
//
// `interest` and `psychometric` are Mixed: Mongoose does NOT track changes inside them,
// so always write with findOneAndUpdate + $set, never .push() + .save()

const submissionSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            unique: true, // one submission document per student
        },
        sessionId: {
            type: String,
        },
        interest: {
            type: Object,
            default: {},
        },
        psychometric: {
            type: Object,
            default: {}, // Day 2
        },
        isComplete: {
            type: Boolean,
            default: false, // false while the student is still moving between sections
        },
        lastSavedAt: {
            type: Date, // stamped on every section change — the frontend compares it with its local draft
        },
        submittedAt: {
            type: Date,
        },
    },
    {
        timestamps: true,
        minimize: false, // keep empty sub-objects instead of silently dropping them
    }
)

const Submission = mongoose.model("Submission", submissionSchema)

module.exports = Submission
