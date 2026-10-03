// HALF-PRICE RESEARCH (owner, Round 12). The monthly data refresh and study bot nobody waits on, so
// instead of asking Claude one question at a time they can hand Anthropic every question in one
// Message Batch: the same requests, at half the token price, answered in the background — usually
// within the hour, at most 24 hours (Anthropic's batch docs, read 3 October 2026; web search works
// inside a batch, and a search that pauses comes back as pause_turn).
//
//     submitBatch     the job prepared its questions; send them as one batch and remember them
//     collectBatches  every hour (batch_collect): for each finished batch, read the answers, check
//                     them exactly as the normal job would, and file the proposals. Anything that came
//                     back paused, refused, cut off, unreadable, errored or expired is asked again the
//                     normal way, one at a time (which has the fallback model).
//
// The checking and filing are the jobs' own handleItem functions, so a batched answer and a direct
// one end in exactly the same proposals. Nothing here decides anything.
//
// RESEARCH_BATCH=false turns it off; the jobs then ask directly, as before.

const { searchRequest, sourcesOf, textOf, parseJsonReply, createResearchClient } = require("./claudeResearch")
const { recordUsage } = require("../utils/aiUsage")

const BATCH_ENDPOINT = "https://api.anthropic.com/v1/messages/batches"
const FALLBACK_BETA = "server-side-fallback-2026-07-01"
const STUCK_MS = 2 * 60 * 60 * 1000      // a collection that died half-way is picked up again after this
const REQUEST_TIMEOUT_MS = 120000

const batchEnabled = () => process.env.RESEARCH_BATCH !== "false"

// the jobs that can be batched, and where their checking and filing live
const HANDLERS = {
    data_refresh: () => require("./dataRefresh"),
    study_refresh: () => require("./studyRefresh"),
}

// custom_id must match ^[a-zA-Z0-9_-]{1,64}$ and be unique in the batch — the position makes it so
const customIdFor = (index, item) => `${index}-${item.kind}-${item.id}`.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 64)

const createBatchApi = ({ apiKey, fetchImpl = fetch }) => {
    const headers = (withFallback) => ({
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        ...(withFallback ? { "anthropic-beta": FALLBACK_BETA } : {}),
        "content-type": "application/json",
    })
    const send = async (url, options) => {
        const response = await fetchImpl(url, { ...options, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) })
        if (!response.ok) {
            const error = new Error(`Anthropic batch HTTP ${response.status} — ${(await response.text()).slice(0, 300)}`)
            error.status = response.status
            throw error
        }
        return response
    }

    return {
        create: async (requests, withFallback) => (await send(BATCH_ENDPOINT, { method: "POST", headers: headers(withFallback), body: JSON.stringify({ requests }) })).json(),
        retrieve: async (batchId) => (await send(`${BATCH_ENDPOINT}/${batchId}`, { method: "GET", headers: headers(false) })).json(),
        // JSON Lines, one result per request, in any order
        results: async (url) => (await (await send(url, { method: "GET", headers: headers(false) })).text())
            .split("\n")
            .filter((line) => line.trim() !== "")
            .map((line) => JSON.parse(line)),
    }
}

// Send the prepared questions. Returns { batchId, items } or null — null means "ask directly instead".
const submitBatch = async ({ job, items, model, apiKey = process.env.ANTHROPIC_API_KEY, fetchImpl = fetch }) => {
    if (!apiKey || !HANDLERS[job] || items.length === 0) return null
    const ResearchBatch = require("../model/researchBatchesModel")
    const api = createBatchApi({ apiKey, fetchImpl })

    const stored = items.map((item, index) => ({ ...item, customId: customIdFor(index, item) }))
    const requests = stored.map((item) => ({ custom_id: item.customId, params: searchRequest({ model, ...item.request }) }))

    let batch
    try {
        batch = await api.create(requests, true)
    } catch (error) {
        if (error.status !== 400) {
            console.error(`${job}: could not submit the batch — ${error.message}; asking directly instead`)
            return null
        }
        // a batch may not take the server-side fallback; the direct retries in collectBatches still have it
        try {
            batch = await api.create(requests.map((request) => {
                const { fallbacks, ...params } = request.params
                return { ...request, params }
            }), false)
        } catch (retryError) {
            console.error(`${job}: the batch was refused twice — ${retryError.message}; asking directly instead`)
            return null
        }
    }

    await ResearchBatch.create({ batchId: batch.id, job, model, items: stored })
    return { batchId: batch.id, items: stored.length }
}

