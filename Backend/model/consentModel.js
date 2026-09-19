const mongoose = require("mongoose")

// TEMPORARY (V1): a self-declared "I have my parent's permission" checkbox for students under 18.
// V2 replaces this with verified parental consent on this same collection —
// every row with isTemporary: true is a student to ask again.

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
            default: "self_declared_checkbox", // self_declared_checkbox | otp (V2)
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
    },
    {
        timestamps: true,
    }
)

// V2: find every student whose consent is still the temporary checkbox
consentSchema.index({ isTemporary: 1 })

const Consent = mongoose.model("Consent", consentSchema)

module.exports = Consent
