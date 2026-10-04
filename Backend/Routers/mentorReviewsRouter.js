const express = require("express")
const MentorReview = require("../model/mentorReviewsModel")
const Mentor = require("../model/mentorsModel")
const ProfessionSuggestions = require("../model/professionSuggestionsModel")
const authMiddleware = require("../middlewares/authMiddleware")
const adminAuthMiddleware = require("../middlewares/adminAuthMiddleware")
const mentorAuthMiddleware = require("../middlewares/mentorAuthMiddleware")
const { studentFacing } = require("./professionsRouter")
const { FACTOR_LABELS } = require("../workers/reportComposer")
const { applyOverride, getOverrides } = require("../utils/professionOverrides")
const { getStudyOverrides, applyStudyOverride, disciplineById, studyPlaces } = require("../utils/studyPlaces")
const { signatureOf } = require("../housekeeping/mentorPass")

const router = express.Router()

// MENTORS CHECK OUR DATA FOR THEIR OWN PROFESSION (owner, Round 12). An approved mentor sees the
// career they work in the way a student would, section by section, and says "looks right" or
// "needs a change" — plus, for every quality the career is rated on, "about right / should be
// higher / should be lower".
//
// NOTHING HERE CHANGES THE PRODUCT. This router writes only its own rows: the mentor's answers
// (MentorReview) and, since Round 15, ONE ROW PER PROFESSION holding just the changes mentors suggest
// (ProfessionSuggestions — "looks right" never reaches the admin). A fixture checks this file never
// touches an override or a data file.
//
// ONE QUEUE (owner, Round 16): the admin no longer decides here. Once a month Claude checks the
// waiting suggestions against sources (housekeeping/mentorPass.js); what holds up becomes an ordinary
// proposal in Data updates, the rest is discarded with a reason, and the list empties. The admin's
// Mentor reviews tab only shows what mentors said and what happened to it. A mentor can always send
// again — their latest answers replace what was still waiting.

const taxonomy = require("../data/ALL-professions.json")
const baseline = require("../data/baseline_rating.json")
const abroad = require("../data/abroad.json")
const abroadWork = require("../data/abroad_work.json")
const degreeFamilies = require("../data/degree_families.json")
const degreeOptions = require("../data/degree_options.json")

const professionById = new Map(taxonomy.professions.map((profession) => [profession.id, profession]))
const ratingById = new Map(baseline.ratings.map((rating) => [rating.id, rating]))

const SECTIONS = ["what_it_is", "path", "exams", "where_to_study", "abroad", "working_abroad", "degrees", "masters", "pay", "demand", "ai", "nuances"]
const VERDICTS = ["right", "change"]
const DIRECTIONS = ["right", "higher", "lower"]
const QUALITY_COUNT = 8
const NOTE_MAX = 600

// The words a mentor sees for a factor's demand — never the number behind it. Uncertainty
// tolerance is a position, not a level (house rule), so it gets its own three words.
const levelOf = (value) => (value >= 6.67 ? "High" : value >= 3.33 ? "Medium" : "Low")
const UNCERTAINTY_POSITION = { High: "comfortable not knowing", Medium: "somewhere in between", Low: "prefers a clear plan" }
const describeLevel = (slug, value) => (slug === "uncertainty_tolerance" ? UNCERTAINTY_POSITION[levelOf(value)] : levelOf(value))

// Every quality the career is rated on (Round 13, owner: all of them, not only the top eight), in
// order of how much it matters for this work. The first QUALITY_COUNT are `main` — shown open on the
// sheet; the rest sit in a collapsed list.
const qualitiesFor = (professionId) => {
    const rating = ratingById.get(professionId)
    if (!rating) return []
    return Object.entries(rating.weights || {})
        .filter(([slug]) => typeof (rating.factors || {})[slug] === "number" && FACTOR_LABELS[slug])
        .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
        .map(([slug], position) => ({ factor: slug, label: FACTOR_LABELS[slug], level: describeLevel(slug, rating.factors[slug]), main: position < QUALITY_COUNT }))
}

