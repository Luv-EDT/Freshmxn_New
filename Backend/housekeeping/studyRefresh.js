// THE MONTHLY STUDY BOT (owner, Round 11) — run by the housekeeping worker on the 1st.
//
// Two passes, each over the rows checked longest ago:
//
//   COLLEGES   up to STUDY_MAX_DISCIPLINES (6) disciplines. Claude searches NIRF first (the owner's
//              main source), then the published rankings (India Today, Outlook-ICARE) and the
//              discipline's regulator, and proposes institutions to add, remove or re-rank — public
//              and private alike. Where no ranking covers a field it may suggest one, and that row
//              is labelled "Suggested — check". It may also name an exam the calendar lacks.
//   EXAMS      up to REFRESH_MAX_EXAMS (15) exams, each searched ON ITS OWN OFFICIAL DOMAIN only,
//              for the usual application window, exam month and eligibility. Never exact dates.
//   FACTS      (Round 12) up to STUDY_FACT_MAX (10) careers: is a master's required, and does
//              studying abroad help — on official and academic Indian domains, with sources.
//
// NOTHING AUTO-CHANGES. Every proposal goes to the admin's "Data updates" tab (kind exam / college);
// only an approval reaches a career page (utils/studyPlaces.js, utils/examCalendar.js).

const calendar = require("../data/exam_calendar.json")
const { studyPlaces, applyStudyOverride, BASIS, keyOf, MAX_INSTITUTIONS } = require("../utils/studyPlaces")
const { applyExamOverride, EDITABLE } = require("../utils/examCalendar")
const { createResearchClient } = require("./claudeResearch")

const RANKING_DOMAINS = ["nirfindia.org", "indiatoday.in", "outlookindia.com"]
const CONFIDENCE = ["low", "medium", "high"]

const maxDisciplines = () => Number(process.env.STUDY_MAX_DISCIPLINES) || 6
const maxExams = () => Number(process.env.REFRESH_MAX_EXAMS) || 15

// "4 May", "May 4", "2027", "2027-05-04" — a usual window never names a day or a year
const EXACT_DATE = /\b\d{1,2}(st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b|\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2}(st|nd|rd|th)?\b|\b20\d\d\b|\d{4}-\d{2}-\d{2}/i

const timeOf = (value) => (value ? new Date(value).getTime() : 0)
const hostOf = (url) => {
    try {
        return new URL(url).hostname.replace(/^www\./, "")
    } catch (error) {
        return null
    }
}

// the rows looked at longest ago (never first), stable on id
const pickOldest = (rows, idOf, overridesById, limit, fileCheckedOf = () => null) => rows
    .map((row) => {
        const override = overridesById.get(idOf(row))
        return { row, last: override ? timeOf(override.lastCheckedAt) : 0, file: timeOf(fileCheckedOf(row)) }
    })
    .sort((left, right) => left.last - right.last || left.file - right.file || idOf(left.row).localeCompare(idOf(right.row)))
    .slice(0, limit)
    .map((entry) => entry.row)

const textOk = (value, max = 200) => typeof value === "string" && value.trim().length > 1 && value.trim().length <= max

// ── colleges ───────────────────────────────────────────────────────────────────────────────────
// a removal names the institution only; everything else must carry a basis a student can check
const cleanInstitution = (raw, needBasis = true) => {
    if (!raw || !textOk(raw.name, 140)) return null
    if (needBasis && !(textOk(raw.basis, 80) && BASIS.test(raw.basis.trim()))) return null
    const institution = {
        name: raw.name.trim(),
        city: textOk(raw.city, 60) ? raw.city.trim() : null,
        ownership: raw.ownership === "public" || raw.ownership === "private" ? raw.ownership : null,
        basis: textOk(raw.basis, 80) ? raw.basis.trim() : null,
    }
    if (textOk(raw.note, 120)) institution.note = raw.note.trim()
    return institution
}

