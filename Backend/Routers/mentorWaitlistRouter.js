const express = require("express")
const User = require("../model/userModel")
const Mentor = require("../model/mentorsModel")
const MentorWaitlist = require("../model/mentorWaitlistModel")
const Recommendation = require("../model/recommendationsModel")
const Submission = require("../model/submissionsModel")
const authMiddleware = require("../middlewares/authMiddleware")
const adminAuthMiddleware = require("../middlewares/adminAuthMiddleware")
const taxonomy = require("../data/ALL-professions.json")

const router = express.Router()

// The Tier-2 mentor waitlist, after payment. Flow (mentor_waitlist_page.md):
//   pay → place held (grantAccess, untouched) → student completes Step 1 and CHOOSES one job role in
//   one of their own matches → we match a mentor within 20 BUSINESS DAYS OF THAT CHOICE → admin matches.
//
// The row is created lazily on the student's first visit rather than at payment, so no payment
// code changes: holding Tier 2 is what entitles you to a row, and the row only records the choice.

const MATCH_BUSINESS_DAYS = 20


// ========================
// Helpers
// ========================

const jobRolesById = new Map(taxonomy.professions.map((profession) => [profession.id, profession.job_roles || []]))

// THE PICKER (owner, Round 11): the student chooses one JOB ROLE inside one of their own matches, so
// the mentor we find does that work, not merely something in the same field. Built here, from the
// student's own ranking and the data file, so the list the page shows and the list the choice is
// checked against are the same list. The roles the matching found suit this student best (the role
// group in `bestRoles`, Round 10) come first and are marked; every role-group role is also a job role.
const pickerOptions = (ranked) => ranked.map((entry, index) => {
    const all = jobRolesById.get(String(entry.professionId)) || []
    const suits = entry.bestRoles && Array.isArray(entry.bestRoles.roles) ? entry.bestRoles.roles.filter((role) => all.includes(role)) : []
    return {
        professionId: String(entry.professionId),
        profession: entry.profession,
        rank: index + 1,
        jobRoles: [...suits, ...all.filter((role) => !suits.includes(role))],
        suitsYou: suits,
    }
})

// Mon–Fri only, no holiday calendar. Promised to the student as "within 20 business days".
const addBusinessDays = (start, days) => {
    const date = new Date(start)
    let added = 0

    while (added < days) {
        date.setDate(date.getDate() + 1)
        const weekday = date.getDay()
        if (weekday !== 0 && weekday !== 6) added += 1
    }

    return date
}

const dueByFor = (row) => (row && row.choiceSentAt ? addBusinessDays(row.choiceSentAt, MATCH_BUSINESS_DAYS) : null)

// Discovery + Mentor (tier 2) or Mentor Only (tier 3) — utils/plans.js
const { grants } = require("../utils/plans")
const { industryByCode } = require("../utils/industries")
const hasMentorPlan = (user) => user.paid === true && grants(Number(user.currentTier)).mentor
const isMentorOnly = (user) => user.paid === true && Number(user.currentTier) === 3
const professionById = new Map(taxonomy.professions.map((profession) => [profession.id, profession]))
const cleanText = (value, max) => (typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : "")

// what a student may see about their assigned mentor — the profile-visible name and role only.
// Contact details, currency and residence never leave the admin side.
const mentorSummary = async (mentorUserId) => {
    if (!mentorUserId) return null
    const profile = await Mentor.findOne({ user: mentorUserId }).select("name currentRole discipline")
    return profile ? { name: profile.name, currentRole: profile.currentRole, discipline: profile.discipline } : null
}


// ========================
// Get My Waitlist
// ========================

