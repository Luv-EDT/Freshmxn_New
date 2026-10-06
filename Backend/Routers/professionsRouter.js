const express = require("express")
const authMiddleware = require("../middlewares/authMiddleware")
const requireDiscovery = require("../middlewares/requireDiscovery")
const { FACTOR_LABELS } = require("../workers/reportComposer")

const router = express.Router()

// the 223-profession taxonomy, read once at startup.
const taxonomy = require("../data/ALL-professions.json")
const industrialSectors = require("../data/industrial_sectors.json")
const entranceGates = require("../data/entrance_gates.json")
const filterRules = require("../data/filter_rules.json")
const blueCollar = require("../data/blue_collar.json")
const abroad = require("../data/abroad.json")
const abroadWork = require("../data/abroad_work.json")
const studySources = require("../data/study_sources.json")
const subjectRoutes = require("../data/subject_routes.json")
const { applyOverride, getOverrides } = require("../utils/professionOverrides")
const { examsFor } = require("../utils/examCalendar")
const { studyPlacesFor, getStudyOverrides } = require("../utils/studyPlaces")
const { industryByCode } = require("../utils/industries")

// The full records, for /getProfession. The slim projection below is what /search walks.
const fullById = new Map(taxonomy.professions.map((profession) => [profession.id, profession]))

const allProfessions = taxonomy.professions.map((profession) => ({
    id: profession.id,
    profession: profession.profession,
    professionalSector: profession.professional_sector,
    jobRoles: profession.job_roles || [],
}))

// code → name, across both the 38 NSDC councils and the 8 EXT- tags. A student must never see
// "CGSC" — it is a lookup key, and rendering it raw is the same class of leak as a factor slug.
const SECTOR_NAMES = new Map([
    ...(industrialSectors.nsdc_sector_skill_councils || []).map((row) => [row.code, row.name]),
    ...(industrialSectors.extension_tags || []).map((row) => [row.code, row.name]),
])

// Sectors 8-18 carry their own number inside the string — "8. Design & Creative Arts". Rendering
// that raw puts a stray "8." on the student's screen.
const cleanSector = (name) => String(name || "").replace(/^\s*\d+\.\s*/, "")

// A union type: "any", or an array of subject slugs. journey.js guards with Array.isArray and so
// must anything that renders it.
const asArray = (value) => {
    if (value === null || value === undefined) return []
    return Array.isArray(value) ? value : [value]
}

// ── REPORT TAGS FROM THE REVIEWED DATA FILES (Round 9) ─────────────────────────────────────────
//
// BLUE-COLLAR is a reviewed list (data/blue_collar.json), not a live rule — the label carries a
// social meaning, so a person owns it. The report tags these careers and lets a student leave them
// out (off by default).
const BLUE_COLLAR = new Set(blueCollar.ids)

// CORE ENGINEERING is filter_rules.json's `core_engineering_track`, computed here from the rule as
// the file writes it: engineering_gated OR in also_include. engineering_gated is sector 2, OR a
// class-12 prerequisite of physics AND maths, OR an engineering route in path_to_entry (B.Tech /
// B.E. / polytechnic, or an ITI in a named engineering trade — never a bare "ITI" or "diploma",
// which the file records once admitted Tailor & Garment Maker).
//
// ⚠ It admits more than the file's own note implies (about 63 careers here against "180-odd removed"):
// the tool that produced that count is not in this repo, and B.Tech routes into software and science
// careers pass the rule as written. It is only ever used to REORDER ("show first"), never to hide,
// so an over-inclusive list costs a student nothing. Tighten it in filter_rules.json, not here.
const ENGINEERING_TRADES = /fitter|turner|electrician|mechanic|welder|machinist|draughtsman|instrumentation|refrigeration|plumbing|carpentry|electronics/i
const ALSO_ENGINEERING = new Set(Object.keys(
    (filterRules.preference_filters.presets.core_engineering_track || {}).also_include || {}
))

const isEngineeringGated = (profession) => {
    if (profession.professional_sector_id === 2) return true

    const required = profession.class12_prerequisite
    if (Array.isArray(required) && required.includes("physics") && required.includes("maths")) return true

    return (profession.path_to_entry || []).some((step) => {
        const text = String(step.requirement || "")
        if (/\bB\.?\s?Tech\b|\bB\.E\.|\bpolytechnic\b/i.test(text)) return true
        return /\bITI\b/.test(text) && ENGINEERING_TRADES.test(text)
    })
}

const isCoreEngineering = (profession) => isEngineeringGated(profession) || ALSO_ENGINEERING.has(profession.profession)

