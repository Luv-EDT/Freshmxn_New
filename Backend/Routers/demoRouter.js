const express = require("express")
const crypto = require("crypto")
const rateLimit = require("express-rate-limit")
const DemoSession = require("../model/demoSessionsModel")
const DemoSignal = require("../model/demoSignalsModel")
const ActivityFactors = require("../model/activityFactorsModel")
const { checkName } = require("../utils/nameRules")
const { verifyTurnstile } = require("../utils/turnstile")
const { createActivityResolver } = require("../matching/activityResolver")
const { runDemo, ANSWER_LETTERS, STAGES, keyOf } = require("../demo/runDemo")
const { loadData } = require("../demo/loadData")
const { pickPuzzles, publicPuzzle, markPuzzle } = require("../demo/demoPuzzles")
const { MI_DEMO_ITEMS, DEMO_SART_TRIALS, miTaste, puzzleTaste, sartTaste } = require("../demo/demoTaste")

// "TRY THE DEMO" (owner, Rounds 32-33) — /demo, before any login. The page is /try-demo, so no page shares
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
const MAX_DRAWS = 12
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
            .map((draw) => ({
                text: cleanText(draw && draw.text, 80),
                when: draw && draw.when,
                // a career picked from our list in the "one day" box keeps its id
                ...(draw && typeof draw.professionId === "string" && knownCareer(draw.professionId) ? { professionId: draw.professionId } : {}),
            }))
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
// The three tasks — 7 statements, 90 s of SART, 4 puzzles
// ========================

// the four puzzles for this visitor, without their answers (dealt once; a refresh gets the same four)
router.get("/puzzles", demoRateLimiter, async (req, res) => {
    try {
        const session = await sessionFor(req)
        if (!session) return noSession(res)

        if (!(session.puzzles || []).length) {
            session.puzzles = pickPuzzles()
            await session.save()
        }

        return res.status(200).json({ success: true, message: "Your puzzles", data: { puzzles: session.puzzles.map(publicPuzzle) } })

    } catch (error) {
        return res.status(500).json({ success: false, message: "Could not load the puzzles", error: error.message })
    }
})

// everything from the three tasks arrives at once and is worked out here; only the small result is kept
router.post("/saveTests", demoRateLimiter, async (req, res) => {
    try {
        const session = await sessionFor(req)
        if (!session) return noSession(res)

        const mi = req.body.mi || {}
        const miIds = Object.values(MI_DEMO_ITEMS)
        if (!miIds.every((id) => ANSWER_LETTERS.includes(mi[id]))) {
            return res.status(400).json({ success: false, message: "Please answer all seven statements" })
        }

        const dealt = session.puzzles || []
        const answers = Array.isArray(req.body.puzzles) ? req.body.puzzles : []
        if (dealt.length !== 4) {
            return res.status(400).json({ success: false, message: "Load the puzzles first" })
        }
        const right = dealt.filter((id) => {
            const answer = answers.find((row) => row && row.id === id)
            return answer && Number.isInteger(answer.choice) && markPuzzle(id, answer.choice, Number(answer.ms))
        }).length

        // the SART rows the page recorded — only the four fields the taste reads, and a sane count
        const rows = (Array.isArray(req.body.sart) ? req.body.sart : []).slice(0, DEMO_SART_TRIALS + 5).map((row) => ({
            isGo: row && row.isGo === true,
            correct: row && row.correct === true,
            rt: row && typeof row.rt === "number" && row.rt >= 0 && row.rt < 5000 ? row.rt : null,
            dropped: Boolean(row && row.dropped),
        }))
        const sart = sartTaste(rows)

        session.tastes = {
            mi: miTaste(mi),
            reasoning: puzzleTaste(right),
            reasoningRight: right,
            speed: sart.speed,
            focus: sart.focus,
            sart: { meanMs: sart.meanMs, pressesOnThree: sart.pressesOnThree, threes: sart.threes, tooEarly: sart.tooEarly },
        }
        session.markModified("tastes")
        if (session.status !== "done") session.status = "assessed"
        await session.save()

        return res.status(200).json({ success: true, message: "Saved", data: { reasoningRight: right } })

    } catch (error) {
        return res.status(500).json({ success: false, message: "Could not save your answers", error: error.message })
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
    factors: session.result.factors,
    sart: session.result.sart,
    reasoningRight: session.result.reasoningRight,
    you: session.result.you,
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
        if (!(interests.draws || []).length || !session.tastes) {
            return res.status(400).json({ success: false, message: "Finish the questions and the three tasks first" })
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

        // where they are now — asked at the start, kept only now that there is an email (owner, Round 33)
        const rawStage = req.body.stage || {}
        const years = Number(rawStage.years)
        session.stage = STAGES.includes(rawStage.journey)
            ? { journey: rawStage.journey, ...(rawStage.journey === "early_professional" && Number.isFinite(years) && years >= 0 && years <= 45 ? { years: Math.round(years) } : {}) }
            : null

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
            factors: outcome.factors,
            sart: outcome.sart,
            reasoningRight: outcome.reasoningRight,
            you: outcome.you,
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

        return res.status(200).json({
            success: true,
            message: "Demo state",
            data: { name: session.name, status: session.status, interests: session.interests, tested: Boolean(session.tastes), hasResult: Boolean(session.result) },
        })

    } catch (error) {
        return res.status(500).json({ success: false, message: "Could not load the demo", error: error.message })
    }
})

module.exports = router