// A change is kept only if it is well formed, makes sense against today's list, and the reply cited
// a page. Additions need a city (names repeat across cities); the list never grows past ten.
const validateCollegeChange = (change, current, sources) => {
    if (!change || !Array.isArray(sources) || sources.length === 0) return null
    const institution = cleanInstitution(change.institution, change.action !== "remove")
    if (!institution) return null
    const exists = current.some((row) => keyOf(row) === keyOf(institution))
    const reason = String(change.reason || "").slice(0, 600)
    const confidence = CONFIDENCE.includes(change.confidence) ? change.confidence : "low"

    if (change.action === "add") {
        if (exists || !institution.city || current.length >= MAX_INSTITUTIONS) return null
        return { field: "add_institution", currentValue: null, proposedValue: JSON.stringify(institution), reason, confidence }
    }
    if (change.action === "remove") {
        if (!exists) return null
        return { field: "remove_institution", currentValue: keyOf(institution), proposedValue: keyOf(institution), reason, confidence }
    }
    if (change.action === "update") {
        const before = current.find((row) => keyOf(row) === keyOf(institution))
        if (!before || before.basis === institution.basis) return null
        return { field: "update_institution", currentValue: before.basis, proposedValue: JSON.stringify({ ...before, ...Object.fromEntries(Object.entries(institution).filter(([, value]) => value !== null)) }), reason, confidence }
    }
    return null
}

