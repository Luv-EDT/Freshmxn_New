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

const router = express.Router()

// MENTORS CHECK OUR DATA FOR THEIR OWN PROFESSION (owner, Round 12). An approved mentor sees the
// career they work in the way a student would, section by section, and says "looks right" or
// "needs a change" — plus, for every quality the career is rated on, "about right / should be
// higher / should be lower".
//
// NOTHING HERE CHANGES THE PRODUCT. This router writes only its own rows: the mentor's answers
// (MentorReview) and, since Round 15, ONE ROW PER PROFESSION holding just the changes mentors suggest
// (ProfessionSuggestions — "looks right" never reaches the admin). The admin approves a profession's
// row; its suggestions go out in Export patch (dataUpdatesRouter) for a reviewed data commit and the
// row is empty again. A fixture checks this file never touches an override or a data file.

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

const itemKey = (item) => (item.section === "qualities" ? `qualities:${item.factor}` : item.section)

// ONLY WHAT SHOULD CHANGE (owner, Round 15): "needs a change", "should be higher / lower", and a skill
// we're missing. Everything a mentor called right stays on their own sheet.
const changesOf = (items, skillsMissing) => [
    ...items
        .filter((item) => item.verdict === "change" || ["higher", "lower"].includes(item.direction))
        .map(({ section, factor, direction, note, sourceUrl }) => ({ section, ...(factor ? { factor, direction } : {}), note: note || "", sourceUrl: sourceUrl || "" })),
    ...(skillsMissing ? [{ section: "skills_missing", note: skillsMissing, sourceUrl: "" }] : []),
]

// One list per profession: this mentor's earlier suggestions are replaced by their latest, everyone
// else's stay — so a second mentor of the same field adds to the same row
const mergeSuggestions = (current, mentorId, changes) => [
    ...(current || []).filter((suggestion) => String(suggestion.mentor) !== String(mentorId)),
    ...changes,
]

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

        const [overrides, studyOverrides, review] = await Promise.all([
            getOverrides(),
            getStudyOverrides(),
            MentorReview.findOne({ mentor: req.user._id, professionId: profession.id }).lean(),
        ])

        return res.status(200).json({
            success: true,
            message: "Review sheet fetched",
            data: {
                sheet: buildSheet(profession, overrides, studyOverrides),
                // the mentor sees their own answers and whether our team has looked, not each decision
                review: review
                    ? {
                        items: review.items.map(({ decision, ...item }) => item),
                        skillsMissing: review.skillsMissing,
                        submittedAt: review.submittedAt,
                        locked: review.items.some((item) => item.decision),
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

        const existing = await MentorReview.findOne({ mentor: req.user._id, professionId: profession.id })
        if (existing && existing.items.some((item) => item.decision)) {
            return res.status(400).json({ success: false, message: "Our team has started going through your review, so it can't be changed now. Thank you!" })
        }

        const cleaned = cleanReview(req.body || {}, qualitiesFor(profession.id))
        if (cleaned.error) {
            return res.status(400).json({ success: false, message: cleaned.error })
        }

        // the profession's one row of suggested changes, with this mentor's part brought up to date
        const row = await ProfessionSuggestions.findOne({ professionId: profession.id }).lean()
        const changes = changesOf(cleaned.items, cleaned.skillsMissing).map((change) => ({ ...change, mentor: req.user._id, mentorName: mentor.name, suggestedAt: new Date() }))
        await ProfessionSuggestions.findOneAndUpdate(
            { professionId: profession.id },
            { $set: { professionName: profession.profession, mentor_suggestions: mergeSuggestions(row && row.mentor_suggestions, req.user._id, changes) } },
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
            message: `Thank you, ${mentor.name.split(" ")[0]} — our team will go through it`,
            data: { items: review.items.map(({ decision, ...item }) => item), skillsMissing: review.skillsMissing, submittedAt: review.submittedAt, locked: false },
        })

    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to save your review", error: error.message })
    }
})


// ========================
// Get Suggestions For Admin
// ========================