// WORKING ABROAD AND DEGREES (Round 14, owner): both were drafted by us, so mentors check them too.
// A mentor sees every licence row, drafts included and marked — the rows still waiting for a check
// are exactly the ones a mentor can confirm — with any approved correction applied, as students get it.
const workingAbroadFor = (professionId, licences = new Map()) => {
    const career = abroadWork.careers[professionId]
    if (!career) return null
    const rows = abroadWork.licences[professionId] || {}
    return {
        portability: career.portability,
        note: career.note,
        countries: abroadWork.countries.filter((country) => rows[country.code]).map((country) => {
            const override = licences.get(`${professionId}:${country.code}`)
            const row = override && override.approvedAt && override.values ? { ...rows[country.code], ...override.values, status: "supported" } : rows[country.code]
            return { country: country.name, body: row.body, exam: row.exam, steps: row.steps, url: row.url || null, draft: row.status !== "supported" }
        }),
    }
}

// degree_families.json read backwards: which degrees already count towards this career, in the
// words the profile form uses ("B.Tech / B.E. — Civil")
const DEGREE_LABELS = new Map(degreeOptions.families.flatMap((family) => [
    [family.id, family.label],
    ...(family.subjects || []).map((subject) => [`${family.id}:${subject.id}`, `${family.label} — ${subject.label}`]),
]))
const degreesFor = (professionId) => {
    const degrees = Object.entries(degreeFamilies.by_degree).filter(([, ids]) => ids.includes(professionId)).map(([key]) => DEGREE_LABELS.get(key) || key)
    const anyBachelors = degreeFamilies.any_bachelors.includes(professionId)
    return degrees.length > 0 || anyBachelors ? { degrees, anyBachelors } : null
}

// What the mentor is shown: the student-facing record, plus the institution list even before the
// owner has reviewed it (a mentor is the kind of reader that review is waiting for), and the
// study-abroad answer even when it is "not needed" (they may disagree).
const buildSheet = (profession, overrides, studyOverrides) => {
    const facing = studentFacing(applyOverride(profession, overrides.get(profession.id)), studyOverrides)
    const disciplineId = studyPlaces.careers[profession.id]
    const discipline = disciplineId ? disciplineById.get(disciplineId) : null
    const institutions = discipline
        ? applyStudyOverride(discipline.institutions, studyOverrides.places.get(discipline.id)).map((institution) => ({
            name: institution.name,
            city: institution.city || null,
            private: institution.ownership === "private",
            basis: institution.basis,
        }))
        : []
    const abroadRow = abroad.careers[profession.id] || null

    return {
        professionId: profession.id,
        profession: profession.profession,
        sections: {
            what_it_is: { oneLiner: facing.oneLiner, jobRoles: facing.jobRoles },
            path: { steps: facing.pathToEntry, yearsToQualify: facing.yearsToQualify, degreeDependency: facing.degreeDependency },
            exams: {
                exams: facing.exams.map((exam) => ({ name: exam.name, window: exam.window || null, examMonth: exam.examMonth || null })),
                other: [...(facing.otherRoutes.public || []), ...(facing.otherRoutes.private || [])],
            },
            where_to_study: discipline ? { discipline: discipline.name, institutions } : null,
            abroad: abroadRow ? { need: abroadRow.need, stage: abroadRow.stage || null, why: abroadRow.why || null } : null,
            working_abroad: workingAbroadFor(profession.id, studyOverrides.licences),
            degrees: degreesFor(profession.id),
            masters: { afterUndergrad: facing.afterUndergrad || null },
            pay: facing.economics
                ? { costOfEntryLakh: facing.economics.costOfEntryLakh, earlyEarningsLpa: facing.economics.earlyEarningsLpa, midCareerLpa: facing.economics.midCareerLpa }
                : null,
            demand: facing.demand ? { india: facing.demand.india, note: facing.demand.note } : null,
            ai: facing.aiExposure ? { band: facing.aiExposure.band, reason: facing.aiExposure.reason } : null,
            nuances: facing.nuances.map((nuance) => nuance.statement),
        },
        qualities: qualitiesFor(profession.id),
    }
}

