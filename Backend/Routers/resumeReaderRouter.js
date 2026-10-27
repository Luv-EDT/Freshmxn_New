const express = require("express")
const rateLimit = require("express-rate-limit")
const authMiddleware = require("../middlewares/authMiddleware")
const { readResume } = require("../utils/resumeReader")
const { sessionFor } = require("./demoRouter")

// READ A RÉSUMÉ (owner, Round 36) — mounted at /resumeReader with its own 8 MB JSON body (the file arrives
// as base64). Two doors, one reader (utils/resumeReader.js); the file is never stored by either.
//   POST /resumeReader/demo   the demo's first step — its own token; at most 3 reads per demo
//   POST /resumeReader/mine   a logged-in student, for Virtual Career Counselling's activity lists
const router = express.Router()

const readLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { success: false, message: "You've read a few résumés already. Try again in an hour" },
})

const MAX_DEMO_READS = 3

router.post("/demo", readLimiter, async (req, res) => {
    try {
        const session = await sessionFor(req)
        if (!session) {
            return res.status(404).json({ success: false, message: "This demo has ended — start a new one" })
        }
        if ((session.resumeReads || 0) >= MAX_DEMO_READS) {
            return res.status(429).json({ success: false, message: "That's enough résumés for one demo — add the rest yourself" })
        }

        const { lists, error } = await readResume({ file: req.body.file, mediaType: req.body.mediaType, shape: "demo" })
        session.resumeReads = (session.resumeReads || 0) + 1
        await session.save()
        if (error) {
            return res.status(400).json({ success: false, message: error })
        }

        return res.status(200).json({ success: true, message: "Read your résumé", data: lists })

    } catch (error) {
        return res.status(500).json({ success: false, message: "Couldn't read that résumé — add your activities yourself", error: error.message })
    }
})

router.post("/mine", readLimiter, authMiddleware, async (req, res) => {
    try {
        const { lists, error } = await readResume({ file: req.body.file, mediaType: req.body.mediaType, shape: "full" })
        if (error) {
            return res.status(400).json({ success: false, message: error })
        }

        return res.status(200).json({ success: true, message: "Read your résumé", data: lists })

    } catch (error) {
        return res.status(500).json({ success: false, message: "Couldn't read that résumé — add your activities yourself", error: error.message })
    }
})

module.exports = router
