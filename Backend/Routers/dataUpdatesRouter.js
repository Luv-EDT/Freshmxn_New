const express = require("express")
const DataProposal = require("../model/dataProposalsModel")
const ProfessionOverride = require("../model/professionOverridesModel")
const ScoutCandidate = require("../model/scoutCandidatesModel")
const CareerDraft = require("../model/careerDraftsModel")
const ExamOverride = require("../model/examOverridesModel")
const StudyPlaceOverride = require("../model/studyPlaceOverridesModel")
const StudyFactOverride = require("../model/studyFactOverridesModel")
const authMiddleware = require("../middlewares/authMiddleware")
const adminAuthMiddleware = require("../middlewares/adminAuthMiddleware")
const { clearOverrides, isValidValue } = require("../utils/professionOverrides")
const { clearStudyOverrides } = require("../utils/studyPlaces")
const { costOf } = require("../utils/aiUsage")
const { validateExamChange, validateNewExam, validateFactChange, cleanInstitution, EXACT_DATE } = require("../housekeeping/studyRefresh")

const router = express.Router()

// The admin's two tabs for the calendar jobs that read the outside world (Round 10, S9):
//   Data updates       proposals from the monthly refresh (housekeeping/dataRefresh.js)
//   Emerging careers   the weekly scout's watchlist (housekeeping/careerScout.js)
// Admin only, every route. "Run now" for both jobs is /followUps/runHousekeepingForAdmin.

const SCOUT_DECISIONS = ["approved_combined", "approved_new", "dismissed", "watch"]


// ========================
// Data Proposals For Admin
// ========================

const parseJson = (text) => {
    try {
        return JSON.parse(text)
    } catch (error) {
        return null
    }
}

// What approving an exam or college proposal writes (Round 11). Checked again here — the proposal
// was valid when the bot filed it, and the admin's approval must not be the thing that lets a bad
// value through. Returns an error message, or null once written.
const approveStudyProposal = async (proposal) => {
    const sources = { $each: proposal.sources.map((source) => ({ url: source.url, title: source.title })), $slice: -20 }

    if (proposal.kind === "study_fact") {
        const proposed = proposal.field === "abroad" ? parseJson(proposal.proposedValue) : proposal.proposedValue
        const valid = validateFactChange({ field: proposal.field, proposed }, {}, [{ url: "checked" }])
        if (!valid) return "The proposed value is not well formed"
        const value = proposal.field === "abroad" ? parseJson(valid.proposedValue) : valid.proposedValue
        await StudyFactOverride.updateOne(
            { professionId: proposal.professionId },
            { $set: { [`values.${proposal.field}`]: value, approvedAt: new Date() }, $push: { sources } },
            { upsert: true }
        )
        return null
    }

    if (proposal.kind === "exam" && proposal.field === "new_exam") {
        const exam = parseJson(proposal.proposedValue)
        if (!validateNewExam({ ...exam, reason: "" }, [{ url: "checked" }])) return "The proposed exam is not well formed, or the calendar already has it"
        await ExamOverride.updateOne(
            { examId: proposal.professionId },
            { $set: { newExam: exam, approvedAt: new Date() }, $push: { sources } },
            { upsert: true }
        )
        return null
    }

    if (proposal.kind === "exam") {
        const value = String(proposal.proposedValue || "").trim()
        if (!value || value.length > 200 || EXACT_DATE.test(value) || !validateExamChange({ field: proposal.field, proposed: value }, {}, [{ url: "checked" }])) {
            return "The proposed value is not well formed"
        }
        await ExamOverride.updateOne(
            { examId: proposal.professionId },
            { $set: { [`values.${proposal.field}`]: value, approvedAt: new Date() }, $push: { sources } },
            { upsert: true }
        )
        return null
    }

    // college
    if (proposal.field === "remove_institution") {
        await StudyPlaceOverride.updateOne(
            { disciplineId: proposal.professionId },
            { $addToSet: { removed: String(proposal.proposedValue).toLowerCase() }, $set: { approvedAt: new Date() }, $push: { sources } },
            { upsert: true }
        )
        return null
    }
    const institution = cleanInstitution(parseJson(proposal.proposedValue))
    if (!institution) return "The proposed institution is not well formed"
    await StudyPlaceOverride.updateOne(
        { disciplineId: proposal.professionId },
        { $push: { [proposal.field === "add_institution" ? "added" : "updated"]: institution, sources }, $set: { approvedAt: new Date() } },
        { upsert: true }
    )
    return null
}

