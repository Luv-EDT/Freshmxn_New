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

// 20 business days for a choice; 15 when we're finding a new mentor (Round 34)
const dueByFor = (row) => (row && row.choiceSentAt ? addBusinessDays(row.choiceSentAt, row.matchBusinessDays || MATCH_BUSINESS_DAYS) : null)
const NEW_MENTOR_BUSINESS_DAYS = 15

// A CHOICE CAN BE CHANGED FOR 7 DAYS (owner, Round 34) — by the admin, after the student asks on
// WhatsApp. After that the reset is refused.
const CHANGE_WINDOW_DAYS = 7
const changeableUntil = (row) => (row && row.choiceSentAt ? new Date(new Date(row.choiceSentAt).getTime() + CHANGE_WINDOW_DAYS * 864e5) : null)
const canResetChoice = (row, now = new Date()) => Boolean(row && row.choiceSentAt && changeableUntil(row) > now)

// BOOKING WINDOW (owner, Round 35): the student is told to book within 2.5 days of the match and sees a
// countdown to it; only after 3 days with no booking logged does their page say the chance is lost and
// the admin sees "booking time missed" (the admin then presses Student no-show — never automatic)
const BOOK_SHOWN_HOURS = 60
const BOOK_ENFORCED_HOURS = 72
const bookBy = (row) => (row && row.matchedAt ? new Date(new Date(row.matchedAt).getTime() + BOOK_SHOWN_HOURS * 36e5) : null)
const bookingMissed = (row, now = new Date()) => Boolean(row && row.matchStatus === "matched" && row.matchedAt && !row.sessionsBookedAt
    && now.getTime() > new Date(row.matchedAt).getTime() + BOOK_ENFORCED_HOURS * 36e5)

// the languages a student may ask for (owner, Round 34); "Other" carries their own word
const LANGUAGES = ["English", "Hindi", "Bengali", "Marathi", "Tamil", "Telugu", "Gujarati", "Kannada", "Malayalam", "Punjabi", "Odia"]
const cleanLanguages = (body) => {
    const picked = (Array.isArray(body.languages) ? body.languages : []).filter((name) => LANGUAGES.includes(name))
    const other = typeof body.languageOther === "string" ? body.languageOther.trim().replace(/\s+/g, " ").slice(0, 40) : ""
    return [...new Set(picked), ...(other.length >= 2 ? [other] : [])]
}

// one line in the ticket's history, with the choice as it stood
const historyEntry = (row, event, by, note = "", mentorName = null) => ({
    at: new Date(),
    event,
    by,
    note,
    profession: (row && (row.chosenProfessionName || row.otherRequest)) || null,
    jobRole: (row && row.chosenJobRole) || null,
    mentorName,
})

// Discovery + Mentor (tier 2) or Mentor Only (tier 3) — utils/plans.js
const { grants } = require("../utils/plans")
const { notifyStudent } = require("../utils/statusEmails")
const { inviteFacts, whatsappLink } = require("../utils/mentorInvite")
const { industryByCode } = require("../utils/industries")
const { writeSessionPayout } = require("../utils/mentorPayouts")
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
const FRESH_MATCH_STEPS = { whatsappInviteAt: null, mentorPrivacyAcceptedAt: null, bookingLinkSentAt: null, mainSessionAt: null, sessionDoneAt: null, sessionsBookedAt: null, bookedMainAt: null, bookedFollowUpAt: null }

