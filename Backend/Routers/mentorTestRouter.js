const express = require("express")
const User = require("../model/userModel")
const Mentor = require("../model/mentorsModel")
const MentorTest = require("../model/mentorTestsModel")
const authMiddleware = require("../middlewares/authMiddleware")
const adminAuthMiddleware = require("../middlewares/adminAuthMiddleware")
const mentorAuthMiddleware = require("../middlewares/mentorAuthMiddleware")
const { STEPS, BANK, SAMPLES, DRAWN, draw, byId, shownOrder, publicQuestion, markTest } = require("../mentors/testBank")
const r2 = require("../utils/r2")
const { notifyStudent } = require("../utils/statusEmails")
const { notifyAdmin, escapeHtml } = require("../utils/mailer")

const router = express.Router()

// THE MENTOR COMPETENCE TEST (owner, Round 34). Mounted at /mentorTest — the page is /mentor, so no API
// prefix equals a page URL. A new mentor takes it after their profile and the training documents;
// the admin reads it, watches the video and approves or rejects. Either decision deletes the video.

const CALENDLY = /^https:\/\/calendly\.com\/[^\s]+$/
const LINK = /^https:\/\/[^\s]+\.[^\s]+$/
const clean = (value, max) => (typeof value === "string" ? value.trim().slice(0, max) : "")

// the mentor's test, created with their own 7 questions, option orders and sample student on first look
const testFor = async (mentorUserId) => {
    const existing = await MentorTest.findOne({ mentor: mentorUserId })
    if (existing) return existing
    const drawnIds = draw(BANK, DRAWN).map((question) => question.id)
    const orders = Object.fromEntries(drawnIds.map((id) => [id, draw([0, 1, 2, 3], 4)]))
    try {
        return await MentorTest.create({
            mentor: mentorUserId,
            drawnIds,
            orders,
            sampleId: draw(SAMPLES, 1)[0].id,
            stepOrder: draw(STEPS, STEPS.length).map((step) => step.id),   // shown shuffled; the mentor puts them in order
        })
    } catch (error) {
        if (error.code === 11000) return MentorTest.findOne({ mentor: mentorUserId })   // two tabs at once
        throw error
    }
}

// what the mentor sees: no right answers, no other mentor's anything
const forMentor = (test) => ({
    questions: test.drawnIds.map((id) => byId.get(id)).filter(Boolean).map((question) => publicQuestion(test, question)),
    steps: test.stepOrder.map((id) => STEPS.find((step) => step.id === id)).filter(Boolean),
    stepsArranged: Boolean(test.stepsArrangedAt),
    sample: (SAMPLES.find((sample) => sample.id === test.sampleId) || SAMPLES[0]).text,
    answers: test.answers || {},
    calendlyMain: test.calendlyMain,
    calendlyFollowUp: test.calendlyFollowUp,
    video: { uploaded: Boolean(test.video && test.video.key && !test.video.deletedAt), link: (test.video && test.video.link) || null },
    submittedAt: test.submittedAt,
    decision: test.decision,
    decisionNote: test.decision ? test.decisionNote : "",
    uploadsOn: r2.configured(),
})

// only a mentor with a profile; a test once sent can't be changed
const loadOwn = async (req, res) => {
    const profile = await Mentor.findOne({ user: req.user._id }).select("status name calendlyMain calendlyFollowUp").lean()
    if (!profile) {
        res.status(400).json({ success: false, message: "Please complete your mentor profile first" })
        return null
    }
    return profile
}


// ========================
// The mentor's side
// ========================

router.get("/getMine", authMiddleware, mentorAuthMiddleware, async (req, res) => {
    try {
        const profile = await loadOwn(req, res)
        if (!profile) return

        // mentors approved before the test existed don't take it
        const existing = await MentorTest.findOne({ mentor: req.user._id })
        if (!existing && profile.status === "onboarded") {
            return res.status(200).json({ success: true, message: "No test needed", data: { notNeeded: true, bookingLinks: { calendlyMain: profile.calendlyMain || "", calendlyFollowUp: profile.calendlyFollowUp || "" } } })
        }

        const test = existing || await testFor(req.user._id)
        return res.status(200).json({ success: true, message: "Your test", data: { ...forMentor(test), bookingLinks: { calendlyMain: profile.calendlyMain || "", calendlyFollowUp: profile.calendlyFollowUp || "" } } })

    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to load your test", error: error.message })
    }
})

