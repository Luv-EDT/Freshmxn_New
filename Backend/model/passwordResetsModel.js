const mongoose = require("mongoose")

// a pending password reset. Kept off the user document so the token can never
// ride along when a user is sent to the browser.

const passwordResetSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        tokenHash: {
            type: String,
            required: true,
            unique: true, // sha256 of the emailed token — the reset lookup is by this
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
passwordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

const PasswordReset = mongoose.model("PasswordReset", passwordResetSchema)

module.exports = PasswordReset