router.get("/getMyWaitlist", authMiddleware, async (req, res) => {
    try {
        if (!hasMentorPlan(req.user)) {
            return res.status(403).json({
                success: false,
                message: "The mentor waitlist comes with the Discovery + Mentor or Mentor Only plan"
            })
        }

        let row = await MentorWaitlist.findOneAndUpdate(
            { user: req.user._id },
            { $setOnInsert: { user: req.user._id, matchStatus: "awaiting_choice" } },
            { upsert: true, returnDocument: "after" }
        )

        // A row closed when the student left Tier 2 (paymentsRouter closeMentorWaitlist) belongs to
        // that earlier place. Being on Tier 2 again means a new place: fresh choice, fresh clock.
        if (row.resolution === "left_tier2") {
            row = await MentorWaitlist.findOneAndUpdate(
                { _id: row._id },
                {
                    $set: { matchStatus: "awaiting_choice", resolution: null, adminNote: "Re-opened on a new Tier 2 place" },
                    $unset: { chosenProfessionId: "", chosenProfessionName: "", chosenJobRole: "", jobRoleIsOther: "", chosenIndustryCode: "", otherRequest: "", planTier: "", choiceSentAt: "", assignedMentor: "", matchedAt: "" },
                },
                { returnDocument: "after" }
            )
        }

        // the careers and their job roles to choose from — only needed before a choice is sent.
        // Mentor Only has no matches: the page loads every career from /professions/getOptions.
        let options = null
        if (row.matchStatus === "awaiting_choice" && !isMentorOnly(req.user)) {
            const recommendation = await Recommendation.findOne({ user: req.user._id }).select("ranked_professions").lean()
            options = pickerOptions(recommendation ? recommendation.ranked_professions || [] : [])
        }

        return res.status(200).json({
            success: true,
            message: "Waitlist fetched successfully",
            data: {
                matchStatus: row.matchStatus,
                chosenProfessionId: row.chosenProfessionId,
                chosenProfessionName: row.chosenProfessionName,
                chosenJobRole: row.chosenJobRole || null,
                chosenIndustry: row.chosenIndustryCode && industryByCode.get(row.chosenIndustryCode) ? industryByCode.get(row.chosenIndustryCode).name : null,
                otherRequest: row.otherRequest || null,
                mentorOnly: isMentorOnly(req.user),
                options,
                choiceSentAt: row.choiceSentAt,
                dueBy: dueByFor(row),
                matchedAt: row.matchedAt,
                resolution: row.resolution,
                mentor: await mentorSummary(row.assignedMentor),
            },
        })

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to fetch your waitlist place",
            error: error.message,
        })
    }
})


// ========================
// Choose A Profession
// ========================