router.get("/getProposalsForAdmin", authMiddleware, adminAuthMiddleware, async (req, res) => {
    try {
        const status = ["open", "approved", "rejected", "superseded"].includes(req.query.status) ? req.query.status : "open"

        const [proposals, open, overrides] = await Promise.all([
            DataProposal.find({ status }).sort({ createdAt: -1 }).limit(500).lean(),
            DataProposal.countDocuments({ status: "open" }),
            ProfessionOverride.countDocuments({ lastCheckedAt: { $ne: null } }),
        ])

        return res.status(200).json({
            success: true,
            message: "Proposals fetched successfully",
            data: { proposals, summary: { open, careersChecked: overrides } },
        })

    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to fetch proposals", error: error.message })
    }
})

// Approve puts the value on the career pages at once (the overrides cache is cleared); reject
// leaves the data as it is. A decided proposal cannot be decided again.
router.put("/decideProposalForAdmin/:id", authMiddleware, adminAuthMiddleware, async (req, res) => {
    try {
        const { decision, adminNote } = req.body

        if (!["approved", "rejected"].includes(decision)) {
            return res.status(400).json({ success: false, message: "Decision must be approved or rejected" })
        }

        const proposal = await DataProposal.findById(req.params.id)

        if (!proposal) {
            return res.status(404).json({ success: false, message: "Proposal not found" })
        }

        if (proposal.status !== "open") {
            return res.status(400).json({ success: false, message: "This proposal has already been decided" })
        }

        if (decision === "approved" && proposal.kind && proposal.kind !== "career") {
            const problem = await approveStudyProposal(proposal)
            if (problem) {
                return res.status(400).json({ success: false, message: problem })
            }
            clearStudyOverrides()
        } else if (decision === "approved") {
            if (!isValidValue(proposal.field, proposal.proposedValue)) {
                return res.status(400).json({ success: false, message: "The proposed value is not well formed" })
            }

            await ProfessionOverride.updateOne(
                { professionId: proposal.professionId },
                {
                    $set: { [`values.${proposal.field}`]: proposal.proposedValue, approvedAt: new Date() },
                    $push: { sources: { $each: proposal.sources.map((source) => ({ url: source.url, title: source.title })), $slice: -20 } },
                },
                { upsert: true }
            )
            clearOverrides()
        }

        proposal.status = decision
        proposal.decidedAt = new Date()
        proposal.adminNote = typeof adminNote === "string" ? adminNote.trim().slice(0, 500) : ""
        await proposal.save()

        return res.status(200).json({ success: true, message: decision === "approved" ? "Approved — the career page shows it now" : "Rejected", data: { proposal } })

    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to save the decision", error: error.message })
    }
})

