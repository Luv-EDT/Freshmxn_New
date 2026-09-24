const mongoose = require("mongoose")

// a mentor's onboarding profile (PRD §B.9) — V1 has no booking machinery, this is supply capture.
// The login itself is a User with role "mentor"; this holds everything the 12-field form collects.
//
// preferredCurrency and residenceCitizenship are ADMIN-ONLY. They exist for payouts and must never
// reach a student-facing response — only the admin list routes select them.

const mentorSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            unique: true, // one profile per mentor login
        },
        name: {
            type: String,
            required: true, // 1. profile-visible
        },
        email: {
            type: String,
            required: true, // 2.
        },
        phone: {
            type: String,
            required: true, // 3. with country code, e.g. +91 9876543210
        },
        currentRole: {
            type: String,
            required: true, // 4. role / title
        },
        discipline: {
            type: String,
            required: true, // 5. discipline / profession
        },
        sectors: {
            type: [String],
            default: [], // 6. industry domains / sectors, past included
        },
        yearsExperience: {
            type: Number,
            required: true, // 7.
        },
        languages: {
            type: [String],
            default: [], // 8.
        },
        motivation: {
            type: String,
            required: true, // 9. open text
        },
        transitionCategory: {
            type: String,
            required: true, // 10. "Category A" | "Category B" | "Category C" | "Category D" — the student form's wording
        },
        preferredCurrency: {
            type: String, // 11. ADMIN-ONLY
        },
        residenceCitizenship: {
            type: String, // 12. ADMIN-ONLY
        },
        status: {
            type: String,
            default: "pending_review", // pending_review | onboarded — server-owned, only an admin approves
        },
        approvedByAdmin: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
        approvedAt: {
            type: Date,
        },
    },
    {
        timestamps: true,
    }
)

// admin list, pending first
mentorSchema.index({ status: 1, createdAt: -1 })

const Mentor = mongoose.model("Mentor", mentorSchema)

module.exports = Mentor
