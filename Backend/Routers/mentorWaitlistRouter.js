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
const { notifyStudent } = require("../utils/statusEmails")
const { inviteFacts, whatsappLink } = require("../utils/mentorInvite")
const { industryByCode } = require("../utils/industries")
const hasMentorPlan = (user) => user.paid === true && grants(Number(user.currentTier)).mentor
const isMentorOnly = (user) => user.paid === true && Number(user.currentTier) === 3
const professionById = new Map(taxonomy.professions.map((profession) => [profession.id, profession]))
const cleanText = (value, max) => (typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : "")

// HOW THE MENTOR MAY REACH THE STUDENT (owner, Round 28): WhatsApp or email, with the student's
// agreement that we share their first name and that one contact with their mentor. null = not given.
const CONTACT_VIA = ["whatsapp", "email"]
const contactChoice = (body) => (CONTACT_VIA.includes(body.contactVia) && body.contactConsent === true
    ? { contactVia: body.contactVia, contactConsentAt: new Date() }
    : null)
const CONTACT_NEEDED = "Choose how your mentor should contact you, and tick that we may share it with them"

// every new match starts its steps again
const FRESH_MATCH_STEPS = { whatsappInviteAt: null, mentorPrivacyAcceptedAt: null, bookingLinkSentAt: null }

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
                    $set: { matchStatus: "awaiting_choice", resolution: null, adminNote: "Re-joined the mentor plan after leaving it — waiting for a new choice" },
                    $unset: { chosenProfessionId: "", chosenProfessionName: "", chosenJobRole: "", jobRoleIsOther: "", chosenIndustryCode: "", otherRequest: "", helpWanted: "", abroadHelpWaitlist: "", helpFocus: "", planTier: "", choiceSentAt: "", assignedMentor: "", matchedAt: "" },
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
                helpWanted: row.helpWanted || "",
                helpFocus: row.helpFocus || null,
                abroadHelpWaitlist: Boolean(row.abroadHelpWaitlist),
                mentorOnly: isMentorOnly(req.user),
                options,
                choiceSentAt: row.choiceSentAt,
                dueBy: dueByFor(row),
                matchedAt: row.matchedAt,
                resolution: row.resolution,
                mentor: await mentorSummary(row.assignedMentor),
                // Round 28: the sessions already done, and whether another can be started now
                sessions: (row.sessions || []).map((session) => ({ profession: session.profession, jobRole: session.jobRole, mentorName: session.mentorName, completedAt: session.completedAt })),
                extraSessionCredit: Math.max(0, (row.extraSessionsPaid || 0) - (row.extraSessionsUsed || 0)),
                sameFieldNewMentor: Boolean(row.sameFieldNewMentor),
                // Round 28: how the mentor reaches them, and whether the booking link is on its way
                contactVia: row.contactVia || null,
                contactConsented: Boolean(row.contactConsentAt),
                bookingLinkSent: Boolean(row.bookingLinkSentAt),
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
// Save My Help (Round 18)
// ========================

// What the student wants from the session, in their own words, and whether they want help with a
// master's abroad or settling abroad when we offer it. Can be changed any time — it is not part of
// the one-time choice and does not touch the 20-business-day clock.
const HELP_MAX = 600
// Round 19 (owner): for the chosen role — help making it a career, help pursuing it as an interest or
// passion alongside whatever pays, or both
const HELP_FOCUS = ["career", "passion", "both"]

router.put("/saveMyHelp", authMiddleware, async (req, res) => {
    try {
        if (!hasMentorPlan(req.user)) {
            return res.status(403).json({
                success: false,
                message: "The mentor waitlist comes with the Discovery + Mentor or Mentor Only plan"
            })
        }

        const helpWanted = cleanText(req.body.helpWanted, HELP_MAX)
        const abroadHelpWaitlist = req.body.abroadHelpWaitlist === true
        const helpFocus = HELP_FOCUS.includes(req.body.helpFocus) ? req.body.helpFocus : null

        const row = await MentorWaitlist.findOneAndUpdate(
            { user: req.user._id },
            { $set: { helpWanted, helpFocus, abroadHelpWaitlist }, $setOnInsert: { user: req.user._id, matchStatus: "awaiting_choice" } },
            { upsert: true, returnDocument: "after" }
        )

        return res.status(200).json({
            success: true,
            message: "Saved — your mentor will see this",
            data: { helpWanted: row.helpWanted, helpFocus: row.helpFocus || null, abroadHelpWaitlist: row.abroadHelpWaitlist },
        })

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to save",
            error: error.message,
        })
    }
})


