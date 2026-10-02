// THE ADMIN-APPROVED DATA UPDATES, applied to what the career pages show (Round 10, S9).
// See model/professionOverridesModel.js. Read by professionsRouter only — the matching engine never
// imports this file, so an approved number can change a card but never a ranking (fixture).

const DEMAND_LEVELS = ["low", "moderate", "high"]
const RANGE = /^(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)$/

// "3.5-8.0" — a pay range in lakh a year, low before high, within reason
const parseRange = (value) => {
    const match = RANGE.exec(String(value || "").replace(/\s+/g, ""))
    if (!match) return null
    const low = Number(match[1])
    const high = Number(match[2])
    if (!(low > 0) || !(high >= low) || high > 500) return null
    return { low, high }
}

const isValidValue = (field, value) => {
    if (field === "india_demand") return DEMAND_LEVELS.includes(value)
    if (field === "early_earnings_lpa" || field === "mid_career_lpa") return parseRange(value) !== null
    return false
}

const monthOf = (date) => (date ? new Date(date).toISOString().slice(0, 10) : null)

// A copy of the record with the approved values in place. Pay that was approved from sources is
// marked checked on the approval date, so the card's "estimate / checked" label stays honest.
const applyOverride = (profession, override) => {
    const values = override && override.values ? override.values : null
    if (!values) return profession

    const copy = { ...profession }

    if (values.india_demand && isValidValue("india_demand", values.india_demand) && profession.demand_signal) {
        copy.demand_signal = { ...profession.demand_signal, india_demand: values.india_demand }
    }

    const early = values.early_earnings_lpa && parseRange(values.early_earnings_lpa) ? values.early_earnings_lpa : null
    const mid = values.mid_career_lpa && parseRange(values.mid_career_lpa) ? values.mid_career_lpa : null

    if ((early || mid) && profession.economics) {
        const economics = { ...profession.economics }
        if (early) economics.early_earnings_lpa = early
        if (mid) {
            const range = parseRange(mid)
            economics.mid_career_lpa = mid
            economics.mid_career_midpoint = Math.round(((range.low + range.high) / 2) * 10) / 10
        }
        economics.verification = {
            status: "verified",
            sources: (override.sources || []).map((source) => source.url),
            checked_on: monthOf(override.approvedAt),
        }
        copy.economics = economics
    }

    return copy
}

// A small cache: the career pages are read far more often than the admin approves anything, and
// the web service is one process, so approving clears it at once (clearOverrides).
const CACHE_MS = 5 * 60 * 1000
let cache = null
let cachedAt = 0

const getOverrides = async () => {
    if (cache && Date.now() - cachedAt < CACHE_MS) return cache
    const ProfessionOverride = require("../model/professionOverridesModel")
    const rows = await ProfessionOverride.find({ approvedAt: { $ne: null } }).lean()
    cache = new Map(rows.map((row) => [row.professionId, row]))
    cachedAt = Date.now()
    return cache
}

const clearOverrides = () => {
    cache = null
    cachedAt = 0
}

module.exports = { applyOverride, getOverrides, clearOverrides, isValidValue, parseRange, DEMAND_LEVELS }
