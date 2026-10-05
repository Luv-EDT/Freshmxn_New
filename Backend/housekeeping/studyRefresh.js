// THE MONTHLY STUDY BOT (owner, Round 11) — run by the housekeeping worker on the 1st.
//
// Four passes, each over the rows checked longest ago — and each only in its season (Round 13,
// see "the seasons" below):
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
//   LICENCES   (Round 13, January) up to STUDY_LICENCE_MAX (10) licence routes abroad
//              (data/abroad_work.json), each on the licensing body's own site.
//   CUT-OFFS   (Round 12, August–October) up to STUDY_CUTOFF_MAX (10) rows of data/cutoffs.json:
//              last year's final-round closing rank, read off the counselling body's own result page.
//
// HALF PRICE BY DEFAULT (Round 12): sent as one Message Batch; batch_collect files the answers
// (housekeeping/researchBatch.js). RESEARCH_BATCH=false asks directly.
//
// NOTHING AUTO-CHANGES. Every proposal goes to the admin's "Data updates" tab (kind exam / college);
// only an approval reaches a career page (utils/studyPlaces.js, utils/examCalendar.js).

const calendar = require("../data/exam_calendar.json")
const { studyPlaces, applyStudyOverride, BASIS, keyOf, MAX_INSTITUTIONS } = require("../utils/studyPlaces")
const { applyExamOverride, EDITABLE } = require("../utils/examCalendar")
const { createResearchClient } = require("./claudeResearch")
const { researchModel } = require("../utils/researchModel")
const { submitBatch, batchEnabled } = require("./researchBatch")

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

