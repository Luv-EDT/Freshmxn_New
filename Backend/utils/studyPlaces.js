// WHERE TO STUDY (Round 11) — data/study_places.json, applied to a career.
//
// Each career maps to one discipline, or to null where there is no formal programme to point at
// (portfolio, apprenticeship or "any degree" careers show nothing). A discipline carries official
// links — the NIRF ranking page and the regulator's approved list — and up to ten institutions,
// public and private, each with its basis: an NIRF rank (the main source), or "Suggested — check".
//
// OWNER GATE: the links show at once; the institution lists stay hidden until the owner has read
// them (review.reviewed_by_owner). Admin-approved changes from the monthly study bot
// (StudyPlaceOverride) are laid over the file here, and the exam overrides beside them — display
// only, cached like utils/professionOverrides.js and cleared when the admin approves.

const studyPlaces = require("../data/study_places.json")
const { cutoffsFor } = require("./cutoffs")

const MAX_INSTITUTIONS = 10
const disciplineById = new Map(studyPlaces.disciplines.map((discipline) => [discipline.id, discipline]))

// "NIRF 2025 Engineering #3", "NIRF 2025 Management top 10", "India Today 2025", "Outlook-ICARE 2025",
// or "Suggested — check". Anything else is not a basis a student can check.
const BASIS = /^(NIRF 20\d\d [A-Za-z ]+ (#\d+|top \d+)|(India Today|Outlook-ICARE) 20\d\d( [A-Za-z ]+)?( #\d+)?|Suggested — check)$/
const isSuggested = (institution) => institution.basis === "Suggested — check"

const sameName = (left, right) => String(left || "").trim().toLowerCase() === String(right || "").trim().toLowerCase()

// Names repeat across cities (five Institutes of Hotel Management), so an institution is its name
// AND its city. A removal is stored as this key.
const keyOf = (institution) => `${String(institution.name || "").trim()} · ${String(institution.city || "").trim()}`.toLowerCase()

// The discipline's institutions with the approved changes in place: removals out, updates replaced,
// additions appended at the end; at most ten.
const applyStudyOverride = (institutions, override) => {
    if (!override) return institutions.slice(0, MAX_INSTITUTIONS)
    const removed = (override.removed || []).map((key) => String(key).trim().toLowerCase())
    let list = institutions.filter((institution) => !removed.includes(keyOf(institution)))
    ;(override.updated || []).forEach((changed) => {
        list = list.map((institution) => (keyOf(institution) === keyOf(changed) ? { ...institution, ...clean(changed) } : institution))
    })
    ;(override.added || []).forEach((added) => {
        if (!list.some((institution) => keyOf(institution) === keyOf(added))) list.push(clean(added))
    })
    return list.slice(0, MAX_INSTITUTIONS)
}

// only the four display fields — a mongoose subdocument carries more
const clean = (institution) => {
    const out = { name: institution.name, city: institution.city || null, ownership: institution.ownership || null, basis: institution.basis }
    if (institution.note) out.note = institution.note
    return out
}

// What a career page shows. `institutions` is empty until the owner has reviewed the lists.
const studyPlacesFor = (professionId, studyOverrides = new Map(), cutoffOverrides = new Map()) => {
    const disciplineId = studyPlaces.careers[professionId]
    const discipline = disciplineId ? disciplineById.get(disciplineId) : null
    if (!discipline) return null

    const reviewed = Boolean(studyPlaces.review && studyPlaces.review.reviewed_by_owner)
    return {
        discipline: discipline.name,
        links: discipline.links,
        institutions: reviewed
            ? applyStudyOverride(discipline.institutions, studyOverrides.get(discipline.id)).map((institution) => ({
                name: institution.name,
                city: institution.city,
                private: institution.ownership === "private",
                basis: institution.basis,
                suggested: isSuggested(institution),
                note: institution.note || null,
            }))
            : [],
        listsPending: !reviewed,
        // last year's closing ranks (Round 12): the official page always; a checked rank only once
        // the institution list itself is shown, since each rank belongs to one of those institutions
        cutoffs: (() => {
            const found = cutoffsFor(discipline.id, cutoffOverrides)
            return found ? { ...found, rows: reviewed ? found.rows : [] } : null
        })(),
    }
}

// ── the cache of both override layers ───────────────────────────────────────────────────────────
const CACHE_MS = 5 * 60 * 1000
let cache = null
let cachedAt = 0

const getStudyOverrides = async () => {
    if (cache && Date.now() - cachedAt < CACHE_MS) return cache
    const ExamOverride = require("../model/examOverridesModel")
    const StudyPlaceOverride = require("../model/studyPlaceOverridesModel")
    const StudyFactOverride = require("../model/studyFactOverridesModel")
    const CutoffOverride = require("../model/cutoffOverridesModel")
    const AbroadLicenceOverride = require("../model/abroadLicenceOverridesModel")
    const [exams, places, facts, cutoffRows, licenceRows] = await Promise.all([
        ExamOverride.find({ approvedAt: { $ne: null } }).lean(),
        StudyPlaceOverride.find({ approvedAt: { $ne: null } }).lean(),
        StudyFactOverride.find({ approvedAt: { $ne: null } }).lean(),
        CutoffOverride.find({ approvedAt: { $ne: null } }).lean(),
        AbroadLicenceOverride.find({ approvedAt: { $ne: null } }).lean(),
    ])
    cache = {
        exams: new Map(exams.map((row) => [row.examId, row])),
        places: new Map(places.map((row) => [row.disciplineId, row])),
        facts: new Map(facts.map((row) => [row.professionId, row])),
        cutoffs: new Map(cutoffRows.map((row) => [row.rowId, row])),
        licences: new Map(licenceRows.map((row) => [row.key, row])),
    }
    cachedAt = Date.now()
    return cache
}

const clearStudyOverrides = () => {
    cache = null
    cachedAt = 0
}

module.exports = {
    studyPlaces, disciplineById, studyPlacesFor, applyStudyOverride, getStudyOverrides, clearStudyOverrides,
    BASIS, MAX_INSTITUTIONS, isSuggested, keyOf, sameName,
}