// a mentor's answers, whitelisted and checked. Returns { items, skillsMissing } or { error }.
const cleanReview = (body, qualities) => {
    const text = (value, max) => (typeof value === "string" ? value.trim().slice(0, max) : "")
    const link = (value) => {
        const url = text(value, 400)
        if (url === "") return ""
        return /^https:\/\/[^\s]+\.[^\s]+$/.test(url) ? url : null
    }
    const qualitySlugs = new Set(qualities.map((quality) => quality.factor))
    const items = []

    for (const raw of Array.isArray(body.sections) ? body.sections : []) {
        if (!SECTIONS.includes(raw.section)) return { error: "Unknown section" }
        if (!VERDICTS.includes(raw.verdict)) return { error: "Please choose \"Looks right\" or \"Needs a change\"" }
        const sourceUrl = link(raw.sourceUrl)
        if (sourceUrl === null) return { error: "A source link must start with https://" }
        const note = text(raw.note, NOTE_MAX)
        if (raw.verdict === "change" && note.length < 3) return { error: "Please tell us what should change" }
        if (items.some((item) => item.section === raw.section)) return { error: "Each section once, please" }
        items.push({ section: raw.section, verdict: raw.verdict, note, sourceUrl })
    }

    for (const raw of Array.isArray(body.qualities) ? body.qualities : []) {
        if (!qualitySlugs.has(raw.factor)) return { error: "Unknown quality" }
        if (!DIRECTIONS.includes(raw.direction)) return { error: "Please choose about right, higher or lower" }
        if (items.some((item) => item.factor === raw.factor)) return { error: "Each quality once, please" }
        items.push({ section: "qualities", factor: raw.factor, direction: raw.direction, note: text(raw.note, NOTE_MAX), sourceUrl: "" })
    }

    const skillsMissing = text(body.skillsMissing, NOTE_MAX)
    if (items.length === 0 && skillsMissing === "") return { error: "Please answer at least one section" }
    return { items, skillsMissing }
}

// ONLY WHAT SHOULD CHANGE (owner, Round 15): "needs a change", "should be higher / lower", and a skill
// we're missing. Everything a mentor called right stays on their own sheet.
const changesOf = (items, skillsMissing) => [
    ...items
        .filter((item) => item.verdict === "change" || ["higher", "lower"].includes(item.direction))
        .map(({ section, factor, direction, note, sourceUrl }) => ({ section, ...(factor ? { factor, direction } : {}), note: note || "", sourceUrl: sourceUrl || "" })),
    ...(skillsMissing ? [{ section: "skills_missing", note: skillsMissing, sourceUrl: "" }] : []),
]

// One list per profession: this mentor's earlier suggestions are replaced by their latest, everyone
// else's stay — so a second mentor of the same field adds to the same row. Something this mentor
// already had checked (`processed`, Round 16) is not queued again when they re-send the same words.
const mergeSuggestions = (current, mentorId, changes, processed = []) => {
    const done = new Set(processed.filter((suggestion) => String(suggestion.mentor) === String(mentorId)).map(signatureOf))
    return [
        ...(current || []).filter((suggestion) => String(suggestion.mentor) !== String(mentorId)),
        ...changes.filter((change) => !done.has(signatureOf(change))),
    ]
}

// the approved mentor and their profession, or the reason there is no sheet
const loadMentor = async (userId) => {
    const mentor = await Mentor.findOne({ user: userId }).lean()
    if (!mentor) return { problem: "Please complete your mentor profile first" }
    if (mentor.status !== "onboarded") return { problem: "Your profile is still being reviewed — this opens once you're approved" }
    const profession = professionById.get(mentor.professionId)
    if (!profession) return { problem: "Please choose your profession from our list in your profile first" }
    return { mentor, profession }
}


// ========================
// Get My Review Sheet
// ========================

router.get("/getMyReviewSheet", authMiddleware, mentorAuthMiddleware, async (req, res) => {
    try {
        const { problem, profession } = await loadMentor(req.user._id)
        if (problem) {
            return res.status(200).json({ success: true, message: problem, data: { sheet: null, review: null, reason: problem } })
        }

        const [overrides, studyOverrides, review, row] = await Promise.all([
            getOverrides(),
            getStudyOverrides(),
            MentorReview.findOne({ mentor: req.user._id, professionId: profession.id }).lean(),
            ProfessionSuggestions.findOne({ professionId: profession.id }).lean(),
        ])
        const mine = (list) => ((row && row[list]) || []).filter((suggestion) => String(suggestion.mentor) === String(req.user._id))

        return res.status(200).json({
            success: true,
            message: "Review sheet fetched",
            data: {
                sheet: buildSheet(profession, overrides, studyOverrides),
                // the mentor sees their own answers, how many are still waiting for our monthly check and
                // how many have been checked — never another mentor's words
                review: review
                    ? {
                        items: review.items.map(({ decision, ...item }) => item),
                        skillsMissing: review.skillsMissing,
                        submittedAt: review.submittedAt,
                        waiting: mine("mentor_suggestions").length,
                        checked: mine("processed").length,
                    }
                    : null,
            },
        })

    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to fetch the review sheet", error: error.message })
    }
})


// ========================
// Save My Review
// ========================

