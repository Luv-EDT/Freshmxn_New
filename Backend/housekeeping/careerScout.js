// THE WEEKLY EMERGING-CAREERS SCOUT (owner, Round 10) — run by the housekeeping worker on Mondays.
//
//   1. Candidates, from two places:
//        job board        this week's Adzuna India postings — titles seen at least MIN_POSTINGS times
//        students         aspirations that matched none of our 223 careers (aspiration_signals,
//                         outcome "unmatched"), counted by how many students wrote them
//      The same title from both is tagged "both".
//   2. Each is embedded (Voyage, the vectors matching already uses) and compared with our careers:
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

const mergeSources = (board, students) => {
    const merged = new Map()
    board.forEach((row) => merged.set(row.key, { key: row.key, title: row.title, postings: row.count, aspirations: 0 }))
    students.forEach((row) => {
        const existing = merged.get(row.key)
        if (existing) existing.aspirations = row.count
        else merged.set(row.key, { key: row.key, title: row.title, postings: 0, aspirations: row.count })
    })
    return [...merged.values()].map((row) => ({
        ...row,
        source: row.postings > 0 && row.aspirations > 0 ? "both" : row.postings > 0 ? "job_board" : "student_aspirations",
    }))
}

// Students first — an unmatched wish is a gap in what we can tell someone — then postings.
const byPriority = (left, right) => right.aspirations - left.aspirations || right.postings - left.postings || left.key.localeCompare(right.key)

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
].join("\n")

const checkAssessment = (json) => LEVELS.includes(json.aiResilience) && GROWTH.includes(json.growth)

const voyageEmbed = () => {
    const apiKey = process.env.VOYAGE_API_KEY
    if (!apiKey) return null
    const model = process.env.Embedding_Model || professionEmbeddings.model
    return (texts) => embedQuery(texts, { apiKey, model, dimensions: professionEmbeddings.dimensions })
}

const runCareerScout = async ({
    research = createResearchClient(),
    adzuna = createAdzuna(),
    embed = voyageEmbed(),
    embeddings = professionEmbeddings.embeddings,
    now = new Date(),
} = {}) => {
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
    const pool = mergeSources(countTitles(titles), countAspirations(recommendations)).sort(byPriority).slice(0, MAX_EMBEDDED)

    const result = { postingsRead: titles.length, adzuna: adzuna ? "used" : "skipped (no keys)", considered: pool.length, listed: 0, assessed: 0, refused: [], failed: [] }
    if (pool.length === 0) return result

    const vectors = await embed(pool.map((row) => row.title))
    const candidates = pool
        .map((row, index) => ({ ...row, ...classifyAgainstCareers(vectors[index], embeddings) }))
        .filter((row) => row.kind !== "known")
        .slice(0, maxCandidates())

    for (const candidate of candidates) {
        const existing = await ScoutCandidate.findOne({ key: candidate.key }).lean()
        const previousCounts = existing && Array.isArray(existing.postingCounts) ? existing.postingCounts.slice(-6) : []
        const source = existing && existing.source !== candidate.source ? "both" : candidate.source

        const update = {
            $set: { title: candidate.title, source, kind: candidate.kind, nearest: candidate.nearest, aspirationCount: candidate.aspirations, lastSeenAt: now },
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

module.exports = { runCareerScout, normaliseTitle, countTitles, countAspirations, mergeSources, classifyAgainstCareers, byPriority, MIN_POSTINGS }
