// THE RESEARCH CLIENT for the two calendar jobs that read the outside world (Round 10, S9): the
// monthly data refresh and the weekly careers scout. One question in, one JSON answer plus the
// pages it came from out.
//
// WEB SEARCH IS LIMITED TO NAMED SOURCES. The owner's rule is "legal sources only": government
// labour statistics, the published industry reports, never scraping LinkedIn or X. allowed_domains
// is enforced by the API, not asked of the model.
//
// NO STRUCTURED-OUTPUT MODE. Web search always returns citations, and the API rejects citations
// together with output_config.format (400). So the JSON is asked for in the prompt and checked here
// — the same discipline as reportComposer.checkReply: parse, check, ask once more, then give up.
//
// fallbacks: "default" is on. If the model declines a request, the API re-runs it on Anthropic's
// recommended fallback model instead of returning a refusal; a refusal that survives that is
// skipped and logged, never retried.

const ANTHROPIC_ENDPOINT = "https://api.anthropic.com/v1/messages"
const { recordUsage } = require("../utils/aiUsage")

const SOURCE_DOMAINS = [
    "mospi.gov.in",                  // PLFS — the government's labour force survey
    "pib.gov.in",                    // where MoSPI's PLFS releases are published
    "ncs.gov.in",                    // National Career Service
    "wheebox.com",                   // India Skills Report
    "naukri.com",                    // Naukri JobSpeak
    "economicgraph.linkedin.com",    // LinkedIn's published Economic Graph reports (reports only)
]

const MAX_RETRIES = 4
const MAX_RESUMES = 2
const REQUEST_TIMEOUT_MS = 180000

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const permanent = (message) => {
    const error = new Error(message)
    error.permanent = true
    return error
}

// same rule as reportComposer.isTransient: a 400 will be a 400 again
const isTransient = (error) => {
    if (error.permanent) return false
    const status = error.status
    if (typeof status !== "number") return true
    return status === 408 || status === 409 || status === 429 || status >= 500
}

// The pages a reply actually drew on: the search results it was handed and the ones its text cites.
// A failed search comes back as a result block holding an error object, not a list — skipped.
const sourcesOf = (content) => {
    const seen = new Map()
    const add = (url, title) => {
        if (typeof url === "string" && url.startsWith("http") && !seen.has(url)) seen.set(url, { url, title: title ? String(title).slice(0, 200) : null })
    }

    ;(content || []).forEach((block) => {
        if (block.type === "web_search_tool_result" && Array.isArray(block.content)) {
            block.content.forEach((result) => add(result.url, result.title))
        }
        if (block.type === "text" && Array.isArray(block.citations)) {
            block.citations.forEach((citation) => add(citation.url, citation.title))
        }
    })

    return [...seen.values()]
}

// the last JSON object in the reply text (the model may say a line before it)
const parseJsonReply = (text) => {
    const start = String(text || "").indexOf("{")
    const end = String(text || "").lastIndexOf("}")
    if (start === -1 || end <= start) return null
    try {
        return JSON.parse(text.slice(start, end + 1))
    } catch (error) {
        return null
    }
}

