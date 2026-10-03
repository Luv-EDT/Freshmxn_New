// THE WEEKLY EMERGING-CAREERS SCOUT (owner, Round 10; Round 11) — run by the housekeeping worker on
// Mondays.
//
//   1. Candidates, from three places, each tagged with every source it came from:
//        job board        this week's Adzuna India postings — titles seen at least MIN_POSTINGS times
//        students         aspirations that matched none of our 223 careers (aspiration_signals,
//                         outcome "unmatched"), counted by how many students wrote them
//        reports          roles the official sources name as new or fast-growing (one search a run)
//   2. Anything that is ALREADY ONE OF OUR JOB TITLES is dropped — first by name (all ~1,700 titles
//      across the 223 careers, normalised the same way), then by meaning (each title's vector,
//      cached in roleEmbeddingsModel). "Unity Developer" is a job title under Game Developer, not a
//      new career.
//   3. What is left is compared with our careers as a whole:
//        new        nothing we hold is close
//        between    it sits between two careers in DIFFERENT sectors — a combined career
//      Anything close to one career we already hold is dropped.
//   3. The top SCOUT_MAX_CANDIDATES are assessed by Claude from the named public sources: pay, how
//      much AI touches the work, whether it is growing, and what it is.
//   4. Everything lands on one watchlist (scoutCandidatesModel). The admin approves it as a combined
//      or a new career, or dismisses it. Nothing is added to the product from here.
//
// The scout only reads and lists, which is why weekly is fine; the monthly refresh is the job that
// can change data, and it waits for the admin too.

const taxonomy = require("../data/ALL-professions.json")
const professionEmbeddings = require("../data/profession_embeddings.json")
const { createResearchClient } = require("./claudeResearch")
const { researchModel } = require("../utils/researchModel")
const { createAdzuna } = require("./adzuna")
const { cosine, embedQuery } = require("../matching/activityResolver")
const { parseRange } = require("../utils/professionOverrides")

const MIN_POSTINGS = 3          // one company's oddly worded advert is not a career
const MAX_EMBEDDED = 200        // titles sent to Voyage per run, most frequent first
const REASSESS_AFTER_DAYS = 28  // an assessment is kept a month before it is asked again
const DAY = 24 * 60 * 60 * 1000

// INVENTED, like activityResolver's DEDUP_COSINE, and tunable without a deploy. Every row stores
// its nearest careers with their similarity, so the first runs show whether these are right.
const newBelow = () => Number(process.env.SCOUT_NEW_BELOW) || 0.55
const betweenGap = () => Number(process.env.SCOUT_BETWEEN_GAP) || 0.03
const maxCandidates = () => Number(process.env.SCOUT_MAX_CANDIDATES) || 25
// a title this close in meaning to one of our job titles IS that job title (INVENTED, tunable)
const roleKnownAt = () => Number(process.env.SCOUT_ROLE_KNOWN) || 0.8

const SENIORITY = /\b(senior|sr|junior|jr|lead|principal|head|chief|associate|assistant|trainee|intern|internship|fresher|freshers|entry level|executive|i{1,3}|iv|[0-9]+\+? ?(years?|yrs?))\b/g