// A change is kept only with a cited page, a known value, and a real difference from today's — or,
// for a mentor-backed change (Round 17, requireSources: false), without the page.
const validateFactChange = (change, current, sources, { requireSources = true } = {}) => {
    if (!change || (requireSources && (!Array.isArray(sources) || sources.length === 0))) return null
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

// ── cut-offs: last year's closing ranks (Round 12) ─────────────────────────────────────────────
// August to October only — when the year's final counselling rounds are published. Up to
// STUDY_CUTOFF_MAX (10) rows of data/cutoffs.json a month, oldest-checked first, each searched on its
// counselling body's own site. The rank must be read off the official result page and that page
// named; a summary site is not a source.
const { cutoffs: cutoffData, applyCutoffOverride } = require("../utils/cutoffs")
const CUTOFF_MONTHS = [7, 8, 9]       // Aug, Sep, Oct (getMonth)
const maxCutoffs = () => Number(process.env.STUDY_CUTOFF_MAX) || 10

const cutoffDomains = (row) => {
    const source = cutoffData.sources[row.source]
    return source ? [...new Set([source.url, source.archive].filter(Boolean).map(hostOf).filter(Boolean))] : []
}

const validateCutoffChange = (change, current, sources, { now = new Date(), domains = [] } = {}) => {
    if (!change || change.field !== "closing_rank" || !Array.isArray(sources) || sources.length === 0) return null
    const raw = change.proposed || {}
    const rank = Number(raw.closing_rank)
    const year = Number(raw.year)
    const round = typeof raw.round === "string" ? raw.round.trim() : ""
    const url = typeof raw.source_url === "string" ? raw.source_url.trim() : ""
    if (!Number.isInteger(rank) || rank <= 0 || rank > 2000000) return null
    if (!Number.isInteger(year) || year < now.getFullYear() - 1 || year > now.getFullYear()) return null
    if (round === "" || round.length > 40) return null
    const host = hostOf(url)
    if (!url.startsWith("https://") || !host || !domains.some((domain) => host === domain || host.endsWith(`.${domain}`))) return null
    if (current && current.status === "checked" && current.closing_rank === rank && current.year === year) return null
    return {
        field: "closing_rank",
        currentValue: current && current.status === "checked" ? JSON.stringify({ closing_rank: current.closing_rank, year: current.year, round: current.round }) : null,
        proposedValue: JSON.stringify({ closing_rank: rank, year, round, source_url: url }),
        reason: String(change.reason || "").slice(0, 600),
        confidence: CONFIDENCE.includes(change.confidence) ? change.confidence : "low",
    }
}

const CUTOFF_SYSTEM = `You read one closing rank off an official Indian admission counselling result, for a career-guidance service.

You are told the institution, programme, counselling body, category, seat pool and quota. Search ONLY the counselling
body's own site and find LAST YEAR'S FINAL ROUND closing rank for exactly that row. Read it off the official result page
itself; never use a coaching, news or summary site, and never estimate. If you cannot find the official figure, return an
empty list.

Reply with ONLY this JSON object:
{"changes": [{"field": "closing_rank", "proposed": {"closing_rank": 66, "year": 2025, "round": "Round 6 (final)", "source_url": "https://<the official page>"}, "reason": "one sentence naming the page", "confidence": "low" | "medium" | "high"}]}`

const cutoffPrompt = (row) => [
    `Institution: ${row.institution}, ${row.city}`,
    `Programme: ${row.programme}`,
    `Counselling: ${(cutoffData.sources[row.source] || {}).name || row.source} (${row.exam})`,
    `Row: ${row.category} category, ${row.seat_pool} seats, ${row.quota} quota, final round`,
    row.status === "checked" ? `We show: ${row.closing_rank} (${row.year}, ${row.round})` : "We show nothing yet.",
].join("\n")

// ── licences abroad (Round 13): what each of the five countries asks of a licensed career ──────────
// January only, up to STUDY_LICENCE_MAX (10) rows of data/abroad_work.json, oldest-checked first,
// each searched on the licensing body's OWN domain. A change must name a page on that domain.
const abroadWork = require("../data/abroad_work.json")
const LICENCE_MONTHS = [0]
const maxLicences = () => Number(process.env.STUDY_LICENCE_MAX) || 10
const licenceRows = () => Object.entries(abroadWork.licences).flatMap(([careerId, byCountry]) => Object.entries(byCountry)
    .filter(([, row]) => row.url)
    .map(([country, row]) => ({ id: `${careerId}:${country}`, careerId, country, ...row })))

const validateLicenceChange = (change, current, sources, domains) => {
    if (!change || change.field !== "licence" || !Array.isArray(sources) || sources.length === 0) return null
    const raw = change.proposed || {}
    const value = { body: raw.body, exam: raw.exam, steps: raw.steps, url: raw.url }
    if (![value.body, value.exam, value.steps].every((text) => textOk(text, 300)) || typeof value.url !== "string" || !value.url.startsWith("https://")) return null
    const host = hostOf(value.url)
    if (!host || !domains.some((domain) => host === domain || host.endsWith(`.${domain}`))) return null
    if (["body", "exam", "steps", "url"].every((key) => String(value[key]).trim() === String(current[key] || "").trim())) return null
    return {
        field: "licence",
        currentValue: JSON.stringify({ body: current.body, exam: current.exam, steps: current.steps, url: current.url }),
        proposedValue: JSON.stringify(value),
        reason: String(change.reason || "").slice(0, 600),
        confidence: CONFIDENCE.includes(change.confidence) ? change.confidence : "low",
    }
}

const LICENCE_SYSTEM = `You check how a professional trained in India gets licensed in one other country, for a career-guidance service.

You are told the career, the country, and what we currently say: the licensing body, its exam or route, the steps in one line,
and the body's official page. Search ONLY the licensing body's own site. Propose a change ONLY where that site clearly says
something different today (a renamed exam, a new route, a moved page). Never use a coaching, news or agency site. Most rows
need no change — an empty list is a good answer.

Reply with ONLY this JSON object:
{"changes": [{"field": "licence", "proposed": {"body": "...", "exam": "...", "steps": "one line", "url": "https://<the official page>"}, "reason": "one sentence naming the page", "confidence": "low" | "medium" | "high"}]}`

const licencePrompt = (row) => [
    `Career: ${row.careerId}`,
    `Country: ${(abroadWork.countries.find((country) => country.code === row.country) || {}).name || row.country}`,
    `We say — body: ${row.body}; exam/route: ${row.exam}; steps: ${row.steps}; official page: ${row.url}`,
].join("\n")

// ── the job ────────────────────────────────────────────────────────────────────────────────────
const check = (json) => Array.isArray(json.changes)
const newResult = () => ({ disciplines: 0, exams: 0, facts: 0, cutoffs: 0, licences: 0, proposals: 0, refused: [], failed: [] })

// a newer suggestion replaces an undecided older one for the same thing
const fileProposal = async (kind, id, name, change, sources, result) => {
    const DataProposal = require("../model/dataProposalsModel")
    const same = { kind, professionId: id, field: change.field, status: "open" }
    if (kind === "college") same.proposedValue = change.proposedValue
    await DataProposal.updateMany(same, { status: "superseded" })
    await DataProposal.create({ kind, professionId: id, profession: name, ...change, sources: sources.slice(0, 8) })
    result.proposals += 1
}

// one answer → proposals. The same whether it came back directly or in a batch (researchBatch.js).
// An unreadable answer is not a check: that row stays at the front for next month.
const handleItem = async (item, reply, { now, result }) => {
    if (reply.refused) result.refused.push(item.id)
    if (reply.unreadable) {
        result.failed.push(item.id)
        return
    }
    const changes = reply.json ? reply.json.changes : []
    const sources = reply.sources || []

    if (item.kind === "college") {
        const StudyPlaceOverride = require("../model/studyPlaceOverridesModel")
        for (const change of changes.map((raw) => validateCollegeChange(raw, item.context.current, sources)).filter(Boolean)) {
            await fileProposal("college", item.id, item.name, change, sources, result)
        }
        for (const exam of ((reply.json && Array.isArray(reply.json.newExams)) ? reply.json.newExams : []).map((raw) => validateNewExam(raw, sources)).filter(Boolean)) {
            const draft = JSON.parse(exam.proposedValue)
            await fileProposal("exam", `new:${normaliseExamName(draft.name).replace(/ /g, "-")}`, draft.name, exam, sources, result)
        }
        await StudyPlaceOverride.updateOne({ disciplineId: item.id }, { $set: { lastCheckedAt: now } }, { upsert: true })
        result.disciplines += 1
    }
    if (item.kind === "exam") {
        const ExamOverride = require("../model/examOverridesModel")
        for (const change of changes.map((raw) => validateExamChange(raw, item.context.current, sources)).filter(Boolean)) {
            await fileProposal("exam", item.id, item.name, change, sources, result)
        }
        await ExamOverride.updateOne({ examId: item.id }, { $set: { lastCheckedAt: now } }, { upsert: true })
        result.exams += 1
    }
    if (item.kind === "cutoff") {
        const CutoffOverride = require("../model/cutoffOverridesModel")
        for (const change of changes.map((raw) => validateCutoffChange(raw, item.context.current, sources, { now: new Date(now), domains: item.context.domains })).filter(Boolean)) {
            await fileProposal("cutoff", item.id, item.name, change, sources, result)
        }
        await CutoffOverride.updateOne({ rowId: item.id }, { $set: { lastCheckedAt: now } }, { upsert: true })
        result.cutoffs = (result.cutoffs || 0) + 1
    }
    if (item.kind === "licence") {
        const AbroadLicenceOverride = require("../model/abroadLicenceOverridesModel")
        for (const change of changes.map((raw) => validateLicenceChange(raw, item.context.current, sources, item.context.domains)).filter(Boolean)) {
            await fileProposal("abroad_licence", item.id, item.name, change, sources, result)
        }
        await AbroadLicenceOverride.updateOne({ key: item.id }, { $set: { lastCheckedAt: now } }, { upsert: true })
        result.licences = (result.licences || 0) + 1
    }
    if (item.kind === "fact") {
        const StudyFactOverride = require("../model/studyFactOverridesModel")
        for (const change of changes.map((raw) => validateFactChange(raw, item.context.current, sources)).filter(Boolean)) {
            await fileProposal("study_fact", item.id, item.name, change, sources, result)
        }
        await StudyFactOverride.updateOne({ professionId: item.id }, { $set: { lastCheckedAt: now } }, { upsert: true })
        result.facts += 1
    }
}

// every question this month, each with what its answer will be checked against
const prepareItems = async ({ disciplines, exams, disciplineLimit, examLimit, factLimit, professions, cutoffLimit = 0, cutoffRows = cutoffData.rows, licenceLimit = 0 }) => {
    const ExamOverride = require("../model/examOverridesModel")
    const StudyPlaceOverride = require("../model/studyPlaceOverridesModel")
    const [examRows, placeRows] = await Promise.all([ExamOverride.find().lean(), StudyPlaceOverride.find().lean()])
    const examOverrides = new Map(examRows.map((row) => [row.examId, row]))
    const placeOverrides = new Map(placeRows.map((row) => [row.disciplineId, row]))
    const items = []

    for (const discipline of pickOldest(disciplines, (row) => row.id, placeOverrides, disciplineLimit, (row) => row.checked_on)) {
        const current = applyStudyOverride(discipline.institutions, placeOverrides.get(discipline.id))
        const regulatorDomains = discipline.links.map((link) => hostOf(link.url)).filter(Boolean)
        items.push({
            kind: "college",
            id: discipline.id,
            name: discipline.name,
            request: { system: COLLEGE_SYSTEM, user: collegePrompt(discipline, current), onlyDomains: [...new Set([...RANKING_DOMAINS, ...regulatorDomains])] },
            context: { current },
        })
    }

    for (const row of pickOldest(exams, (exam) => exam.id, examOverrides, examLimit, (exam) => exam.checked_on)) {
        const exam = applyExamOverride(row, examOverrides.get(row.id))
        const domain = hostOf(exam.official_url)
        if (!domain) continue
        items.push({
            kind: "exam",
            id: exam.id,
            name: exam.name,
            request: { system: EXAM_SYSTEM, user: examPrompt(exam), onlyDomains: [domain] },
            context: { current: { usual_application_window: exam.usual_application_window, usual_exam_month: exam.usual_exam_month, eligibility: exam.eligibility } },
        })
    }

    if (cutoffLimit > 0) {
        const CutoffOverride = require("../model/cutoffOverridesModel")
        const cutoffOverrides = new Map((await CutoffOverride.find().lean()).map((row) => [row.rowId, row]))
        for (const raw of pickOldest(cutoffRows, (row) => row.id, cutoffOverrides, cutoffLimit, (row) => row.checked_on)) {
            const row = applyCutoffOverride(raw, cutoffOverrides.get(raw.id))
            const domains = cutoffDomains(row)
            if (domains.length === 0) continue
            items.push({
                kind: "cutoff",
                id: row.id,
                name: `${row.institution} — ${row.programme}`,
                request: { system: CUTOFF_SYSTEM, user: cutoffPrompt(row), onlyDomains: domains },
                context: { current: { status: row.status, closing_rank: row.closing_rank, year: row.year, round: row.round }, domains },
            })
        }
    }

    if (licenceLimit > 0) {
        const AbroadLicenceOverride = require("../model/abroadLicenceOverridesModel")
        const licenceOverrides = new Map((await AbroadLicenceOverride.find().lean()).map((row) => [row.key, row]))
        for (const raw of pickOldest(licenceRows(), (row) => row.id, licenceOverrides, licenceLimit, (row) => row.checkedOn)) {
            const override = licenceOverrides.get(raw.id)
            const row = override && override.approvedAt && override.values ? { ...raw, ...override.values } : raw
            const domain = hostOf(row.url)
            if (!domain) continue
            items.push({
                kind: "licence",
                id: row.id,
                name: `${row.careerId} — ${row.country}`,
                request: { system: LICENCE_SYSTEM, user: licencePrompt(row), onlyDomains: [domain] },
                context: { current: { body: row.body, exam: row.exam, steps: row.steps, url: row.url }, domains: [domain] },
            })
        }
    }

    // the careers whose master's matters, or where studying abroad was flagged
    if (factLimit <= 0) return items
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
        items.push({
            kind: "fact",
            id: profession.id,
            name: profession.profession,
            request: { system: FACT_SYSTEM, user: factPrompt(profession, current), onlyDomains: FACT_DOMAINS },
            context: { current },
        })
    }
    return items
}