// `ai_exposure.work_composition` in words. The five shares always sum to 100; the two largest name
// what the work is mostly made of, which is what decides how much of it AI touches.
const WORK_PARTS = {
    knowledge_foundational: "deep knowledge",
    knowledge_retrievable: "looking things up",
    skill_physical: "hands-on physical work",
    skill_digital: "screen-based skill",
    clarity: "judgement in unclear situations",
}

const workMostly = (composition) => Object.entries(composition || {})
    .filter(([key, share]) => WORK_PARTS[key] && typeof share === "number" && share > 0)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 2)
    .map(([key]) => WORK_PARTS[key])

const factStatus = (professionId, field, approvedOverride) => {
    if (approvedOverride) return { status: "checked", checkedOn: new Date(approvedOverride.approvedAt).toISOString().slice(0, 10) }
    const row = studySources.careers[professionId] && studySources.careers[professionId][field]
    return row ? { status: row.status, checkedOn: row.status === "judgement" ? null : row.checkedOn } : { status: "judgement", checkedOn: null }
}

const labelFactors = (slugs) => asArray(slugs).map((slug) => FACTOR_LABELS[slug] || String(slug).replace(/_/g, " "))

// THE NOTES A STUDENT READS ARE WRITTEN FOR THEM (owner, Round 18). Every one of the 438 nuances
// was rewritten in one or two plain sentences that a Class 9 student and a working professional can
// both follow, and stored beside the original as `nuances[i].student`. The original `statement` —
// written for whoever built the data, full of "the merge test", "Sector 5" and field names — stays
// in the file for the admin and is never served. Notes that only explain how the data was built
// have `student: null` and are not shown at all.
//
// The two screens below stay as a safety net on the student text itself — a sentence addressed to a
// builder, or any snake_case identifier, still never reaches a student's screen:
//   BUILDER_MARKERS   sentences addressed to whoever is building this, not to a student.
//   RAW_IDENTIFIER    any snake_case token — `mid_career`, `admin_review`, `india_demand`.
const BUILDER_MARKERS = /audit\.py|this record carries|the application must|compensation filter|tier [ABC] rather than|rejected by audit|admin review|DECISIONS\.md|merge test/i
const RAW_IDENTIFIER = /\b[a-z]+_[a-z_]+\b/

// AND A FIELD WHITELIST, kept from before (a whitelist, not a blacklist): a note on a new `field`
// is excluded until someone decides it is safe. "filter" and "verification" notes are about how the
// data was built.
const STUDENT_SAFE_NUANCE_FIELDS = [
    "profession", "job_roles", "role_spread", "professional_sector", "industrial_sectors",
    "degree_dependency", "class12_prerequisite", "path_to_entry", "entrance_exams",
    "entry_competition", "entry_window", "licensing_body", "years_to_qualify",
    "economics", "demand_signal", "after_undergrad", "self_employment", "ai_exposure",
    "mid_stream_entry",
]

const nuanceIsStudentSafe = (nuance) => (
    STUDENT_SAFE_NUANCE_FIELDS.includes(nuance.field)
    && typeof nuance.student === "string"
    && nuance.student.trim() !== ""
    && !BUILDER_MARKERS.test(nuance.student)
    && !RAW_IDENTIFIER.test(nuance.student)
)

// The nuance's `field` says which part of the record it annotates — but it says it in the
// taxonomy's own field names. The card needs to know where to attach it; the student does not need
// to see `entry_competition`. Translated to a section id at the boundary, like everything else.
//
// ONE SECTION PER PART OF THE CARD (owner, Round 18): "each field's nuance should show in that field
// as a note", so a note about Class 12 subjects sits under the subjects, one about freelancing under
// "Can I start my own business or freelance?". A note whose part isn't shown goes to "Worth knowing".
const NUANCE_SECTION = {
    path_to_entry: "path", years_to_qualify: "path",
    class12_prerequisite: "subjects",
    degree_dependency: "degree", licensing_body: "degree",
    mid_stream_entry: "move_in",
    after_undergrad: "masters",
    entry_window: "deadline",
    entrance_exams: "exams", entry_competition: "exams",
    industrial_sectors: "where", professional_sector: "where",
    profession: "what",
    job_roles: "roles", role_spread: "roles",
    economics: "pay",
    self_employment: "own_business",
    demand_signal: "demand",
    ai_exposure: "ai",
}