// One row per profession that has suggestions waiting, each in words the admin can weigh: which
// section or quality, what we say today, and where two or more mentors say the same thing.
router.get("/getSuggestionsForAdmin", authMiddleware, adminAuthMiddleware, async (req, res) => {
    try {
        const rows = await ProfessionSuggestions.find({ "mentor_suggestions.0": { $exists: true } }).sort({ updatedAt: -1 }).lean()

        return res.status(200).json({
            success: true,
            message: "Mentor suggestions fetched",
            data: rows.map((row) => {
                const levels = new Map(qualitiesFor(row.professionId).map((quality) => [quality.factor, quality.level]))
                const counts = {}
                const suggestions = row.mentor_suggestions.map((suggestion) => {
                    const what = suggestion.section === "qualities"
                        ? `${FACTOR_LABELS[suggestion.factor] || suggestion.factor} should be ${suggestion.direction}`
                        : suggestion.section.replace(/_/g, " ")
                    counts[what] = (counts[what] || 0) + 1
                    return { ...suggestion, what, currentLevel: suggestion.factor ? levels.get(suggestion.factor) || null : null }
                })
                return {
                    professionId: row.professionId,
                    professionName: row.professionName,
                    mentors: new Set(suggestions.map((suggestion) => String(suggestion.mentor))).size,
                    suggestions,
                    agreement: Object.entries(counts).filter(([, count]) => count >= 2).map(([what, count]) => ({ what, count })),
                }
            }),
        })

    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to fetch mentor suggestions", error: error.message })
    }
})


// ========================
// Decide Suggestions For Admin
// ========================

// approve → every waiting suggestion for the profession moves to `approved` (Export patch carries
// them to a reviewed data commit) and the row's list is empty again. drop → one suggestion (by its
// place in the list) is removed as not right. Either way the mentors' own sheets lock for those
// answers, so a re-save cannot send them back.
router.put("/decideSuggestionsForAdmin/:professionId", authMiddleware, adminAuthMiddleware, async (req, res) => {
    try {
        const { action, index } = req.body || {}
        if (!["approve", "drop"].includes(action)) {
            return res.status(400).json({ success: false, message: "Action must be approve or drop" })
        }

        const row = await ProfessionSuggestions.findOne({ professionId: req.params.professionId }).lean()
        const pending = (row && row.mentor_suggestions) || []
        const chosen = action === "approve" ? pending : pending.filter((_, position) => position === Number(index))
        if (chosen.length === 0) {
            return res.status(400).json({ success: false, message: "There is nothing waiting to decide here" })
        }

        const now = new Date()
        await ProfessionSuggestions.updateOne(
            { _id: row._id },
            {
                $set: {
                    mentor_suggestions: pending.filter((suggestion) => !chosen.includes(suggestion)),
                    approved: action === "approve" ? [...(row.approved || []), ...chosen.map((suggestion) => ({ ...suggestion, approvedAt: now }))] : row.approved || [],
                },
            }
        )

        // lock what was decided on each mentor's own sheet (MentorReview), so it cannot come back
        const decision = action === "approve" ? "accepted" : "rejected"
        await Promise.all([...new Set(chosen.map((suggestion) => String(suggestion.mentor)))].map(async (mentorId) => {
            const review = await MentorReview.findOne({ mentor: mentorId, professionId: row.professionId })
            if (!review) return
            const keys = new Set(chosen.filter((suggestion) => String(suggestion.mentor) === mentorId).map(itemKey))
            review.items.forEach((item) => { if (keys.has(itemKey(item))) item.decision = decision })
            review.status = review.items.every((item) => item.decision || item.verdict === "right" || item.direction === "right") ? "reviewed" : "open"
            review.markModified("items")
            await review.save()
        }))

        return res.status(200).json({
            success: true,
            message: action === "approve" ? `Approved — ${chosen.length} ${chosen.length === 1 ? "change goes" : "changes go"} into Export patch` : "Dropped",
            data: { professionId: row.professionId, waiting: pending.length - chosen.length },
        })

    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to save the decision", error: error.message })
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
