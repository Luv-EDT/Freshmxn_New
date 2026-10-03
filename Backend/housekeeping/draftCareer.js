// DRAFTING AN APPROVED CAREER (owner, Round 11) — queued as the housekeeping job `draft_career` when
// the admin approves a row in "Emerging careers". It builds the career the way ALL-professions.json
// was built, so a career added later is held to the same rules as the 223:
//
//   NEW career
//     1. the record, in the DECISIONS.md §1 schema — Claude with web search on the allowed sources,
//        given the locked rules VERBATIM from DECISIONS.md (read from the file at run time, so they
//        can never drift from what the 223 were built to) and a real record as the pattern
//     2. three rating passes against factor_anchors.json — the SAME prompt as
//        tools/rateProfessions.js (createRater), merged as mergeRatings.js does: the mean, the spread
//        kept, a wide spread sent for review, `review_status: unreviewed`
//     3. its embedding — Voyage, input_type "document", as profession_embeddings.json requires
//     4. checked by validateDraftRecord — every warning is shown to the admin, none is hidden
//   COMBINED career
//     a combined_careers.json row: two existing side groups, a one-liner, how people get there
//
// NOTHING GOES LIVE FROM HERE. The admin accepts or sends back with a note; an accepted draft goes
// into Export patch, and only a committed, deployed patch puts it in front of students.

const fs = require("fs")
const path = require("path")
const taxonomy = require("../data/ALL-professions.json")
const professionEmbeddings = require("../data/profession_embeddings.json")
const baseline = require("../data/baseline_rating.json")
const combinedData = require("../data/combined_careers.json")
const industrial = require("../data/industrial_sectors.json")
const entranceGates = require("../data/entrance_gates.json")
const sectorsData = require("../data/professional_sectors.json")
const { createResearchClient } = require("./claudeResearch")
const { researchModel } = require("../utils/researchModel")

const RATING_PASSES = 3
const RATING_MODEL = () => process.env.RATING_MODEL || "claude-sonnet-5"
const VOYAGE_ENDPOINT = "https://api.voyageai.com/v1/embeddings"

// ── the locked rules, straight from the file ────────────────────────────────────────────────────

const DECISION_SECTIONS = ["1.", "8.4 ", "3.", "7.", "8.45 ", "8.6 ", "8.7 ", "8.7b ", "8.8 ", "8.9 ", "8.95 ", "9."]