// What a student is allowed to see. A PROJECTION, NEVER THE RAW RECORD — the raw one carries
// `admin_review` (56 records flagged for internal review), `verification` (judgment-vs-verified
// status and sources), the `filter` boolean, and the internals of `entry_competition`. None of that
// is student-facing, and an endpoint that serves the whole object leaks all of it the first time
// somebody adds a field. Where the report needs something from them it gets a DERIVED value only:
// `checked` (verified or estimate), `payCaution` (from `filter`), never the record itself.
// the countries in abroad_work.json order, with only the licence rows a student may see
const goingAbroadFor = (professionId, licenceOverrides = new Map()) => {
    const career = abroadWork.careers[professionId]
    if (!career) return null
    const rows = abroadWork.licences[professionId] || {}
    return {
        portability: career.portability,
        note: career.note,
        countries: abroadWork.countries.map((country) => {
            const override = licenceOverrides.get(`${professionId}:${country.code}`)
            const row = override && override.approvedAt && override.values ? { ...rows[country.code], ...override.values, status: "supported" } : rows[country.code]
            const licence = row && row.status === "supported" && typeof row.url === "string" && row.url.startsWith("https://")
                ? { body: row.body, exam: row.exam, steps: row.steps, url: row.url }
                : null
            return { code: country.code, name: country.name, licence, recognition: country.recognition }
        }),
    }
}

