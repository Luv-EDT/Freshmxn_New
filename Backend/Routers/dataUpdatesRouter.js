const express = require("express")
const DataProposal = require("../model/dataProposalsModel")
const ProfessionOverride = require("../model/professionOverridesModel")
const ScoutCandidate = require("../model/scoutCandidatesModel")
const authMiddleware = require("../middlewares/authMiddleware")
const adminAuthMiddleware = require("../middlewares/adminAuthMiddleware")
const { clearOverrides, isValidValue } = require("../utils/professionOverrides")

const router = express.Router()

// The admin's two tabs for the calendar jobs that read the outside world (Round 10, S9):
//   Data updates       proposals from the monthly refresh (housekeeping/dataRefresh.js)
//   Emerging careers   the weekly scout's watchlist (housekeeping/careerScout.js)
// Admin only, every route. "Run now" for both jobs is /followUps/runHousekeepingForAdmin.

const SCOUT_DECISIONS = ["approved_combined", "approved_new", "dismissed", "watch"]


// ========================
// Data Proposals For Admin
// ========================

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

        if (decision === "approved") {
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
        const [overrides, approvedScout] = await Promise.all([
            ProfessionOverride.find({ approvedAt: { $ne: null } }).lean(),
            ScoutCandidate.find({ status: { $in: ["approved_combined", "approved_new"] } }).lean(),
        ])

        const patch = {
            kind: "freshmxn-data-patch",
            exportedAt: new Date().toISOString(),
            careers: overrides.map((row) => ({
                id: row.professionId,
                values: row.values || {},
                checkedOn: row.approvedAt ? new Date(row.approvedAt).toISOString().slice(0, 10) : null,
                sources: (row.sources || []).map((source) => source.url),
            })),
            newCareerDrafts: approvedScout.map((row) => ({
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

        return res.status(200).json({ success: true, message: "Watchlist fetched successfully", data: { candidates } })

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

        return res.status(200).json({ success: true, message: "Saved", data: { candidate } })

    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to save the decision", error: error.message })
    }
})

module.exports = router
