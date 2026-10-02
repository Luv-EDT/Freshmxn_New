const mongoose = require("mongoose")

// A SUGGESTED CHANGE TO ONE CAREER'S DISPLAYED DATA (Round 10, S9), made by the monthly data refresh
// (housekeeping/dataRefresh.js) and decided by the admin in the "Data updates" tab.
//
// NOTHING CHANGES BY ITSELF. A proposal is only ever shown to the admin. Approving it writes the
// value into professionOverrides, which the career pages read; rejecting it leaves the data alone.
// Only three display fields can be proposed — demand and the two pay ranges. Matching inputs never.

const dataProposalSchema = new mongoose.Schema(
    {
        professionId: {
            type: String,
            required: true,
        },
        profession: {
            type: String,
            required: true,
        },
        field: {
            type: String,
            enum: ["india_demand", "early_earnings_lpa", "mid_career_lpa"],
            required: true,
        },
        currentValue: {
            type: String,
            default: null,
        },
        proposedValue: {
            type: String,
            required: true,
        },
        reason: {
            type: String,
            default: "",
        },
        confidence: {
            type: String,
            enum: ["low", "medium", "high"],
            default: "low",
        },
        sources: {
            type: [{ url: String, title: String }],
            default: [],
        },
        adzuna: {
            count: { type: Number, default: null },     // live postings
            meanLpa: { type: Number, default: null },
            medianLpa: { type: Number, default: null }, // only with enough salaried postings
        },
        status: {
            type: String,
            enum: ["open", "approved", "rejected", "superseded"],
            default: "open",
        },
        decidedAt: {
            type: Date,
            default: null,
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

dataProposalSchema.index({ status: 1, createdAt: -1 })
dataProposalSchema.index({ professionId: 1, field: 1, status: 1 })

const DataProposal = mongoose.model("DataProposal", dataProposalSchema)

module.exports = DataProposal
