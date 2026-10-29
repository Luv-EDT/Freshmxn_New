const mongoose = require("mongoose")

// A COMPANY'S REQUEST from /corporates (owner, Round 40b): the short contact form. Kept here and emailed to the
// founder, so a failed email never loses one.

const enquirySchema = new mongoose.Schema(
    {
        name: { type: String, required: true },
        email: { type: String, required: true },
        company: { type: String, default: "" },
        phone: { type: String, default: "" },
        teamSize: { type: String, default: "" },
        message: { type: String, default: "" },
        emailed: { type: Boolean, default: false },
    },
    { timestamps: true }
)

module.exports = mongoose.model("CorporateEnquiry", enquirySchema)
