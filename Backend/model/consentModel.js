const mongoose = require("mongoose")

// Parental consent for students under 18.
//
// V1 was a self-declared "I have my parent's permission" checkbox (isTemporary: true). Round 10 adds
// the verified step on this same row: a 6-digit code emailed to the PARENT, entered back here. A
// verified row is consentMethod "otp_email", isTemporary false, with verifiedAt. Every row still
// isTemporary: true is a student whose parent has not confirmed yet — the dashboard asks them to.
// SMS codes come later (V2); the row shape will not change.

const consentSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            unique: true, // one consent record per student
        },
        parentName: {
            type: String,
            required: true,
        },
        parentPhone: {
            type: String,
            required: true,
        },
        isParentPermissionChecked: {
            type: Boolean,
            required: true, // must be true — checked in the route handler
        },
        consentMethod: {
            type: String,
            default: "self_declared_checkbox", // self_declared_checkbox | otp_email (Round 10) | otp_sms (V2)
        },
        isTemporary: {
            type: Boolean,
            default: true,
        },
        consentGivenAt: {
            type: Date,
            required: true,
        },
        ipAtConsent: {
            type: String,
        },
        policyVersion: {
            type: String,
        },
        // ── the verified step (Round 10) ──
        parentEmail: {
            type: String,
            lowercase: true,
            trim: true,
        },
        // the current code, hashed — never stored as typed — with its clock and its tries
        otpHash: {
            type: String,
            default: null,
        },
        otpExpiresAt: {
            type: Date,
            default: null,
        },
        otpAttempts: {
            type: Number,
            default: 0,
        },
        otpSentAt: {
            type: Date,
            default: null,
        },
        verifiedAt: {
            type: Date,
            default: null,
        },
        ipAtVerify: {
            type: String,
        },
    },
    {
        timestamps: true,
    }
)

// V2: find every student whose consent is still the temporary checkbox
consentSchema.index({ isTemporary: 1 })

const Consent = mongoose.model("Consent", consentSchema)

module.exports = Consent
