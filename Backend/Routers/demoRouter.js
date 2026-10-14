const express = require("express")
const crypto = require("crypto")
const rateLimit = require("express-rate-limit")
const DemoSession = require("../model/demoSessionsModel")
const DemoSignal = require("../model/demoSignalsModel")
const ActivityFactors = require("../model/activityFactorsModel")
const { checkName } = require("../utils/nameRules")
const { verifyTurnstile } = require("../utils/turnstile")
const { createActivityResolver } = require("../matching/activityResolver")
const { runDemo, OPENNESS_ITEMS, ANSWER_LETTERS, keyOf } = require("../demo/runDemo")
const { loadData } = require("../demo/loadData")
const { DEMO_REASONING_ITEMS, reasoningTimedOut, reasoningResponse, reasoningBank } = require("../demo/reasoningMarks")

// "TRY THE DEMO" (owner, Round 32) — /demo, before any login. The page is /try-demo, so no page shares
// this prefix.
//
// THE ONE RULE: the demo is additive and isolated. These routes write only demo_sessions, demo_signals
// and — through the real activity resolver, exactly as a student's report does — the shared, identity-
// free activity cache. Never a User, Submission, Payment, Profile, Recommendation or Report, and never
// grantAccess. A fixture ("DEMO ISOLATION") holds this file and Backend/demo/ to that.
//
// The browser holds a random token (the row keeps only its hash). A public page that runs AI calls is
// guarded three ways: the spam check (Turnstile) to start, three starts per hour from one address, and
// a daily cap on new demos (DEMO_DAILY_CAP, default 200) — over it the page says "busy, try tomorrow".
const router = express.Router()

const startRateLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 3,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { success: false, message: "You've started a few demos from here already. Try again in an hour" },
})

// every other demo call — generous for one person, a wall for a script
const demoRateLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 200,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { success: false, message: "Too many requests. Try again in an hour" },
})

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MAX_DRAWS = 8
const hashOf = (token) => crypto.createHash("sha256").update(String(token || "")).digest("hex")
const dailyCap = () => Number(process.env.DEMO_DAILY_CAP) || 200
const cleanText = (value, max) => (typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : "")

// the start of today in India — the daily cap resets at midnight IST
const startOfTodayIst = () => {
    const ist = new Date(Date.now() + 5.5 * 3600 * 1000)
    ist.setUTCHours(0, 0, 0, 0)
    return new Date(ist.getTime() - 5.5 * 3600 * 1000)
}

const sessionFor = async (req) => {
    const token = (req.body && req.body.token) || req.query.token
    if (!token) return null
    return DemoSession.findOne({ tokenHash: hashOf(token) })
}

const noSession = (res) => res.status(404).json({ success: false, message: "This demo has ended — start a new one" })

// the real careers' names, for the "which profession" question (the same list GET /professions/getNames serves)
let careerIds = null
const knownCareer = (id) => {
    if (!careerIds) careerIds = new Set(loadData().professions.professions.map((profession) => profession.id))
    return careerIds.has(id)
}

// ========================
// Start — first name only
// ========================

router.post("/start", startRateLimiter, async (req, res) => {
    try {
        const nameProblem = checkName(req.body.name)
        if (nameProblem) {
            return res.status(400).json({ success: false, message: nameProblem })
        }
        if (!(await verifyTurnstile(req.body.turnstileToken, req.ip))) {
            return res.status(400).json({ success: false, message: "Please complete the spam check and try again" })
        }
        if ((await DemoSession.countDocuments({ createdAt: { $gte: startOfTodayIst() } })) >= dailyCap()) {
            return res.status(429).json({ success: false, message: "The demo is busy today — please try again tomorrow" })
        }

        const token = crypto.randomBytes(24).toString("hex")
        const name = req.body.name.trim().replace(/\s+/g, " ").split(" ")[0]
        await DemoSession.create({ tokenHash: hashOf(token), name })

        return res.status(201).json({ success: true, message: "Demo started", data: { token, name } })

    } catch (error) {
        return res.status(500).json({ success: false, message: "Could not start the demo", error: error.message })
    }
})

// ========================
// The two open questions
// ========================