const createResearchClient = ({
    apiKey = process.env.ANTHROPIC_API_KEY,
    model = process.env.REFRESH_MODEL || "claude-opus-5-5",
    fetchImpl = fetch,
    domains = SOURCE_DOMAINS,
    job = "research",      // the label on the AI usage log: data_refresh, career_scout, study_refresh, draft_career
} = {}) => {
    if (!apiKey) return null

    const post = async (body) => {
        for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
            let waitMs = Math.min(2000 * 2 ** (attempt - 1), 15000)
            try {
                const response = await fetchImpl(ANTHROPIC_ENDPOINT, {
                    method: "POST",
                    headers: {
                        "x-api-key": apiKey,
                        "anthropic-version": "2023-06-01",
                        "anthropic-beta": "server-side-fallback-2026-07-01",
                        "content-type": "application/json",
                    },
                    body: JSON.stringify(body),
                    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
                })

                if (!response.ok) {
                    const error = new Error(`Anthropic HTTP ${response.status} — ${(await response.text()).slice(0, 300)}`)
                    error.status = response.status
                    const retryAfter = Number(response.headers.get("retry-after"))
                    if (retryAfter > 0) waitMs = Math.min(retryAfter * 1000, 60000)
                    throw error
                }

                const payload = await response.json()
                recordUsage(job, body.model, payload)
                return payload
            } catch (error) {
                if (attempt === MAX_RETRIES || !isTransient(error)) throw error
                await sleep(waitMs)
            }
        }
        return null
    }

    // { text, sources, refused } — refused is true when even the fallback declined
    // `onlyDomains` narrows the search for one call (the study bot checks an exam on its own site)
    const ask = async ({ system, user, maxUses = 3, maxTokens = 4000, onlyDomains = domains }) => {
        const messages = [{ role: "user", content: user }]
        const content = []

        for (let resume = 0; resume <= MAX_RESUMES; resume += 1) {
            const payload = await post({
                model,
                max_tokens: maxTokens,
                fallbacks: "default",
                thinking: { type: "adaptive" },
                // cached (Round 11): the same instructions go out for every career, exam or title
                system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
                messages,
                tools: [{ type: "web_search_20260209", name: "web_search", allowed_domains: onlyDomains, max_uses: maxUses }],
            })

            if (payload.stop_reason === "refusal") return { text: "", sources: [], refused: true }
            if (!Array.isArray(payload.content)) throw new Error("research reply had no content")
            content.push(...payload.content)

            if (payload.stop_reason === "max_tokens") throw permanent("research reply hit max_tokens")

            // The server's search loop paused: send the turn back as it is and it carries on.
            if (payload.stop_reason === "pause_turn") {
                messages.push({ role: "assistant", content: payload.content })
                continue
            }

            break
        }

        const text = content.filter((block) => block.type === "text").map((block) => block.text || "").join("")
        return { text, sources: sourcesOf(content), refused: false }
    }

    // ask, parse, check — and ask once more with the rule restated before giving up
    const askJson = async ({ system, user, check, maxUses, maxTokens, onlyDomains }) => {
        const first = await ask({ system, user, maxUses, maxTokens, onlyDomains })
        if (first.refused) return { refused: true }
        const parsed = parseJsonReply(first.text)
        if (parsed && check(parsed)) return { json: parsed, sources: first.sources }

        const second = await ask({ system, user: `${user}\n\nYour previous reply could not be read. Reply with ONLY the JSON object described above.`, maxUses: 1, maxTokens, onlyDomains })
        if (second.refused) return { refused: true }
        const again = parseJsonReply(second.text)
        if (again && check(again)) return { json: again, sources: [...first.sources, ...second.sources] }

        return { unreadable: true }
    }

    // NO web search — for work that must not look anything up (the rating passes judge the record
    // they are given against the anchors, exactly as tools/rateProfessions.js did).
    const askPlain = async ({ system, user, maxTokens = 6000, plainModel = model }) => {
        const payload = await post({
            model: plainModel,
            max_tokens: maxTokens,
            fallbacks: "default",
            system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
            messages: [{ role: "user", content: user }],
        })
        if (payload.stop_reason === "refusal") return { text: "", refused: true }
        if (payload.stop_reason === "max_tokens") throw permanent("reply hit max_tokens")
        if (!Array.isArray(payload.content)) throw new Error("reply had no content")
        return { text: payload.content.filter((block) => block.type === "text").map((block) => block.text || "").join(""), refused: false }
    }

    return { ask, askJson, askPlain, model }
}

module.exports = { createResearchClient, sourcesOf, parseJsonReply, isTransient, SOURCE_DOMAINS }