// Everything approved, as a file the owner commits: tools/applyDataPatch.js writes the values into
// ALL-professions.json. The scout's approved careers ride along as drafts — they still have to be
// built (a combined career's two sides, or a full new record) before they can ship.
router.get("/exportPatchForAdmin", authMiddleware, adminAuthMiddleware, async (req, res) => {
    try {
        const [overrides, approvedScout, accepted, examRows, placeRows, factRows] = await Promise.all([
            ProfessionOverride.find({ approvedAt: { $ne: null } }).lean(),
            ScoutCandidate.find({ status: { $in: ["approved_combined", "approved_new"] } }).lean(),
            CareerDraft.find({ status: "accepted" }).lean(),
            ExamOverride.find({ approvedAt: { $ne: null } }).lean(),
            StudyPlaceOverride.find({ approvedAt: { $ne: null } }).lean(),
            StudyFactOverride.find({ approvedAt: { $ne: null } }).lean(),
        ])
        const acceptedFor = new Set(accepted.map((draft) => String(draft.candidate)))

        const patch = {
            kind: "freshmxn-data-patch",
            exportedAt: new Date().toISOString(),
            careers: overrides.map((row) => ({
                id: row.professionId,
                values: row.values || {},
                checkedOn: row.approvedAt ? new Date(row.approvedAt).toISOString().slice(0, 10) : null,
                sources: (row.sources || []).map((source) => source.url),
            })),
            // accepted drafts, complete — tools/applyDataPatch.js writes them into the data files
            newCareers: accepted.filter((draft) => draft.kind === "new").map((draft) => ({ record: draft.record, rating: draft.rating, embedding: draft.embedding })),
            newCombined: accepted.filter((draft) => draft.kind === "combined").map((draft) => draft.record),
            // the study bot's approved changes (Round 11) — tools/applyDataPatch.js writes them into
            // exam_calendar.json and study_places.json
            exams: examRows.filter((row) => row.values && Object.values(row.values).some(Boolean)).map((row) => ({
                id: row.examId,
                values: row.values,
                checkedOn: new Date(row.approvedAt).toISOString().slice(0, 10),
            })),
            newExams: examRows.filter((row) => row.newExam).map((row) => ({ id: row.examId.replace(/^new:/, ""), ...row.newExam })),
            studyPlaces: placeRows.map((row) => ({
                discipline: row.disciplineId,
                added: (row.added || []).map(({ _id, ...institution }) => institution),
                removed: row.removed || [],
                updated: (row.updated || []).map(({ _id, ...institution }) => institution),
            })),
            // master's need and studying abroad (Round 12), with the pages that backed them
            studyFacts: factRows.filter((row) => row.values && (row.values.after_undergrad || row.values.abroad)).map((row) => ({
                id: row.professionId,
                values: row.values,
                checkedOn: new Date(row.approvedAt).toISOString().slice(0, 10),
                sources: (row.sources || []).map((source) => ({ url: source.url, title: source.title })),
            })),
            // approved but not yet accepted as a finished draft — listed so nothing is forgotten
            newCareerDrafts: approvedScout.filter((row) => !acceptedFor.has(String(row._id))).map((row) => ({
                title: row.title,
                as: row.status === "approved_combined" ? "combined" : "new",
                nearest: row.nearest,
                assessment: row.assessment,
                adminNote: row.adminNote,
            })),
        }

        return res.status(200).json({ success: true, message: "Patch exported", data: { patch } })

    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to export the patch", error: error.message })
    }
})


// ========================
// Emerging Careers For Admin
// ========================

router.get("/getScoutForAdmin", authMiddleware, adminAuthMiddleware, async (req, res) => {
    try {
        const status = SCOUT_DECISIONS.includes(req.query.status) ? req.query.status : "watch"

        const candidates = await ScoutCandidate.find({ status })
            .sort({ aspirationCount: -1, lastSeenAt: -1 })
            .limit(300)
            .lean()

        // the career drafted from each approved row, if any (Round 11)
        const drafts = await CareerDraft.find({ candidate: { $in: candidates.map((candidate) => candidate._id) } }).lean()
        const draftFor = new Map(drafts.map((draft) => [String(draft.candidate), draft]))

        return res.status(200).json({
            success: true,
            message: "Watchlist fetched successfully",
            data: { candidates: candidates.map((candidate) => ({ ...candidate, draft: draftFor.get(String(candidate._id)) || null })) },
        })

    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to fetch the watchlist", error: error.message })
    }
})

router.put("/decideScoutForAdmin/:id", authMiddleware, adminAuthMiddleware, async (req, res) => {
    try {
        const { decision, adminNote } = req.body

        if (!SCOUT_DECISIONS.includes(decision)) {
            return res.status(400).json({ success: false, message: "Unknown decision" })
        }

        const candidate = await ScoutCandidate.findByIdAndUpdate(
            req.params.id,
            { status: decision, adminNote: typeof adminNote === "string" ? adminNote.trim().slice(0, 500) : "" },
            { new: true }
        ).lean()

        if (!candidate) {
            return res.status(404).json({ success: false, message: "Not found" })
        }

        // Approving builds the career the way the 223 were built (housekeeping/draftCareer.js) —
        // queued, because drafting and three rating passes take a few minutes.
        let drafting = false
        if (decision === "approved_new" || decision === "approved_combined") {
            const { runNow } = require("../workers/housekeepingWorker")
            const { withTimeout } = require("../workers/queueHelpers")
            await withTimeout(runNow("draft_career", { candidateId: String(candidate._id) }), "queueing the draft")
            drafting = true
        }

        return res.status(200).json({ success: true, message: drafting ? "Saved — the career is being drafted; it appears here in a few minutes" : "Saved", data: { candidate, drafting } })

    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to save the decision", error: error.message })
    }
})


