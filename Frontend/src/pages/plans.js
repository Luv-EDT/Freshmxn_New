// The three plans as the site names them (owner, Round 12) — the same names the server sends from
// GET /payments/getPricing. Prices are never here: they always come from the server.
export const PLAN_NAMES = {
    0: "No plan yet",
    1: "Career Discovery",
    2: "Discovery + Mentor",
    3: "Mentor Only",
}

// what a plan gives — the same rule as Backend/utils/plans.js
export const hasDiscovery = (user) => Boolean(user && user.paid && (user.currentTier === 1 || user.currentTier === 2))
export const hasMentor = (user) => Boolean(user && user.paid && (user.currentTier === 2 || user.currentTier === 3))
export const isMentorOnly = (user) => Boolean(user && user.paid && user.currentTier === 3)
