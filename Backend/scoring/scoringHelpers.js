// Shared primitives for the scoring engine. Deliberately small: letter parsing, the coverage gate,
// and the one weighted-combine function every composite goes through.
//
// The thresholds here mirror perspective_scoring_final.js exactly (80% answered, 0.6 surviving
// weight) so the ported half and the half written here behave identically.

const FULL_COVERAGE = 0.999      // floating point: "all of them"
const MIN_COVERAGE = 0.8         // under this, a block is not scored at all
const MIN_USED_WEIGHT = 0.6      // under this much surviving weight, a composite is not scored

// answers arrive either as a bare letter ("D") or as the rendered option ("D) Moderately accurate").
// Only the leading character is read, exactly as the ported perspective scorer does.
const letterOf = (answer) => {
    if (typeof answer !== "string" || answer.length === 0) return null

    const letter = answer.charAt(0).toUpperCase()

    return letter >= "A" && letter <= "E" ? letter : null
}

// A–E → 1–5 on the standard Likert scale used by IPIP, MI, Rosenberg and the confidence items
const LIKERT_VALUE = { A: 1, B: 2, C: 3, D: 4, E: 5 }

const likertOf = (answer) => {
    const letter = letterOf(answer)

    return letter === null ? null : LIKERT_VALUE[letter]
}

// how much of a block the student actually answered
const coverageOf = (answers, itemIds) => {
    const source = answers || {}
    const answered = itemIds.filter((id) => likertOf(source[id]) !== null).length

    return itemIds.length === 0 ? 0 : answered / itemIds.length
}

// full | partial | null — null means "do not report a score at all"
const qualityFromCoverage = (ratio) => {
    if (ratio >= FULL_COVERAGE) return "full"
    if (ratio >= MIN_COVERAGE) return "partial"

    return null
}

// Principle 5 — no factor may report higher confidence than its weakest input.
// A null quality anywhere means the input was absent, which is at best "partial" downstream.
const worstQuality = (qualities) => {
    const present = qualities.filter((quality) => quality !== undefined)

    if (present.length === 0) return null
    if (present.some((quality) => quality === null)) return "partial"

    return present.some((quality) => quality === "partial") ? "partial" : "full"
}

// The single path every weighted composite takes.
//
//   parts: [{ value, weight, quality, primary }]
//
// Nulls are dropped and the surviving weights renormalise — they are never imputed and never
// treated as zero, which would silently drag a factor down. Two ways a factor refuses to report:
// too little surviving weight, or a missing `primary` input. `primary` marks a directly-measured
// component that the supporting inputs are not allowed to stand in for (Principle 1 — a factor is
// never rebuilt out of its supports).
const combine = (parts, options = {}) => {
    const minUsedWeight = options.minUsedWeight === undefined ? MIN_USED_WEIGHT : options.minUsedWeight

    const missingPrimary = parts.some((part) => part.primary && (part.value === null || part.value === undefined))

    if (missingPrimary) {
        return { value: null, quality: null }
    }

    const used = parts.filter((part) => part.value !== null && part.value !== undefined)
    const usedWeight = used.reduce((sum, part) => sum + part.weight, 0)

    if (usedWeight < minUsedWeight) {
        return { value: null, quality: null }
    }

    const value = used.reduce((sum, part) => sum + part.value * part.weight, 0) / usedWeight

    // losing any weight at all means something was missing, so the result is at best partial
    const ownQuality = usedWeight >= FULL_COVERAGE ? "full" : "partial"

    return {
        value: round2(value),
        quality: worstQuality([ownQuality, ...used.map((part) => part.quality)]),
    }
}

const round2 = (value) => (value === null || value === undefined ? null : Math.round(value * 100) / 100)

const clamp = (value, low, high) => Math.min(Math.max(value, low), high)

module.exports = {
    FULL_COVERAGE,
    MIN_COVERAGE,
    MIN_USED_WEIGHT,
    letterOf,
    likertOf,
    coverageOf,
    qualityFromCoverage,
    worstQuality,
    combine,
    round2,
    clamp,
}