const studentFacing = (profession, studyOverrides) => {
    // { exams, places } Maps or nothing — `.map(studentFacing)` passes the array index here
    const layers = studyOverrides && studyOverrides.exams instanceof Map ? studyOverrides : { exams: new Map(), places: new Map(), facts: new Map() }
    const factOverride = layers.facts ? layers.facts.get(profession.id) : null
    const factValues = factOverride && factOverride.values ? factOverride.values : {}
    const afterUndergrad = factValues.after_undergrad || profession.after_undergrad
    const abroadRow = factValues.abroad || abroad.careers[profession.id]
    const calendarExams = examsFor(profession, layers.exams)
    const gate = profession.entry_competition && entranceGates.gates
        ? entranceGates.gates[profession.entry_competition.primary_gate]
        : null

    return {
        id: profession.id,
        profession: profession.profession,
        professionalSector: cleanSector(profession.professional_sector),
        oneLiner: profession.one_liner,
        jobRoles: profession.job_roles || [],

        // in the words a person would say — "Agriculture", not "Agriculture Skill Council of India"
        // (owner, Round 18: easy terms)
        industries: (profession.industrial_sectors || []).map((code) => (industryByCode.get(code) || {}).name || SECTOR_NAMES.get(code) || code),

        pathToEntry: (profession.path_to_entry || []).map((step) => ({
            step: step.step,
            stage: step.stage,
            requirement: step.requirement,
        })),

        yearsToQualify: profession.years_to_qualify,
        degreeDependency: profession.degree_dependency,
        afterUndergrad,
        midStreamEntry: profession.mid_stream_entry,
        class12Prerequisite: asArray(profession.class12_prerequisite),
        licensingBody: profession.licensing_body || null,

        entranceExams: profession.entrance_exams
            ? {
                publicRoutes: profession.entrance_exams.public_routes || [],
                privateEntrances: profession.entrance_exams.private_entrances || [],
                note: profession.entrance_exams.note || null,
            }
            : null,

        // The same exams from the exam calendar (Round 11): who runs each, its official site, and —
        // once checked — when it USUALLY opens. `otherRoutes` are the spellings with no calendar row
        // (a state recruitment, an institute's own admission), shown as plain text.
        exams: calendarExams.exams,
        otherRoutes: calendarExams.unlisted,

        // Where to study (Round 11): official links always; the institution list once the owner has
        // reviewed it. null for careers with no formal programme to point at.
        studyPlaces: studyPlacesFor(profession.id, layers.places, layers.cutoffs || new Map()),

        // Class 11–12 subjects PER ROUTE (owner, Round 18) — for a career that takes any stream but
        // whose usual routes include a degree that needs particular subjects. null for the rest.
        subjectRoutes: subjectRoutes.careers[profession.id] || null,

        // The report's "Studying abroad helps" filter (owner, Round 18) — the same reviewed file
        studyAbroadHelps: Boolean(abroadRow && abroadRow.need !== "not_needed"),

        // Is studying abroad needed (Round 11)? null when it is not — the card then says nothing.
        // Never a ranking input: matching does not read data/abroad.json.
        abroad: abroadRow && abroadRow.need !== "not_needed"
            ? { need: abroadRow.need, stage: abroadRow.stage, why: abroadRow.why }
            : null,

        // Going abroad to WORK (Round 13): how the career travels, and — for a licensed one — what
        // each of the five countries asks first. Only rows backed by the licensing body's own site
        // are served; the report shows this only to a student who said they hope to go abroad.
        goingAbroad: goingAbroadFor(profession.id, layers.licences),

        // What backs those two lines (Round 12, data/study_sources.json): "checked" = an official
        // rule, "supported" = published evidence, "judgement" = our estimate. An admin-approved
        // change from the study bot came with sources, so it counts as checked on its approval date.
        studyFacts: {
            masters: factStatus(profession.id, "after_undergrad", factOverride && factValues.after_undergrad ? factOverride : null),
            abroad: factStatus(profession.id, "abroad", factOverride && factValues.abroad ? factOverride : null),
        },

        // Only the facing numbers off the gate record — how hard it is to get in, which is what a
        // student is asking. Not its verification block or its internal next_stage wiring.
        entryGate: gate
            ? {
                name: gate.name,
                applicantsPerSeat: gate.applicants_per_seat,
                preparationYears: gate.preparation_years,
                note: gate.note || null,
                // A private gate's odds mean nothing without its price (entrance_gates.json).
                typicalTotalCostLakh: typeof gate.typical_total_cost_lakh === "number" ? gate.typical_total_cost_lakh : null,
                // Plan B: where the preparation still counts if this exam does not work out.
                ifUnsuccessful: gate.if_unsuccessful && Array.isArray(gate.if_unsuccessful.transfers_to)
                    ? gate.if_unsuccessful.transfers_to
                    : [],
            }
            : null,

        entryWindow: profession.entry_window
            ? {
                maxAge: profession.entry_window.max_age,
                maxYearsSinceClass12: profession.entry_window.max_years_since_class12,
                isHardBlock: profession.entry_window.is_hard_block,
                constrainedRoute: profession.entry_window.constrained_route,
                bypass: asArray(profession.entry_window.bypass),
            }
            : null,

        economics: profession.economics
            ? {
                costOfEntryLakh: profession.economics.cost_of_entry_lakh,
                earlyEarningsLpa: profession.economics.early_earnings_lpa,
                midCareerLpa: profession.economics.mid_career_lpa,
                midCareerMidpoint: profession.economics.mid_career_midpoint,
                // `distribution` travels because it is what says the midpoint is meaningless for
                // nine professions. Removing it would leave a number with no warning attached.
                distribution: profession.economics.distribution,
                basis: profession.economics.basis,
                // "estimate" vs "checked" — 155 of 223 pay blocks are judgment. The student is told
                // which, never the sources or the review flags behind it.
                checked: Boolean(profession.economics.verification && profession.economics.verification.status === "verified"),
                checkedOn: profession.economics.verification && profession.economics.verification.status === "verified"
                    ? profession.economics.verification.checked_on || null
                    : null,
            }
            : null,

        // filter_rules.json's compensation rule, shown as a caution — NEVER used to hide or rank.
        // `filter` is the derived flag; false means mid-career pay stays low (see the rule there).
        payCaution: profession.filter === false,

        blueCollar: BLUE_COLLAR.has(profession.id),
        coreEngineering: isCoreEngineering(profession),

        demand: profession.demand_signal
            ? {
                india: profession.demand_signal.india_demand,
                pathway: profession.demand_signal.pathway,
                note: profession.demand_signal.note || null,
            }
            : null,

        aiExposure: profession.ai_exposure
            ? {
                band: profession.ai_exposure.band,
                raw: profession.ai_exposure.exposure_raw,
                reason: profession.ai_exposure.reason,
                workComposition: profession.ai_exposure.work_composition,
                workMostly: workMostly(profession.ai_exposure.work_composition),
                // Work where a named, licensed person must sign off — accountability AI cannot hold.
                legalAccountability: Boolean(profession.ai_exposure.legal_accountability),
            }
            : null,

        selfEmployment: profession.self_employment
            ? { likelihood: profession.self_employment.likelihood, route: profession.self_employment.route || null }
            : null,

        // The factor slugs inside deviating_roles are labelled here for the same reason
        // reportsRouter labels the ranking's: the page must never receive an identifier it could
        // render. All 19 slugs used here are covered by FACTOR_LABELS.
        roleSpread: profession.role_spread
            ? {
                spread: profession.role_spread.spread,
                deviatingRoles: (profession.role_spread.deviating_roles || []).map((group) => ({
                    roles: group.roles || [],
                    higher: labelFactors(group.higher),
                    lower: labelFactors(group.lower),
                    higherSlugs: asArray(group.higher),
                    lowerSlugs: asArray(group.lower),
                    why: group.why,
                })),
            }
            : null,

        nuances: (profession.nuances || [])
            .filter(nuanceIsStudentSafe)
            .map((nuance) => ({ section: NUANCE_SECTION[nuance.field] || "other", statement: nuance.student })),

        taxonomyVersion: taxonomy.generated_on || null,
    }
}