router.put("/saveInterests", demoRateLimiter, async (req, res) => {
    try {
        const session = await sessionFor(req)
        if (!session) return noSession(res)

        const seen = new Set()
        const draws = (Array.isArray(req.body.draws) ? req.body.draws : [])
            .map((draw) => ({ text: cleanText(draw && draw.text, 80), when: draw && draw.when }))
            .filter((draw) => draw.text.length >= 2 && ["past", "present", "future"].includes(draw.when))
            .filter((draw) => !seen.has(keyOf(draw.text)) && seen.add(keyOf(draw.text)))
            .slice(0, MAX_DRAWS)
        if (draws.length === 0) {
            return res.status(400).json({ success: false, message: "Tell us at least one thing that pulls you" })
        }

        const rawAspiration = req.body.aspiration || {}
        const aspirationText = cleanText(rawAspiration.text, 80)
        const aspiration = aspirationText.length >= 2
            ? { text: aspirationText, professionId: typeof rawAspiration.professionId === "string" && knownCareer(rawAspiration.professionId) ? rawAspiration.professionId : null }
            : null

        // what stuck must be one of the things they named; why it stuck is one of the four real groups
        const { REASON_KEYS } = DemoSession
        const stuck = (Array.isArray(req.body.stuck) ? req.body.stuck : [])
            .map((row) => ({
                text: cleanText(row && row.text, 80),
                reasons: (Array.isArray(row && row.reasons) ? row.reasons : []).filter((reason) => REASON_KEYS.includes(reason)),
                why: cleanText(row && row.why, 300),
            }))
            .filter((row) => seen.has(keyOf(row.text)))

        session.interests = { draws, aspiration, stuck }
        if (session.status === "started") session.status = "interests"
        await session.save()

        return res.status(200).json({ success: true, message: "Saved", data: { draws: draws.length, stuck: stuck.length } })

    } catch (error) {
        return res.status(500).json({ success: false, message: "Could not save your answers", error: error.message })
    }
})

// ========================
// Openness — eight real IPIP-50 items
// ========================

router.put("/saveOpenness", demoRateLimiter, async (req, res) => {
    try {
        const session = await sessionFor(req)
        if (!session) return noSession(res)

        const given = req.body.answers || {}
        const answers = {}
        OPENNESS_ITEMS.forEach((id) => {
            if (ANSWER_LETTERS.includes(given[id])) answers[id] = given[id]
        })
        if (Object.keys(answers).length !== OPENNESS_ITEMS.length) {
            return res.status(400).json({ success: false, message: "Please answer all eight statements" })
        }

        session.openness = answers
        await session.save()

        return res.status(200).json({ success: true, message: "Saved", data: { answered: OPENNESS_ITEMS.length } })

    } catch (error) {
        return res.status(500).json({ success: false, message: "Could not save your answers", error: error.message })
    }
})

// ========================
// Reasoning — puzzles 1-6 of the real test, marked and timed exactly as it does
// ========================

// the same rules as the real /reasoningNext: a seed on the session, one puzzle at a time, never the
// answer, its clock started here so a refresh never buys time, and an expired one recorded as not answered
router.post("/reasoningNext", demoRateLimiter, async (req, res) => {
    try {
        const session = await sessionFor(req)
        if (!session) return noSession(res)

        let block = session.reasoning || {}
        const seed = typeof block.seed === "number" ? block.seed : Math.floor(Math.random() * 2 ** 31)
        let responses = block.responses || []

        if (block.pending && typeof block.seed === "number" && block.pending.index === responses.length) {
            const shown = reasoningBank.itemFor(block.seed, block.pending.index, "A")
            if (reasoningTimedOut(shown, block.pending)) {
                responses = [...responses, reasoningResponse(shown, null, Date.now() - new Date(block.pending.issuedAt).getTime(), true)]
                block = { ...block, pending: null }
            }
        }

        if (responses.length >= DEMO_REASONING_ITEMS) {
            session.reasoning = { ...block, seed, form: "A", responses, pending: null }
            session.markModified("reasoning")
            await session.save()
            return res.status(200).json({ success: true, message: "Puzzles done", data: { done: true, answered: responses.length } })
        }

        const index = responses.length
        const pending = block.pending && block.pending.index === index ? block.pending : { index, issuedAt: new Date() }
        session.reasoning = { seed, form: "A", startedAt: block.startedAt || new Date(), responses, pending }
        session.markModified("reasoning")
        await session.save()

        const item = reasoningBank.itemFor(seed, index, "A")
        const secondsLeft = Math.max(Math.ceil((item.timeLimitS * 1000 - (Date.now() - new Date(pending.issuedAt).getTime())) / 1000), 0)

        return res.status(200).json({
            success: true,
            message: "Next puzzle",
            data: { done: false, number: index + 1, of: DEMO_REASONING_ITEMS, item: reasoningBank.publicItem(item), secondsLeft },
        })

    } catch (error) {
        return res.status(500).json({ success: false, message: "Could not load the next puzzle", error: error.message })
    }
})

router.post("/reasoningAnswer", demoRateLimiter, async (req, res) => {
    try {
        const session = await sessionFor(req)
        if (!session) return noSession(res)

        const block = session.reasoning || {}
        const responses = block.responses || []
        const pending = block.pending
        if (!pending || typeof block.seed !== "number" || pending.index !== responses.length) {
            return res.status(400).json({ success: false, message: "No puzzle is open" })
        }

        const item = reasoningBank.itemFor(block.seed, pending.index, "A")
        const choice = Number.isInteger(req.body.choice) && req.body.choice >= 0 && req.body.choice < item.options.length ? req.body.choice : null
        const ms = Date.now() - new Date(pending.issuedAt).getTime()
        const all = [...responses, reasoningResponse(item, choice, ms, reasoningTimedOut(item, pending))]

        session.reasoning = { ...block, responses: all, pending: null }
        session.markModified("reasoning")
        if (all.length >= DEMO_REASONING_ITEMS && session.status === "interests") session.status = "assessed"
        await session.save()

        return res.status(200).json({ success: true, message: "Answer recorded", data: { done: all.length >= DEMO_REASONING_ITEMS, answered: all.length } })

    } catch (error) {
        return res.status(500).json({ success: false, message: "Could not record your answer", error: error.message })
    }
})