// ========================
// Save My Contact (Round 28)
// ========================

// For a student who sent their choice before this was asked, or who wants to switch between WhatsApp
// and email. A change after the match is not re-sent to the mentor — they message us instead.
router.put("/saveMyContact", authMiddleware, async (req, res) => {
    try {
        if (!hasMentorPlan(req.user)) {
            return res.status(403).json({ success: false, message: "The mentor waitlist comes with the Discovery + Mentor or Mentor Only plan" })
        }

        const contact = contactChoice(req.body)
        if (!contact) {
            return res.status(400).json({ success: false, message: CONTACT_NEEDED })
        }
        if (contact.contactVia === "whatsapp" && !req.user.phone) {
            return res.status(400).json({ success: false, message: "Add your phone number on your profile first, or choose email" })
        }

        const row = await MentorWaitlist.findOneAndUpdate(
            { user: req.user._id },
            { $set: contact, $setOnInsert: { user: req.user._id, matchStatus: "awaiting_choice" } },
            { upsert: true, returnDocument: "after" }
        )

        return res.status(200).json({ success: true, message: "Saved — your mentor will contact you this way", data: { contactVia: row.contactVia, contactConsented: true } })

    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to save", error: error.message })
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

        // Round 28: no choice goes in without knowing how the mentor may reach them
        const contact = contactChoice(req.body)
        if (!contact) {
            return res.status(400).json({ success: false, message: CONTACT_NEEDED })
        }
        if (contact.contactVia === "whatsapp" && !req.user.phone) {
            return res.status(400).json({ success: false, message: "Add your phone number on your profile first, or choose email" })
        }

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
                ...contact,
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

        // Round 28: the one-tap WhatsApp invite for each matched row — the mentor's phone is admin-only
        const mentorIds = rows.filter((row) => row.matchStatus === "matched" && row.assignedMentor).map((row) => row.assignedMentor._id)
        const mentorPhones = new Map((await Mentor.find({ user: { $in: mentorIds } }).select("user phone").lean()).map((mentor) => [String(mentor.user), mentor.phone]))

        const data = students.map((student) => {
            const row = rowByUser.get(String(student._id)) || { matchStatus: "awaiting_choice" }
            const mentorPhone = row.matchStatus === "matched" && row.assignedMentor ? mentorPhones.get(String(row.assignedMentor._id)) : null
            return {
                student,
                ...row,
                user: student._id,
                dueBy: dueByFor(row),
                sharedSupportNeeds: supportByUser.get(String(student._id)) || [],
                plan: Number(student.currentTier) === 3 ? "Mentor Only" : "Discovery + Mentor",
                chosenIndustry: row.chosenIndustryCode && industryByCode.get(row.chosenIndustryCode) ? industryByCode.get(row.chosenIndustryCode).name : null,
                contactConsented: Boolean(row.contactConsentAt),
                whatsappInvite: mentorPhone ? whatsappLink(mentorPhone, inviteFacts(row, student)) : null,
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

        // Round 28: the student must have said how the mentor may reach them, and agreed to it
        if (!row.contactConsentAt) {
            return res.status(400).json({
                success: false,
                message: "Waiting for the student's contact consent — they choose WhatsApp or email on their mentorship page"
            })
        }

        // only approved mentors (a paused one is never offered), and never one kept away from this student
        const mentor = await Mentor.findOne({ user: mentorUserId, status: "onboarded" })

        if (!mentor) {
            return res.status(400).json({
                success: false,
                message: "Pick an approved mentor"
            })
        }

        if ((row.excludedMentors || []).some((excluded) => String(excluded) === String(mentor.user))) {
            return res.status(400).json({
                success: false,
                message: "This student must not be matched with this mentor again — pick someone else"
            })
        }

        const updated = await MentorWaitlist.findOneAndUpdate(
            { user: id },
            { assignedMentor: mentor.user, matchedAt: new Date(), matchStatus: "matched", resolution: "matched", ...FRESH_MATCH_STEPS },
            { returnDocument: "after" }
        )

        // the invite to the mentor (email; WhatsApp is the admin's one tap), and the news to the student
        const student = await User.findById(id).select("name email").lean()
        const mentorUser = await User.findById(mentor.user).select("email").lean()
        notifyStudent(mentorUser, "mentorInvite", inviteFacts(updated, student))
        notifyStudent(student, "mentorConfirmed", { mentorName: mentor.name, contactVia: updated.contactVia })

        return res.status(200).json({
            success: true,
            message: `Matched with ${mentor.name} — they've been emailed the invite. Send it on WhatsApp too.`,
            data: { ...updated.toObject(), whatsappInvite: whatsappLink(mentor.phone, inviteFacts(updated, student)) },
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


// ========================
// Mentor sessions (owner, Round 28)
// ========================

// The admin marks a matched session done: it is logged on the row, and the student can then book
// another (paid) — a new career or job role, or the same one with a different mentor.
router.put("/completeSessionForAdmin/:id", authMiddleware, adminAuthMiddleware, async (req, res) => {
    try {
        const { id } = req.params   // :id is the STUDENT's user id
        const row = await MentorWaitlist.findOne({ user: id }).lean()

        if (!row || row.matchStatus !== "matched") {
            return res.status(400).json({ success: false, message: "Only a matched session can be marked done" })
        }

        const mentor = await mentorSummary(row.assignedMentor)
        const session = {
            professionId: row.chosenProfessionId,
            profession: row.chosenProfessionName || row.otherRequest,
            jobRole: row.chosenJobRole,
            mentor: row.assignedMentor,
            mentorName: mentor ? mentor.name : null,
            matchedAt: row.matchedAt,
            completedAt: new Date(),
            adminNote: cleanText(req.body.adminNote, 500) || undefined,
        }
        const updated = await MentorWaitlist.findOneAndUpdate(
            { _id: row._id, matchStatus: "matched" },
            { $push: { sessions: session }, $set: { matchStatus: "completed" } },
            { returnDocument: "after" }
        )

        notifyStudent(await User.findById(id).select("email").lean(), "reviewOpen")

        return res.status(200).json({ success: true, message: "Session logged — the student has been asked for a review", data: updated })

    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to log the session", error: error.message })
    }
})

// The student starts another session with one they've paid for: a fresh choice (any of their
// recommendations — or any career on Mentor Only), or `sameField` — the same career and role, with a
// different mentor, which goes straight to matching on a new 20-business-day clock.
router.post("/startAnotherSession", authMiddleware, async (req, res) => {
    try {
        if (!hasMentorPlan(req.user)) {
            return res.status(403).json({ success: false, message: "Mentor sessions come with a mentor plan" })
        }

        const row = await MentorWaitlist.findOne({ user: req.user._id }).lean()
        if (!row || row.matchStatus !== "completed") {
            return res.status(400).json({ success: false, message: "You can book another session once your current one is done" })
        }
        if ((row.extraSessionsPaid || 0) <= (row.extraSessionsUsed || 0)) {
            return res.status(402).json({ success: false, message: "Another mentor session needs a payment first", data: { needsPayment: true } })
        }

        const sameField = req.body.sameField === true && Boolean(row.chosenProfessionId || row.otherRequest)
        const update = sameField
            ? {
                $set: { matchStatus: "matching", choiceSentAt: new Date(), sameFieldNewMentor: true, resolution: null, adminNote: "Same career and role — find a DIFFERENT mentor from last time", ...FRESH_MATCH_STEPS },
                $unset: { assignedMentor: "", matchedAt: "" },
                $inc: { extraSessionsUsed: 1 },
                // last time's mentor can't be picked again for this one
                ...(row.assignedMentor ? { $addToSet: { excludedMentors: row.assignedMentor } } : {}),
            }
            : {
                $set: { matchStatus: "awaiting_choice", sameFieldNewMentor: false, resolution: null, adminNote: "Booked another session — waiting for a new choice", ...FRESH_MATCH_STEPS },
                $unset: { chosenProfessionId: "", chosenProfessionName: "", chosenJobRole: "", jobRoleIsOther: "", chosenIndustryCode: "", otherRequest: "", choiceSentAt: "", assignedMentor: "", matchedAt: "" },
                $inc: { extraSessionsUsed: 1 },
            }

        const updated = await MentorWaitlist.findOneAndUpdate({ _id: row._id, matchStatus: "completed" }, update, { returnDocument: "after" })

        return res.status(200).json({
            success: true,
            message: sameField ? "We're finding you a different mentor in the same field" : "Choose the career and job role for your next session",
            data: { matchStatus: updated ? updated.matchStatus : row.matchStatus },
        })

    } catch (error) {
        return res.status(500).json({ success: false, message: "Could not start another session", error: error.message })
    }
})


module.exports = router
module.exports.pickerOptions = pickerOptions
