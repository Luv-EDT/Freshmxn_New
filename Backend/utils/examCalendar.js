// THE EXAM CALENDAR (Round 11), applied to a career's exam list.
//
// data/exam_calendar.json holds one row per real exam and an alias map from every one of the 174
// ways the careers file spells an exam ("JEE Main Paper 1", "JEE Main (B.Tech)") to its row — or to
// null with a reason (a state recruitment, an institute's own admission, a course).
//
// What a student sees is what USUALLY happens ("applications usually open in November") and the
// official link, never this year's dates. A row still marked "draft" shows only its name and link.
// Admin-approved changes from the monthly study bot (ExamOverride) are laid over the file here —
// display only, exactly like the career overrides.

const calendar = require("../data/exam_calendar.json")

const examById = new Map(calendar.exams.map((exam) => [exam.id, exam]))

const EDITABLE = ["usual_application_window", "usual_exam_month", "eligibility"]

// A copy of the row with the approved values in place; an approved check makes a draft row checked.
const applyExamOverride = (exam, override) => {
    if (!override || !override.values) return exam
    const copy = { ...exam }
    EDITABLE.forEach((field) => {
        if (typeof override.values[field] === "string" && override.values[field].trim()) copy[field] = override.values[field].trim()
    })
    if (override.approvedAt) {
        copy.status = "checked"
        copy.checked_on = new Date(override.approvedAt).toISOString().slice(0, 10)
    }
    return copy
}

// The student-facing shape of one row. A draft row carries no window, month or eligibility.
const examFacing = (exam) => {
    const checked = exam.status === "checked"
    return {
        id: exam.id,
        name: exam.name,
        conductingBody: exam.conducting_body,
        officialUrl: exam.official_url,
        level: exam.level,
        window: checked ? exam.usual_application_window : null,
        examMonth: checked ? exam.usual_exam_month : null,
        eligibility: checked ? exam.eligibility : null,
        checkedOn: checked ? exam.checked_on : null,
    }
}

// A career's exams from the calendar, in the order the career lists them, each exam once; plus the
// spellings with no calendar row (they still show, as plain text, so nothing the file says is lost).
const examsFor = (profession, overrides = new Map()) => {
    const routes = profession.entrance_exams || {}
    const spellings = [
        ...(routes.public_routes || []).map((spelling) => ({ spelling, isPrivate: false })),
        ...(routes.private_entrances || []).map((spelling) => ({ spelling, isPrivate: true })),
    ]

    const seen = new Set()
    const exams = []
    const unlisted = { public: [], private: [] }

    spellings.forEach(({ spelling, isPrivate }) => {
        const alias = calendar.aliases[spelling]
        const exam = alias && alias.exam ? examById.get(alias.exam) : null
        if (!exam) {
            unlisted[isPrivate ? "private" : "public"].push(spelling)
            return
        }
        if (seen.has(exam.id)) return
        seen.add(exam.id)
        exams.push(examFacing(applyExamOverride(exam, overrides.get(exam.id))))
    })

    return { exams, unlisted }
}

module.exports = { examsFor, examFacing, applyExamOverride, examById, calendar, EDITABLE }