// A batched answer, read the way askJson reads a direct one — or null when it must be asked again.
const replyFrom = (message, check) => {
    if (!message || !Array.isArray(message.content)) return null
    if (["refusal", "pause_turn", "max_tokens"].includes(message.stop_reason)) return null
    const json = parseJsonReply(textOf(message.content))
    if (!json || !check(json)) return null
    return { json, sources: sourcesOf(message.content) }
}

const collectBatches = async ({
    apiKey = process.env.ANTHROPIC_API_KEY,
    fetchImpl = fetch,
    research,             // the direct client for retries; built per job from the batch's model if not given
    now = new Date(),
} = {}) => {
    if (!apiKey) return { skipped: "ANTHROPIC_API_KEY is not set" }
    const ResearchBatch = require("../model/researchBatchesModel")
    const api = createBatchApi({ apiKey, fetchImpl })

    const due = await ResearchBatch.find({
        $or: [
            { status: "submitted" },
            { status: "collecting", collectingAt: { $lt: new Date(now.getTime() - STUCK_MS) } },
        ],
    }).sort({ submittedAt: 1 }).lean()

    const summary = { waiting: 0, collected: 0, handled: 0, retried: 0, failed: 0 }

    for (const batch of due) {
        try {
            const info = await api.retrieve(batch.batchId)
            if (info.processing_status !== "ended") {
                summary.waiting += 1
                continue
            }

            // claim it, so two workers (or a slow run and the next hour's) never file it twice
            const claimed = await ResearchBatch.findOneAndUpdate({ _id: batch._id, status: batch.status }, { $set: { status: "collecting", collectingAt: now } })
            if (!claimed) continue

            const lines = await api.results(info.results_url)
            const resultFor = new Map(lines.map((line) => [line.custom_id, line.result]))
            const handler = HANDLERS[batch.job]()
            const result = handler.newResult()
            const direct = research || createResearchClient({ job: batch.job, model: batch.model, apiKey, fetchImpl })

            for (const item of batch.items) {
                const outcome = resultFor.get(item.customId)
                let reply = null
                if (outcome && outcome.type === "succeeded") {
                    recordUsage(`${batch.job}:batch`, batch.model, outcome.message)
                    reply = replyFrom(outcome.message, handler.check)
                }
                try {
                    if (reply) {
                        item.outcome = "handled"
                        summary.handled += 1
                    } else {
                        reply = await direct.askJson({ ...item.request, check: handler.check })
                        item.outcome = "retried"
                        summary.retried += 1
                    }
                    await handler.handleItem(item, reply, { now, result })
                } catch (error) {
                    console.error(`batch_collect: ${batch.job} ${item.id} failed — ${error.message}`)
                    item.outcome = "failed"
                    result.failed.push(item.id)
                    summary.failed += 1
                }
            }

            await ResearchBatch.updateOne({ _id: batch._id }, { $set: { status: "collected", collectedAt: now, items: batch.items, summary: result } })
            summary.collected += 1
            console.log(`batch_collect: ${batch.job} ${batch.batchId} — ${JSON.stringify(result).slice(0, 300)}`)
        } catch (error) {
            console.error(`batch_collect: ${batch.batchId} — ${error.message}`)
        }
    }

    return summary
}

module.exports = { submitBatch, collectBatches, replyFrom, customIdFor, batchEnabled, createBatchApi, HANDLERS }
