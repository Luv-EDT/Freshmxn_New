// HOW MANY OF THE 31 FACTORS CAN BE MEASURED FROM WHAT A STUDENT HAS FINISHED (owner, Round 10,
// item 3): the "N of 31 factors measured so far" line on the assessment page.
//
// A mirror of Backend/scoring/scoreProfile.js's inputs, at the level of whole sections: each factor
// lists the sections it is built from, with their weight, and a factor counts once its primary
// section is done and at least 60% of its weight is present — the same two rules combine() applies
// to the real scores. It is a progress guide, not a score: the real coverage per factor (items
// answered, written answers graded) is computed by the scorer and shown on the Profile.
//
// No imports, so the pipeline fixtures can load it in Node.

// a section group is satisfied by any one of its sections
const GROUPS = {
    ipip: ["ipip50"],
    mi: ["mi"],
    reasoning: ["reasoning", "extReasoning"],
    stm: ["digitSpan", "wordRecall", "extVerbal"],
    story: ["storyRecall"],
    sart: ["sartRaw"],
    conf: ["rosenberg", "confidence"],
    persp: ["perspective"],
}

const leaf = (group) => [{ group, weight: 1, primary: true }]

export const FACTOR_FEEDS = {
    openness: leaf("ipip"),
    conscientiousness: leaf("ipip"),
    agreeableness: leaf("ipip"),
    extraversion: leaf("ipip"),
    emotional_stability: leaf("ipip"),
    verbal_intelligence: leaf("mi"),
    spatial_intelligence: leaf("mi"),
    musical_intelligence: leaf("mi"),
    bodily_intelligence: leaf("mi"),
    naturalistic_intelligence: leaf("mi"),
    existential_intelligence: leaf("mi"),
    logical_intelligence: leaf("mi"),
    reasoning: leaf("reasoning"),
    short_term_memory: leaf("stm"),
    long_term_memory: leaf("story"),
    processing_speed: leaf("sart"),
    uncertainty_tolerance: leaf("persp"),
    confidence: [{ group: "conf", weight: 0.55, primary: true }, { group: "ipip", weight: 0.3 }, { group: "reasoning", weight: 0.15 }],
    emotional_intelligence: [{ group: "persp", weight: 0.4, primary: true }, { group: "ipip", weight: 0.4 }, { group: "reasoning", weight: 0.2 }],
    firmness: [{ group: "persp", weight: 0.6, primary: true }, { group: "conf", weight: 0.2 }, { group: "ipip", weight: 0.2 }],
    focus: [{ group: "persp", weight: 0.35, primary: true }, { group: "sart", weight: 0.3 }, { group: "stm", weight: 0.2 }, { group: "reasoning", weight: 0.15 }],
    intrapersonal_intelligence: [{ group: "persp", weight: 0.8, primary: true }, { group: "ipip", weight: 0.2 }],
    informed_decision_making: [{ group: "reasoning", weight: 0.4, primary: true }, { group: "persp", weight: 0.3 }, { group: "ipip", weight: 0.3 }],
    consistency_grit: [{ group: "ipip", weight: 0.35, primary: true }, { group: "persp", weight: 0.5 }, { group: "reasoning", weight: 0.15 }],
    learning_capacity: [{ group: "reasoning", weight: 0.25 }, { group: "persp", weight: 0.25 }, { group: "ipip", weight: 0.2 }, { group: "story", weight: 0.15 }, { group: "sart", weight: 0.15 }],
    convergent_thinking: [{ group: "ipip", weight: 0.2 }, { group: "reasoning", weight: 0.2 }, { group: "stm", weight: 0.15 }, { group: "story", weight: 0.15 }, { group: "mi", weight: 0.15 }, { group: "sart", weight: 0.15 }],
    practical_intelligence: [{ group: "ipip", weight: 0.4 }, { group: "stm", weight: 0.2 }, { group: "reasoning", weight: 0.2 }, { group: "conf", weight: 0.2 }],
    divergent_thinking: [{ group: "ipip", weight: 0.5 }, { group: "reasoning", weight: 0.25 }, { group: "stm", weight: 0.25 }],
    collaboration: [{ group: "ipip", weight: 0.67 }, { group: "mi", weight: 0.17 }, { group: "conf", weight: 0.16 }],
    interpersonal_intelligence: [{ group: "ipip", weight: 0.4 }, { group: "mi", weight: 0.2 }, { group: "stm", weight: 0.2 }, { group: "persp", weight: 0.2 }],
    propensity_to_go_deep: [{ group: "mi", weight: 0.25 }, { group: "ipip", weight: 0.25 }, { group: "reasoning", weight: 0.25 }, { group: "story", weight: 0.25 }],
}

export const FACTOR_TOTAL = Object.keys(FACTOR_FEEDS).length

const groupDone = (group, done) => GROUPS[group].some((key) => done.includes(key))

// `done` is the list of completed module keys (assessmentModules.completedModules)
export const measurableFactors = (done) => Object.entries(FACTOR_FEEDS)
    .filter(([, parts]) => {
        if (parts.some((part) => part.primary && !groupDone(part.group, done))) return false
        const present = parts.filter((part) => groupDone(part.group, done)).reduce((sum, part) => sum + part.weight, 0)
        return present >= 0.6 - 1e-9
    })
    .map(([factor]) => factor)

export const factorCoverage = (done) => {
    const count = measurableFactors(done || []).length
    return { count, total: FACTOR_TOTAL, pct: Math.round((count / FACTOR_TOTAL) * 100) }
}
