// WHERE A STUDENT IS WITH THEIR MENTOR, IN ONE LINE (owner, Round 29) — the admin Students tab's
// "Mentorship" column. From the second cycle on (another session booked after the first), the stage
// carries its number: "2 · session done — waiting for feedback".
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
    // a student no-show logs that session before closing, so it counts like a done one
    const cycle = row.matchStatus === "completed" || row.resolution === "student_no_show" ? done : done + 1
    const prefix = cycle >= 2 ? `${cycle} · ` : ""

    if (row.resolution === "refund_requested") return `${prefix}refund asked for`
    if (row.resolution === "student_no_show") return `${prefix}closed · student no-show`
    if (row.matchStatus === "closed" || row.matchStatus === "unmatchable" || ["refunded", "rolled_over", "left_tier2"].includes(row.resolution)) return `${prefix}closed`
    if (row.matchStatus === "awaiting_choice") return `${prefix}not started`
    if (row.matchStatus === "matching") return `${prefix}${row.matchBusinessDays === 15 ? "15-day wait (new mentor)" : "20-day wait"}${dueBy ? ` · ${businessDaysLeft(dueBy, now)} days left` : ""}`
    // Round 34: the student books from the mentor's links; the mentor reports nothing on the platform
    if (row.matchStatus === "matched") return `${prefix}matched — session to happen`
    if (row.matchStatus === "completed") {
        if (reviewed.includes(done - 1)) return `${prefix}feedback in · closed`
        return `${prefix}session done — waiting for feedback`
    }
    return `${prefix}${row.matchStatus}`
}

module.exports = { mentorStage, businessDaysLeft }
