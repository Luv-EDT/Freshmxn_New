// DELETING AN ACCOUNT AND EVERYTHING THAT BELONGS TO IT (owner, Round 26). Used by the admin's
// "Delete account" (a DPDP erasure request, a test or a bot account) and by tools/deleteAccounts.js.
//
// Every collection that stores a row per person is cleared by its `user`; queued jobs by their key;
// a mentor's own rows by `user`/`mentor`, and their opinions are taken out of each profession's stack.
// Shared reference data (the activity cache, the careers data) holds no person and is left alone.
// An admin account is never deleted here.

const USER_COLLECTIONS = [
    ["submissions", "../model/submissionsModel"],
    ["profiles", "../model/profilesModel"],
    ["recommendations", "../model/recommendationsModel"],
    ["reports", "../model/reportsModel"],
    ["consents", "../model/consentModel"],
    ["payments", "../model/paymentsModel"],
    ["accessRequests", "../model/accessRequestsModel"],
    ["refundRequests", "../model/refundRequestsModel"],
    ["financialAidRequests", "../model/financialAidRequestsModel"],
    ["emailVerifications", "../model/emailVerificationsModel"],
    ["passwordResets", "../model/passwordResetsModel"],
    ["verifications", "../model/verificationsModel"],
    ["assessmentIssues", "../model/assessmentIssuesModel"],
    ["followUps", "../model/followUpsModel"],
    ["mentorWaitlist", "../model/mentorWaitlistModel"],
    ["studyAbroadLeads", "../model/studyAbroadLeadsModel"],
    ["careerHelp", "../model/careerHelpModel"],
    ["sessionReviews", "../model/sessionReviewsModel"],
    ["mentorReports", "../model/mentorReportsModel"],
    ["notifications", "../model/notificationsModel"],
    ["mentors", "../model/mentorsModel"],
]

const REMOVED = "Removed mentor"

// the real models, required on first use so the fixtures can pass stand-ins
const realModels = () => ({
    User: require("../model/userModel"),
    Job: require("../model/jobsModel"),
    MentorReview: require("../model/mentorReviewsModel"),
    ProfessionSuggestions: require("../model/professionSuggestionsModel"),
    MentorWaitlist: require("../model/mentorWaitlistModel"),
    // where a mentor's name is kept in someone else's record (Round 28): kept, but as "Removed mentor"
    named: [
        [require("../model/mentorWaitlistModel"), "sessions"],
        [require("../model/dataProposalsModel"), "fromMentors"],
        [require("../model/sessionReviewsModel"), null],
        [require("../model/mentorReportsModel"), null],
    ],
    byUser: Object.fromEntries(USER_COLLECTIONS.map(([name, file]) => [name, require(file)])),
})

// Returns { counts } — rows removed per collection — or { error } (not found, or an admin).
// With dryRun, it only counts.
const deleteAccountData = async (userId, { dryRun = false, models = null } = {}) => {
    const M = models || realModels()
    const user = await M.User.findById(userId).select("email role").lean()
    if (!user) return { error: "Account not found" }
    if (user.role === "admin") return { error: "An admin account is never deleted here" }

    const id = user._id
    const counts = {}

    for (const [name, Model] of Object.entries(M.byUser)) {
        counts[name] = dryRun ? await Model.countDocuments({ user: id }) : (await Model.deleteMany({ user: id })).deletedCount
    }

    const jobFilter = { $or: [{ key: String(id) }, { "data.userId": String(id) }] }
    counts.jobs = dryRun ? await M.Job.countDocuments(jobFilter) : (await M.Job.deleteMany(jobFilter)).deletedCount

    // a mentor's reviews, and their opinions inside each profession's stack (read, filter, write —
    // the pattern every MongoDB-compatible database supports)
    counts.mentorReviews = dryRun ? await M.MentorReview.countDocuments({ mentor: id }) : (await M.MentorReview.deleteMany({ mentor: id })).deletedCount
    const stacks = await M.ProfessionSuggestions.find({ "mentor_suggestions.mentor": id }).lean()
    counts.mentorOpinions = 0
    for (const row of stacks) {
        const kept = (row.mentor_suggestions || []).filter((opinion) => String(opinion.mentor) !== String(id))
        counts.mentorOpinions += (row.mentor_suggestions || []).length - kept.length
        if (!dryRun) await M.ProfessionSuggestions.updateOne({ _id: row._id }, { $set: { mentor_suggestions: kept } })
    }
    // students matched to this mentor go back to waiting for one
    counts.matchesUnassigned = dryRun
        ? await M.MentorWaitlist.countDocuments({ assignedMentor: id })
        : (await M.MentorWaitlist.updateMany({ assignedMentor: id }, { $set: { assignedMentor: null, matchStatus: "matching", matchedAt: null } })).modifiedCount

    // other students' session history, reviews and reports, and mentor-backed proposals keep the
    // record — without the name of the person who asked to be deleted
    counts.namesRemoved = 0
    for (const [Model, field] of M.named || []) {
        if (!field) {
            counts.namesRemoved += dryRun ? await Model.countDocuments({ mentor: id }) : (await Model.updateMany({ mentor: id }, { $set: { mentorName: REMOVED } })).modifiedCount
            continue
        }
        const rows = await Model.find({ [`${field}.mentor`]: id }).lean()
        counts.namesRemoved += rows.length
        if (dryRun) continue
        for (const row of rows) {
            const renamed = (row[field] || []).map((item) => (String(item.mentor) === String(id) ? { ...item, mentorName: REMOVED } : item))
            await Model.updateOne({ _id: row._id }, { $set: { [field]: renamed } })
        }
    }

    counts.users = dryRun ? 1 : (await M.User.deleteOne({ _id: id })).deletedCount

    return { email: user.email, counts }
}

module.exports = { deleteAccountData, USER_COLLECTIONS }