// ========================
// Career Drafts For Admin (Round 11)
// ========================

// Accept: the draft goes into Export patch, and from there into the data files by a commit.
// Send back: drafted again with the admin's note. A draft with a MUST FIX warning cannot be accepted.
router.put("/decideDraftForAdmin/:candidateId", authMiddleware, adminAuthMiddleware, async (req, res) => {
    try {
        const { decision, adminNote } = req.body

        if (!["accept", "send_back"].includes(decision)) {
            return res.status(400).json({ success: false, message: "Decision must be accept or send_back" })
        }

        const draft = await CareerDraft.findOne({ candidate: req.params.candidateId })

        if (!draft || !["ready", "sent_back", "failed", "accepted"].includes(draft.status)) {
            return res.status(400).json({ success: false, message: "There is no finished draft to decide on" })
        }

        if (decision === "accept") {
            if (draft.status !== "ready") {
                return res.status(400).json({ success: false, message: "Only a ready draft can be accepted" })
            }
            if (draft.warnings.some((warning) => warning.startsWith("MUST FIX"))) {
                return res.status(400).json({ success: false, message: "This draft breaks a rule (MUST FIX) — send it back with a note" })
            }
            draft.status = "accepted"
            draft.adminNote = typeof adminNote === "string" ? adminNote.trim().slice(0, 1000) : draft.adminNote
            await draft.save()
            return res.status(200).json({ success: true, message: "Accepted — it is in Export patch now", data: { status: draft.status } })
        }

        const note = typeof adminNote === "string" ? adminNote.trim().slice(0, 1000) : ""
        if (!note) {
            return res.status(400).json({ success: false, message: "Say what to change, so the next draft can fix it" })
        }
        draft.status = "sent_back"
        draft.adminNote = note
        await draft.save()

        const { runNow } = require("../workers/housekeepingWorker")
        const { withTimeout } = require("../workers/queueHelpers")
        await withTimeout(runNow("draft_career", { candidateId: String(draft.candidate) }), "queueing the redraft")

        return res.status(200).json({ success: true, message: "Sent back — a new draft appears here in a few minutes", data: { status: "drafting" } })

    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to save the decision", error: error.message })
    }
})

// ========================
// AI Usage For Admin (Round 11)
// ========================

// One month of utils/aiUsage's log, summed by job, with the cost at list prices. A model with no
// listed price shows its tokens and a null cost — never a guess.
router.get("/getAiUsageForAdmin", authMiddleware, adminAuthMiddleware, async (req, res) => {
    try {
        const month = /^\d{4}-\d{2}$/.test(String(req.query.month || "")) ? req.query.month : new Date().toISOString().slice(0, 7)
        const AiUsage = require("../model/aiUsageModel")
        const rows = await AiUsage.find({ day: { $regex: `^${month}` } }).lean()

        const byJob = new Map()
        let total = 0
        let unpriced = false
        rows.forEach((row) => {
            const job = byJob.get(row.job) || { job: row.job, calls: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, webSearches: 0, cost: 0, models: [] }
            ;["calls", "inputTokens", "outputTokens", "cacheReadTokens", "cacheWriteTokens", "webSearches"].forEach((key) => { job[key] += row[key] || 0 })
            if (!job.models.includes(row.model)) job.models.push(row.model)
            const cost = costOf(row)
            if (cost === null) unpriced = true
            else {
                job.cost = Math.round((job.cost + cost) * 100) / 100
                total += cost
            }
            byJob.set(row.job, job)
        })

        return res.status(200).json({
            success: true,
            message: "Usage fetched",
            data: { month, jobs: [...byJob.values()].sort((left, right) => right.cost - left.cost), totalCost: Math.round(total * 100) / 100, unpriced },
        })

    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to fetch usage", error: error.message })
    }
})

module.exports = router
