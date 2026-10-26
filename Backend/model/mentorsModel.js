const mongoose = require("mongoose")

// a mentor's onboarding profile (PRD §B.9) — V1 has no booking machinery, this is supply capture.
// The login itself is a User with role "mentor"; this holds everything the 12-field form collects.
//
// preferredCurrency, residenceCitizenship and `payout` are ADMIN-ONLY. They exist for payouts and must
// never reach a student-facing response — only the admin list routes and the mentor's own profile read them.

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
        // 4–6 (Round 12): chosen from OUR lists, so a mentor matches a student's choice exactly
        professionId: {
            type: String, // one of the 223 careers (ALL-professions.json)
        },
        professionName: {
            type: String,
        },
        jobRole: {
            type: String, // one of that career's job_roles, or the mentor's own words when jobRoleOther is set
        },
        jobRoleOther: {
            type: String, // "something else in this career", in their words
        },
        industryCodes: {
            type: [String],
            default: [], // codes from utils/industries.js
        },
        // the readable forms of the three above, kept so every screen that showed them still does
        // (and so profiles written before Round 12, which only have these, keep working)
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
            type: String, // 11. ADMIN-ONLY (before Round 34; the region and payout details below replace it)
        },
        residenceCitizenship: {
            type: String, // 12. ADMIN-ONLY — the country they live in
        },
        // ── Round 34 (owner): where they live, how they're paid, their booking links, their tier ──
        region: {
            type: String,      // indian | international (an Indian living abroad) — sets their pay; only an admin changes it after approval
            default: null,
        },
        // ADMIN-ONLY, like 11–12: what we need to pay them by hand today (and RazorpayX later)
        payout: {
            upiId: { type: String, default: "" },
            accountName: { type: String, default: "" },
            accountNumber: { type: String, default: "" },
            ifsc: { type: String, default: "" },
            pan: { type: String, default: "" },
            intlMethod: { type: String, default: "" },   // international: an Indian NRE/NRO account, Wise or PayPal email — in their words
        },
        // the two Calendly links a matched student books from (1-hour main, 20-minute follow-up)
        calendlyMain: { type: String, default: "" },
        calendlyFollowUp: { type: String, default: "" },
        tier: {
            type: Number,      // 1 | 2 | 3 — utils/mentorTiers.js; 1 → 2 is automatic, 3 is the admin's
            default: 1,
        },
        tierHistory: {
            type: [{ tier: Number, at: Date, by: String }],   // by: "auto" | "admin"
            default: [],
        },
        customRateInr: { type: Number, default: null },   // Tier 3 "+": a higher rate the admin set
        customRateUsd: { type: Number, default: null },
        strikes: {
            type: [{ at: Date, reason: String, student: { type: mongoose.Schema.Types.ObjectId, ref: "User" } }],   // didn't prepare, respond or turn up
            default: [],
        },
        firstSessionApproved: {
            type: Boolean,     // after their first feedback the admin approves them to continue (or removes them)
            default: null,
        },
        status: {
            type: String,
            default: "pending_review", // pending_review (profile in; training and test next) | test_submitted | onboarded | rejected | paused (Round 28: after a student's report) | removed (Round 34: not kept after the first session) — server-owned, only an admin moves it past test_submitted
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
