const mongoose = require("mongoose")

// WHAT DEMO VISITORS TYPED, WITH NOTHING THAT SAYS WHO (owner, Round 32: "the useful data — activities,
// the profession you want — should feed our usual data processing"). When a demo finishes, each thing
// it pulled them towards and the profession they named is kept here as bare text: no session, no name,
// no email, no IP. The monthly careers scout counts the unmatched aspirations alongside the students'
// (housekeeping/careerScout.js). The activities themselves already built the shared activity cache when
// the demo resolved them. Rows delete themselves after 12 months.

const demoSignalSchema = new mongoose.Schema(
    {
        text: {
            type: String,
            required: true,
        },
        kind: {
            type: String,
            enum: ["aspiration", "activity"],
            required: true,
        },
        matched: {
            type: Boolean,
            default: false,   // did it point to one of our careers?
        },
        nearestCareerIds: {
            type: [String],
            default: [],
        },
        expiresAt: {
            type: Date,
            default: () => new Date(Date.now() + 365 * 24 * 3600 * 1000),
        },
    },
    { timestamps: true }
)

demoSignalSchema.index({ kind: 1, matched: 1 })
demoSignalSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

module.exports = mongoose.model("demo_signals", demoSignalSchema)
