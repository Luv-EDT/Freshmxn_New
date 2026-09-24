const fs = require("fs")
const path = require("path")
const express = require("express")
const Submission = require("../model/submissionsModel")
const User = require("../model/userModel")
const authMiddleware = require("../middlewares/authMiddleware")
const requirePaid = require("../middlewares/requirePaid")

const router = express.Router()

// Delayed story recall — 05_Story_Bank.md.
//
// TWO CLOCKS, AND NEITHER CAN LIVE IN THE BROWSER.
//
//     t = 0        the story opens; both timers start
//     t + 60 min   the story disappears and cannot be seen again
//     t + 24 h     the recall questions unlock
//     t + 72 h     the window closes
//
// The whole point of the instrument is overnight consolidation, so the clock spans sittings, tabs,
// devices and reboots. A client-side timer survives none of those, and a student who reloads would
// simply get their hour back. Every gate below is computed from `storyOpenedAt` on the server, and
// the endpoints refuse rather than trusting anything the client says about time.
//
// THE FACTS NEVER LEAVE THIS PROCESS. `Backend/data/stories.json` holds the answers. Only the story
// TEXT is ever served, and only inside the reading window. Even the multiple-choice options are
// built here — the correct answer is mixed with distractors drawn from the other seven stories, so
// the payload never reveals which is which.
//
// RECALL IS ON ITS OWN CLOCK, not a step in the sequence. A student who finishes everything else in
// one sitting would otherwise face a one-hour delay while someone spread over four days faced four
// days, and the two scores would not be comparable.

const DATA = path.join(__dirname, "..", "data")
const storyBank = JSON.parse(fs.readFileSync(path.join(DATA, "stories.json"), "utf8"))

const READ_WINDOW_MINUTES = 60
const RECALL_OPENS_HOURS = 24
const RECALL_CLOSES_HOURS = 72
const OPTION_COUNT = 5

const storyById = (id) => storyBank.stories.find((story) => story.id === id) || null

const hoursSince = (date) => (Date.now() - new Date(date).getTime()) / 3600000

// Distractors come from the OTHER seven stories' slots, per the spec. Drawing them from the same
// pool keeps difficulty even across stories and stops a student picking the answer that merely
// sounds plausible for the story they read.
const optionsFor = (field, correct, seed) => {
    const pool = storyBank.stories
        .map((story) => story.facts[field])
        .filter((value) => value && String(value).toLowerCase() !== String(correct).toLowerCase())

    const unique = [...new Set(pool)]
    const chosen = []

    // Deterministic from the seed so a student who reloads the recall page sees the same options
    // in the same order — a reshuffle looks like the question changed, and re-rolling distractors
    // would let someone narrow the answer by reloading.
    let cursor = seed % Math.max(unique.length, 1)

    while (chosen.length < OPTION_COUNT - 1 && chosen.length < unique.length) {
        const candidate = unique[cursor % unique.length]
        if (!chosen.includes(candidate)) chosen.push(candidate)
        cursor += 1
    }

    const all = [...chosen, correct]

    // Sorted rather than shuffled: a stable order that carries no information about which is right.
    return all.sort((left, right) => String(left).localeCompare(String(right)))
}

const seedFrom = (value) => String(value).split("").reduce((total, character) => total + character.charCodeAt(0), 0)

// One place that decides where a student is, so the three endpoints cannot disagree.
const stateOf = (block) => {
    if (!block || !block.storyId || !block.storyOpenedAt) return { phase: "not_started" }

    const hours = hoursSince(block.storyOpenedAt)

    if (block.submittedAt) return { phase: "submitted", hours }
    if (hours > RECALL_CLOSES_HOURS) return { phase: "expired", hours }
    if (hours >= RECALL_OPENS_HOURS) return { phase: "recall", hours }
    if (hours * 60 <= READ_WINDOW_MINUTES) return { phase: "reading", hours }
    return { phase: "waiting", hours }
}


// ========================
// Open a story — starts both clocks
// ========================