// "Sr. Drone Pilot (Agri) - Pune | Urgent" → "drone pilot"
const normaliseTitle = (text) => String(text || "")
    .toLowerCase()
    .replace(/\(.*?\)|\[.*?\]/g, " ")
    .split(/\s[-–|]\s|\||,/)[0]
    .replace(/\./g, " ")
    .replace(SENIORITY, " ")
    .replace(/[^a-z&+/ ]/g, " ")
    .replace(/\b(jobs?|vacancy|vacancies|urgent|hiring|wanted|required|opening)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim()

// Titles that recur, keyed by their normalised form, with the most common original spelling.
const countTitles = (titles, minCount = MIN_POSTINGS) => {
    const byKey = new Map()
    titles.forEach((title) => {
        const key = normaliseTitle(title)
        if (key.length < 3) return
        const row = byKey.get(key) || { key, count: 0, spellings: new Map() }
        row.count += 1
        const spelling = String(title).trim()
        row.spellings.set(spelling, (row.spellings.get(spelling) || 0) + 1)
        byKey.set(key, row)
    })

    return [...byKey.values()]
        .filter((row) => row.count >= minCount)
        .map((row) => ({ key: row.key, title: [...row.spellings.entries()].sort((a, b) => b[1] - a[1])[0][0], count: row.count }))
}

// How many students named each unmatched aspiration (one vote per student).
const countAspirations = (recommendations) => {
    const byKey = new Map()
    recommendations.forEach((recommendation) => {
        const seen = new Set()
        ;(recommendation.aspiration_signals || []).forEach((signal) => {
            if (!signal || signal.outcome !== "unmatched") return
            const key = normaliseTitle(signal.professionText)
            if (key.length < 3 || seen.has(key)) return
            seen.add(key)
            const row = byKey.get(key) || { key, title: String(signal.professionText).trim().slice(0, 120), count: 0 }
            row.count += 1
            byKey.set(key, row)
        })
    })
    return [...byKey.values()]
}

// One row per normalised title, with every source it came from.
const mergeSources = (board, students, reports = []) => {
    const merged = new Map()
    const row = (key, title) => {
        if (!merged.has(key)) merged.set(key, { key, title, postings: 0, aspirations: 0, sources: [], reportUrl: null })
        return merged.get(key)
    }
    board.forEach((entry) => {
        const item = row(entry.key, entry.title)
        item.postings = entry.count
        item.sources.push("job_board")
    })
    students.forEach((entry) => {
        const item = row(entry.key, entry.title)
        item.aspirations = entry.count
        item.sources.push("student_aspirations")
    })
    reports.forEach((entry) => {
        const item = row(entry.key, entry.title)
        if (!item.sources.includes("reports")) item.sources.push("reports")
        item.reportUrl = item.reportUrl || entry.url || null
    })
    return [...merged.values()]
}

// Students first — an unmatched wish is a gap in what we can tell someone — then titles more sources
// agree on, then postings.
const byPriority = (left, right) => right.aspirations - left.aspirations
    || right.sources.length - left.sources.length
    || right.postings - left.postings
    || left.key.localeCompare(right.key)

// Every job title we already list, by its normalised key.
const jobRoleIndex = (professions) => {
    const index = new Map()
    professions.forEach((profession) => {
        ;[profession.profession, ...(profession.job_roles || [])].forEach((role) => {
            const key = normaliseTitle(role)
            if (key.length >= 3 && !index.has(key)) index.set(key, { professionId: profession.id, role })
        })
    })
    return index
}

// The closest of our job titles by meaning, best first.
const nearestRoles = (vector, roleVectors, limit = 3) => roleVectors
    .map((entry) => ({ role: entry.role, professionId: entry.professionId, similarity: Math.round(cosine(vector, entry.vector) * 1000) / 1000 }))
    .sort((left, right) => right.similarity - left.similarity)
    .slice(0, limit)

const sectorById = new Map(taxonomy.professions.map((profession) => [profession.id, profession.professional_sector]))

// new / between / known, with the three nearest careers for the admin to see
const classifyAgainstCareers = (vector, embeddings, { below = newBelow(), gap = betweenGap(), sectors = sectorById } = {}) => {
    const ranked = embeddings
        .map((entry) => ({ id: entry.id, name: entry.profession, similarity: Math.round(cosine(vector, entry.embedding) * 1000) / 1000 }))
        .sort((left, right) => right.similarity - left.similarity)
    const nearest = ranked.slice(0, 3)
    const [first, second] = ranked

    if (!first || first.similarity < below) return { kind: "new", nearest }

    if (second && second.similarity >= below && first.similarity - second.similarity <= gap && sectors.get(first.id) !== sectors.get(second.id)) {
        return { kind: "between", nearest }
    }

    return { kind: "known", nearest }
}

const LEVELS = ["low", "medium", "high"]
const GROWTH = ["falling", "flat", "rising", "unknown"]

const SYSTEM = `You assess possible new careers for an Indian career-guidance service used by students aged 14 to 25.

You are given a job title that does not match any career we list, the careers it sits nearest to, and
how often it has appeared. Search the allowed public sources and say, for INDIA:
- payLpa: a typical early-to-mid pay range in lakh rupees a year, written "a-b", or null if the sources do not say
- aiResilience: how much of the work AI cannot do — "high" when it is mostly hands-on physical work,
  judgement in unclear situations, or work a named person must sign off; "low" when it is mostly
  screen-based skill and looking things up; otherwise "medium"
- growth: "rising", "flat", "falling", or "unknown" if the sources do not say
- oneLiner: what the person in this job does, in one plain sentence, or null if this is not a real job
- reason: one sentence naming what you found

Reply with ONLY this JSON object:
{"payLpa": "a-b" | null, "aiResilience": "low" | "medium" | "high", "growth": "rising" | "flat" | "falling" | "unknown", "oneLiner": "..." | null, "reason": "..."}`

const promptFor = (candidate, previousCounts) => [
    `Title: ${candidate.title}`,
    `Nearest careers we list: ${candidate.nearest.map((near) => near.name).join("; ")}`,
    candidate.kind === "between" ? "It sits between the first two of those — it may be a combination of them." : "None of them is close.",
    `Job-board postings this week: ${candidate.postings}${previousCounts.length ? `; earlier weeks: ${previousCounts.map((row) => row.count).join(", ")}` : ""}`,
    `Students who named it as the career they want: ${candidate.aspirations}`,
    candidate.sources.includes("reports") ? `Named as new or growing by: ${candidate.reportUrl || "an official report"}` : null,
].filter(Boolean).join("\n")

const checkAssessment = (json) => LEVELS.includes(json.aiResilience) && GROWTH.includes(json.growth)

// ONE search a run for roles the official sources call new or growing — the third source.
const REPORTS_SYSTEM = `You look for NEW or FAST-GROWING job roles in India for a career-guidance service used by students
aged 14 to 25. Search the allowed public sources (government labour statistics, the National Career
Service, the India Skills Report, Naukri JobSpeak, LinkedIn's published Economic Graph reports).

List up to 15 specific job roles that a source from the last 12 months names as new, emerging or
growing fast in India. A job title, not an industry ("Drone Pilot", not "aviation"). Only roles a
source actually names — never your own guesses.

Reply with ONLY this JSON object:
{"roles": [{"title": "...", "source_url": "https://..."}]}`

const reportTitles = async (research) => {
    if (!research) return []
    const reply = await research.askJson({
        system: REPORTS_SYSTEM,
        user: "Which job roles do the sources name as new or fast-growing in India this year?",
        check: (json) => Array.isArray(json.roles),
        maxUses: 5,
    })
    if (!reply.json) return []
    return reply.json.roles
        .filter((role) => role && typeof role.title === "string")
        .slice(0, 15)
        .map((role) => ({ key: normaliseTitle(role.title), title: role.title.trim().slice(0, 120), url: typeof role.source_url === "string" && role.source_url.startsWith("http") ? role.source_url : null }))
        .filter((role) => role.key.length >= 3)
}

// Our job titles' vectors, from the cache; only titles not cached yet are embedded (Round 11, R11-L).
const roleVectorsFor = async (professions, embed, model) => {
    const RoleEmbedding = require("../model/roleEmbeddingsModel")
    const wanted = []
    professions.forEach((profession) => (profession.job_roles || []).forEach((role) => wanted.push({ key: `${model}::${normaliseTitle(role)}`, professionId: profession.id, role })))
    const unique = [...new Map(wanted.map((entry) => [entry.key, entry])).values()]

    const cached = await RoleEmbedding.find({ key: { $in: unique.map((entry) => entry.key) } }).lean()
    const have = new Set(cached.map((entry) => entry.key))
    const missing = unique.filter((entry) => !have.has(entry.key))

    for (let start = 0; start < missing.length; start += 128) {
        const batch = missing.slice(start, start + 128)
        const vectors = await embed(batch.map((entry) => entry.role))
        // these keys were not in the cache a moment ago, so a plain insert; a duplicate from a run
        // racing this one is harmless and ignored
        await RoleEmbedding.insertMany(batch.map((entry, index) => ({ key: entry.key, professionId: entry.professionId, role: entry.role, vector: vectors[index] })), { ordered: false })
            .catch((error) => { if (!/duplicate key|E11000/.test(error.message)) throw error })
        batch.forEach((entry, index) => cached.push({ ...entry, vector: vectors[index] }))
    }
    return cached
}

const embeddingModel = () => process.env.Embedding_Model || professionEmbeddings.model

const voyageEmbed = () => {
    const apiKey = process.env.VOYAGE_API_KEY
    if (!apiKey) return null
    return (texts) => embedQuery(texts, { apiKey, model: embeddingModel(), dimensions: professionEmbeddings.dimensions })
}

const runCareerScout = async ({
    research,
    adzuna = createAdzuna(),
    embed = voyageEmbed(),
    embeddings = professionEmbeddings.embeddings,
    professions = taxonomy.professions,
    now = new Date(),
} = {}) => {
    // the admin's chosen research model (Round 12) unless a client was injected (the fixtures)
    if (research === undefined) research = createResearchClient({ job: "career_scout", model: await researchModel() })
    if (!embed) return { skipped: "VOYAGE_API_KEY is not set" }

    const Recommendation = require("../model/recommendationsModel")
    const ScoutCandidate = require("../model/scoutCandidatesModel")

    let titles = []
    if (adzuna) {
        try {
            titles = await adzuna.latestTitles({ pages: Number(process.env.SCOUT_ADZUNA_PAGES) || 10, maxDaysOld: 7 })
        } catch (error) {
            console.error(`career_scout: Adzuna failed — ${error.message}`)
        }
    }

    const recommendations = await Recommendation.find({ "aspiration_signals.outcome": "unmatched" }).select("aspiration_signals").limit(5000).lean()

    let reports = []
    try {
        reports = await reportTitles(research)
    } catch (error) {
        console.error(`career_scout: the reports search failed — ${error.message}`)
    }

    // already one of our job titles, by name → not a candidate at all
    const known = jobRoleIndex(professions)
    const merged = mergeSources(countTitles(titles), countAspirations(recommendations), reports)
    const pool = merged.filter((row) => !known.has(row.key)).sort(byPriority).slice(0, MAX_EMBEDDED)

    const result = { postingsRead: titles.length, adzuna: adzuna ? "used" : "skipped (no keys)", reportsNamed: reports.length, considered: merged.length, knownByName: merged.length - merged.filter((row) => !known.has(row.key)).length, knownByMeaning: 0, listed: 0, assessed: 0, refused: [], failed: [] }
    if (pool.length === 0) return result

    const roleVectors = await roleVectorsFor(professions, embed, embeddingModel())
    const vectors = await embed(pool.map((row) => row.title))
    const candidates = []
    pool.forEach((row, index) => {
        const roles = nearestRoles(vectors[index], roleVectors)
        if (roles.length > 0 && roles[0].similarity >= roleKnownAt()) {
            result.knownByMeaning += 1     // already one of our job titles, by meaning
            return
        }
        const placed = classifyAgainstCareers(vectors[index], embeddings)
        if (placed.kind !== "known") candidates.push({ ...row, ...placed, nearestRoles: roles })
    })
    candidates.splice(maxCandidates())

    for (const candidate of candidates) {
        const existing = await ScoutCandidate.findOne({ key: candidate.key }).lean()
        const previousCounts = existing && Array.isArray(existing.postingCounts) ? existing.postingCounts.slice(-6) : []
        // the sources build up across weeks: a title the job board showed last month and students
        // ask for now carries both tags
        const sources = [...new Set([...((existing && existing.sources) || []), ...candidate.sources])]

        const update = {
            $set: { title: candidate.title, sources, reportUrl: candidate.reportUrl || (existing && existing.reportUrl) || null, kind: candidate.kind, nearest: candidate.nearest, nearestRoles: candidate.nearestRoles, aspirationCount: candidate.aspirations, lastSeenAt: now },
        }
        if (candidate.postings > 0) update.$push = { postingCounts: { $each: [{ at: now, count: candidate.postings }], $slice: -26 } }

        // a dismissed title keeps its counts but is not paid for again; a fresh assessment is a month old at most
        const fresh = existing && existing.assessment && existing.assessment.assessedAt && now.getTime() - new Date(existing.assessment.assessedAt).getTime() < REASSESS_AFTER_DAYS * DAY
        const dismissed = existing && existing.status === "dismissed"

        if (research && !fresh && !dismissed) {
            try {
                const reply = await research.askJson({ system: SYSTEM, user: promptFor(candidate, previousCounts), check: checkAssessment, maxUses: 3 })
                if (reply.refused) result.refused.push(candidate.key)
                if (reply.unreadable) result.failed.push(candidate.key)
                if (reply.json) {
                    update.$set.assessment = {
                        payLpa: parseRange(reply.json.payLpa) ? String(reply.json.payLpa).replace(/\s+/g, "") : null,
                        aiResilience: reply.json.aiResilience,
                        growth: reply.json.growth,
                        oneLiner: reply.json.oneLiner ? String(reply.json.oneLiner).slice(0, 300) : null,
                        reason: reply.json.reason ? String(reply.json.reason).slice(0, 600) : null,
                        sources: reply.sources.slice(0, 8),
                        assessedAt: now,
                    }
                    result.assessed += 1
                }
            } catch (error) {
                console.error(`career_scout: assessing "${candidate.key}" failed — ${error.message}`)
                result.failed.push(candidate.key)
            }
        }

        await ScoutCandidate.updateOne({ key: candidate.key }, update, { upsert: true })
        result.listed += 1
    }

    return result
}

module.exports = { runCareerScout, normaliseTitle, countTitles, countAspirations, mergeSources, classifyAgainstCareers, byPriority, jobRoleIndex, nearestRoles, reportTitles, MIN_POSTINGS }
