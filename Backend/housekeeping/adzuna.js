// ADZUNA — the licensed job-board API the owner chose for live posting counts and pay (Round 10,
// S9). India is country code "in". Keys live in Render's environment (ADZUNA_APP_ID,
// ADZUNA_APP_KEY); without them this returns null and both jobs say "Adzuna skipped".
//
// GENTLE ON PURPOSE. The free tier allows about 25 calls a minute, so calls are spaced
// (ADZUNA_DELAY_MS). Adzuna's Indian salary data is thin — many postings carry no pay — so a median
// is only reported when at least MIN_SALARIED postings stand behind it.

const BASE = "https://api.adzuna.com/v1/api/jobs/in"
const MIN_SALARIED = 20
const LAKH = 100000

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const toLpa = (rupees) => (typeof rupees === "number" && rupees > 0 ? Math.round((rupees / LAKH) * 10) / 10 : null)

// histogram is { "<salary lower bound>": postings, ... }. The median bucket's lower bound, in lakh a
// year — a rough figure, labelled as one wherever it is shown.
const medianLpaFromHistogram = (histogram) => {
    const buckets = Object.entries(histogram || {})
        .map(([bound, count]) => [Number(bound), Number(count)])
        .filter(([bound, count]) => Number.isFinite(bound) && count > 0)
        .sort((left, right) => left[0] - right[0])

    const total = buckets.reduce((sum, [, count]) => sum + count, 0)
    if (total < MIN_SALARIED) return null

    let running = 0
    for (const [bound, count] of buckets) {
        running += count
        if (running >= total / 2) return toLpa(bound)
    }
    return null
}

const createAdzuna = ({
    appId = process.env.ADZUNA_APP_ID,
    appKey = process.env.ADZUNA_APP_KEY,
    delayMs = Number(process.env.ADZUNA_DELAY_MS) || 2600,
    fetchImpl = fetch,
} = {}) => {
    if (!appId || !appKey) return null

    let last = 0
    const get = async (path, params) => {
        const wait = last + delayMs - Date.now()
        if (wait > 0) await sleep(wait)
        last = Date.now()

        const query = new URLSearchParams({ app_id: appId, app_key: appKey, "content-type": "application/json", ...params })
        const response = await fetchImpl(`${BASE}/${path}?${query}`, { signal: AbortSignal.timeout(30000) })
        if (!response.ok) throw new Error(`Adzuna HTTP ${response.status}`)
        return response.json()
    }

    // how many live postings, and their mean advertised pay
    const search = async (what) => {
        const data = await get("search/1", { what, results_per_page: "1" })
        return { count: typeof data.count === "number" ? data.count : null, meanLpa: toLpa(data.mean) }
    }

    const histogram = async (what) => {
        const data = await get("histogram", { what })
        return { medianLpa: medianLpaFromHistogram(data.histogram) }
    }

    // the newest postings' titles, for the weekly scout
    const latestTitles = async ({ pages = 10, maxDaysOld = 7 } = {}) => {
        const titles = []
        for (let page = 1; page <= pages; page += 1) {
            const data = await get(`search/${page}`, { results_per_page: "50", max_days_old: String(maxDaysOld), sort_by: "date" })
            const results = Array.isArray(data.results) ? data.results : []
            results.forEach((result) => { if (result && result.title) titles.push(String(result.title)) })
            if (results.length < 50) break
        }
        return titles
    }

    return { search, histogram, latestTitles }
}

module.exports = { createAdzuna, medianLpaFromHistogram, toLpa, MIN_SALARIED }
