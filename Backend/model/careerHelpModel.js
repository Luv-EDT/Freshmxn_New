const mongoose = require("mongoose")

// "HOW ELSE CAN WE HELP?" (owner, Round 25) — one row per student, asked after they have chosen a
// career: on the dashboard for Career Discovery, on /mentorship/choose for the mentor plans.
//
// It is a waitlist, not a service yet: we go through it with the student on a detailed call and, if
// they ask, recommend a partner affiliate or a new product of ours. Saved only with the consent box
// ticked; the time and the privacy policy version are kept with it (DPDP purpose limitation).

const WANTS = ["toolkit", "opportunities", "abroad", "other"]

const careerHelpSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            unique: true,
        },
        planTier: {
            type: Number,
            default: null,   // the plan they were on when they asked
        },
        careerId: {
            type: String,
            default: null,   // the career it is for — one of their own matches, or blank
        },
        careerName: {
            type: String,
            default: "",
        },
        wants: {
            type: [String],
            enum: WANTS,     // toolkit = the getting-started skill kit · opportunities = internships, jobs, fellowships · abroad = a master's or settling abroad
            default: [],
        },
        otherText: {
            type: String,
            default: "",     // "Anything else", 300 characters at most
        },
        consentAt: {
            type: Date,
            required: true,
        },
        policyVersion: {
            type: String,
            required: true,
        },
        status: {
            type: String,
            enum: ["new", "called", "closed"],
            default: "new",
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

const CareerHelp = mongoose.model("CareerHelp", careerHelpSchema)

module.exports = CareerHelp
module.exports.WANTS = WANTS