const decisionsText = () => {
    const text = fs.readFileSync(path.join(__dirname, "..", "data", "DECISIONS.md"), "utf8")
    const parts = text.split(/\n(?=## )/)
    return DECISION_SECTIONS
        .map((prefix) => parts.find((part) => part.startsWith(`## ${prefix}`)))
        .filter(Boolean)
        .join("\n\n")
}

// ── the vocabularies a record may use ───────────────────────────────────────────────────────────

const ENUMS = {
    degree_dependency: ["none", "certificate", "undergrad", "professional"],
    mid_stream_entry: ["open", "after_any_degree", "restart_undergrad"],
    after_undergrad: ["masters_required", "masters_is_the_entry", "masters_advantage", "work_first"],
    spread: ["narrow", "wide"],
    distribution: ["range", "bimodal", "power_law"],
    india_demand: ["declining", "low", "moderate", "high"],
    pathway: ["india", "any"],
    likelihood: ["common", "possible_later", "rare"],
    band: ["low", "medium", "high"],
    tier: ["A", "B", "C"],
    subjects: ["physics", "chemistry", "maths", "biology"],
    composition: ["knowledge_foundational", "knowledge_retrievable", "skill_physical", "skill_digital", "clarity"],
}

const SECTOR_CODES = new Set([
    ...industrial.nsdc_sector_skill_councils.map((entry) => entry.code),
    ...(industrial.extension_tags || []).map((entry) => (typeof entry === "string" ? entry : entry.code)).filter(Boolean),
])

const RANGE = /^(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)$/

const slugify = (text) => String(text || "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50)

// The record checks — what the 223 satisfy. Returns { blocking: [...], warnings: [...] }: a blocking
// problem stops the admin accepting the draft; a warning is shown and is the admin's call.
const validateDraftRecord = (record, existingIds = new Set(taxonomy.professions.map((profession) => profession.id))) => {
    const blocking = []
    const warnings = []
    const need = (condition, message) => { if (!condition) blocking.push(message) }

    if (!record || typeof record !== "object") return { blocking: ["no record"], warnings }

    need(typeof record.id === "string" && /^[a-z]{2,4}-[a-z0-9-]+$/.test(record.id), "id must look like `sec-some-career`")
    need(!existingIds.has(record.id), `id ${record.id} already exists`)
    need(typeof record.profession === "string" && record.profession.length > 2, "profession name missing")
    need(typeof record.one_liner === "string" && record.one_liner.length > 10, "one_liner missing")
    need(Number.isInteger(record.professional_sector_id) && record.professional_sector_id >= 1 && record.professional_sector_id <= 18, "professional_sector_id must be 1-18")
    need(Array.isArray(record.job_roles) && record.job_roles.length >= 3 && record.job_roles.every((role) => typeof role === "string"), "at least three job_roles")
    need(record.role_spread && ENUMS.spread.includes(record.role_spread.spread) && Array.isArray(record.role_spread.deviating_roles), "role_spread {spread, deviating_roles[]}")
    if (record.role_spread && Array.isArray(record.role_spread.deviating_roles)) {
        record.role_spread.deviating_roles.forEach((group) => {
            ;(group.roles || []).forEach((role) => { if (!(record.job_roles || []).includes(role)) blocking.push(`role-group role "${role}" is not one of its job_roles`) })
        })
    }
    need(Array.isArray(record.industrial_sectors) && record.industrial_sectors.length >= 1, "at least one industrial sector")
    ;(record.industrial_sectors || []).forEach((code) => { if (!SECTOR_CODES.has(code)) blocking.push(`unknown industrial sector ${code}`) })
    need(ENUMS.degree_dependency.includes(record.degree_dependency), "degree_dependency")
    need(ENUMS.mid_stream_entry.includes(record.mid_stream_entry), "mid_stream_entry")
    need(record.class12_prerequisite === "any" || (Array.isArray(record.class12_prerequisite) && record.class12_prerequisite.length > 0 && record.class12_prerequisite.every((subject) => ENUMS.subjects.includes(subject))), "class12_prerequisite: \"any\" or a subject list")
    need(Array.isArray(record.path_to_entry) && record.path_to_entry.length >= 1 && record.path_to_entry.every((step, index) => step.step === index + 1 && typeof step.stage === "string" && typeof step.requirement === "string"), "path_to_entry: numbered steps with stage and requirement")
    need(record.entrance_exams && Array.isArray(record.entrance_exams.public_routes) && Array.isArray(record.entrance_exams.private_entrances), "entrance_exams {public_routes, private_entrances, note}")
    if (record.entry_competition) {
        need(Boolean(entranceGates.gates[record.entry_competition.primary_gate]), `entry_competition.primary_gate ${record.entry_competition.primary_gate} is not in entrance_gates.json`)
    }
    need(typeof record.years_to_qualify === "number" && record.years_to_qualify >= 0 && record.years_to_qualify <= 15, "years_to_qualify 0-15")
    need(ENUMS.after_undergrad.includes(record.after_undergrad), "after_undergrad")

    const economics = record.economics || {}
    const early = RANGE.exec(String(economics.early_earnings_lpa || ""))
    const mid = RANGE.exec(String(economics.mid_career_lpa || ""))
    need(Boolean(early) && Boolean(mid), "economics early_earnings_lpa and mid_career_lpa as \"a-b\"")
    need(typeof economics.cost_of_entry_lakh === "number", "economics.cost_of_entry_lakh")
    need(ENUMS.distribution.includes(economics.distribution), "economics.distribution")
    if (mid && typeof economics.mid_career_midpoint === "number") {
        const midpoint = (Number(mid[1]) + Number(mid[2])) / 2
        if (Math.abs(midpoint - economics.mid_career_midpoint) > 0.6) warnings.push(`mid_career_midpoint ${economics.mid_career_midpoint} is not the middle of ${economics.mid_career_lpa}`)
    }

    need(record.demand_signal && ENUMS.india_demand.includes(record.demand_signal.india_demand) && ENUMS.pathway.includes(record.demand_signal.pathway), "demand_signal {india_demand, pathway}")
    need(record.self_employment && ENUMS.likelihood.includes(record.self_employment.likelihood), "self_employment.likelihood")

    const ai = record.ai_exposure || {}
    const composition = ai.work_composition || {}
    const total = ENUMS.composition.reduce((sum, key) => sum + (Number(composition[key]) || 0), 0)
    need(ENUMS.composition.every((key) => typeof composition[key] === "number"), "ai_exposure.work_composition with all five parts")
    if (total !== 100) blocking.push(`ai_exposure.work_composition sums to ${total}, not 100`)
    need(ENUMS.band.includes(ai.band) && typeof ai.exposure_raw === "number", "ai_exposure band and exposure_raw")

    need(record.verification && ENUMS.tier.includes(record.verification.tier), "verification.tier")
    if (record.verification && record.verification.status === "verified" && !record.verification.source) warnings.push("marked verified with no source — §7")
    if (economics.distribution && economics.distribution !== "range" && !(record.admin_review && record.admin_review.required)) blocking.push("a non-range distribution must set admin_review.required (§8.4)")

    if (record.profession_test && record.profession_test.passes === false) warnings.push(`§8.95: ${record.profession_test.reason || "the drafter says this is not a profession"}`)

    return { blocking, warnings }
}

// The derived `filter` flag, by the rule in filter_rules.json — never asked of the model.
const deriveFilter = (record) => {
    const midpoint = record.economics && record.economics.mid_career_midpoint
    if (typeof midpoint !== "number") return true
    if (record.economics.distribution === "power_law") return true
    const floorExempt = record.self_employment && record.self_employment.likelihood === "common" && record.admin_review && record.admin_review.required
    if (midpoint < 4.5 && !floorExempt) return false
    if (midpoint < 6 && record.ai_exposure && record.ai_exposure.band === "high") return false
    return true
}

// ── the drafting prompts ────────────────────────────────────────────────────────────────────────

const DRAFT_SYSTEM = () => `You build ONE career record for an Indian career-guidance service used by students aged 14 to 25.
The service already holds 223 careers built to the rules below. Your record must follow them exactly —
they are the locked design decisions, quoted from the project's DECISIONS.md.

${decisionsText()}

HOW TO WORK
- Search the allowed public sources for India-specific facts: the route in, exams, pay, demand.
- Where no source settles a value, use your judgment and say so: verification.status "judgment",
  economics.verification.status "estimate", and a nuance if it matters to a student.
- Test the title against §8.95. Put the result in "profession_test": {"passes": true|false, "reason": "..."}.
  If it fails (it is a job role inside an existing career, or an industry), still fill the record, but say why.
- Choose 1-3 "driving_reasons" from: ${Object.keys(baseline.driving_reasons_vocabulary).join(", ")}.
- Do not set "filter" — it is derived.
- professional_sector_id is one of: ${sectorsData.professional_sectors.map((sector) => `${sector.id} ${sector.name}`).join("; ")}.
- industrial_sectors are NSDC codes, for example: ${[...SECTOR_CODES].slice(0, 40).join(", ")}.

Reply with ONLY the JSON record — the same keys and shapes as the example record you are given, plus
"profession_test" and "driving_reasons".`

const exampleRecord = (nearestId) => {
    const record = taxonomy.professions.find((profession) => profession.id === nearestId) || taxonomy.professions[0]
    const { verification, admin_review, filter, ...rest } = record
    return rest
}

const draftUserPrompt = (candidate, note) => [
    `Career to build: ${candidate.title}`,
    candidate.assessment && candidate.assessment.oneLiner ? `What it is (from the scout): ${candidate.assessment.oneLiner}` : null,
    `Nearest careers we already hold: ${(candidate.nearest || []).map((near) => `${near.name} (${near.id})`).join("; ")}`,
    `Nearest job titles we already hold: ${(candidate.nearestRoles || []).map((near) => near.role).join("; ") || "none listed"}`,
    note ? `The admin sent an earlier draft back with this note — address it: ${note}` : null,
    "",
    "The example record (the nearest career), for the exact keys and shapes:",
    JSON.stringify(exampleRecord(candidate.nearest && candidate.nearest[0] && candidate.nearest[0].id), null, 1),
].filter((line) => line !== null).join("\n")

// ── the rating passes ───────────────────────────────────────────────────────────────────────────

const round2 = (value) => Math.round(value * 100) / 100

const rateRecord = async (research, record) => {
    const { createRater, VOCABULARY, professionBrief } = require("../tools/rateProfessions")
    const rater = createRater(VOCABULARY)
    const passes = []

    for (let pass = 0; pass < RATING_PASSES; pass += 1) {
        let parsed = null
        for (let attempt = 0; attempt < 2 && !parsed; attempt += 1) {
            const reply = await research.askPlain({ system: rater.SYSTEM_PROMPT, user: `Rate these 1 professions.\n\n${professionBrief(record)}`, maxTokens: 6000, plainModel: RATING_MODEL() })
            if (reply.refused) throw new Error("the rating pass was declined")
            const start = reply.text.indexOf("{")
            const end = reply.text.lastIndexOf("}")
            try {
                const candidate = JSON.parse(reply.text.slice(start, end + 1))
                if (rater.checkBatch(candidate, [record]).length === 0) parsed = candidate[record.id]
            } catch (error) {
                parsed = null
            }
        }
        if (!parsed) throw new Error(`rating pass ${pass + 1} never returned a valid reply`)
        passes.push(parsed)
    }

    return mergePasses(record, passes)
}

// mergeRatings.js's rule: the mean of the passes; the spread kept; a wide spread sent to a human.
const mergePasses = (record, passes) => {
    const factors = {}
    const weights = {}
    const sampleVariance = {}
    let wide = []

    Object.keys(passes[0].factors).forEach((slug) => {
        const samples = passes.map((pass) => pass.factors[slug])
        const spread = Math.max(...samples) - Math.min(...samples)
        factors[slug] = round2(samples.reduce((sum, value) => sum + value, 0) / samples.length)
        weights[slug] = round2(passes.reduce((sum, pass) => sum + pass.weights[slug], 0) / passes.length)
        sampleVariance[slug] = { samples, spread, origin: "drafted" }
        if (spread > baseline.max_spread_before_review) wide.push(slug)
    })

    return {
        id: record.id,
        profession: record.profession,
        professional_sector_id: record.professional_sector_id,
        professional_sector: record.professional_sector,
        factors,
        weights,
        drivingReasons: (record.driving_reasons || []).filter((reason) => baseline.driving_reasons_vocabulary[reason]).slice(0, 3),
        samples: passes.length,
        sample_variance: sampleVariance,
        version: baseline.schema_version,
        generated_on: new Date().toISOString().slice(0, 10),
        review_status: "unreviewed",
        admin_review: wide.length > 0
            ? { required: true, priority: "high", reason: `rating passes disagree by more than ${baseline.max_spread_before_review} on: ${wide.join(", ")}` }
            : { required: false, priority: "none", reason: null },
    }
}

// ── the embedding — a DOCUMENT, like the 223 (never a query: that would degrade every match silently)

// The SAME text and hash the 223 were embedded from (tools/verifyEmbeddings.js checks them; a fixture
// pins that these two lines match that file), so verifyEmbeddings passes on a drafted career too.
const sourceTextOf = (profession) => `${profession.profession}. ${profession.one_liner} Job roles include: ${(profession.job_roles || []).join(", ")}.`
const contentHash = (text) => require("crypto").createHash("sha256").update(`${professionEmbeddings.model}\x00${professionEmbeddings.dimensions}\x00${text}`, "utf8").digest("hex")

const embedDocument = async (record, { apiKey = process.env.VOYAGE_API_KEY, fetchImpl = fetch } = {}) => {
    if (!apiKey) return []
    const text = sourceTextOf(record)
    const response = await fetchImpl(VOYAGE_ENDPOINT, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ input: [text], model: professionEmbeddings.model, input_type: "document", output_dimension: professionEmbeddings.dimensions }),
    })
    if (!response.ok) throw new Error(`Voyage HTTP ${response.status}`)
    const payload = await response.json()
    return payload.data[0].embedding
}

