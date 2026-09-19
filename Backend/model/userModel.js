const mongoose = require("mongoose")

// identity + account + payment state ONLY.
// form answers live in submissions, parent permission lives in consent.

const userSchema = new mongoose.Schema(
    {
        role: {
            type: String,
            default: "student", // student | parent | mentor | admin
        },
        email: {
            type: String,
            required: true,
            unique: true,
        },
        password: {
            type: String, // not required — a Google-only account has none
        },
        isEmailVerified: {
            type: Boolean,
            default: false,
        },
        googleId: {
            type: String, // leave unset (not null) for password accounts, so the sparse index skips them
        },
        name: {
            type: String,
            required: true,
        },
        phone: {
            type: String, // the one true copy — access/aid requests display this, not their own snapshot
        },
        age: {
            type: Number,
        },
        journey: {
            type: String, // class9_10 | class11_12 | college | early_professional
        },
        journeyDetail: {
            class: {
                type: Number, // 9 | 10 | 11 | 12
            },
            stream: {
                type: [String], // class 11-12: the class12_prerequisite subject-set
                default: [],
            },
            collegeStage: {
                type: String, // pre_admission | enrolled
            },
            preAdmission: {
                type: Boolean,
                default: false,
            },
            courseYear: {
                type: Number, // 1 | 2 | 3 | 4
            },
            experienceYears: {
                type: Number,
            },
        },
        preferredLanguage: {
            type: String,
            default: "en", // en | hi
        },
        parent: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User", // V2 parent accounts — unused in V1
        },
        lastLoginAt: {
            type: Date,
        },
        paid: {
            type: Boolean,
            default: false,
        },
        currentTier: {
            type: Number,
            default: 0, // 0 = none, 1 = Career Discovery, 2 = Mentorship
        },
        progress: {
            interestForm: {
                type: String,
                default: "not_started", // not_started | in_progress | done
            },
            psychometric: {
                type: String,
                default: "not_started", // not_started | in_progress | done
            },
            report: {
                type: String,
                default: "locked", // locked | ready | locked_final
            },
            mentor: {
                type: String,
                default: "not_applicable", // not_applicable | waitlisted
            },
        },
    },
    {
        timestamps: true,
    }
)

// Google login looks users up by googleId
userSchema.index({ googleId: 1 }, { unique: true, sparse: true })

const User = mongoose.model("User", userSchema)

module.exports = User
