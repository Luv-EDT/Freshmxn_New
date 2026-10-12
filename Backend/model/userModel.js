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
        pendingEmail: {
            type: String,
            default: null, // Round 25: a new address waiting for its confirmation link; the old one works until then
        },
        profileChangedAt: {
            type: Date,
            default: null, // Round 25: stage or its details changed — the report offers "Update my report"
        },
        // Round 28 (owner): Virtual Career Counselling answers saved after the report was built — the
        // report then offers "Update my report", as for a changed stage
        answersChangedAt: {
            type: Date,
            default: null,
        },
        // Round 28 (owner): how many of the three updates from the student's OWN changes are used
        // (utils/selfUpdates.js). Updates because our matching changed never count.
        selfUpdatesUsed: {
            type: Number,
            default: 0,
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
            // Round 10: the degree a college student is doing (or joining) and a working student
            // holds — a family from data/degree_options.json, and its subject where it has one —
            // plus a working student's field in their own words. Matching uses the degree so it is
            // not counted as switching cost for careers it already leads to (degree_families.json).
            degree: {
                type: String,
            },
            subject: {
                type: String,
            },
            field: {
                type: String,   // a working student's own words; since Round 25 only when their profession isn't on our list
            },
            // Round 25 (owner): the year Class 12 was (or will be) finished — college and working
            // students — so an entry window (JEE: 3 years) can say "this route has closed for you";
            // and a working student's current profession from our list, which costs 0 to stay in.
            class12Year: {
                type: Number,
            },
            currentProfessionId: {
                type: String,
            },
        },
        preferredLanguage: {
            type: String,
            default: "en", // en | hi
        },
        storiesSeen: {
            type: [String],
            default: [], // story ids already assigned — the next one is drawn from those NOT here
            // 01_Build_PRD calls this `stories_seen`. Named in this file's own convention instead:
            // every other field here is camelCase, and this is app state, not part of the scoring
            // engine's snake_case contract the way profiles.raw_scores is.
        },
        parent: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User", // V2 parent accounts — unused in V1
        },
        lastLoginAt: {
            type: Date,
        },
        // one device at a time (Round 27): each login moves it on, and a pass carrying an older
        // number is refused — see utils/sessionToken.js
        sessionVersion: {
            type: Number,
            default: 0,
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
        // Set when score_profile or generate_report has failed on its LAST attempt, so the report
        // page can say so instead of showing "generating" forever. Deliberately NOT a
        // `progress.report` value: refunds and "Tier 1 delivered" read `report !== "locked"`, and a
        // failure must never count as delivery. Cleared on a successful report, a new submit or a retry.
        reportFailedAt: {
            type: Date,
            default: null,
        },
        // Round 10: the student asked not to be emailed the 6- and 12-month follow-up questions
        followUpOptOut: {
            type: Boolean,
            default: false,
        },
        // Round 11: WHEN THE 6/12-MONTH FOLLOW-UP CLOCK STARTED. Set at the first assessment submit,
        // and moved only when the student says they are heading somewhere NEW (asked on a resubmit
        // and on "Update my report"). A report rebuilt for any other reason never moves it.
        followUpAnchorAt: {
            type: Date,
            default: null,
            index: true,
        },
        // every answer to "same way, or something new?" — outcome data in its own right
        directionChanges: {
            type: [{ at: Date, via: String, choice: String }],   // via: resubmit | update · choice: same | new
            default: [],
        },
        // Round 11: the student pressed "Update my report" — the page shows "being updated" until a
        // report newer than this exists
        reportUpdateRequestedAt: {
            type: Date,
            default: null,
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