// ONE-TIME. Sending the choice starts the 20-business-day clock and the search; a student who
// wants to change it asks us, and an admin resets it (resetChoiceForAdmin below).
router.post("/chooseProfession", authMiddleware, async (req, res) => {
    try {
        if (!hasMentorPlan(req.user)) {
            return res.status(403).json({
                success: false,
                message: "The mentor waitlist comes with the Discovery + Mentor or Mentor Only plan"
            })
        }

        const { professionId, jobRole, jobRoleOther, industryCode, other } = req.body

        // an industry is a nice-to-have on either plan; when given it must be one of ours
        const industry = industryCode ? industryByCode.get(String(industryCode)) : null
        if (industryCode && !industry) {
            return res.status(400).json({ success: false, message: "Please choose an industry from the list" })
        }

        let choice
        if (isMentorOnly(req.user)) {
            // MENTOR ONLY (Round 12): any of our careers, a role in it or their own words for one,
            // or — if the career isn't in our list at all — a short description we act on by hand.
            const otherText = cleanText(other, 300)
            const profession = professionById.get(String(professionId))
            if (!profession && otherText.length >= 3) {
                choice = { chosenProfessionId: null, chosenProfessionName: null, chosenJobRole: null, jobRoleIsOther: false, otherRequest: otherText }
            } else if (!profession) {
                return res.status(400).json({ success: false, message: "Please choose a career from the list, or tell us what you're looking for" })
            } else if (jobRole === "other") {
                const ownRole = cleanText(jobRoleOther, 120)
                if (ownRole.length < 2) {
                    return res.status(400).json({ success: false, message: "Please tell us the job role you have in mind" })
                }
                choice = { chosenProfessionId: profession.id, chosenProfessionName: profession.profession, chosenJobRole: ownRole, jobRoleIsOther: true, otherRequest: null }
            } else {
                const role = (profession.job_roles || []).find((name) => name === jobRole)
                if (!role) {
                    return res.status(400).json({ success: false, message: "Please choose a job role from that career" })
                }
                choice = { chosenProfessionId: profession.id, chosenProfessionName: profession.profession, chosenJobRole: role, jobRoleIsOther: false, otherRequest: null }
            }
        } else {
            // the choice must come from THIS student's own ranked matches — the id is checked against
            // their recommendation and the name is read from there, never from the request body
            const recommendation = await Recommendation.findOne({ user: req.user._id }).lean()
            const ranked = recommendation ? recommendation.ranked_professions || [] : []
            const match = ranked.find((entry) => String(entry.professionId) === String(professionId))

            if (!match) {
                return res.status(400).json({
                    success: false,
                    message: ranked.length === 0
                        ? "Your matches aren't ready yet — finish your assessment first"
                        : "Please choose a career from your matches"
                })
            }

            // the role must be one of THIS career's job roles, exactly as the data file names it
            const role = (jobRolesById.get(String(match.professionId)) || []).find((name) => name === jobRole)

            if (!role) {
                return res.status(400).json({
                    success: false,
                    message: "Please choose a job role from that career"
                })
            }
            choice = { chosenProfessionId: String(match.professionId), chosenProfessionName: match.profession, chosenJobRole: role, jobRoleIsOther: false, otherRequest: null }
        }

        const existing = await MentorWaitlist.findOne({ user: req.user._id })

        if (existing && existing.choiceSentAt) {
            return res.status(400).json({
                success: false,
                message: "You've already sent your choice. To change it, message us on WhatsApp"
            })
        }

        const row = await MentorWaitlist.findOneAndUpdate(
            { user: req.user._id },
            {
                user: req.user._id,
                ...choice,
                chosenIndustryCode: industry ? industry.code : null,
                planTier: Number(req.user.currentTier),
                choiceSentAt: new Date(),
                matchStatus: "matching",
            },
            { upsert: true, returnDocument: "after" }
        )

        return res.status(200).json({
            success: true,
            message: "Choice sent — your 20-business-day match has started",
            data: {
                matchStatus: row.matchStatus,
                chosenProfessionId: row.chosenProfessionId,
                chosenProfessionName: row.chosenProfessionName,
                chosenJobRole: row.chosenJobRole,
                otherRequest: row.otherRequest || null,
                choiceSentAt: row.choiceSentAt,
                dueBy: dueByFor(row),
            },
        })

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to send your choice",
            error: error.message,
        })
    }
})


// ========================
// Get All For Admin
// ========================

// every student on a mentor plan (Discovery + Mentor or Mentor Only), with their row — or a virtual "awaiting_choice" one if they have never
// opened the page. Admin actions below are keyed on the STUDENT's user id for the same reason.
router.get("/getAllForAdmin", authMiddleware, adminAuthMiddleware, async (req, res) => {
    try {
        const students = await User.find({ role: "student", paid: true, currentTier: { $in: [2, 3] } })
            .select("name email phone createdAt currentTier")
            .sort({ createdAt: -1 })
            .lean()

        const rows = await MentorWaitlist.find({ user: { $in: students.map((s) => s._id) } })
            .populate("assignedMentor", "name email")
            .lean()

        const rowByUser = new Map(rows.map((row) => [String(row.user), row]))

        // Support needs a student declared on the assessment page AND agreed their mentor may know
        // (Round 10). Nothing is shown for anyone who did not tick that box.
        const NEED_LABELS = { vision: "seeing the screen", hearing: "hearing", motor: "movement / fine motor", reading: "reading (e.g. dyslexia)", attention: "attention" }
        const submissions = await Submission.find({ user: { $in: students.map((s) => s._id) }, "psychometric.accommodations.shareWithMentor": true })
            .select("user psychometric.accommodations")
            .lean()
        const supportByUser = new Map(submissions.map((submission) => [
            String(submission.user),
            (submission.psychometric.accommodations.needs || []).map((need) => NEED_LABELS[need] || need),
        ]))

        const data = students.map((student) => {
            const row = rowByUser.get(String(student._id)) || { matchStatus: "awaiting_choice" }
            return {
                student,
                ...row,
                user: student._id,
                dueBy: dueByFor(row),
                sharedSupportNeeds: supportByUser.get(String(student._id)) || [],
                plan: Number(student.currentTier) === 3 ? "Mentor Only" : "Discovery + Mentor",
                chosenIndustry: row.chosenIndustryCode && industryByCode.get(row.chosenIndustryCode) ? industryByCode.get(row.chosenIndustryCode).name : null,
            }
        })

        return res.status(200).json({
            success: true,
            message: "Waitlist fetched successfully",
            data,
        })

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to fetch the waitlist",
            error: error.message,
        })
    }
})


