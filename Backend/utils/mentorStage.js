// WHERE A STUDENT IS WITH THEIR MENTOR, IN ONE LINE (owner, Round 29) — the admin Students tab's
// "Mentorship" column. From the second cycle on (another session booked after the first), the stage
// carries its number: "2 · main session taken".
const { grants } = require("./plans")

const businessDaysLeft = (dueBy, now = new Date()) => {
    let left = 0
    const day = new Date(now)
    day.setHours(0, 0, 0, 0)
    const end = new Date(dueBy)
    while (day < end) {
        day.setDate(day.getDate() + 1)
        if (day.getDay() !== 0 && day.getDay() !== 6 && day <= end) left += 1
    }
    return left
}

// row: the student's MentorWaitlist row (or null); reviewed: the session indexes with a review;
// dueBy: the 20-business-day date for a "matching" row
const mentorStage = ({ tier, row, reviewed = [], dueBy = null, now = new Date() }) => {
    if (!grants(tier).mentor) return "NA"
    if (!row) return "not started"

    const done = (row.sessions || []).length
    const cycle = row.matchStatus === "completed" ? done : done + 1
    const prefix = cycle >= 2 ? `${cycle} · ` : ""

    if (row.matchStatus === "unmatchable" || ["refunded", "rolled_over", "left_tier2"].includes(row.resolution)) return `${prefix}closed`
    if (row.matchStatus === "awaiting_choice") return `${prefix}not started`
    if (row.matchStatus === "matching") return `${prefix}20-day wait${dueBy ? ` · ${businessDaysLeft(dueBy, now)} days left` : ""}`
    if (row.matchStatus === "matched") {
        if (row.mainSessionAt) return `${prefix}main session taken`
        if (row.bookingLinkSentAt) return `${prefix}booking link sent`
        return `${prefix}found mentor — waiting for mentor to reply`
    }
    if (row.matchStatus === "completed") {
        if (reviewed.includes(done - 1)) return `${prefix}review given`
        const last = (row.sessions || [])[done - 1] || {}
        return `${prefix}${last.followUp ? "follow-up taken" : "main session taken · no follow-up"}`
    }
    return `${prefix}${row.matchStatus}`
}

module.exports = { mentorStage, businessDaysLeft }
