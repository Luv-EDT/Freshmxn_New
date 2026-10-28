const mongoose = require("mongoose")

// A MENTOR'S SIGNED AGREEMENT (owner, Round 38). The Mentor Agreement (Frontend/public/mentor-training/
// Freshmxn_Mentor_Agreement.pdf) is read, printed, signed and scanned, then uploaded in step 2 ("Tell us
// about yourself") — the profile is not accepted without it. One per mentor; a new upload replaces the old.
//
// The scan is kept here, not in R2: it is small (5 MB at most) and must be kept whether or not R2 is
// switched on. `data` is never selected unless asked for, and only the mentor and the admin can open it.

const AGREEMENT_VERSION = "2026-10"

const agreementSchema = new mongoose.Schema(
    {
        mentor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
        version: { type: String, default: AGREEMENT_VERSION },
        fileName: { type: String, default: "" },
        contentType: { type: String, required: true },
        size: { type: Number, default: 0 },
        data: { type: Buffer, required: true, select: false },
        uploadedAt: { type: Date, default: Date.now },
    },
    { timestamps: true }
)

module.exports = mongoose.model("MentorAgreement", agreementSchema)
module.exports.AGREEMENT_VERSION = AGREEMENT_VERSION