// ========================
// Search Professions
// ========================

// autocomplete for the aspirational-professions question. Matches profession names first, then job roles.
router.get("/search", authMiddleware, async (req, res) => {
    try {
        const query = String(req.query.q || "").trim().toLowerCase()

        if (query.length < 2) {
            return res.status(200).json({
                success: true,
                message: "Type at least 2 letters",
                data: [],
            })
        }

        const scored = []

        allProfessions.forEach((profession) => {
            const name = profession.profession.toLowerCase()
            const matchedRole = profession.jobRoles.find((role) => role.toLowerCase().includes(query))

            let score = 0
            if (name.startsWith(query)) score = 3
            else if (name.includes(query)) score = 2
            else if (matchedRole) score = 1

            if (score > 0) {
                scored.push({
                    id: profession.id,
                    profession: profession.profession,
                    professionalSector: profession.professionalSector,
                    matchedRole: score === 1 ? matchedRole : null,
                    score,
                })
            }
        })

        const results = scored
            .sort((a, b) => b.score - a.score || a.profession.localeCompare(b.profession))
            .slice(0, 10)

        return res.status(200).json({
            success: true,
            message: "Professions fetched successfully",
            data: results,
        })

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to search professions",
            error: error.message,
        })
    }
})


// ========================
// Options for the pickers (Round 12)
// ========================

// Every career with its job roles, and the industry list — what a Mentor Only student and a mentor
// filling their profile choose from. Logged-in only, like /search: names and roles, nothing else
// from the record (the full facts stay behind requireDiscovery on /getProfessions).
const PICKER_PROFESSIONS = taxonomy.professions
    .map((profession) => ({ id: profession.id, profession: profession.profession, jobRoles: profession.job_roles || [] }))
    .sort((left, right) => left.profession.localeCompare(right.profession))

router.get("/getOptions", authMiddleware, async (req, res) => {
    try {
        const { INDUSTRIES } = require("../utils/industries")

        return res.status(200).json({
            success: true,
            message: "Options fetched successfully",
            data: { professions: PICKER_PROFESSIONS, industries: INDUSTRIES },
        })

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to fetch options",
            error: error.message,
        })
    }
})


// ========================
// One profession, in full
// ========================

// Fetched when a student expands a row in the report — the taxonomy is static and shared, so it is
// served live rather than copied into every student's recommendations document.
//
// `requireDiscovery`, like every other report route (Round 12: paid AND a plan with Career Discovery). The ids are guessable slugs and the taxonomy is the
// hand-built asset of the whole product; a route that serves all 223 to any free account is a
// scrape surface, and the server's only rate limiter is on login.
router.post("/getProfessions", authMiddleware, requireDiscovery, async (req, res) => {
    try {
        const ids = Array.isArray(req.body.ids) ? req.body.ids.slice(0, 60) : []

        if (ids.length === 0) {
            return res.status(400).json({ success: false, message: "No professions requested" })
        }

        // BATCHED ON PURPOSE. One row per profession expanded one at a time is an N+1 over a
        // 40-entry list on a phone connection. The report asks once, for everything it ranked.
        // Admin-approved demand and pay from the monthly refresh (utils/professionOverrides.js) are
        // laid over the file here — display only; the ranking was built from the file.
        // The exam and college changes from the monthly study bot are laid over their files the same way.
        const [overrides, studyOverrides] = await Promise.all([getOverrides(), getStudyOverrides()])
        const found = ids
            .map((id) => fullById.get(String(id)))
            .filter(Boolean)
            .map((profession) => studentFacing(applyOverride(profession, overrides.get(profession.id)), studyOverrides))

        return res.status(200).json({
            success: true,
            message: "Professions fetched successfully",
            data: { professions: found, taxonomyVersion: taxonomy.generated_on || null },
        })

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to fetch professions",
            error: error.message,
        })
    }
})

module.exports = router
module.exports.studentFacing = studentFacing
module.exports.goingAbroadFor = goingAbroadFor
module.exports.STUDENT_SAFE_NUANCE_FIELDS = STUDENT_SAFE_NUANCE_FIELDS
module.exports.cleanSector = cleanSector