// what a student may see about their assigned mentor — the profile-visible name and role, and once
// matched the two Calendly links they book from (Round 34). Contact details, payout details, currency
// and residence never leave the admin side.
const mentorSummary = async (mentorUserId, withLinks = false) => {
    if (!mentorUserId) return null
    const profile = await Mentor.findOne({ user: mentorUserId }).select("name currentRole discipline calendlyMain calendlyFollowUp")
    if (!profile) return null
    return {
        name: profile.name,
        currentRole: profile.currentRole,
        discipline: profile.discipline,
        ...(withLinks ? { calendlyMain: profile.calendlyMain || null, calendlyFollowUp: profile.calendlyFollowUp || null } : {}),
    }
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
                mentor: await mentorSummary(row.assignedMentor, row.matchStatus === "matched"),
                languages: row.languages || [],
                sessionDoneAt: row.sessionDoneAt || null,
                // Round 35: the booking window, and the sessions once the admin has logged them
                bookBy: row.matchStatus === "matched" ? bookBy(row) : null,
                bookingMissed: bookingMissed(row),
                sessionsBookedAt: row.sessionsBookedAt || null,
                bookedMainAt: row.bookedMainAt || null,
                bookedFollowUpAt: row.bookedFollowUpAt || null,
                changeableUntil: changeableUntil(row),
                // Round 34: what "refund me" would give back, for the report form — from the server, never copy
                mentorRefundInr: row.assignedMentor && ["matched", "completed"].includes(row.matchStatus)
                    ? (await require("./paymentsRouter").mentorPartOf(req.user, row)).amountInr
                    : null,
                history: (row.history || []).map(({ at, event, profession, jobRole, mentorName }) => ({ at, event, profession, jobRole, mentorName })),
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

        // Round 34 (owner): everything is sent once, with the choice — after that only we change it
        const sent = await MentorWaitlist.exists({ user: req.user._id, choiceSentAt: { $ne: null } })
        if (sent) {
            return res.status(400).json({ success: false, message: "Your answers were sent with your choice and can't be changed here — message us on WhatsApp" })
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

        // Round 34 (owner): ONE form, sent once — what help they want, what they want to know and the
        // languages go in with the choice and can't be changed afterwards
        const helpFocus = HELP_FOCUS.includes(req.body.helpFocus) ? req.body.helpFocus : null
        if (!helpFocus) {
            return res.status(400).json({ success: false, message: "Please choose what help you want from your mentor" })
        }
        const languages = cleanLanguages(req.body)
        if (languages.length === 0) {
            return res.status(400).json({ success: false, message: "Please choose at least one language for your session" })
        }
        const answers = { helpFocus, languages, helpWanted: cleanText(req.body.helpWanted, HELP_MAX) }

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
                $set: {
                    user: req.user._id,
                    ...choice,
                    ...contact,
                    ...answers,
                    chosenIndustryCode: industry ? industry.code : null,
                    planTier: Number(req.user.currentTier),
                    choiceSentAt: new Date(),
                    matchBusinessDays: MATCH_BUSINESS_DAYS,
                    matchStatus: "matching",
                },
                $push: { history: historyEntry(choice, "choice_sent", "student") },
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
                canResetChoice: canResetChoice(row),
                changeableUntil: changeableUntil(row),
                bookBy: row.matchStatus === "matched" ? bookBy(row) : null,
                bookingMissed: bookingMissed(row),
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

// Before matching, the admin asks the mentor on WhatsApp to open slots on their Calendly links (main
// session in the next 4 days, follow-up on day 3, 4, 5 or 6 — after the main one). The match then shows the student those links on
// their dashboard, by email and as a notification — students and mentors never message each other to
// arrange it (owner, Round 34).
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

        // Round 28: the student must have said how we may reach them, and agreed to it
        if (!row.contactConsentAt) {
            return res.status(400).json({
                success: false,
                message: "Waiting for the student's contact consent — they choose WhatsApp or email on their mentorship page"
            })
        }

        // only approved mentors (a paused or removed one is never offered), and never one kept away from this student
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

        // the student books from these, so a match without them would leave the student stuck
        if (!mentor.calendlyMain) {
            return res.status(400).json({
                success: false,
                message: `${mentor.name} hasn't added their Calendly links yet — ask them to add them on their dashboard (Test tab → Your Calendly links), then match`
            })
        }

        const updated = await MentorWaitlist.findOneAndUpdate(
            { user: id },
            {
                $set: { assignedMentor: mentor.user, matchedAt: new Date(), matchStatus: "matched", resolution: "matched", ...FRESH_MATCH_STEPS },
                $push: { history: historyEntry(row, "matched", "admin", "", mentor.name) },
            },
            { returnDocument: "after" }
        )

        // the news to both: the mentor gets the student's brief to prepare from; the student their links
        const student = await User.findById(id).select("name email").lean()
        const mentorUser = await User.findById(mentor.user).select("email").lean()
        notifyStudent(mentorUser, "mentorInvite", inviteFacts(updated, student))
        notifyStudent(student, "mentorConfirmed", { mentorName: mentor.name, calendlyMain: mentor.calendlyMain, calendlyFollowUp: mentor.calendlyFollowUp })

        return res.status(200).json({
            success: true,
            message: `Matched with ${mentor.name} — both have been emailed. The student books from ${mentor.name}'s Calendly links.`,
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
// Close or change the ticket (owner, Round 34)
// ========================

// THREE CHOICES, EACH DOING THE WHOLE JOB and telling the student by email and notification:
//   1. find another mentor        newMentorForAdmin (below) — same career and role, the old mentor kept away
//   2. reset the career choice    resetChoiceForAdmin — only within 7 days of the student's choice
//   3. refund the mentor part     /payments/refundMentorPartForAdmin — the money, and the ticket closed
// (They replace "Rolled over" / "Refunded", which only wrote a word on the row, and the Students tab's
// "Downgrade", which is the same as 3.)

// the student asked (over WhatsApp) to change their career choice. Clears the choice, the clock and
// any match, back to awaiting_choice — the next choice starts a fresh 20 business days. The old choice
// stays in the ticket's history.
router.put("/resetChoiceForAdmin/:id", authMiddleware, adminAuthMiddleware, async (req, res) => {
    try {
        const { id } = req.params   // :id is the STUDENT's user id
        const row = await MentorWaitlist.findOne({ user: id }).lean()

        if (!row || !row.choiceSentAt) {
            return res.status(400).json({ success: false, message: "There's no choice to reset" })
        }
        if (!canResetChoice(row)) {
            return res.status(400).json({ success: false, message: `A choice can only be reset within ${CHANGE_WINDOW_DAYS} days of sending it` })
        }

        const note = cleanText(req.body.adminNote, 500)
        const updated = await MentorWaitlist.findOneAndUpdate(
            { user: id },
            {
                $set: { matchStatus: "awaiting_choice", adminNote: note, ...FRESH_MATCH_STEPS },
                $unset: { chosenProfessionId: "", chosenProfessionName: "", chosenJobRole: "", jobRoleIsOther: "", chosenIndustryCode: "", otherRequest: "", planTier: "", choiceSentAt: "", assignedMentor: "", matchedAt: "", resolution: "", helpWanted: "", helpFocus: "", languages: "" },
                $push: { history: historyEntry(row, "choice_reset", "admin", note) },
            },
            { returnDocument: "after" }
        )

        notifyStudent(await User.findById(id).select("email").lean(), "choiceReset")

        return res.status(200).json({
            success: true,
            message: "Choice reset — the student has been told to choose again",
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

// Same career and role, a different mentor, within 15 business days. `strike` when the mentor is at
// fault — they didn't prepare, respond or turn up — which counts against them.
router.put("/newMentorForAdmin/:id", authMiddleware, adminAuthMiddleware, async (req, res) => {
    try {
        const { id } = req.params   // :id is the STUDENT's user id
        const row = await MentorWaitlist.findOne({ user: id }).lean()

        if (!row || !row.choiceSentAt) {
            return res.status(400).json({ success: false, message: "This student hasn't chosen a career yet" })
        }

        const note = cleanText(req.body.adminNote, 500)
        const old = row.assignedMentor ? await Mentor.findOne({ user: row.assignedMentor }).select("name") : null
        if (old && req.body.strike === true) {
            await Mentor.updateOne({ user: row.assignedMentor }, { $push: { strikes: { at: new Date(), reason: note || "didn't prepare, respond or turn up", student: row.user } } })
        }

        const updated = await MentorWaitlist.findOneAndUpdate(
            { user: id },
            {
                $set: { matchStatus: "matching", choiceSentAt: new Date(), matchBusinessDays: NEW_MENTOR_BUSINESS_DAYS, sameFieldNewMentor: true, resolution: null, adminNote: note || "Find a DIFFERENT mentor", ...FRESH_MATCH_STEPS },
                $unset: { assignedMentor: "", matchedAt: "" },
                ...(row.assignedMentor ? { $addToSet: { excludedMentors: row.assignedMentor } } : {}),
                $push: { history: historyEntry(row, "new_mentor", "admin", note, old ? old.name : null) },
            },
            { returnDocument: "after" }
        )

        notifyStudent(await User.findById(id).select("email").lean(), "newMentorComing", { dueBy: dueByFor(updated) })

        return res.status(200).json({
            success: true,
            message: `Back to matching — the student has been told within ${NEW_MENTOR_BUSINESS_DAYS} business days${old && req.body.strike === true ? `; ${old.name} has a strike` : ""}`,
            data: updated,
        })

    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to find another mentor", error: error.message })
    }
})


// ========================
// Sessions booked (owner, Round 35)
// ========================

// The mentor tells us on WhatsApp that the student has booked, with the dates and times; the admin logs
// them here and both dashboards say the sessions are booked (the student is emailed too). Sent again it
// corrects the times; `clear: true` takes the booking off (e.g. logged by mistake).
const bookingTime = (value) => {
    if (value === null || value === undefined || value === "") return null
    const at = new Date(value)
    return Number.isNaN(at.getTime()) ? undefined : at
}

router.put("/sessionsBookedForAdmin/:id", authMiddleware, adminAuthMiddleware, async (req, res) => {
    try {
        const { id } = req.params   // :id is the STUDENT's user id
        const row = await MentorWaitlist.findOne({ user: id }).lean()

        if (!row || row.matchStatus !== "matched" || !row.assignedMentor) {
            return res.status(400).json({ success: false, message: "Only a matched student's sessions can be logged as booked" })
        }

        if (req.body.clear === true) {
            const updated = await MentorWaitlist.findOneAndUpdate(
                { _id: row._id },
                { $set: { sessionsBookedAt: null, bookedMainAt: null, bookedFollowUpAt: null }, $push: { history: historyEntry(row, "booking_cleared", "admin", cleanText(req.body.adminNote, 500)) } },
                { returnDocument: "after" }
            )
            return res.status(200).json({ success: true, message: "Booking taken off — the student sees their booking links again", data: updated })
        }

        const mainAt = bookingTime(req.body.mainAt)
        const followUpAt = bookingTime(req.body.followUpAt)
        if (!mainAt) {
            return res.status(400).json({ success: false, message: "Please give the date and time of the main session" })
        }
        if (followUpAt === undefined || (followUpAt && followUpAt <= mainAt)) {
            return res.status(400).json({ success: false, message: "The follow-up must be after the main session (or leave it empty if none was booked)" })
        }

        const mentor = await mentorSummary(row.assignedMentor)
        const updated = await MentorWaitlist.findOneAndUpdate(
            { _id: row._id, matchStatus: "matched" },
            {
                $set: { sessionsBookedAt: row.sessionsBookedAt || new Date(), bookedMainAt: mainAt, bookedFollowUpAt: followUpAt },
                $push: { history: historyEntry(row, "sessions_booked", "admin", "", mentor ? mentor.name : null) },
            },
            { returnDocument: "after" }
        )

        notifyStudent(await User.findById(id).select("email").lean(), "sessionsBooked", { mainAt, followUpAt })

        return res.status(200).json({ success: true, message: "Logged as booked — the student and the mentor see it on their dashboards, and the student has been emailed", data: updated })

    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to log the booking", error: error.message })
    }
})


// ========================
// Session done, and student no-shows (owner, Round 34)
// ========================

// ONE "SESSION DONE", pressed after the mentor tells us on WhatsApp that the session (and the follow-up,
// if one was booked) is over. The session is logged and the student's feedback form opens — on their
// dashboard, by email and as a notification. Their feedback closes the ticket and makes the mentor's
// payout due (mentorSessionsRouter saveMyReview).
router.put("/completeSessionForAdmin/:id", authMiddleware, adminAuthMiddleware, async (req, res) => {
    try {
        const { id } = req.params   // :id is the STUDENT's user id
        const row = await MentorWaitlist.findOne({ user: id }).lean()

        if (!row || row.matchStatus !== "matched" || !row.assignedMentor) {
            return res.status(400).json({ success: false, message: "Only a matched session can be marked done" })
        }

        const mentor = await mentorSummary(row.assignedMentor)
        const now = new Date()
        const session = {
            professionId: row.chosenProfessionId,
            profession: row.chosenProfessionName || row.otherRequest,
            jobRole: row.chosenJobRole,
            mentor: row.assignedMentor,
            mentorName: mentor ? mentor.name : null,
            matchedAt: row.matchedAt,
            mainSessionAt: now,
            followUp: typeof req.body.followUp === "boolean" ? req.body.followUp : undefined,
            completedAt: now,
            adminNote: cleanText(req.body.adminNote, 500) || undefined,
        }
        const updated = await MentorWaitlist.findOneAndUpdate(
            { _id: row._id, matchStatus: "matched" },
            {
                $push: { sessions: session, history: historyEntry(row, "session_done", "admin", "", session.mentorName) },
                $set: { matchStatus: "completed", sessionDoneAt: now },
            },
            { returnDocument: "after" }
        )

        notifyStudent(await User.findById(id).select("email").lean(), "reviewOpen")

        return res.status(200).json({ success: true, message: "Session done — the student's feedback form is open (dashboard, email, notification)", data: updated })

    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to mark the session done", error: error.message })
    }
})

// the student didn't join (10 minutes late counts) or never booked within 2.5 days: the ticket closes
// with no refund, and the mentor — who kept the slot — is still paid
router.put("/studentNoShowForAdmin/:id", authMiddleware, adminAuthMiddleware, async (req, res) => {
    try {
        const { id } = req.params   // :id is the STUDENT's user id
        const row = await MentorWaitlist.findOne({ user: id }).lean()

        if (!row || row.matchStatus !== "matched" || !row.assignedMentor) {
            return res.status(400).json({ success: false, message: "Only a matched session can be marked a no-show" })
        }

        const mentor = await mentorSummary(row.assignedMentor)
        const note = cleanText(req.body.adminNote, 500)
        const session = {
            professionId: row.chosenProfessionId,
            profession: row.chosenProfessionName || row.otherRequest,
            jobRole: row.chosenJobRole,
            mentor: row.assignedMentor,
            mentorName: mentor ? mentor.name : null,
            matchedAt: row.matchedAt,
            noShow: "student",
            completedAt: new Date(),
            adminNote: note || undefined,
        }
        const updated = await MentorWaitlist.findOneAndUpdate(
            { _id: row._id, matchStatus: "matched" },
            {
                $push: { sessions: session, history: historyEntry(row, "student_no_show", "admin", note, session.mentorName) },
                $set: { matchStatus: "closed", resolution: "student_no_show" },
            },
            { returnDocument: "after" }
        )

        if (updated) await writeSessionPayout({ row: updated, sessionIndex: updated.sessions.length - 1, note: "student no-show" })
        notifyStudent(await User.findById(id).select("email").lean(), "studentNoShow")

        return res.status(200).json({ success: true, message: "Marked a no-show — the ticket is closed and the mentor's payout is due", data: updated })

    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to mark the no-show", error: error.message })
    }
})

// AFTER A STUDENT NO-SHOW, THE SAME MENTOR AGAIN (owner, Round 35): the student asked on WhatsApp and the
// mentor agreed. The ticket is matched again with that mentor on a fresh booking window; the no-show
// stays in the history (and stays paid), and this session is paid in its turn.
router.put("/reopenSameMentorForAdmin/:id", authMiddleware, adminAuthMiddleware, async (req, res) => {
    try {
        const { id } = req.params   // :id is the STUDENT's user id
        const row = await MentorWaitlist.findOne({ user: id }).lean()
        const last = row && (row.sessions || [])[row.sessions.length - 1]

        if (!row || row.matchStatus !== "closed" || row.resolution !== "student_no_show" || !last || !last.mentor) {
            return res.status(400).json({ success: false, message: "Only a ticket closed as a student no-show can be re-arranged with the same mentor" })
        }

        const mentor = await Mentor.findOne({ user: last.mentor, status: "onboarded" })
        if (!mentor || !mentor.calendlyMain) {
            return res.status(400).json({ success: false, message: "That mentor isn't available (not approved, or no Calendly links) — use Find another mentor instead" })
        }

        const note = cleanText(req.body.adminNote, 500)
        const updated = await MentorWaitlist.findOneAndUpdate(
            { _id: row._id, matchStatus: "closed" },
            {
                $set: { matchStatus: "matched", assignedMentor: mentor.user, matchedAt: new Date(), resolution: "matched", adminNote: note || "Re-arranged with the same mentor after a no-show", ...FRESH_MATCH_STEPS },
                $push: { history: historyEntry(row, "reassigned", "admin", note || "same mentor again after a no-show", mentor.name) },
            },
            { returnDocument: "after" }
        )

        const student = await User.findById(id).select("name email").lean()
        const mentorUser = await User.findById(mentor.user).select("email").lean()
        notifyStudent(mentorUser, "mentorInvite", inviteFacts(updated, student))
        notifyStudent(student, "mentorConfirmed", { mentorName: mentor.name, calendlyMain: mentor.calendlyMain, calendlyFollowUp: mentor.calendlyFollowUp })

        return res.status(200).json({ success: true, message: `Matched again with ${mentor.name} — both have been emailed, and the student has a new 2.5 days to book`, data: updated })

    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to re-arrange", error: error.message })
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
        if (!row || !["completed", "closed"].includes(row.matchStatus)) {
            return res.status(400).json({ success: false, message: "You can book another session once your current one is done" })
        }
        if ((row.extraSessionsPaid || 0) <= (row.extraSessionsUsed || 0)) {
            return res.status(402).json({ success: false, message: "Another mentor session needs a payment first", data: { needsPayment: true } })
        }

        const sameField = req.body.sameField === true && Boolean(row.chosenProfessionId || row.otherRequest)
        const update = sameField
            ? {
                $set: { matchStatus: "matching", choiceSentAt: new Date(), matchBusinessDays: MATCH_BUSINESS_DAYS, sameFieldNewMentor: true, resolution: null, adminNote: "Same career and role — find a DIFFERENT mentor from last time", ...FRESH_MATCH_STEPS },
                $unset: { assignedMentor: "", matchedAt: "" },
                $inc: { extraSessionsUsed: 1 },
                // last time's mentor can't be picked again for this one
                ...(row.assignedMentor ? { $addToSet: { excludedMentors: row.assignedMentor } } : {}),
            }
            : {
                $set: { matchStatus: "awaiting_choice", sameFieldNewMentor: false, resolution: null, adminNote: "Booked another session — waiting for a new choice", ...FRESH_MATCH_STEPS },
                $unset: { chosenProfessionId: "", chosenProfessionName: "", chosenJobRole: "", jobRoleIsOther: "", chosenIndustryCode: "", otherRequest: "", choiceSentAt: "", assignedMentor: "", matchedAt: "", helpWanted: "", helpFocus: "", languages: "" },
                $inc: { extraSessionsUsed: 1 },
            }

        const updated = await MentorWaitlist.findOneAndUpdate({ _id: row._id, matchStatus: row.matchStatus }, update, { returnDocument: "after" })

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
module.exports.dueByFor = dueByFor
module.exports.canResetChoice = canResetChoice
module.exports.cleanLanguages = cleanLanguages
module.exports.LANGUAGES = LANGUAGES
module.exports.bookBy = bookBy
module.exports.bookingMissed = bookingMissed