const normaliseExamName = (name) => String(name || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()

const validateNewExam = (raw, sources) => {
    if (!raw || !Array.isArray(sources) || sources.length === 0) return null
    if (!textOk(raw.name, 80) || !textOk(raw.conducting_body, 120)) return null
    if (!/^https:\/\/[^\s/]+\.[a-z]{2,}/i.test(String(raw.official_url || ""))) return null
    if (!["ug", "pg", "professional", "recruitment"].includes(raw.level)) return null
    const known = calendar.exams.some((exam) => normaliseExamName(exam.name) === normaliseExamName(raw.name))
    if (known) return null
    const exam = {
        name: raw.name.trim(),
        conducting_body: raw.conducting_body.trim(),
        official_url: raw.official_url.trim(),
        level: raw.level,
    }
    return { field: "new_exam", currentValue: null, proposedValue: JSON.stringify(exam), reason: String(raw.reason || "").slice(0, 600), confidence: "low" }
}

const COLLEGE_SYSTEM = `You keep a list of good places to study for an Indian career-guidance service used by students aged 14 to 25.

For ONE discipline you are given our current list (at most ten institutions, public and private), each with its
basis. Search NIRF India Rankings first (nirfindia.org) — it is the main source — then the published rankings
(India Today, Outlook-ICARE) and the regulator's approved list.

Propose a change ONLY where a source you found supports it:
  add     a strong institution missing from the list (private institutions are welcome)
  remove  one that no longer belongs (it closed, lost approval, or fell far down every ranking)
  update  a changed rank — e.g. a newer NIRF year
Every institution needs a basis written EXACTLY as one of:
  "NIRF <year> <category> #<rank>"   "India Today <year>"   "Outlook-ICARE <year>"   "Suggested — check"
Use "Suggested — check" only where no ranking covers the field, and say why in the reason.
Most months need no change — an empty list is a good answer.

You may also name an entrance exam for this discipline that is NOT in the list of exams we already know.

Reply with ONLY this JSON object:
{"changes": [{"action": "add" | "remove" | "update", "institution": {"name": "...", "city": "...", "ownership": "public" | "private", "basis": "..."}, "reason": "one sentence naming the source", "confidence": "low" | "medium" | "high"}],
 "newExams": [{"name": "...", "conducting_body": "...", "official_url": "https://...", "level": "ug" | "pg" | "professional" | "recruitment", "reason": "..."}]}`

const collegePrompt = (discipline, current) => [
    `Discipline: ${discipline.name}`,
    `Regulator and ranking pages: ${discipline.links.map((link) => link.url).join(", ")}`,
    "Our current list:",
    ...(current.length > 0 ? current.map((row) => `- ${row.name}, ${row.city || "?"} (${row.ownership || "?"}) — ${row.basis}`) : ["- (empty)"]),
    `Exams we already know: ${calendar.exams.map((exam) => exam.name).join(", ")}`,
].join("\n")

// ── exams ──────────────────────────────────────────────────────────────────────────────────────
const validateExamChange = (change, current, sources) => {
    if (!change || !EDITABLE.includes(change.field) || !Array.isArray(sources) || sources.length === 0) return null
    if (!textOk(change.proposed, 200)) return null
    const proposed = change.proposed.trim().replace(/\.$/, "")
    if (EXACT_DATE.test(proposed)) return null
    const now = current[change.field] || null
    if (now && now.trim().toLowerCase() === proposed.toLowerCase()) return null
    return {
        field: change.field,
        currentValue: now,
        proposedValue: proposed,
        reason: String(change.reason || "").slice(0, 600),
        confidence: CONFIDENCE.includes(change.confidence) ? change.confidence : "low",
    }
}

const EXAM_SYSTEM = `You check one Indian entrance or recruitment exam for a career-guidance service used by students aged 14 to 25.

Search ONLY the exam's official site. Say what USUALLY happens each year — never this year's exact dates:
  usual_application_window   e.g. "November to December"
  usual_exam_month           e.g. "January and April"
  eligibility                one short line, e.g. "Class 12 with Physics, Chemistry and Maths"
Never write a day of the month or a year. Propose a change ONLY where the official site clearly differs from what we
show (or fills a blank). Most exams need no change — an empty list is a good answer.

Reply with ONLY this JSON object:
{"changes": [{"field": "usual_application_window" | "usual_exam_month" | "eligibility", "proposed": "...", "reason": "one sentence naming the page", "confidence": "low" | "medium" | "high"}]}`

const examPrompt = (exam) => [
    `Exam: ${exam.name}`,
    `Run by: ${exam.conducting_body}`,
    `Official site: ${exam.official_url}`,
    `We show — applications usually: ${exam.usual_application_window || "blank"}; exam usually: ${exam.usual_exam_month || "blank"}; eligibility: ${exam.eligibility || "blank"}`,
].join("\n")

// ── study facts: the master's need and studying abroad (Round 12) ─────────────────────────────
// Up to STUDY_FACT_MAX careers a month whose master's matters or where studying abroad was
// flagged, oldest-checked first. Searched on official and academic Indian domains only.
const FACT_DOMAINS = ["gov.in", "nic.in", "ac.in", "res.in", "edu.in"]
const MASTERS_VALUES = ["masters_required", "masters_is_the_entry", "masters_advantage", "work_first"]
const ABROAD_NEEDS = ["not_needed", "helps", "often_needed"]
const ABROAD_STAGES = ["undergrad", "masters", "doctorate", "training"]
const maxFacts = () => Number(process.env.STUDY_FACT_MAX) || 10

// A change is kept only with a cited page, a known value, and a real difference from today's.
const validateFactChange = (change, current, sources) => {
    if (!change || !Array.isArray(sources) || sources.length === 0) return null
    const reason = String(change.reason || "").slice(0, 600)
    const confidence = CONFIDENCE.includes(change.confidence) ? change.confidence : "low"
    if (change.field === "after_undergrad") {
        if (!MASTERS_VALUES.includes(change.proposed) || change.proposed === current.after_undergrad) return null
        return { field: "after_undergrad", currentValue: current.after_undergrad || null, proposedValue: change.proposed, reason, confidence }
    }
    if (change.field === "abroad") {
        const raw = change.proposed || {}
        if (!ABROAD_NEEDS.includes(raw.need)) return null
        const value = raw.need === "not_needed"
            ? { need: "not_needed", stage: null, why: null }
            : (ABROAD_STAGES.includes(raw.stage) && textOk(raw.why, 220) ? { need: raw.need, stage: raw.stage, why: raw.why.trim().replace(/\.$/, "") } : null)
        if (!value) return null
        const before = current.abroad || { need: "not_needed" }
        if (before.need === value.need && (before.stage || null) === value.stage) return null
        return { field: "abroad", currentValue: JSON.stringify(before), proposedValue: JSON.stringify(value), reason, confidence }
    }
    return null
}

const FACT_SYSTEM = `You check two facts about one career for an Indian career-guidance service used by students aged 14 to 25.

1. after_undergrad — what a master's means for this career in India:
   masters_required      you cannot practise or be recruited without it (cite the rule: a regulator, UGC, a recruitment notice)
   masters_is_the_entry  the postgraduate degree is the usual door in, though no law requires it
   masters_advantage     it helps, but people are hired without it
   work_first            experience counts more; a master's is rarely needed
2. abroad — does a student in India NEED to study abroad for this career? Never name a university.
   not_needed / helps / often_needed, with the stage (undergrad, masters, doctorate, training) and one short reason.

Search only official and academic Indian sources. Propose a change ONLY where a page you found clearly supports a
different value. Most careers need no change — an empty list is a good answer.

Reply with ONLY this JSON object:
{"changes": [{"field": "after_undergrad", "proposed": "masters_required", "reason": "one sentence naming the rule and the page", "confidence": "low" | "medium" | "high"},
             {"field": "abroad", "proposed": {"need": "helps", "stage": "masters", "why": "..."}, "reason": "...", "confidence": "..."}]}`

const factPrompt = (profession, current) => [
    `Career: ${profession.profession}`,
    `What it is: ${profession.one_liner || ""}`,
    `Path: ${(profession.path_to_entry || []).map((step) => step.requirement).join(" → ")}`,
    `We show — master's: ${current.after_undergrad || "unknown"}; studying abroad: ${current.abroad ? `${current.abroad.need}${current.abroad.stage ? ` (${current.abroad.stage})` : ""}` : "not needed"}`,
].join("\n")

// ── the job ────────────────────────────────────────────────────────────────────────────────────
const runStudyRefresh = async ({
    research = createResearchClient({ job: "study_refresh" }),
    disciplines = studyPlaces.disciplines,
    exams = calendar.exams,
    disciplineLimit = maxDisciplines(),
    examLimit = maxExams(),
    factLimit = maxFacts(),
    professions = require("../data/ALL-professions.json").professions,
    now = new Date(),
} = {}) => {
    if (!research) return { skipped: "ANTHROPIC_API_KEY is not set" }

    const DataProposal = require("../model/dataProposalsModel")
    const ExamOverride = require("../model/examOverridesModel")
    const StudyPlaceOverride = require("../model/studyPlaceOverridesModel")

    const [examRows, placeRows] = await Promise.all([ExamOverride.find().lean(), StudyPlaceOverride.find().lean()])
    const examOverrides = new Map(examRows.map((row) => [row.examId, row]))
    const placeOverrides = new Map(placeRows.map((row) => [row.disciplineId, row]))

    const result = { disciplines: 0, exams: 0, facts: 0, proposals: 0, refused: [], failed: [] }

    // a newer suggestion replaces an undecided older one for the same thing
    const file = async (kind, id, name, change, sources) => {
        const same = { kind, professionId: id, field: change.field, status: "open" }
        if (kind === "college") same.proposedValue = change.proposedValue
        await DataProposal.updateMany(same, { status: "superseded" })
        await DataProposal.create({ kind, professionId: id, profession: name, ...change, sources: sources.slice(0, 8) })
        result.proposals += 1
    }

    for (const discipline of pickOldest(disciplines, (row) => row.id, placeOverrides, disciplineLimit, (row) => row.checked_on)) {
        const current = applyStudyOverride(discipline.institutions, placeOverrides.get(discipline.id))
        const regulatorDomains = discipline.links.map((link) => hostOf(link.url)).filter(Boolean)
        try {
            const reply = await research.askJson({
                system: COLLEGE_SYSTEM,
                user: collegePrompt(discipline, current),
                check: (json) => Array.isArray(json.changes),
                onlyDomains: [...new Set([...RANKING_DOMAINS, ...regulatorDomains])],
            })
            if (reply.refused) result.refused.push(discipline.id)
            if (reply.unreadable) {
                result.failed.push(discipline.id)
                continue
            }
            if (reply.json) {
                for (const change of reply.json.changes.map((raw) => validateCollegeChange(raw, current, reply.sources)).filter(Boolean)) {
                    await file("college", discipline.id, discipline.name, change, reply.sources)
                }
                for (const exam of (Array.isArray(reply.json.newExams) ? reply.json.newExams : []).map((raw) => validateNewExam(raw, reply.sources)).filter(Boolean)) {
                    const draft = JSON.parse(exam.proposedValue)
                    await file("exam", `new:${normaliseExamName(draft.name).replace(/ /g, "-")}`, draft.name, exam, reply.sources)
                }
            }
            await StudyPlaceOverride.updateOne({ disciplineId: discipline.id }, { $set: { lastCheckedAt: now } }, { upsert: true })
            result.disciplines += 1
        } catch (error) {
            console.error(`study_refresh: ${discipline.id} failed — ${error.message}`)
            result.failed.push(discipline.id)
        }
    }

    for (const row of pickOldest(exams, (exam) => exam.id, examOverrides, examLimit, (exam) => exam.checked_on)) {
        const exam = applyExamOverride(row, examOverrides.get(row.id))
        const domain = hostOf(exam.official_url)
        if (!domain) continue
        try {
            const reply = await research.askJson({
                system: EXAM_SYSTEM,
                user: examPrompt(exam),
                check: (json) => Array.isArray(json.changes),
                onlyDomains: [domain],
            })
            if (reply.refused) result.refused.push(exam.id)
            if (reply.unreadable) {
                result.failed.push(exam.id)
                continue
            }
            const current = { usual_application_window: exam.usual_application_window, usual_exam_month: exam.usual_exam_month, eligibility: exam.eligibility }
            for (const change of (reply.json ? reply.json.changes : []).map((raw) => validateExamChange(raw, current, reply.sources)).filter(Boolean)) {
                await file("exam", exam.id, exam.name, change, reply.sources)
            }
            await ExamOverride.updateOne({ examId: exam.id }, { $set: { lastCheckedAt: now } }, { upsert: true })
            result.exams += 1
        } catch (error) {
            console.error(`study_refresh: ${exam.id} failed — ${error.message}`)
            result.failed.push(exam.id)
        }
    }

    // the careers whose master's matters, or where studying abroad was flagged
    if (factLimit <= 0) return result
    const StudyFactOverride = require("../model/studyFactOverridesModel")
    const abroadData = require("../data/abroad.json").careers
    const factRows = await StudyFactOverride.find().lean()
    const factOverrides = new Map(factRows.map((row) => [row.professionId, row]))
    const studySources = require("../data/study_sources.json").careers
    const candidates = professions.filter((profession) => profession.after_undergrad !== "work_first" || (abroadData[profession.id] && abroadData[profession.id].need !== "not_needed"))
    for (const profession of pickOldest(candidates, (row) => row.id, factOverrides, factLimit, (row) => {
        const known = studySources[row.id] && (studySources[row.id].after_undergrad || studySources[row.id].abroad)
        return known ? known.checkedOn : null
    })) {
        const override = factOverrides.get(profession.id)
        const values = (override && override.approvedAt && override.values) || {}
        const abroadRow = values.abroad || abroadData[profession.id]
        const current = {
            after_undergrad: values.after_undergrad || profession.after_undergrad,
            abroad: abroadRow && abroadRow.need !== "not_needed" ? abroadRow : null,
        }
        try {
            const reply = await research.askJson({
                system: FACT_SYSTEM,
                user: factPrompt(profession, current),
                check: (json) => Array.isArray(json.changes),
                onlyDomains: FACT_DOMAINS,
            })
            if (reply.refused) result.refused.push(profession.id)
            if (reply.unreadable) {
                result.failed.push(profession.id)
                continue
            }
            for (const change of (reply.json ? reply.json.changes : []).map((raw) => validateFactChange(raw, current, reply.sources)).filter(Boolean)) {
                await file("study_fact", profession.id, profession.profession, change, reply.sources)
            }
            await StudyFactOverride.updateOne({ professionId: profession.id }, { $set: { lastCheckedAt: now } }, { upsert: true })
            result.facts += 1
        } catch (error) {
            console.error(`study_refresh: ${profession.id} failed — ${error.message}`)
            result.failed.push(profession.id)
        }
    }

    return result
}

module.exports = {
    runStudyRefresh, pickOldest, validateCollegeChange, validateExamChange, validateNewExam, validateFactChange, cleanInstitution,
    EXACT_DATE, RANKING_DOMAINS, FACT_DOMAINS, COLLEGE_SYSTEM, EXAM_SYSTEM, FACT_SYSTEM, MASTERS_VALUES, ABROAD_NEEDS, ABROAD_STAGES,
}
