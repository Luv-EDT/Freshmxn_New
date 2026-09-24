const express = require("express")
const authMiddleware = require("../middlewares/authMiddleware")
const requirePaid = require("../middlewares/requirePaid")
const { FACTOR_LABELS } = require("../workers/reportComposer")

const router = express.Router()

// the 223-profession taxonomy, read once at startup.
const taxonomy = require("../data/ALL-professions.json")
const industrialSectors = require("../data/industrial_sectors.json")
const entranceGates = require("../data/entrance_gates.json")

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

const labelFactors = (slugs) => asArray(slugs).map((slug) => FACTOR_LABELS[slug] || String(slug).replace(/_/g, " "))

// ⚠ THE NUANCE WHITELIST. `nuances` ARE NOT UNIFORMLY STUDENT-SAFE.
//
// Each nuance names the field it annotates. Most are written for the student and are the best
// content in the dataset. Two `field` values are not:
//
//   "filter"        notes addressed to the BUILDER about the compensation filter. The Farmer one
//                   reads "Fails the compensation filter, and it is the largest occupation in the
//                   country… the application must be able to reverse it." Shown to a student from a
//                   farming family that is the worst content failure this redesign could produce.
//                   Handloom Weaver and Anganwadi Educator are the same shape.
//   "verification"  sourcing notes about why a record is tier B rather than C. Internal QA.
//
// A WHITELIST, NOT A BLACKLIST, and that is the point: a new `field` value added to the taxonomy
// later is excluded by default and someone has to decide it is safe. A blacklist would ship it.
const STUDENT_SAFE_NUANCE_FIELDS = [
    "profession", "job_roles", "role_spread", "professional_sector", "industrial_sectors",
    "degree_dependency", "class12_prerequisite", "path_to_entry", "entrance_exams",
    "entry_competition", "entry_window", "licensing_body", "years_to_qualify",
    "economics", "demand_signal", "after_undergrad", "self_employment", "ai_exposure",
    "mid_stream_entry",
]

// ⚠ AND A SECOND SCREEN ON THE STATEMENT ITSELF, because the field whitelist is not enough.
//
// A fixture caught this: nuances sitting in perfectly student-facing FIELDS still contain prose
// written for the builder. Real examples from `economics` and `job_roles`, both whitelisted above:
//
//     "mid_career EXCLUDES business ownership by design…"
//     "…which would duplicate a job role across professions and is rejected by audit.py."
//
// Two different leaks, so two rules:
//
//   BUILDER_MARKERS   sentences addressed to whoever is building this, not to a student.
//   RAW_IDENTIFIER    any snake_case token — `mid_career`, `admin_review`, `verified_facts`,
//                     `india_demand`. This is the same rule the rest of the product already
//                     enforces everywhere: an identifier never reaches a student's screen. 74 of
//                     438 nuances carry one.
//
// Together these drop 90 of 438 and keep 348. The dropped ones are not lost — they are in the
// taxonomy and an admin can still read them. They are simply not shown to a child.
const BUILDER_MARKERS = /audit\.py|this record carries|the application must|compensation filter|tier [ABC] rather than|rejected by audit|admin review/i
const RAW_IDENTIFIER = /\b[a-z]+_[a-z_]+\b/

const nuanceIsStudentSafe = (nuance) => (
    STUDENT_SAFE_NUANCE_FIELDS.includes(nuance.field)
    && !BUILDER_MARKERS.test(nuance.statement)
    && !RAW_IDENTIFIER.test(nuance.statement)
)

// The nuance's `field` says which part of the record it annotates — but it says it in the
// taxonomy's own field names. The card needs to know where to attach it; the student does not need
// to see `entry_competition`. Translated to a section id at the boundary, like everything else.
const NUANCE_SECTION = {
    path_to_entry: "path", class12_prerequisite: "path", years_to_qualify: "path",
    degree_dependency: "path", after_undergrad: "path", mid_stream_entry: "path",
    entry_window: "path",
    entrance_exams: "exams", entry_competition: "exams",
    industrial_sectors: "where", job_roles: "where", professional_sector: "where",
    profession: "where",
    economics: "pay", self_employment: "pay",
    demand_signal: "demand",
    ai_exposure: "ai",
    role_spread: "roles",
    licensing_body: "path",
}

// What a student is allowed to see. A PROJECTION, NEVER THE RAW RECORD — the raw one carries
// `admin_review` (56 records flagged for internal review), `verification` (judgment-vs-verified
// status and sources), the `filter` boolean, and the internals of `entry_competition`. None of that
// is student-facing, and an endpoint that serves the whole object leaks all of it the first time
// somebody adds a field.
const studentFacing = (profession) => {
    const gate = profession.entry_competition && entranceGates.gates
        ? entranceGates.gates[profession.entry_competition.primary_gate]
        : null

    return {
        id: profession.id,
        profession: profession.profession,
        professionalSector: cleanSector(profession.professional_sector),
        oneLiner: profession.one_liner,
        jobRoles: profession.job_roles || [],

        industries: (profession.industrial_sectors || []).map((code) => SECTOR_NAMES.get(code) || code),

        pathToEntry: (profession.path_to_entry || []).map((step) => ({
            step: step.step,
            stage: step.stage,
            requirement: step.requirement,
        })),

        yearsToQualify: profession.years_to_qualify,
        degreeDependency: profession.degree_dependency,
        afterUndergrad: profession.after_undergrad,
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

        // Only the facing numbers off the gate record — how hard it is to get in, which is what a
        // student is asking. Not its verification block or its internal next_stage wiring.
        entryGate: gate
            ? {
                name: gate.name,
                applicantsPerSeat: gate.applicants_per_seat,
                preparationYears: gate.preparation_years,
                note: gate.note || null,
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
            }
            : null,

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
            .map((nuance) => ({ section: NUANCE_SECTION[nuance.field] || "path", statement: nuance.statement })),

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
// One profession, in full
// ========================

// Fetched when a student expands a row in the report — the taxonomy is static and shared, so it is
// served live rather than copied into every student's recommendations document.
//
// `requirePaid`, like every other report route. The ids are guessable slugs and the taxonomy is the
// hand-built asset of the whole product; a route that serves all 223 to any free account is a
// scrape surface, and the server's only rate limiter is on login.
router.post("/getProfessions", authMiddleware, requirePaid, async (req, res) => {
    try {
        const ids = Array.isArray(req.body.ids) ? req.body.ids.slice(0, 60) : []

        if (ids.length === 0) {
            return res.status(400).json({ success: false, message: "No professions requested" })
        }

        // BATCHED ON PURPOSE. One row per profession expanded one at a time is an N+1 over a
        // 40-entry list on a phone connection. The report asks once, for everything it ranked.
        const found = ids
            .map((id) => fullById.get(String(id)))
            .filter(Boolean)
            .map(studentFacing)

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
module.exports.STUDENT_SAFE_NUANCE_FIELDS = STUDENT_SAFE_NUANCE_FIELDS
module.exports.cleanSector = cleanSector
