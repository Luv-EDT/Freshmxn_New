const express = require("express")
const DataProposal = require("../model/dataProposalsModel")
const ProfessionOverride = require("../model/professionOverridesModel")
const ScoutCandidate = require("../model/scoutCandidatesModel")
const CareerDraft = require("../model/careerDraftsModel")
const ExamOverride = require("../model/examOverridesModel")
const StudyPlaceOverride = require("../model/studyPlaceOverridesModel")
const StudyFactOverride = require("../model/studyFactOverridesModel")
const MentorReview = require("../model/mentorReviewsModel")
const authMiddleware = require("../middlewares/authMiddleware")
const adminAuthMiddleware = require("../middlewares/adminAuthMiddleware")
const { clearOverrides, isValidValue } = require("../utils/professionOverrides")
const { clearStudyOverrides } = require("../utils/studyPlaces")
const { costOf } = require("../utils/aiUsage")
const { validateExamChange, validateNewExam, validateFactChange, validateCutoffChange, cutoffDomains, validateLicenceChange, hostOf, cleanInstitution, EXACT_DATE } = require("../housekeeping/studyRefresh")
const { cutoffs: cutoffData } = require("../utils/cutoffs")
const abroadWork = require("../data/abroad_work.json")
const { qualitiesFor } = require("./mentorReviewsRouter")
const { stackOf } = require("../housekeeping/mentorPass")

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

    if (proposal.kind === "abroad_licence") {
        const value = parseJson(proposal.proposedValue)
        const [careerId, country] = String(proposal.professionId).split(":")
        const current = ((abroadWork.licences[careerId] || {})[country]) || null
        if (!current || !value) return "That licence row is not in data/abroad_work.json"
        const host = hostOf(current.url)
        const valid = validateLicenceChange({ field: "licence", proposed: value }, {}, [{ url: "checked" }], host ? [host] : [])
        if (!valid) return "The proposed route is not well formed, or its page is not the licensing body's own"
        const AbroadLicenceOverride = require("../model/abroadLicenceOverridesModel")
        await AbroadLicenceOverride.updateOne(
            { key: proposal.professionId },
            { $set: { values: parseJson(valid.proposedValue), approvedAt: new Date() }, $push: { sources } },
            { upsert: true }
        )
        return null
    }

    if (proposal.kind === "cutoff") {
        const value = parseJson(proposal.proposedValue)
        const row = cutoffData.rows.find((entry) => entry.id === proposal.professionId)
        if (!row || !value) return "That cut-off row is not in data/cutoffs.json"
        const valid = validateCutoffChange({ field: "closing_rank", proposed: value }, null, [{ url: "checked" }], { now: proposal.createdAt || new Date(), domains: cutoffDomains(row) })
        if (!valid) return "The proposed rank is not well formed, or its page is not the official one"
        const CutoffOverride = require("../model/cutoffOverridesModel")
        await CutoffOverride.updateOne(
            { rowId: proposal.professionId },
            { $set: { values: parseJson(valid.proposedValue), approvedAt: new Date() }, $push: { sources } },
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

        // a mentor's wording (Round 16) changes no page: approved, it waits in Export patch for a
        // person to turn into a reviewed data change
        if (decision === "approved" && proposal.kind === "mentor_text") {
            if (!proposal.proposedValue || !proposal.section) {
                return res.status(400).json({ success: false, message: "The suggestion is not well formed" })
            }
        } else if (decision === "approved" && proposal.kind && proposal.kind !== "career") {
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

        // a mentor-backed proposal: the topic remembers the decision, so next month's look sees it
        // (read, change in JS, $set — the form FerretDB accepts)
        if (proposal.origin === "mentor" && proposal.topic) {
            const ProfessionSuggestions = require("../model/professionSuggestionsModel")
            const row = await ProfessionSuggestions.findOne({ professionId: proposal.professionId }).lean()
            if (row) {
                await ProfessionSuggestions.updateOne({ _id: row._id }, {
                    $set: { topics: (row.topics || []).map((topic) => (topic.key === proposal.topic ? { ...topic, adminDecision: decision, adminDecidedAt: proposal.decidedAt } : topic)) },
                })
            }
        }

        const approvedMessage = proposal.kind === "mentor_text" ? "Approved — it goes into Export patch for a data commit" : "Approved — the career page shows it now"
        return res.status(200).json({ success: true, message: decision === "approved" ? approvedMessage : "Rejected", data: { proposal } })

    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to save the decision", error: error.message })
    }
})

