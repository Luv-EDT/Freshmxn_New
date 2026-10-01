const { round2 } = require("./scoringHelpers")

// The O*NET Interest Profiler Short Form (owner-supplied, Round 10): 60 work activities, ten per
// RIASEC type, each simply ticked or not — "would you like to do this?". U.S. Department of Labor,
// Employment & Training Administration; National Center for O*NET Development.
//
// USED FOR ONE THING: a second, independent view of six of the seven intelligences (owner: "if it
// can help score the MI factors, use it; else there is no point"). Only the activities that clearly
// belong to one intelligence count towards it; the rest count only towards the RIASEC totals, which
// are stored for V2 (careers have no RIASEC codes yet) and are never shown to a student.
//
// LIKING, NOT ABILITY — exactly like the MI self-report it sits beside. Ability for spatial, logical
// and verbal comes from the reasoning test (scoreProfile's composites).
//
// The block is { answers: { R1: true, I3: false, … }, completedAt }. A block not finished is not
// scored: an unticked box only means "no" once the student has said they are done.
const TYPES = { R: "realistic", I: "investigative", A: "artistic", S: "social", E: "enterprising", C: "conventional" }

// item → the one intelligence it unambiguously points at (Round 10 mapping, owner-reviewed plan)
const MI_ITEMS = {
    musical_intelligence: ["A2", "A3", "A9"],                       // instrument · compose · sing in a band
    verbal_intelligence: ["A1", "A7"],                              // write books or plays · write scripts
    spatial_intelligence: ["A4", "A5", "A6", "A10"],                // draw · special effects · paint sets · edit movies
    bodily_intelligence: ["R1", "R2", "A8", "S1", "S6", "R10"],     // cabinets · brick · dance · exercise · sports · forest fires
    naturalistic_intelligence: ["R4", "I2", "I7", "I8"],            // fish hatchery · water pollution · weather · biology lab
    logical_intelligence: ["I3", "I4", "I6", "C1", "C6"],           // chemistry · planets · cause of a fire · spreadsheet · wages
}

const ALL_ITEMS = Object.keys(TYPES).flatMap((letter) => Array.from({ length: 10 }, (_, index) => `${letter}${index + 1}`))

const scoreInterests60 = (block) => {
    if (!block || !block.completedAt || !block.answers) return { mi: {}, riasec: null, flags: {} }

    const ticked = (id) => block.answers[id] === true
    const flags = {}

    const mi = {}
    Object.entries(MI_ITEMS).forEach(([factor, items]) => {
        mi[factor] = round2((items.filter(ticked).length / items.length) * 10)
    })

    const riasec = {}
    Object.entries(TYPES).forEach(([letter, name]) => {
        riasec[name] = ALL_ITEMS.filter((id) => id.startsWith(letter) && ticked(id)).length
    })

    const total = ALL_ITEMS.filter(ticked).length
    if (total === 0 || total === ALL_ITEMS.length) flags.interests_all_same = true

    return { mi, riasec, flags }
}

module.exports = scoreInterests60
module.exports.MI_ITEMS = MI_ITEMS
module.exports.ALL_ITEMS = ALL_ITEMS
