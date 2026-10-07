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
const { stackOf, mergeOpinions, dueTopics, topicOf } = require("../housekeeping/mentorPass")

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
// ONE QUEUE, AND NOTHING FORGOTTEN (owner, Rounds 16–17). Mentors' opinions are kept for good, stacked
// per topic; a mentor answering a topic again replaces only their own earlier opinion on it. Once a
// month Claude weighs the topics with new input (housekeeping/mentorPass.js) and what it proposes
// goes to Data updates, where the admin decides. The admin's Mentor reviews tab only shows the stacks;
// the one thing an admin can change here is "Remove as wrong" on a single opinion, which is logged.

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
// firmness is a position too since Round 20 (owner): a career can want a firm view or an open one
const FIRMNESS_POSITION = { High: "holds firmly to a view", Medium: "somewhere in between", Low: "open to changing a view" }
const describeLevel = (slug, value) => (slug === "uncertainty_tolerance" ? UNCERTAINTY_POSITION[levelOf(value)]
    : slug === "firmness" ? FIRMNESS_POSITION[levelOf(value)]
        : levelOf(value))

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

// A mentor's opinions from their answers (Round 17): "needs a change" and "should be higher / lower"
// with their notes, a missing skill — and "looks right" / "about right" too, as agreement with what we
// show, because the consensus counts both sides.
const opinionsOf = (items, skillsMissing) => [
    ...items.map(({ section, verdict, factor, direction, note, sourceUrl }) => {
        const agrees = section === "qualities" ? direction === "right" : verdict === "right"
        return {
            section,
            ...(factor ? { factor } : {}),
            ...(factor && !agrees ? { direction } : {}),
            agrees,
            note: agrees ? "" : note || "",
            sourceUrl: agrees ? "" : sourceUrl || "",
        }
    }),
    ...(skillsMissing ? [{ section: "skills_missing", agrees: false, note: skillsMissing, sourceUrl: "" }] : []),
]

