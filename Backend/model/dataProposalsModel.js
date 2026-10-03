const mongoose = require("mongoose")

// A SUGGESTED CHANGE TO ONE CAREER'S DISPLAYED DATA (Round 10, S9), made by the monthly data refresh
// (housekeeping/dataRefresh.js) and decided by the admin in the "Data updates" tab.
//
// NOTHING CHANGES BY ITSELF. A proposal is only ever shown to the admin. Approving it writes the
// value into professionOverrides, which the career pages read; rejecting it leaves the data alone.
// Only three display fields can be proposed — demand and the two pay ranges. Matching inputs never.
//
// Round 11: the monthly study bot (housekeeping/studyRefresh.js) files proposals here too, told
// apart by `kind`. For an exam, professionId/profession hold the exam's id and name; for colleges,
// the discipline's. A college or new-exam proposal carries its institution or exam as JSON text in
// proposedValue (a removal carries just the institution's name).

const CAREER_FIELDS = ["india_demand", "early_earnings_lpa", "mid_career_lpa"]
const EXAM_FIELDS = ["usual_application_window", "usual_exam_month", "eligibility", "new_exam"]
const COLLEGE_FIELDS = ["add_institution", "remove_institution", "update_institution"]
// Round 12: a career's master's need and whether studying abroad helps — kind "study_fact"
const STUDY_FACT_FIELDS = ["after_undergrad", "abroad"]
// Round 12: last year's closing rank for one row of data/cutoffs.json — kind "cutoff"; professionId
// holds the row id, proposedValue the JSON { closing_rank, year, round, source_url }
const CUTOFF_FIELDS = ["closing_rank"]

const dataProposalSchema = new mongoose.Schema(
    {
        kind: {
            type: String,
            enum: ["career", "exam", "college", "study_fact", "cutoff"],
            default: "career",
        },
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
            enum: [...CAREER_FIELDS, ...EXAM_FIELDS, ...COLLEGE_FIELDS, ...STUDY_FACT_FIELDS, ...CUTOFF_FIELDS],
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
module.exports.CAREER_FIELDS = CAREER_FIELDS
module.exports.EXAM_FIELDS = EXAM_FIELDS
module.exports.COLLEGE_FIELDS = COLLEGE_FIELDS
module.exports.STUDY_FACT_FIELDS = STUDY_FACT_FIELDS
