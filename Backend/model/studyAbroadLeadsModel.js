const mongoose = require("mongoose")

// A STUDENT WHO ASKED TO BE PUT IN TOUCH WITH A STUDY-ABROAD PARTNER (Round 11). One row per student.
//
// Created only on an explicit opt-in with a ticked consent box; the consent time and the privacy
// policy version in force are kept with it (DPDP purpose limitation). The admin shares the lead
// with the partner by hand and records that here — the partner is not named in the code.

const studyAbroadLeadSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            unique: true,
        },
        careerIds: {
            type: [String],
            default: [],
        },
        careers: {
            type: [String],
            default: [],
        },
        consentAt: {
            type: Date,
            required: true,
        },
        policyVersion: {
            type: String,
            required: true,
        },
        status: {
            type: String,
            enum: ["new", "shared", "closed"],
            default: "new",
        },
        adminNote: {
            type: String,
            default: "",
        },
    },
    {
        timestamps: true,
    }
)

const StudyAbroadLead = mongoose.model("StudyAbroadLead", studyAbroadLeadSchema)

module.exports = StudyAbroadLead