// saves as they go — answers, the order of the steps, the links, and a pasted video link
router.put("/saveMine", authMiddleware, mentorAuthMiddleware, async (req, res) => {
    try {
        const profile = await loadOwn(req, res)
        if (!profile) return

        const test = await testFor(req.user._id)
        if (test.submittedAt) {
            return res.status(400).json({ success: false, message: "Your test is sent — our team is reviewing it" })
        }

        const body = req.body || {}
        if (body.answers && typeof body.answers === "object") {
            const answers = {}
            for (const id of test.drawnIds) {
                const value = Number(body.answers[id])
                if (Number.isInteger(value) && value >= 0 && value < 4) answers[id] = value
            }
            test.answers = answers
        }
        if (Array.isArray(body.stepOrder)) {
            const ids = STEPS.map((step) => step.id)
            const order = body.stepOrder.map(String)
            if (order.length !== ids.length || !ids.every((id) => order.includes(id))) {
                return res.status(400).json({ success: false, message: "Please keep all five steps" })
            }
            test.stepOrder = order
            test.stepsArrangedAt = new Date()
        }
        for (const key of ["calendlyMain", "calendlyFollowUp"]) {
            if (body[key] === undefined) continue
            const value = clean(body[key], 300)
            if (value && !CALENDLY.test(value)) {
                return res.status(400).json({ success: false, message: "Calendly links look like https://calendly.com/your-name/…" })
            }
            test[key] = value
        }
        if (body.videoLink !== undefined) {
            const link = clean(body.videoLink, 400)
            if (link && !LINK.test(link)) {
                return res.status(400).json({ success: false, message: "A video link must start with https://" })
            }
            test.video = { ...(test.video ? test.video.toObject() : {}), link: link || null }
        }
        // a video uploaded to R2 through /videoUploadUrl: the key must be this mentor's own
        if (body.videoKey !== undefined) {
            const key = clean(body.videoKey, 200)
            if (!key.startsWith(`mentor-tests/${req.user._id}/`)) {
                return res.status(400).json({ success: false, message: "That upload isn't yours" })
            }
            const previous = test.video && test.video.key
            test.video = { ...(test.video ? test.video.toObject() : {}), key, contentType: clean(body.videoType, 40) || null, uploadedAt: new Date(), deletedAt: null }
            if (previous && previous !== key) await r2.removeObject(previous)
        }
        test.markModified("answers")
        await test.save()

        return res.status(200).json({ success: true, message: "Saved", data: forMentor(test) })

    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to save", error: error.message })
    }
})

// a 15-minute link to upload the video straight to R2
router.post("/videoUploadUrl", authMiddleware, mentorAuthMiddleware, async (req, res) => {
    try {
        const profile = await loadOwn(req, res)
        if (!profile) return
        if (!r2.configured()) {
            return res.status(400).json({ success: false, message: "Video upload isn't switched on yet — please paste a link to your video instead" })
        }

        const test = await testFor(req.user._id)
        if (test.submittedAt) {
            return res.status(400).json({ success: false, message: "Your test is sent — our team is reviewing it" })
        }

        const ext = r2.VIDEO_TYPES[req.body.contentType]
        if (!ext) {
            return res.status(400).json({ success: false, message: "Please upload an MP4, MOV or WebM video" })
        }
        const size = Number(req.body.size)
        if (!Number.isFinite(size) || size <= 0 || size > r2.MAX_BYTES) {
            return res.status(400).json({ success: false, message: "The video must be under 1 GB — record at 1080p rather than 4K" })
        }

        const key = `mentor-tests/${req.user._id}/${Date.now()}.${ext}`
        return res.status(200).json({ success: true, message: "Upload link ready", data: { url: await r2.uploadUrl(key, req.body.contentType), key } })

    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to prepare the upload", error: error.message })
    }
})

