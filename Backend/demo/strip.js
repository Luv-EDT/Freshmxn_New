// WHAT A CAREER MAY CARRY OUT OF THE SERVER, COPIED from Routers/reportsRouter.js (not exported there, and
// the demo must not change that file). The fixture "DEMO PARITY" checks the copy still matches: the demo
// report honours the same rule as the real one — match_confidence never leaves the server, and every
// factor goes out under its plain label.
const { FACTOR_LABELS } = require("../workers/reportComposer")

const FORBIDDEN_FIELDS = ["match_confidence", "activity_match_confidence"]

const labelFactor = (entry) => ({
    ...entry,
    factor: FACTOR_LABELS[entry.factor] || String(entry.factor).replace(/_/g, " "),
    slug: entry.factor,
})

const withLabels = (list) => (Array.isArray(list) ? list.map(labelFactor) : [])

const stripInternal = (entry) => {
    // Round 13 (owner): the "Partial · N% measured" coverage line moved off the careers to the
    // assessment page and profile only, so nothing about coverage goes out with a career any more.
    const clean = { ...entry }
    FORBIDDEN_FIELDS.forEach((field) => { delete clean[field] })

    clean.supportingFactors = withLabels(clean.supportingFactors)
    clean.divergingFactors = withLabels(clean.divergingFactors)

    return clean
}

module.exports = { FORBIDDEN_FIELDS, stripInternal }
