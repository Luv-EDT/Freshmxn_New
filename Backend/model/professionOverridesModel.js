const mongoose = require("mongoose")

// THE LIVE LAYER OVER ALL-professions.json (Round 10, S9). One row per career the monthly refresh
// has looked at.
//
//     values         the admin-approved display values — demand, early pay, mid-career pay
//     lastCheckedAt  when the refresh last looked, changed or not, so the next run starts with the
//                    careers checked longest ago
//
// Why a database layer and not an edit to the JSON: Render's disk is wiped on every deploy, so a
// file written on the server would vanish. The admin's "Export patch" turns approved values into a
// file the owner commits (tools/applyDataPatch.js), after which the row is no longer needed.
//
// Display only. The matching engine reads the JSON and never this.

const professionOverrideSchema = new mongoose.Schema(
    {
        professionId: {
            type: String,
            required: true,
            unique: true,
        },
        values: {
            india_demand: { type: String, default: undefined },
            early_earnings_lpa: { type: String, default: undefined },
            mid_career_lpa: { type: String, default: undefined },
        },
        sources: {
            type: [{ url: String, title: String }],
            default: [],
        },
        approvedAt: {
            type: Date,
            default: null,
        },
        lastCheckedAt: {
            type: Date,
            default: null,
        },
    },
    {
        timestamps: true,
    }
)

const ProfessionOverride = mongoose.model("ProfessionOverride", professionOverrideSchema)

module.exports = ProfessionOverride