router.post("/openStory", authMiddleware, requirePaid, async (req, res) => {
    try {
        const submission = await Submission.findOne({ user: req.user._id })
        const existing = (submission && submission.psychometric && submission.psychometric.storyRecall) || {}

        // ALREADY OPENED MEANS ALREADY OPENED. The hour cannot be restarted by calling this again,
        // which is the obvious way to try to get a second reading window.
        if (existing.storyOpenedAt) {
            return res.status(200).json({ success: true, message: "Already open", data: { restarted: false, ...stateOf(existing) } })
        }

        const seen = req.user.storiesSeen || []
        const available = storyBank.stories.filter((story) => !seen.includes(story.id))
        const pool = available.length > 0 ? available : storyBank.stories
        const story = pool[Math.floor(Math.random() * pool.length)]

        const openedAt = new Date()

        await Submission.findOneAndUpdate(
            { user: req.user._id },
            { $set: { "psychometric.storyRecall.storyId": story.id, "psychometric.storyRecall.storyOpenedAt": openedAt, lastSavedAt: openedAt } },
            { upsert: true }
        )

        await User.findByIdAndUpdate(req.user._id, { $addToSet: { storiesSeen: story.id } })

        if (req.user.progress.psychometric === "not_started") {
            await User.findByIdAndUpdate(req.user._id, { "progress.psychometric": "in_progress" })
        }

        return res.status(201).json({
            success: true,
            message: "Story opened",
            data: { phase: "reading", title: story.title, text: story.text, openedAt, readWindowMinutes: READ_WINDOW_MINUTES },
        })

    } catch (error) {
        return res.status(500).json({ success: false, message: "Could not open the story", error: error.message })
    }
})


// ========================
// Where am I? — the only source of truth for the clocks
// ========================

router.get("/storyState", authMiddleware, requirePaid, async (req, res) => {
    try {
        const submission = await Submission.findOne({ user: req.user._id })
        const block = (submission && submission.psychometric && submission.psychometric.storyRecall) || {}
        const state = stateOf(block)
        const story = storyById(block.storyId)

        const data = {
            phase: state.phase,
            hoursElapsed: state.hours === undefined ? null : Math.round(state.hours * 100) / 100,
            recallOpensHours: RECALL_OPENS_HOURS,
            recallClosesHours: RECALL_CLOSES_HOURS,
        }

        // THE TEXT IS SERVED ONLY INSIDE THE READING WINDOW. Removing it client-side at 60 minutes
        // would be theatre — anyone could re-request it. After the hour the server simply does not
        // have anything to give.
        if (state.phase === "reading" && story) {
            data.title = story.title
            data.text = story.text
            data.minutesLeft = Math.max(0, Math.ceil(READ_WINDOW_MINUTES - state.hours * 60))
        }

        // The options are built at recall time, never earlier — sending them during the reading
        // window would hand the student a checklist of what to memorise.
        if (state.phase === "recall" && story) {
            const seed = seedFrom(story.id + String(req.user._id))
            data.options = {
                LR7: optionsFor("profession1", story.facts.profession1, seed),
                LR8: optionsFor("profession2", story.facts.profession2, seed + 1),
                LR10: optionsFor("ability", story.facts.ability, seed + 2),
            }
            data.hoursLeft = Math.max(0, Math.round((RECALL_CLOSES_HOURS - state.hours) * 10) / 10)
        }

        return res.status(200).json({ success: true, message: "Story state", data })

    } catch (error) {
        return res.status(500).json({ success: false, message: "Could not read the story state", error: error.message })
    }
})


// ========================
// Submit recall
// ========================

router.post("/submitStoryRecall", authMiddleware, requirePaid, async (req, res) => {
    try {
        const { free, structured } = req.body

        const submission = await Submission.findOne({ user: req.user._id })
        const block = (submission && submission.psychometric && submission.psychometric.storyRecall) || {}
        const state = stateOf(block)
        const story = storyById(block.storyId)

        if (!story) return res.status(400).json({ success: false, message: "No story has been opened" })

        // Refused on the server, not hidden in the UI. Beyond 72 hours the module is not scored at
        // all — `long_term_memory` goes null and everything else releases normally, which is the
        // honest outcome rather than a score from a delay the instrument does not cover.
        if (state.phase === "expired") {
            await Submission.findOneAndUpdate(
                { user: req.user._id },
                { $set: { "psychometric.storyRecall.expired": true, "psychometric.storyRecall.submittedAt": new Date() } }
            )
            return res.status(410).json({ success: false, message: "The recall window has closed" })
        }

        if (state.phase !== "recall") {
            return res.status(400).json({ success: false, message: "The recall questions are not open yet" })
        }

        // delayHours is computed HERE from the stored timestamp. Taking it from the client would
        // let anyone claim a 30-hour delay on a 30-minute one, and the scorer's timing gate reads
        // exactly this number.
        const changes = {
            "psychometric.storyRecall.facts": story.facts,
            "psychometric.storyRecall.delayHours": Math.round(state.hours * 100) / 100,
            "psychometric.storyRecall.structured": structured || {},
            "psychometric.storyRecall.freeText": free || {},
            "psychometric.storyRecall.submittedAt": new Date(),
            lastSavedAt: new Date(),
        }

        await Submission.findOneAndUpdate({ user: req.user._id }, { $set: changes })

        return res.status(201).json({ success: true, message: "Recall saved", data: { delayHours: changes["psychometric.storyRecall.delayHours"] } })

    } catch (error) {
        return res.status(500).json({ success: false, message: "Could not save your recall answers", error: error.message })
    }
})

module.exports = router
