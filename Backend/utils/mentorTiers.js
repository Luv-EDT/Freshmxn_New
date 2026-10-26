// MENTOR TIERS, REGIONS AND PAY (owner, Round 34). One table, read by the payout rows and the admin
// screens, so a rate change never touches a payout already written (each row keeps its own amount).
//
//     Tier 1   a new, approved mentor
//     Tier 2   AUTOMATIC at 7 sessions with feedback, an average of at least 8/10 and no upheld report
//     Tier 3   BY THE ADMIN, once a mentor has 10+ sessions, an average of at least 8/10, a skills
//              roadmap and a review of their profession's data
//
//                      Indian       International
//     Tier 1           ₹1,000       ₹1,500 ($15)
//     Tier 2           ₹1,300       ₹1,900 ($19)
//     Tier 3           ₹1,500+      ₹2,200+ ($22)   — "+": the admin may set a higher rate per mentor
//
// A mentor is International when they live abroad (an Indian living abroad), Indian otherwise.
// The first follow-up is part of the main fee; a later, separately booked follow-up pays 30% of the
// mentor's main rate.

const REGIONS = ["indian", "international"]

const RATES = {
    indian: { 1: { inr: 1000 }, 2: { inr: 1300 }, 3: { inr: 1500 } },
    international: { 1: { inr: 1500, usd: 15 }, 2: { inr: 1900, usd: 19 }, 3: { inr: 2200, usd: 22 } },
}

const FOLLOW_UP_SHARE = 0.3

const RULES = {
    tier2Sessions: 7,
    tier3Sessions: 10,
    minAverage: 8,
    roadmapMinSteps: 3,
}

const regionOf = (mentor) => (mentor && REGIONS.includes(mentor.region) ? mentor.region : "indian")
const tierOf = (mentor) => ([1, 2, 3].includes(Number(mentor && mentor.tier)) ? Number(mentor.tier) : 1)

// what one main session pays this mentor today: { inr, usd? }. A Tier-3 custom rate counts only when
// it is above the table's.
const mainRate = (mentor) => {
    const region = regionOf(mentor)
    const tier = tierOf(mentor)
    const base = RATES[region][tier]
    if (tier === 3 && Number(mentor.customRateInr) > base.inr) {
        return { inr: Number(mentor.customRateInr), ...(region === "international" ? { usd: Number(mentor.customRateUsd) || base.usd } : {}) }
    }
    return { ...base }
}

// a payout's amount by kind: "main" | "followup"
const payoutAmount = (mentor, kind = "main") => {
    const rate = mainRate(mentor)
    if (kind !== "followup") return rate
    return {
        inr: Math.round(rate.inr * FOLLOW_UP_SHARE),
        ...(rate.usd ? { usd: Math.round(rate.usd * FOLLOW_UP_SHARE * 100) / 100 } : {}),
    }
}

// sessions with feedback and their average rating, from the mentor's session reviews
const statsOf = (reviews = []) => {
    const ratings = reviews.map((review) => Number(review.rating)).filter((rating) => Number.isFinite(rating))
    const average = ratings.length ? Math.round((ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length) * 10) / 10 : null
    return { sessions: ratings.length, average }
}

// Tier 2 needs no one: 7 sessions, average ≥ 8, nothing upheld against them
const tier2Due = (mentor, stats, upheldReports = 0) => tierOf(mentor) === 1
    && stats.sessions >= RULES.tier2Sessions
    && stats.average !== null && stats.average >= RULES.minAverage
    && upheldReports === 0

// Tier 3 is the admin's call; this says when the button may appear, and what is still missing
const tier3Missing = (mentor, stats, { roadmapSteps = 0, dataReviewed = false, upheldReports = 0 } = {}) => [
    tierOf(mentor) === 3 && "already Tier 3",
    stats.sessions < RULES.tier3Sessions && `${RULES.tier3Sessions - stats.sessions} more session${RULES.tier3Sessions - stats.sessions === 1 ? "" : "s"} with feedback`,
    (stats.average === null || stats.average < RULES.minAverage) && `an average rating of ${RULES.minAverage}/10 or more`,
    roadmapSteps < RULES.roadmapMinSteps && "a skills roadmap",
    !dataReviewed && "a review of their profession's data",
    upheldReports > 0 && "no upheld report",
].filter(Boolean)

module.exports = { REGIONS, RATES, FOLLOW_UP_SHARE, RULES, regionOf, tierOf, mainRate, payoutAmount, statsOf, tier2Due, tier3Missing }