// SEND IT: everything answered, then it waits for our team (a couple of days)
// THE BOOKING LINKS AFTER THE TEST (owner, Round 35): the links live on the Test tab only. Once the test is
// sent — or for a mentor approved before the test existed — this changes them; students book from them.
router.put("/saveMyLinks", authMiddleware, mentorAuthMiddleware, async (req, res) => {
    try {
        const profile = await loadOwn(req, res)
        if (!profile) return

        const test = await MentorTest.findOne({ mentor: req.user._id }).select("submittedAt").lean()
        if (!(test && test.submittedAt) && profile.status !== "onboarded") {
            return res.status(400).json({ success: false, message: "Put your Calendly links in the test — they're saved with it" })
        }

        const calendlyMain = clean(req.body.calendlyMain, 300)
        const calendlyFollowUp = clean(req.body.calendlyFollowUp, 300)
        if (!CALENDLY.test(calendlyMain) || !CALENDLY.test(calendlyFollowUp)) {
            return res.status(400).json({ success: false, message: "Both links look like https://calendly.com/your-name/…" })
        }

        await Mentor.updateOne({ user: req.user._id }, { $set: { calendlyMain, calendlyFollowUp } })
        return res.status(200).json({ success: true, message: "Booking links saved — students book from these", data: { calendlyMain, calendlyFollowUp } })

    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to save your links", error: error.message })
    }
})

router.post("/submitMine", authMiddleware, mentorAuthMiddleware, async (req, res) => {
    try {
        const profile = await loadOwn(req, res)
        if (!profile) return

        const test = await testFor(req.user._id)
        if (test.submittedAt) {
            return res.status(400).json({ success: false, message: "Your test is already sent" })
        }

        // Round 35 (owner): every part is compulsory — the questions, the five steps put in order, both
        // Calendly links and the video; the page shows Send only when all are done, and this refuses otherwise
        const missing = [
            test.drawnIds.some((id) => !Number.isInteger((test.answers || {})[id])) && "every multiple-choice question",
            !test.stepsArrangedAt && "the 5-step mentor flow in order",
            (!CALENDLY.test(test.calendlyMain || "") || !CALENDLY.test(test.calendlyFollowUp || "")) && "both Calendly links",
            !(test.video && (test.video.key || test.video.link)) && "your video",
        ].filter(Boolean)
        if (missing.length) {
            return res.status(400).json({ success: false, message: `Please complete ${missing.join(", ")} first` })
        }

        test.submittedAt = new Date()
        test.autoScore = markTest(test)
        await test.save()

        // Round 35 (owner): the Calendly links are asked only in the test — the ones they send become their
        // booking links
        await Mentor.updateOne(
            { user: req.user._id },
            {
                $set: {
                    status: profile.status === "onboarded" ? "onboarded" : "test_submitted",
                    calendlyMain: test.calendlyMain,
                    calendlyFollowUp: test.calendlyFollowUp,
                },
            }
        )

        notifyStudent(req.user, "mentorTestReceived")
        notifyAdmin("A mentor sent their test", `<p>${escapeHtml(profile.name)} sent their mentor test (${test.autoScore.correct} of ${test.autoScore.of} multiple-choice right). Admin → Mentors → Review test.</p>`)

        return res.status(200).json({ success: true, message: "Sent — our team will review it within a couple of days and let you know", data: forMentor(test) })

    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to send your test", error: error.message })
    }
})


// ========================
// Admin
// ========================