// how this mentor's opinions stand: still waiting for the monthly look, or already weighed
const standingOf = (row, mentorId) => {
    const stack = stackOf(row)
    const due = new Set(dueTopics(stack, row && row.topics).map((topic) => topic.key))
    const mine = stack.filter((opinion) => String(opinion.mentor) === String(mentorId) && !opinion.agrees)
    return { waiting: mine.filter((opinion) => due.has(topicOf(opinion))).length, checked: mine.filter((opinion) => !due.has(topicOf(opinion))).length }
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

        return res.status(200).json({
            success: true,
            message: "Review sheet fetched",
            data: {
                sheet: buildSheet(profession, overrides, studyOverrides),
                // the mentor sees their own answers, how many of their suggestions wait for the monthly
                // look and how many have been weighed — never another mentor's words
                review: review
                    ? {
                        items: review.items.map(({ decision, ...item }) => item),
                        skillsMissing: review.skillsMissing,
                        submittedAt: review.submittedAt,
                        ...standingOf(row, req.user._id),
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
        const opinions = opinionsOf(cleaned.items, cleaned.skillsMissing).map((opinion) => ({ ...opinion, mentorName: mentor.name }))
        const stack = mergeOpinions(stackOf(row), req.user._id, opinions)
        await ProfessionSuggestions.findOneAndUpdate(
            { professionId: profession.id },
            { $set: { professionName: profession.profession, mentor_suggestions: stack, processed: [] } },
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
            message: `Thank you, ${mentor.name.split(" ")[0]} — we weigh what mentors say on the 1st of each month`,
            data: {
                items: review.items.map(({ decision, ...item }) => item),
                skillsMissing: review.skillsMissing,
                submittedAt: review.submittedAt,
                ...standingOf({ ...(row || {}), mentor_suggestions: stack, processed: [] }, req.user._id),
            },
        })

    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to save your review", error: error.message })
    }
})


// ========================
// Get Suggestions For Admin
// ========================

// Read only: per profession, every topic's stack — who wants a change, who agrees with what we show —
// and what the monthly look concluded and the admin decided. Topics where two or more mentors want
// the same change are marked.
const describe = (key) => (key.startsWith("qualities:") ? (FACTOR_LABELS[key.slice(10)] || key.slice(10)) : key.replace(/_/g, " "))

const topicsOf = (row) => {
    const stack = stackOf(row)
    const due = new Set(dueTopics(stack, row.topics).map((topic) => topic.key))
    const history = new Map((row.topics || []).map((topic) => [topic.key, topic]))
    const levels = new Map(qualitiesFor(row.professionId).map((quality) => [quality.factor, quality.level]))
    const byKey = new Map()
    stack.forEach((opinion) => byKey.set(topicOf(opinion), [...(byKey.get(topicOf(opinion)) || []), opinion]))
    return [...byKey.entries()].map(([key, opinions]) => {
        const before = history.get(key) || {}
        return {
            key,
            what: describe(key),
            currentLevel: key.startsWith("qualities:") ? levels.get(key.slice(10)) || null : null,
            opinions,
            wantChange: opinions.filter((opinion) => !opinion.agrees).length,
            agreeToday: opinions.filter((opinion) => opinion.agrees).length,
            due: due.has(key),
            lastCheckedAt: before.lastCheckedAt || null,
            lastOutcome: before.lastOutcome || null,
            adminDecision: before.adminDecision || null,
        }
    }).sort((left, right) => right.wantChange - left.wantChange || left.key.localeCompare(right.key))
}

router.get("/getSuggestionsForAdmin", authMiddleware, adminAuthMiddleware, async (req, res) => {
    try {
        const rows = await ProfessionSuggestions.find({ $or: [{ "mentor_suggestions.0": { $exists: true } }, { "processed.0": { $exists: true } }] }).sort({ updatedAt: -1 }).lean()

        return res.status(200).json({
            success: true,
            message: "Mentor suggestions fetched",
            data: rows.map((row) => {
                const topics = topicsOf(row)
                return {
                    professionId: row.professionId,
                    professionName: row.professionName,
                    mentors: new Set(stackOf(row).map((opinion) => String(opinion.mentor))).size,
                    topics,
                    removed: (row.removedOpinions || []).slice(-20).reverse(),
                }
            }),
        })

    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to fetch mentor suggestions", error: error.message })
    }
})


// ========================
// Get Unchanged Topics For Admin
// ========================

// For the monthly review in Data updates: the topics the last look decided NOT to change (within the
// last 45 days), each with Claude's reason and its stack, so the admin can remove anything clearly wrong.
router.get("/getUnchangedTopicsForAdmin", authMiddleware, adminAuthMiddleware, async (req, res) => {
    try {
        const since = Date.now() - 45 * 24 * 60 * 60 * 1000
        const rows = await ProfessionSuggestions.find({ "topics.0": { $exists: true } }).lean()
        const unchanged = rows.flatMap((row) => topicsOf(row)
            .filter((topic) => topic.lastOutcome && topic.lastOutcome.decision === "not_changed" && new Date(topic.lastCheckedAt).getTime() >= since)
            .map((topic) => ({ professionId: row.professionId, professionName: row.professionName, ...topic })))

        return res.status(200).json({ success: true, message: "Unchanged topics fetched", data: unchanged })

    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to fetch the unchanged topics", error: error.message })
    }
})


// ========================
// Remove Opinion For Admin
// ========================

// "Remove as wrong" (owner, Round 17): the ONLY way a mentor's opinion leaves the stack, done by the
// admin in the monthly review. Logged with who removed it and when.
router.put("/removeOpinionForAdmin/:professionId", authMiddleware, adminAuthMiddleware, async (req, res) => {
    try {
        const { mentor, topic } = req.body || {}
        if (!mentor || typeof topic !== "string" || topic === "") {
            return res.status(400).json({ success: false, message: "Say which mentor's opinion on which topic" })
        }

        const row = await ProfessionSuggestions.findOne({ professionId: req.params.professionId }).lean()
        const stack = stackOf(row)
        const target = stack.find((opinion) => String(opinion.mentor) === String(mentor) && topicOf(opinion) === topic)
        if (!target) {
            return res.status(404).json({ success: false, message: "That opinion is not in the stack" })
        }

        await ProfessionSuggestions.updateOne({ _id: row._id }, {
            $set: {
                mentor_suggestions: stack.filter((opinion) => opinion !== target),
                processed: [],
                removedOpinions: [...(row.removedOpinions || []), {
                    mentorName: target.mentorName,
                    topic,
                    note: target.agrees ? "agrees with what we show" : `${target.direction ? `should be ${target.direction}. ` : ""}${target.note || ""}`.trim(),
                    at: new Date(),
                    by: req.user.email || req.user.name || "admin",
                }].slice(-200),
            },
        })

        return res.status(200).json({ success: true, message: "Removed — it no longer counts", data: { professionId: row.professionId, topic } })

    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to remove the opinion", error: error.message })
    }
})

module.exports = router
module.exports.qualitiesFor = qualitiesFor
module.exports.cleanReview = cleanReview
module.exports.buildSheet = buildSheet
module.exports.SECTIONS = SECTIONS
module.exports.opinionsOf = opinionsOf
module.exports.topicsOf = topicsOf
module.exports.workingAbroadFor = workingAbroadFor
module.exports.degreesFor = degreesFor