// ========================
// Match For Admin
// ========================

router.put("/matchForAdmin/:id", authMiddleware, adminAuthMiddleware, async (req, res) => {
    try {
        const { id } = req.params   // :id is the STUDENT's user id
        const { mentorUserId } = req.body

        const row = await MentorWaitlist.findOne({ user: id })

        if (!row || !row.choiceSentAt) {
            return res.status(400).json({
                success: false,
                message: "This student hasn't chosen a career yet"
            })
        }

        const mentor = await Mentor.findOne({ user: mentorUserId, status: "onboarded" })

        if (!mentor) {
            return res.status(400).json({
                success: false,
                message: "Pick an approved mentor"
            })
        }

        const updated = await MentorWaitlist.findOneAndUpdate(
            { user: id },
            { assignedMentor: mentor.user, matchedAt: new Date(), matchStatus: "matched", resolution: "matched" },
            { returnDocument: "after" }
        )

        return res.status(200).json({
            success: true,
            message: `Matched with ${mentor.name}`,
            data: updated,
        })

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to match",
            error: error.message,
        })
    }
})


// ========================
// Resolve For Admin
// ========================

// When no mentor can be found in 20 business days: rollover first, refund on request
// (mentor_waitlist_page.md). This RECORDS the outcome — an actual refund still goes through the
// Refund Requests tab, so the money trail stays in one place.
router.put("/resolveForAdmin/:id", authMiddleware, adminAuthMiddleware, async (req, res) => {
    try {
        const { id } = req.params   // :id is the STUDENT's user id
        const { resolution, adminNote } = req.body

        if (!["rolled_over", "refunded"].includes(resolution)) {
            return res.status(400).json({
                success: false,
                message: "Resolution must be rolled_over or refunded"
            })
        }

        const updated = await MentorWaitlist.findOneAndUpdate(
            { user: id },
            { matchStatus: "unmatchable", resolution, adminNote: (adminNote || "").trim() },
            { returnDocument: "after" }
        )

        if (!updated) {
            return res.status(404).json({
                success: false,
                message: "No waitlist place for this student"
            })
        }

        return res.status(200).json({
            success: true,
            message: "Resolution recorded",
            data: updated,
        })

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to record the resolution",
            error: error.message,
        })
    }
})


// ========================
// Reset Choice For Admin
// ========================

// the student asked (over WhatsApp) to change their career choice. Clears the choice, the clock and
// any match, back to awaiting_choice — the next choice starts a fresh 20 business days.
router.put("/resetChoiceForAdmin/:id", authMiddleware, adminAuthMiddleware, async (req, res) => {
    try {
        const { id } = req.params   // :id is the STUDENT's user id
        const { adminNote } = req.body

        const updated = await MentorWaitlist.findOneAndUpdate(
            { user: id },
            {
                $set: { matchStatus: "awaiting_choice", adminNote: (adminNote || "").trim() },
                $unset: { chosenProfessionId: "", chosenProfessionName: "", chosenJobRole: "", jobRoleIsOther: "", chosenIndustryCode: "", otherRequest: "", planTier: "", choiceSentAt: "", assignedMentor: "", matchedAt: "", resolution: "" },
            },
            { returnDocument: "after" }
        )

        if (!updated) {
            return res.status(404).json({
                success: false,
                message: "No waitlist place for this student"
            })
        }

        return res.status(200).json({
            success: true,
            message: "Choice reset — the student can choose again",
            data: updated,
        })

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to reset the choice",
            error: error.message,
        })
    }
})


module.exports = router
module.exports.pickerOptions = pickerOptions
