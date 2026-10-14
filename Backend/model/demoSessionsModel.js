const mongoose = require("mongoose")

// THE "TRY THE DEMO" SESSION (owner, Round 32) — a visitor's 7-minute taste before any login. It is a
// collection of its own: the demo never writes a User, a Submission, a Payment or a report.
//
// The browser holds only a random token; the row keeps its sha256. What is kept is what the visitor
// typed or answered, their first name, and — from the result step — an email and whether they are 18
// or older (an under-18 ticks that a parent or guardian knows and agrees; the time and policy version
// are kept). No IP, no device, no cookies, nothing for advertising.
//
// RESUME, NOT RESTART: after they register and buy, their answers can be carried into the real flow —
// only from their own, verified account (Routers/demoResumeRouter.js), and only into what is still
// empty there. Once carried (or declined) the row is deleted; one never linked deletes itself after
// 30 days (the TTL index below).

const DEMO_TTL_DAYS = 30
const REASON_KEYS = ["curiosityDriven", "personalGrowth", "socialRecognition", "effortlessEngagement"]

const demoSessionSchema = new mongoose.Schema(
    {
        tokenHash: {
            type: String,
            required: true,
            unique: true,     // sha256 of the token the browser holds
        },
        name: {
            type: String,
            required: true,
        },
        status: {
            type: String,
            enum: ["started", "interests", "assessed", "done"],
            default: "started",
        },
        // Q1 "what pulls you" (past, present, one day) and Q2 "what stuck, and why"
        interests: {
            draws: { type: [{ text: String, when: { type: String, enum: ["past", "present", "future"] }, _id: false }], default: [] },
            aspiration: { type: { text: String, professionId: String, _id: false }, default: null },
            stuck: { type: [{ text: String, reasons: [{ type: String, enum: REASON_KEYS }], why: String, _id: false }], default: [] },
        },
        // eight of the real IPIP-50 Openness items, keyed like the real assessment (IPIP_O1 …), A–E
        openness: {
            type: Object,
            default: null,
        },
        // the first six puzzles of the real reasoning test under this seed — the same block shape the real
        // test keeps (seed, form, startedAt, pending, responses), so it can continue from puzzle 7
        reasoning: {
            type: Object,
            default: null,
        },
        result: {
            type: Object,
            default: null,    // { careerIds, opennessLevel, reasoningRight, pointedTo, at }
        },
        email: {
            type: String,
            default: null,    // lower-case; asked at the result step
        },
        adult: {
            type: Boolean,
            default: null,
        },
        parentConsent: {
            type: { at: Date, policyVersion: String, _id: false },
            default: null,    // an under-18's "my parent or guardian knows and agrees"
        },
        emailAt: {
            type: Date,
            default: null,
        },
        expiresAt: {
            type: Date,
            default: () => new Date(Date.now() + DEMO_TTL_DAYS * 24 * 3600 * 1000),
        },
    },
    { timestamps: true }
)

demoSessionSchema.index({ email: 1, status: 1, createdAt: 1 })
// TTL: MongoDB deletes the row by itself once expiresAt has passed
demoSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

const DemoSession = mongoose.model("demo_sessions", demoSessionSchema)

module.exports = DemoSession
module.exports.DEMO_TTL_DAYS = DEMO_TTL_DAYS
module.exports.REASON_KEYS = REASON_KEYS
