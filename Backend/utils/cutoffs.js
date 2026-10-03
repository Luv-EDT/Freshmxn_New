// LAST YEAR'S CLOSING RANKS (owner, Round 12) — data/cutoffs.json, plus the values an admin approved
// from the study bot (model/cutoffOverridesModel.js).
//
// SHOWN ONLY WHEN CHECKED. A draft row — what search summaries said — never reaches a student. A
// checked row is shown with its year, round, category, quota and seat pool, the caveat that ranks
// change every year and differ by category, and the official page to check. Every discipline with
// an official counselling body gets that link even when no row is checked yet.

const cutoffs = require("../data/cutoffs.json")

const CAVEAT = "Ranks change every year and are different for each category, quota and seat pool — check the official page for yours."

// the row with an approved check laid over it
const applyCutoffOverride = (row, override) => {
    if (!override || !override.approvedAt || !override.values) return row
    return {
        ...row,
        ...override.values,
        status: "checked",
        checked_on: new Date(override.approvedAt).toISOString().slice(0, 10),
    }
}

const isShowable = (row) => row.status === "checked"
    && Number.isInteger(row.closing_rank) && row.closing_rank > 0
    && Number.isInteger(row.year) && typeof row.round === "string" && row.round !== ""
    && typeof row.category === "string" && row.category !== ""
    && typeof row.source_url === "string" && row.source_url.startsWith("https://")

// { sources: [{ name, url, how, noRank }], rows: [...], caveat } for a discipline, or null
const cutoffsFor = (disciplineId, overrides = new Map()) => {
    const sources = Object.values(cutoffs.sources).filter((source) => source.disciplines.includes(disciplineId))
    if (sources.length === 0) return null
    const rows = cutoffs.rows
        .filter((row) => row.discipline === disciplineId)
        .map((row) => applyCutoffOverride(row, overrides.get(row.id)))
        .filter(isShowable)
        .map((row) => ({
            institution: row.institution,
            programme: row.programme,
            closingRank: row.closing_rank,
            year: row.year,
            round: row.round,
            category: row.category,
            quota: row.quota,
            seatPool: row.seat_pool,
            sourceUrl: row.source_url,
            checkedOn: row.checked_on,
        }))
    return {
        sources: sources.map((source) => ({ name: source.name, url: source.archive || source.url, how: source.how, noRank: Boolean(source.no_rank) })),
        rows,
        caveat: CAVEAT,
    }
}

module.exports = { cutoffs, cutoffsFor, applyCutoffOverride, isShowable, CAVEAT }
