// THE THREE PLANS (owner, Round 12). The site says "plan" and uses these names; "Tier 1/2/3" stays
// in code and on admin screens only.
//
//     tier 1  Career Discovery     ₹2,499   the assessment and the report
//     tier 2  Discovery + Mentor   ₹5,499   both
//     tier 3  Mentor Only          ₹2,999   a mentor, with no assessment or report
//
// The numbers are not an ordering any more — a tier-3 student does not "have more" than a tier-1
// one. What a plan gives is `grants(tier)`, and every check that used `currentTier >= tier` asks
// `owns(current, requested)` instead.
//
// Prices are module constants, never env vars: a missing env var must never mean a ₹0 charge.

const TIER_PRICE_INR = {
    1: 2499,
    2: 5499,
    3: 2999,
}

const PLAN_NAMES = {
    1: "Career Discovery",
    2: "Discovery + Mentor",
    3: "Mentor Only",
}

const TIERS = [1, 2, 3]

const grants = (tier) => ({
    discovery: tier === 1 || tier === 2,
    mentor: tier === 2 || tier === 3,
})

// A student owns a plan when what they already have covers everything it gives.
const owns = (currentTier, requestedTier, paid = true) => {
    if (!paid || !TIERS.includes(Number(currentTier))) return false
    const have = grants(Number(currentTier))
    const want = grants(Number(requestedTier))
    return (!want.discovery || have.discovery) && (!want.mentor || have.mentor)
}

// The only upgrades: adding the mentor to Discovery (1 → 2) and adding Discovery to Mentor Only
// (3 → 2). Each costs the difference. Buying Mentor Only while on Discovery is refused — the
// upgrade to the full plan is the same thing for the same money; likewise Discovery on Mentor Only.
const UPGRADES = { "1-2": true, "3-2": true }

const isUpgrade = (currentTier, requestedTier, paid = true) => Boolean(paid && UPGRADES[`${currentTier}-${requestedTier}`])

const upgradePrice = (currentTier, requestedTier) => TIER_PRICE_INR[requestedTier] - TIER_PRICE_INR[currentTier]

// null when the purchase is allowed, otherwise the message to show
const purchaseProblem = (currentTier, requestedTier, paid) => {
    const requested = Number(requestedTier)
    if (!TIERS.includes(requested)) return "Invalid plan"
    if (owns(currentTier, requested, paid)) return "You already have this plan"
    if (paid && Number(currentTier) === 1 && requested === 3) return "You have Career Discovery — add a mentor with the Discovery + Mentor upgrade instead"
    if (paid && Number(currentTier) === 3 && requested === 1) return "You have Mentor Only — add Career Discovery with the Discovery + Mentor upgrade instead"
    return null
}

module.exports = { TIER_PRICE_INR, PLAN_NAMES, TIERS, grants, owns, isUpgrade, upgradePrice, purchaseProblem, UPGRADES }