router.put("/saveMyReview", authMiddleware, mentorAuthMiddleware, async (req, res) => {
    try {
        const { problem, mentor, profession } = await loadMentor(req.user._id)
        if (problem) {
            return res.status(400).json({ success: false, message: problem })
        }

        const cleaned = cleanReview(req.body || {}, qualitiesFor(profession.id))
        if (cleaned.error) {
            return res.status(400).json({ success: false, message: cleaned.error })
        }

        // the profession's one row of suggested changes, with this mentor's part brought up to date
        const row = await ProfessionSuggestions.findOne({ professionId: profession.id }).lean()
        const changes = changesOf(cleaned.items, cleaned.skillsMissing).map((change) => ({ ...change, mentor: req.user._id, mentorName: mentor.name, suggestedAt: new Date() }))
        const waiting = mergeSuggestions(row && row.mentor_suggestions, req.user._id, changes, (row && row.processed) || [])
        await ProfessionSuggestions.findOneAndUpdate(
            { professionId: profession.id },
            { $set: { professionName: profession.profession, mentor_suggestions: waiting } },
            { upsert: true }
        )

        const review = await MentorReview.findOneAndUpdate(
            { mentor: req.user._id, professionId: profession.id },
            {
                $set: {
                    professionName: profession.profession,
                    items: cleaned.items,
                    skillsMissing: cleaned.skillsMissing,
                    status: "open",
                    submittedAt: new Date(),
                },
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        ).lean()

        return res.status(200).json({
            success: true,
            message: `Thank you, ${mentor.name.split(" ")[0]} — we check suggestions against sources on the 1st of each month`,
            data: {
                items: review.items.map(({ decision, ...item }) => item),
                skillsMissing: review.skillsMissing,
                submittedAt: review.submittedAt,
                waiting: waiting.filter((suggestion) => String(suggestion.mentor) === String(req.user._id)).length,
                checked: ((row && row.processed) || []).filter((suggestion) => String(suggestion.mentor) === String(req.user._id)).length,
            },
        })

    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to save your review", error: error.message })
    }
})


// ========================
// Get Suggestions For Admin
// ========================

// Read only (Round 16): per profession, what mentors said that is still waiting for the monthly check,
// and what the check did with the rest — used (with the proposal it became in Data updates) or
// discarded, with Claude's reason. Two or more mentors saying the same thing is marked.
const describe = (suggestion) => (suggestion.section === "qualities"
    ? `${FACTOR_LABELS[suggestion.factor] || suggestion.factor} should be ${suggestion.direction}`
    : suggestion.section.replace(/_/g, " "))

router.get("/getSuggestionsForAdmin", authMiddleware, adminAuthMiddleware, async (req, res) => {
    try {
        const rows = await ProfessionSuggestions.find({ $or: [{ "mentor_suggestions.0": { $exists: true } }, { "processed.0": { $exists: true } }] }).sort({ updatedAt: -1 }).lean()

        return res.status(200).json({
            success: true,
            message: "Mentor suggestions fetched",
            data: rows.map((row) => {
                const levels = new Map(qualitiesFor(row.professionId).map((quality) => [quality.factor, quality.level]))
                const shape = (suggestion) => ({ ...suggestion, what: describe(suggestion), currentLevel: suggestion.factor ? levels.get(suggestion.factor) || null : null })
                const waiting = (row.mentor_suggestions || []).map(shape)
                const counts = {}
                waiting.forEach((suggestion) => { counts[suggestion.what] = (counts[suggestion.what] || 0) + 1 })
                return {
                    professionId: row.professionId,
                    professionName: row.professionName,
                    mentors: new Set([...(row.mentor_suggestions || []), ...(row.processed || [])].map((suggestion) => String(suggestion.mentor))).size,
                    waiting,
                    processed: (row.processed || []).slice(-30).reverse().map(shape),
                    agreement: Object.entries(counts).filter(([, count]) => count >= 2).map(([what, count]) => ({ what, count })),
                }
            }),
        })

    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to fetch mentor suggestions", error: error.message })
    }
})

module.exports = router
module.exports.qualitiesFor = qualitiesFor
module.exports.cleanReview = cleanReview
module.exports.buildSheet = buildSheet
module.exports.SECTIONS = SECTIONS
module.exports.changesOf = changesOf
module.exports.mergeSuggestions = mergeSuggestions
module.exports.workingAbroadFor = workingAbroadFor
module.exports.degreesFor = degreesFor