// ── a combined career ───────────────────────────────────────────────────────────────────────────

const COMBINED_SYSTEM = () => `You add ONE combined career — a real job that joins two fields — to an Indian career-guidance service.
Each combined career has two SIDES, and each side is one of these existing groups of careers:

${Object.entries(combinedData.groups).map(([key, group]) => `${key}: ${group.label} — ${group.careers.join(", ")}`).join("\n")}

Search the allowed sources for how people in India get into this work.

Reply with ONLY this JSON object:
{"name": "...", "oneLiner": "one plain sentence", "howToGetThere": "both fields' routes, stated plainly", "sideA": "<group key>", "sideB": "<a different group key>", "blueCollar": true|false}`

const validateCombined = (row) => {
    const blocking = []
    if (!row || typeof row.name !== "string") blocking.push("no name")
    if (!combinedData.groups[row && row.sideA]) blocking.push(`sideA ${row && row.sideA} is not a known group`)
    if (!combinedData.groups[row && row.sideB]) blocking.push(`sideB ${row && row.sideB} is not a known group`)
    if (row && row.sideA === row.sideB) blocking.push("the two sides are the same group")
    if (row && combinedData.careers.some((career) => career.name.toLowerCase() === String(row.name).toLowerCase())) blocking.push("a combined career with this name already exists")
    return { blocking, warnings: [] }
}