// ── the seasons (owner, Round 13) ──────────────────────────────────────────────────────────────
// The bot runs on the 1st of every month, but each part only works when something can have
// changed: an exam about two months before its applications usually open (draft rows with no
// window in January), colleges in September and October after NIRF publishes, the master's and
// abroad facts once a quarter, cut-offs from August to October. A month with nothing due makes no
// AI call. The admin's "Run now" (force) checks a slice of everything, as before.
const COLLEGE_MONTHS = [8, 9]           // Sep, Oct
const FACT_MONTHS = [0, 3, 6, 9]        // Jan, Apr, Jul, Oct
const SEASON_DISCIPLINES = 12           // all 23 disciplines across the two college months
const MONTH_NAMES = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]

// the first month a usual window names ("November to December" → 10), or null
const windowMonth = (text) => {
    const found = String(text || "").toLowerCase().match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/)
    return found ? MONTH_NAMES.indexOf(found[1]) : null
}

const examIsDue = (exam, now) => {
    const month = windowMonth(exam.usual_application_window)
    if (month === null) return now.getMonth() === 0
    const ahead = (month - now.getMonth() + 12) % 12
    return ahead === 1 || ahead === 2
}

const runStudyRefresh = async ({
    research,             // injected in the fixtures; otherwise built on the chosen research model
    batch,                // true / false to force; by default batched unless RESEARCH_BATCH=false
    force = false,        // the admin's Run now: a slice of everything, ignoring the seasons
    disciplines = studyPlaces.disciplines,
    exams = calendar.exams,
    disciplineLimit,
    examLimit,
    factLimit,
    cutoffLimit,
    licenceLimit,
    professions = require("../data/ALL-professions.json").professions,
    now = new Date(),
} = {}) => {
    const month = now.getMonth()
    if (disciplineLimit === undefined) disciplineLimit = force ? maxDisciplines() : COLLEGE_MONTHS.includes(month) ? SEASON_DISCIPLINES : 0
    if (examLimit === undefined) examLimit = maxExams()
    if (factLimit === undefined) factLimit = force || FACT_MONTHS.includes(month) ? maxFacts() : 0
    if (cutoffLimit === undefined) cutoffLimit = force || CUTOFF_MONTHS.includes(month) ? maxCutoffs() : 0
    if (licenceLimit === undefined) licenceLimit = force || LICENCE_MONTHS.includes(month) ? maxLicences() : 0
    const dueExams = force ? exams : exams.filter((exam) => examIsDue(exam, now))
    if (disciplineLimit === 0 && (dueExams.length === 0 || examLimit === 0) && factLimit === 0 && cutoffLimit === 0 && licenceLimit === 0) return { nothing: "due this month" }

    const injected = research !== undefined
    if (!injected) research = createResearchClient({ job: "study_refresh", model: await researchModel() })
    if (!research) return { skipped: "ANTHROPIC_API_KEY is not set" }

    const items = await prepareItems({ disciplines, exams: dueExams, disciplineLimit, examLimit, factLimit, professions, cutoffLimit, licenceLimit })
    if (items.length === 0) return { nothing: "due this month" }

    if (batch === undefined ? !injected && batchEnabled() : batch) {
        const submitted = await submitBatch({ job: "study_refresh", items, model: research.model })
        if (submitted) return { batched: submitted.batchId, questions: submitted.items, note: "answers are filed by batch_collect, usually within the hour" }
    }

    const result = newResult()
    for (const item of items) {
        try {
            const reply = await research.askJson({ ...item.request, check })
            await handleItem(item, reply, { now, result })
        } catch (error) {
            console.error(`study_refresh: ${item.id} failed — ${error.message}`)
            result.failed.push(item.id)
        }
    }

    return result
}

module.exports = {
    runStudyRefresh, handleItem, newResult, check, prepareItems, pickOldest, validateCollegeChange, validateExamChange, validateNewExam, validateFactChange, cleanInstitution,
    validateCutoffChange, cutoffDomains, CUTOFF_SYSTEM, CUTOFF_MONTHS, validateLicenceChange, licenceRows, hostOf, LICENCE_MONTHS, COLLEGE_MONTHS, FACT_MONTHS, windowMonth, examIsDue,
    EXACT_DATE, RANKING_DOMAINS, FACT_DOMAINS, COLLEGE_SYSTEM, EXAM_SYSTEM, FACT_SYSTEM, MASTERS_VALUES, ABROAD_NEEDS, ABROAD_STAGES,
}