// ========================
// The result — asked for an email first
// ========================

const resultPayload = (session, details) => ({
    name: session.name,
    careers: session.result.careers,
    details,
    pointedTo: session.result.pointedTo,
    opennessLevel: session.result.opennessLevel,
    reasoningRight: session.result.reasoningRight,
    reasoningOf: DEMO_REASONING_ITEMS,
})

const detailsFor = (careers) => {
    const { demoDetail } = require("../demo/runDemo")
    const byId = new Map(loadData().professions.professions.map((profession) => [profession.id, profession]))
    return Object.fromEntries(careers.map(({ entry }) => [entry.professionId, demoDetail(byId.get(entry.professionId))]))
}

router.post("/result", demoRateLimiter, async (req, res) => {
    try {
        const session = await sessionFor(req)
        if (!session) return noSession(res)

        // worked out once — a second call shows the same result without another AI call
        if (session.result) {
            return res.status(200).json({ success: true, message: "Your result", data: resultPayload(session, detailsFor(session.result.careers)) })
        }

        const interests = session.interests || {}
        if (!(interests.draws || []).length || !session.openness || ((session.reasoning || {}).responses || []).length < DEMO_REASONING_ITEMS) {
            return res.status(400).json({ success: false, message: "Finish the questions and the puzzles first" })
        }

        const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : ""
        if (!emailRegex.test(email) || email.length > 120) {
            return res.status(400).json({ success: false, message: "Please enter a valid email" })
        }
        if (typeof req.body.adult !== "boolean") {
            return res.status(400).json({ success: false, message: "Please tell us whether you are 18 or older" })
        }
        // an under-18 needs a parent or guardian's agreement (DPDP) — self-declared here, as the demo
        // keeps only a first name, the answers and this email, and deletes them after 30 days
        if (req.body.adult === false && req.body.parentConsent !== true) {
            return res.status(400).json({ success: false, message: "Please confirm that your parent or guardian knows and agrees" })
        }

        const data = loadData()
        const resolver = createActivityResolver({
            ActivityFactors,
            professionEmbeddings: data.professionEmbeddings,
            anchors: data.anchors,
            // a visitor waits on this page, so Voyage's busy-retries are brief, not minutes long
            embedWait: () => new Promise((resolve) => setTimeout(resolve, 2000)),
        })
        const outcome = await runDemo({ session: session.toObject(), resolver, data })

        const { POLICY_VERSION } = require("./userRouter")
        session.email = email
        session.adult = req.body.adult
        session.parentConsent = req.body.adult === false ? { at: new Date(), policyVersion: POLICY_VERSION } : null
        session.emailAt = new Date()
        session.result = {
            careers: outcome.careers,
            pointedTo: outcome.pointedTo,
            opennessLevel: outcome.opennessLevel,
            reasoningRight: outcome.reasoningRight,
            at: new Date(),
        }
        session.status = "done"
        session.markModified("result")
        await session.save()

        // identity-free rows for the monthly careers scout (model/demoSignalsModel.js)
        if (outcome.signals.length) await DemoSignal.insertMany(outcome.signals)

        return res.status(200).json({ success: true, message: "Your result", data: resultPayload(session, outcome.details) })

    } catch (error) {
        return res.status(500).json({ success: false, message: "Could not work out your result", error: error.message })
    }
})

router.get("/result", demoRateLimiter, async (req, res) => {
    try {
        const session = await sessionFor(req)
        if (!session) return noSession(res)
        if (!session.result) {
            return res.status(404).json({ success: false, message: "No result yet" })
        }

        return res.status(200).json({ success: true, message: "Your result", data: resultPayload(session, detailsFor(session.result.careers)) })

    } catch (error) {
        return res.status(500).json({ success: false, message: "Could not load your result", error: error.message })
    }
})

// where a returning visitor left off
router.get("/state", demoRateLimiter, async (req, res) => {
    try {
        const session = await sessionFor(req)
        if (!session) return noSession(res)
        const answered = ((session.reasoning || {}).responses || []).length

        return res.status(200).json({
            success: true,
            message: "Demo state",
            data: { name: session.name, status: session.status, interests: session.interests, openness: Boolean(session.openness), reasoningAnswered: answered, hasResult: Boolean(session.result) },
        })

    } catch (error) {
        return res.status(500).json({ success: false, message: "Could not load the demo", error: error.message })
    }
})

module.exports = router
module.exports.DEMO_REASONING_ITEMS = DEMO_REASONING_ITEMS