// everything, with the right answers and a 15-minute link to watch the video
router.get("/getForAdmin/:mentorUserId", authMiddleware, adminAuthMiddleware, async (req, res) => {
    try {
        const test = await MentorTest.findOne({ mentor: req.params.mentorUserId }).lean()
        if (!test) {
            return res.status(404).json({ success: false, message: "This mentor hasn't started the test" })
        }

        const questions = test.drawnIds.map((id) => byId.get(id)).filter(Boolean).map((question) => {
            const order = shownOrder(test, question.id)
            const shownAnswer = (test.answers || {})[question.id]
            return {
                id: question.id,
                q: question.q,
                options: question.options,
                answer: question.answer,
                picked: Number.isInteger(shownAnswer) ? order[shownAnswer] : null,
            }
        })

        const video = test.video || {}
        return res.status(200).json({
            success: true,
            message: "Mentor test",
            data: {
                questions,
                steps: test.stepOrder.map((id) => STEPS.find((step) => step.id === id)).filter(Boolean),
                rightSteps: STEPS,
                sample: (SAMPLES.find((sample) => sample.id === test.sampleId) || SAMPLES[0]).text,
                calendlyMain: test.calendlyMain,
                calendlyFollowUp: test.calendlyFollowUp,
                videoUrl: video.key && !video.deletedAt && r2.configured() ? await r2.viewUrl(video.key) : null,
                videoLink: video.link || null,
                videoDeleted: Boolean(video.deletedAt),
                submittedAt: test.submittedAt,
                autoScore: test.autoScore || markTest(test),
                decision: test.decision,
                decisionNote: test.decisionNote,
                decidedAt: test.decidedAt,
            },
        })

    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to load the test", error: error.message })
    }
})

// APPROVE OR REJECT — the mentor's status follows, the mentor is told, and the video is deleted now
router.put("/decideForAdmin/:mentorUserId", authMiddleware, adminAuthMiddleware, async (req, res) => {
    try {
        const { decision } = req.body
        if (!["approved", "rejected"].includes(decision)) {
            return res.status(400).json({ success: false, message: "Choose approve or reject" })
        }
        const note = clean(req.body.note, 600)
        if (decision === "rejected" && note.length < 3) {
            return res.status(400).json({ success: false, message: "Please give the mentor a reason" })
        }

        const test = await MentorTest.findOne({ mentor: req.params.mentorUserId })
        if (!test || !test.submittedAt) {
            return res.status(400).json({ success: false, message: "This mentor hasn't sent their test yet" })
        }

        const key = test.video && test.video.key
        if (key) await r2.removeObject(key)
        test.video = { ...(test.video ? test.video.toObject() : {}), key: null, link: null, deletedAt: new Date() }
        test.decision = decision
        test.decisionNote = note
        test.decidedAt = new Date()
        test.decidedBy = req.user._id
        await test.save()

        await Mentor.updateOne(
            { user: test.mentor },
            { $set: decision === "approved" ? { status: "onboarded", approvedByAdmin: req.user._id, approvedAt: new Date() } : { status: "rejected" } }
        )

        notifyStudent(await User.findById(test.mentor).select("email").lean(), "mentorDecision", { decision, note })

        return res.status(200).json({ success: true, message: decision === "approved" ? "Approved — the mentor has been told, and the video deleted" : "Rejected — the mentor has been told, and the video deleted" })

    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to record the decision", error: error.message })
    }
})

// the daily clean-up (housekeeping mentor_video_cleanup): no video waits more than 30 days for a decision
const cleanUpOldVideos = async (now = new Date()) => {
    const cutoff = new Date(now.getTime() - 30 * 864e5)
    const old = await MentorTest.find({ "video.key": { $ne: null }, "video.uploadedAt": { $lt: cutoff } }).select("video").lean()
    let deleted = 0
    for (const test of old) {
        const result = await r2.removeObject(test.video.key)
        if (result.deleted || !r2.configured()) {
            await MentorTest.updateOne({ _id: test._id }, { $set: { "video.key": null, "video.deletedAt": now } })
            deleted += 1
        }
    }
    return { deleted }
}

module.exports = router
module.exports.cleanUpOldVideos = cleanUpOldVideos
module.exports.forMentor = forMentor
