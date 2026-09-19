const mongoose = require("mongoose")

// a pending "confirm your email" link. Same shape and same reasoning as passwordResets:
// kept off the user document so the token can never ride along when a user is sent to the browser.

const emailVerificationSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        tokenHash: {
            type: String,
            required: true,
            unique: true, // sha256 of the emailed token — the verify lookup is by this
        },
        expiresAt: {
            type: Date,
            required: true,
        },
        usedAt: {
            type: Date,
            default: null,
        },
    },
    {
        timestamps: true,
    }
)

// TTL: MongoDB deletes the row by itself once expiresAt has passed
emailVerificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

const EmailVerification = mongoose.model("EmailVerification", emailVerificationSchema)

module.exports = EmailVerification
