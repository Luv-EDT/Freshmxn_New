const express = require("express")
const MentorReview = require("../model/mentorReviewsModel")
const Mentor = require("../model/mentorsModel")
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
// "needs a change" — plus, for the qualities the career needs most, "about right / should be
// higher / should be lower".
//
// NOTHING HERE CHANGES THE PRODUCT. This router writes only MentorReview rows. The admin decides
// each item; accepted ones go out in Export patch (dataUpdatesRouter) for a reviewed data commit.
// A fixture checks this file never touches an override or a data file.

const taxonomy = require("../data/ALL-professions.json")
const baseline = require("../data/baseline_rating.json")
const abroad = require("../data/abroad.json")

const professionById = new Map(taxonomy.professions.map((profession) => [profession.id, profession]))
const ratingById = new Map(baseline.ratings.map((rating) => [rating.id, rating]))

const SECTIONS = ["what_it_is", "path", "exams", "where_to_study", "abroad", "masters", "pay", "demand", "ai", "nuances"]
const VERDICTS = ["right", "change"]
const DIRECTIONS = ["right", "higher", "lower"]
const DECISIONS = ["accepted", "noted", "rejected"]
const QUALITY_COUNT = 8
const NOTE_MAX = 600

// The words a mentor sees for a factor's demand — never the number behind it. Uncertainty
// tolerance is a position, not a level (house rule), so it gets its own three words.
const levelOf = (value) => (value >= 6.67 ? "High" : value >= 3.33 ? "Medium" : "Low")
const UNCERTAINTY_POSITION = { High: "comfortable not knowing", Medium: "somewhere in between", Low: "prefers a clear plan" }
const describeLevel = (slug, value) => (slug === "uncertainty_tolerance" ? UNCERTAINTY_POSITION[levelOf(value)] : levelOf(value))

// the qualities that matter most for this career — the top factors by weight in the baseline rating
const topQualities = (professionId) => {
    const rating = ratingById.get(professionId)
    if (!rating) return []
    return Object.entries(rating.weights || {})
        .filter(([slug]) => typeof (rating.factors || {})[slug] === "number" && FACTOR_LABELS[slug])
        .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
        .slice(0, QUALITY_COUNT)
        .map(([slug]) => ({ factor: slug, label: FACTOR_LABELS[slug], level: describeLevel(slug, rating.factors[slug]) }))
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
            masters: { afterUndergrad: facing.afterUndergrad || null },
            pay: facing.economics
                ? { costOfEntryLakh: facing.economics.costOfEntryLakh, earlyEarningsLpa: facing.economics.earlyEarningsLpa, midCareerLpa: facing.economics.midCareerLpa }
                : null,
            demand: facing.demand ? { india: facing.demand.india, note: facing.demand.note } : null,
            ai: facing.aiExposure ? { band: facing.aiExposure.band, reason: facing.aiExposure.reason } : null,
            nuances: facing.nuances.map((nuance) => nuance.statement),
        },
        qualities: topQualities(profession.id),
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

        const cleaned = cleanReview(req.body || {}, topQualities(profession.id))
        if (cleaned.error) {
            return res.status(400).json({ success: false, message: cleaned.error })
        }

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
// Get Reviews For Admin
// ========================

router.get("/getReviewsForAdmin", authMiddleware, adminAuthMiddleware, async (req, res) => {
    try {
        const reviews = await MentorReview.find({ submittedAt: { $ne: null } })
            .populate("mentor", "name email")
            .sort({ status: 1, submittedAt: -1 })
            .lean()

        // where mentors of the same profession agree — "2 mentors say sustained focus should be higher"
        const agreement = {}
        reviews.forEach((review) => {
            review.items.forEach((item) => {
                const key = item.section === "qualities"
                    ? `${FACTOR_LABELS[item.factor] || item.factor} should be ${item.direction === "right" ? "as it is" : item.direction}`
                    : `${item.section.replace(/_/g, " ")} ${item.verdict === "right" ? "looks right" : "needs a change"}`
                const bucket = agreement[review.professionId] || (agreement[review.professionId] = {})
                bucket[key] = (bucket[key] || 0) + 1
            })
        })

        return res.status(200).json({
            success: true,
            message: "Mentor reviews fetched",
            data: {
                reviews: reviews.map((review) => ({
                    ...review,
                    items: review.items.map((item) => ({
                        ...item,
                        key: itemKey(item),
                        factorLabel: item.factor ? FACTOR_LABELS[item.factor] || item.factor : null,
                        // what we say today, so the admin can weigh "should be higher" against it
                        currentLevel: item.factor ? (topQualities(review.professionId).find((quality) => quality.factor === item.factor) || {}).level || null : null,
                    })),
                })),
                agreement: Object.fromEntries(Object.entries(agreement).map(([id, counts]) => [
                    id,
                    Object.entries(counts).filter(([, count]) => count >= 2).map(([what, count]) => ({ what, count })),
                ])),
            },
        })

    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to fetch mentor reviews", error: error.message })
    }
})


// ========================
// Decide Review Item For Admin
// ========================

// One item at a time: accepted (goes into Export patch), noted (kept, nothing to change) or
// rejected. When every item is decided the review is "reviewed".
router.put("/decideReviewItemForAdmin/:id", authMiddleware, adminAuthMiddleware, async (req, res) => {
    try {
        const { key, decision } = req.body || {}
        if (!DECISIONS.includes(decision)) {
            return res.status(400).json({ success: false, message: "Decision must be accepted, noted or rejected" })
        }

        const review = await MentorReview.findById(req.params.id)
        if (!review) {
            return res.status(404).json({ success: false, message: "Review not found" })
        }

        const item = review.items.find((entry) => itemKey(entry) === key)
        if (!item) {
            return res.status(400).json({ success: false, message: "That item is not in this review" })
        }

        item.decision = decision
        if (typeof req.body.adminNote === "string") review.adminNote = req.body.adminNote.trim().slice(0, NOTE_MAX)
        review.status = review.items.every((entry) => entry.decision) ? "reviewed" : "open"
        review.markModified("items")
        await review.save()

        return res.status(200).json({ success: true, message: "Decision saved", data: review })

    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to save the decision", error: error.message })
    }
})

module.exports = router
module.exports.topQualities = topQualities
module.exports.cleanReview = cleanReview
module.exports.buildSheet = buildSheet
module.exports.SECTIONS = SECTIONS