// ── the job ─────────────────────────────────────────────────────────────────────────────────────

const runDraftCareer = async ({ candidateId, research, embed = embedDocument } = {}) => {
    // the admin's chosen research model (Round 12) unless a client was injected (the fixtures)
    if (research === undefined) research = createResearchClient({ job: "draft_career", model: await researchModel() })
    const ScoutCandidate = require("../model/scoutCandidatesModel")
    const CareerDraft = require("../model/careerDraftsModel")

    const candidate = await ScoutCandidate.findById(candidateId).lean()
    if (!candidate) return { skipped: "no such watchlist row" }
    const kind = candidate.status === "approved_combined" ? "combined" : candidate.status === "approved_new" ? "new" : null
    if (!kind) return { skipped: "the row is not approved" }

    const previous = await CareerDraft.findOne({ candidate: candidateId }).lean()
    await CareerDraft.updateOne(
        { candidate: candidateId },
        { $set: { kind, status: "drafting", error: null }, $inc: { attempts: 1 } },
        { upsert: true }
    )

    if (!research) {
        await CareerDraft.updateOne({ candidate: candidateId }, { $set: { status: "failed", error: "ANTHROPIC_API_KEY is not set" } })
        return { skipped: "ANTHROPIC_API_KEY is not set" }
    }

    try {
        if (kind === "combined") {
            const reply = await research.askJson({ system: COMBINED_SYSTEM(), user: `Combined career: ${candidate.title}\nNearest careers: ${(candidate.nearest || []).map((near) => near.name).join("; ")}${previous && previous.adminNote ? `\nThe admin's note on the last draft: ${previous.adminNote}` : ""}`, check: (json) => typeof json.name === "string", maxUses: 3 })
            if (!reply.json) throw new Error(reply.refused ? "the request was declined" : "no readable reply")
            const row = { id: `cmb-${slugify(reply.json.name)}`, name: reply.json.name, oneLiner: reply.json.oneLiner, howToGetThere: reply.json.howToGetThere, sideA: reply.json.sideA, sideB: reply.json.sideB, blueCollar: Boolean(reply.json.blueCollar) }
            const checks = validateCombined(row)
            await CareerDraft.updateOne({ candidate: candidateId }, { $set: { status: "ready", record: row, rating: null, embedding: [], warnings: [...checks.blocking.map((text) => `MUST FIX: ${text}`), ...checks.warnings] } })
            return { drafted: "combined", blocking: checks.blocking.length }
        }

        const reply = await research.askJson({ system: DRAFT_SYSTEM(), user: draftUserPrompt(candidate, previous && previous.adminNote), check: (json) => typeof json.profession === "string" && Array.isArray(json.job_roles), maxUses: 6, maxTokens: 16000 })
        if (!reply.json) throw new Error(reply.refused ? "the request was declined" : "no readable reply")

        const record = { ...reply.json }
        const sector = sectorsData.professional_sectors.find((entry) => entry.id === record.professional_sector_id)
        if (sector) record.professional_sector = sector.name
        if (!record.id || !/^[a-z]{2,4}-/.test(record.id)) {
            const prefix = (candidate.nearest && candidate.nearest[0] && candidate.nearest[0].id.split("-")[0]) || "new"
            record.id = `${prefix}-${slugify(record.profession)}`
        }
        record.filter = deriveFilter(record)
        record.verification = { tier: "C", status: "judgment", source: null, ...(record.verification || {}), checked_on: new Date().toISOString().slice(0, 10) }
        record.admin_review = record.admin_review || { required: true, priority: "medium", reason: "Drafted by the careers scout — needs a human read before it ships" }

        const checks = validateDraftRecord(record)
        const rating = checks.blocking.length === 0 ? await rateRecord(research, record) : null
        const embedding = checks.blocking.length === 0 ? await embed(record) : []

        await CareerDraft.updateOne({ candidate: candidateId }, { $set: {
            status: "ready",
            record,
            rating,
            embedding,
            warnings: [...checks.blocking.map((text) => `MUST FIX: ${text}`), ...checks.warnings, ...(embedding.length === 0 && checks.blocking.length === 0 ? ["no embedding (VOYAGE_API_KEY missing) — it cannot be matched until it has one"] : [])],
        } })
        return { drafted: "new", id: record.id, blocking: checks.blocking.length }
    } catch (error) {
        await CareerDraft.updateOne({ candidate: candidateId }, { $set: { status: "failed", error: error.message.slice(0, 300) } })
        throw error
    }
}

module.exports = { runDraftCareer, validateDraftRecord, validateCombined, deriveFilter, mergePasses, decisionsText, sourceTextOf, contentHash, DECISION_SECTIONS, slugify }