// Everything approved, as a file the owner commits: tools/applyDataPatch.js writes the values into
// ALL-professions.json. The scout's approved careers ride along as drafts — they still have to be
// built (a combined career's two sides, or a full new record) before they can ship.
router.get("/exportPatchForAdmin", authMiddleware, adminAuthMiddleware, async (req, res) => {
    try {
        const CutoffOverride = require("../model/cutoffOverridesModel")
        const AbroadLicenceOverride = require("../model/abroadLicenceOverridesModel")
        const ProfessionSuggestions = require("../model/professionSuggestionsModel")
        const [overrides, approvedScout, accepted, examRows, placeRows, factRows, mentorReviews, cutoffRows, licenceRows, suggestionRows, mentorTexts] = await Promise.all([
            ProfessionOverride.find({ approvedAt: { $ne: null } }).lean(),
            ScoutCandidate.find({ status: { $in: ["approved_combined", "approved_new"] } }).lean(),
            CareerDraft.find({ status: "accepted" }).lean(),
            ExamOverride.find({ approvedAt: { $ne: null } }).lean(),
            StudyPlaceOverride.find({ approvedAt: { $ne: null } }).lean(),
            StudyFactOverride.find({ approvedAt: { $ne: null } }).lean(),
            MentorReview.find({ submittedAt: { $ne: null } }).lean(),
            CutoffOverride.find({ approvedAt: { $ne: null } }).lean(),
            AbroadLicenceOverride.find({ approvedAt: { $ne: null } }).lean(),
            ProfessionSuggestions.find({}).lean(),
            DataProposal.find({ kind: "mentor_text", status: "approved" }).sort({ decidedAt: 1 }).lean(),
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
            // closing ranks read off the official result pages and approved (Round 12)
            cutoffs: cutoffRows.filter((row) => row.values).map((row) => ({
                id: row.rowId,
                values: row.values,
                checkedOn: new Date(row.approvedAt).toISOString().slice(0, 10),
            })),
            // licence routes abroad re-read on the licensing body's own site and approved (Round 13)
            abroadLicences: licenceRows.filter((row) => row.values).map((row) => ({
                id: row.key,
                values: row.values,
                checkedOn: new Date(row.approvedAt).toISOString().slice(0, 10),
            })),
            // mentors' approved changes to their own profession. Words, not values: a person turns each
            // into a data change, so tools/applyDataPatch.js only lists them. Since Round 16 these are
            // the mentor suggestions Claude found a source for and the admin approved in Data updates;
            // the Round 15 approvals made before that ride along.
            mentorNotes: [
                ...suggestionRows.flatMap((row) => (row.approved || []).map((suggestion) => ({
                    id: row.professionId,
                    section: suggestion.section,
                    ...(suggestion.factor ? { factor: suggestion.factor, direction: suggestion.direction } : { verdict: "change" }),
                    note: suggestion.note,
                    sourceUrl: suggestion.sourceUrl || null,
                    reviewedOn: new Date(suggestion.approvedAt || row.updatedAt).toISOString().slice(0, 10),
                }))),
                ...mentorTexts.map((proposal) => ({
                    id: proposal.professionId,
                    section: proposal.section,
                    ...(proposal.factor ? { factor: proposal.factor, direction: proposal.direction } : { verdict: "change" }),
                    note: proposal.proposedValue,
                    sourceUrl: (proposal.sources[0] && proposal.sources[0].url) || null,
                    sources: proposal.sources.map((source) => source.url),
                    reviewedOn: new Date(proposal.decidedAt || proposal.updatedAt).toISOString().slice(0, 10),
                })),
            ],
            // each profession's whole stack of mentor opinions (kept for good, Round 17), written into its
            // `mentor_suggestions` in ALL-professions.json — names, never ids or emails
            mentorSuggestions: suggestionRows.map((row) => ({
                id: row.professionId,
                mentor_suggestions: stackOf(row).map(({ mentorName, section, factor, direction, agrees, note, sourceUrl, suggestedAt, updatedAt }) => ({
                    mentor: mentorName, section, ...(factor ? { factor } : {}), ...(direction ? { direction } : {}), ...(agrees ? { agrees: true } : {}),
                    ...(note ? { note } : {}), ...(sourceUrl ? { sourceUrl } : {}),
                    suggestedOn: new Date(updatedAt || suggestedAt).toISOString().slice(0, 10),
                })),
            })),
            // careers where a mentor answered at least the main qualities and called every quality they
            // answered "about right" — baseline_rating.json can mark these mentor_reviewed. ("About
            // right" no longer goes to the admin to accept, Round 15: there is nothing to change.)
            mentorReviewedRatings: [...new Set(mentorReviews
                .filter((review) => {
                    const qualities = review.items.filter((item) => item.section === "qualities")
                    const answered = new Set(qualities.map((item) => item.factor))
                    return qualitiesFor(review.professionId).filter((quality) => quality.main).every((quality) => answered.has(quality.factor))
                        && qualities.every((item) => item.direction === "right")
                })
                .map((review) => review.professionId))],
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

// ========================
// Research Model For Admin (Round 12)
// ========================

// The latest one-time comparison, the model the monthly research uses now, and why.
router.get("/getModelChoiceForAdmin", authMiddleware, adminAuthMiddleware, async (req, res) => {
    try {
        const ModelComparison = require("../model/modelComparisonsModel")
        const AppSetting = require("../model/appSettingsModel")
        const { researchModel, RESEARCH_MODELS, DEFAULT_RESEARCH_MODEL } = require("../utils/researchModel")
        const [comparison, setting, inUse] = await Promise.all([
            ModelComparison.findOne().sort({ createdAt: -1 }).lean(),
            AppSetting.findOne({ key: "research_model" }).lean(),
            researchModel(),
        ])

        return res.status(200).json({
            success: true,
            message: "Model choice fetched",
            data: {
                comparison,
                inUse,
                chosen: setting ? setting.value : null,
                chosenAt: setting ? setting.updatedAt : null,
                // REFRESH_MODEL on Render wins over the choice made here
                fromEnvironment: Boolean(process.env.REFRESH_MODEL),
                models: RESEARCH_MODELS,
                defaultModel: DEFAULT_RESEARCH_MODEL,
            },
        })

    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to fetch the model choice", error: error.message })
    }
})

router.put("/setResearchModelForAdmin", authMiddleware, adminAuthMiddleware, async (req, res) => {
    try {
        const AppSetting = require("../model/appSettingsModel")
        const { RESEARCH_MODELS } = require("../utils/researchModel")
        const { model } = req.body || {}

        if (!RESEARCH_MODELS.includes(model)) {
            return res.status(400).json({ success: false, message: "Unknown model" })
        }

        await AppSetting.updateOne({ key: "research_model" }, { $set: { value: model, setBy: req.user._id } }, { upsert: true })

        return res.status(200).json({
            success: true,
            message: process.env.REFRESH_MODEL
                ? `Saved — but REFRESH_MODEL on Render (${process.env.REFRESH_MODEL}) still wins until it is removed`
                : "Saved — the next monthly run uses it",
            data: { model },
        })

    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to save the model", error: error.message })
    }
})

// ========================
// Activity Matches For Admin (Round 14)
// ========================

// Every time a student's activity was treated as one we had already rated, and how similar the two
// were — lowest first, so the closest calls are read first. This is how the 0.90 threshold
// (ACTIVITY_DEDUP_COSINE) gets checked against real answers. The similarity is shown to the admin
// only; nothing about it reaches a student.
router.get("/getActivityFoldsForAdmin", authMiddleware, adminAuthMiddleware, async (req, res) => {
    try {
        const ActivityFactors = require("../model/activityFactorsModel")
        const { DEDUP_COSINE } = require("../matching/activityResolver")
        const rows = await ActivityFactors.find({ "folds.0": { $exists: true } }).select("canonicalActivity folds").lean()
        const folds = rows
            .flatMap((row) => row.folds.map((fold) => ({ rowId: row._id, cachedActivity: row.canonicalActivity, text: fold.text, score: fold.score, at: fold.at })))
            .sort((left, right) => left.score - right.score)

        return res.status(200).json({
            success: true,
            message: "Activity matches fetched",
            data: {
                threshold: DEDUP_COSINE,
                cachedActivities: await ActivityFactors.countDocuments({}),
                foldCount: folds.length,
                closeCalls: folds.filter((fold) => fold.score < 0.93).length,
                folds: folds.slice(0, 150),
            },
        })

    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to fetch activity matches", error: error.message })
    }
})

// HOW WE READ ONE STUDENT'S ACTIVITIES (Round 17, owner). By email: the activities they ticked as
// ongoing in Current interests (only those reach the activity matcher), and — from their latest
// report — what each was read as and whether the cache already knew it. Admin only.
// THE ACTIVITY TRACE (Round 19, owner: "show me the exact flow"). One line per activity the
// report read, in the order the resolver works:
//   wrote → named as (the one common string) → cache (exact wording / exact name / near at a cosine
//   ≥ the threshold / new rating) → the careers that row points to → where each landed in THIS
//   student's report (rank and band, ruled out and why, or not in the list).
// Pure, so a fixture can check it without a database.
const professionNames = new Map(require("../data/ALL-professions.json").professions.map((row) => [row.id, row.profession]))

const traceReadings = (readings, recommendation) => {
    const ranked = new Map(((recommendation && recommendation.ranked_professions) || []).map((entry) => [String(entry.professionId), entry]))
    const filtered = new Map(((recommendation && recommendation.filtered) || []).map((entry) => [String(entry.professionId), entry]))
    return (readings || []).map((reading) => ({
        wrote: reading.said,
        namedAs: reading.namedAs || null,
        pointsTo: reading.pointsTo || [],
        cache: reading.cacheHit,
        nearScore: typeof reading.nearScore === "number" ? reading.nearScore : null,
        readAs: reading.readAs,
        careers: (reading.candidates || []).map((id) => {
            const entry = ranked.get(String(id))
            const ruledOut = filtered.get(String(id))
            return {
                id,
                name: professionNames.get(id) || id,
                landed: entry ? `#${entry.rankedPosition} (tier ${entry.tier})` : ruledOut ? `ruled out — ${ruledOut.reason}` : "not in the list",
            }
        }),
        // Round 22: what the strict shortlist also considered but marked partial — never matched, so a
        // career that is "missing" can be checked here
        partial: (reading.partial || []).map((id) => ({ id, name: professionNames.get(id) || id })),
    }))
}

router.get("/getActivityReadingsForAdmin", authMiddleware, adminAuthMiddleware, async (req, res) => {
    try {
        const User = require("../model/userModel")
        const Submission = require("../model/submissionsModel")
        const Recommendation = require("../model/recommendationsModel")
        const email = typeof req.query.email === "string" ? req.query.email.trim().toLowerCase() : ""
        if (!email) {
            return res.status(400).json({ success: false, message: "Enter the student's email" })
        }

        const student = await User.findOne({ email }).select("name email").lean()
        if (!student) {
            return res.status(404).json({ success: false, message: "No student with that email" })
        }

        const [submission, recommendation] = await Promise.all([
            Submission.findOne({ user: student._id }).select("interest.currentInterests.persistentInterests psychometric.storyRecall.free psychometric.storyRecall.freeMeta psychometric.storyRecall.submittedAt").lean(),
            Recommendation.findOne({ user: student._id }).select("activity_readings ranked_professions.professionId ranked_professions.rankedPosition ranked_professions.tier filtered updatedAt").lean(),
        ])
        const ticked = (((submission || {}).interest || {}).currentInterests || {}).persistentInterests || []
        const story = ((submission || {}).psychometric || {}).storyRecall || {}

        return res.status(200).json({
            success: true,
            message: "Activity readings fetched",
            data: {
                name: student.name,
                email: student.email,
                ticked: ticked.map((row) => row.activity).filter(Boolean),
                readings: (recommendation && recommendation.activity_readings) || [],
                trace: traceReadings(recommendation && recommendation.activity_readings, recommendation),
                threshold: require("../matching/activityResolver").DEDUP_COSINE,
                // why long-term memory may be "Partial": was the story's free recall marked?
                storyFreeRecall: story.submittedAt
                    ? { graded: Boolean(story.free), reason: (story.freeMeta && story.freeMeta.unscoreable_reason) || null }
                    : null,
                reportAt: recommendation ? recommendation.updatedAt : null,
            },
        })

    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to fetch the student's activities", error: error.message })
    }
})

// "Not the same": the wording leaves that cached activity and is never folded into it again, so the
// next student who writes it gets it rated on its own. Earlier reports are not recomputed.
router.put("/splitActivityFoldForAdmin/:rowId", authMiddleware, adminAuthMiddleware, async (req, res) => {
    try {
        const text = typeof req.body.text === "string" ? req.body.text.trim().toLowerCase().slice(0, 300) : ""
        if (!text) {
            return res.status(400).json({ success: false, message: "Which wording should be split off?" })
        }

        const ActivityFactors = require("../model/activityFactorsModel")
        const current = await ActivityFactors.findById(req.params.rowId).select("exampleRaw folds").lean()
        if (!current) {
            return res.status(404).json({ success: false, message: "That cached activity no longer exists" })
        }
        // filtered here and written whole: a $pull with a condition on sub-documents is not supported
        // everywhere this runs (the test database), and an admin click never races itself
        const row = await ActivityFactors.findOneAndUpdate(
            { _id: current._id },
            {
                $set: { exampleRaw: (current.exampleRaw || []).filter((wording) => wording !== text), folds: (current.folds || []).filter((fold) => fold.text !== text) },
                $addToSet: { refusedFolds: text },
            },
            { returnDocument: "after" }
        ).lean()

        return res.status(200).json({
            success: true,
            message: `"${text}" will be rated on its own from now on`,
            data: { rowId: row._id, cachedActivity: row.canonicalActivity, refusedFolds: row.refusedFolds },
        })

    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to split the match", error: error.message })
    }
})

module.exports = router
module.exports.traceReadings = traceReadings
