// WHAT EACH FACTOR MEANS, IN PLAIN WORDS (owner, Round 18). One table for every place a student
// reads about themselves — the Profile's "Your psychometric profile" and the report's "The four
// fundamentals" — so a factor has one name and one meaning everywhere.
//
// `name` is what the student reads as the heading; `meaning` is a few words on what it is. Neither
// is a verdict: a factor describes how someone works, not how good they are (Master Plan rule 1).
// Levels go out as words only — never the score (reportsRouter, "WORDS, NEVER NUMBERS").
const FACTOR_GUIDE = {
    // the four universals
    confidence: { name: "Confidence", meaning: "Trusting yourself to try, speak up and decide" },
    consistency_grit: { name: "Sticking with things", meaning: "Keeping going on long goals when it gets dull or hard" },
    learning_capacity: { name: "Picking up new material", meaning: "How quickly new ideas and skills settle in" },
    informed_decision_making: { name: "Deciding with good information", meaning: "Checking the facts and options before you choose" },

    // personality
    openness: { name: "Openness to new ideas", meaning: "Enjoying new ideas, art and ways of doing things" },
    conscientiousness: { name: "Being organised and careful", meaning: "Planning, finishing what you start, paying attention to detail" },
    agreeableness: { name: "Getting along", meaning: "Being warm, patient and cooperative with people" },
    extraversion: { name: "Outgoing energy", meaning: "Drawing energy from people and activity" },
    emotional_stability: { name: "Staying calm under pressure", meaning: "Keeping steady when things go wrong" },

    // cognitive abilities
    reasoning: { name: "Reasoning", meaning: "Spotting patterns and working out the answer" },
    short_term_memory: { name: "Short-term memory", meaning: "Holding new information in mind for a moment" },
    long_term_memory: { name: "Long-term memory", meaning: "Remembering what you learned a day or more later" },
    processing_speed: { name: "Speed of response", meaning: "How fast you react and take things in" },
    focus: { name: "Sustained focus", meaning: "Keeping your attention on one task" },
    firmness: { name: "Holding a position", meaning: "Standing by a view you have thought through" },

    // areas you feel drawn to
    verbal_intelligence: { name: "Working with words", meaning: "Reading, writing, explaining and arguing" },
    spatial_intelligence: { name: "Spatial thinking", meaning: "Picturing shapes, spaces and how things fit" },
    musical_intelligence: { name: "Musical sense", meaning: "Rhythm, tune and sound" },
    bodily_intelligence: { name: "Physical skill", meaning: "Using your hands and body with control" },
    naturalistic_intelligence: { name: "Reading the natural world", meaning: "Noticing plants, animals, weather and land" },
    existential_intelligence: { name: "Big-picture questions", meaning: "Wondering about meaning, purpose and why" },
    logical_intelligence: { name: "Logical thinking", meaning: "Numbers, rules and step-by-step problems" },
    intrapersonal_intelligence: { name: "Self-knowledge", meaning: "Understanding your own feelings and reasons" },
    interpersonal_intelligence: { name: "Reading a group", meaning: "Sensing what people around you need" },
    emotional_intelligence: { name: "Reading and handling emotion", meaning: "Noticing feelings and responding well" },
    practical_intelligence: { name: "Making things work in practice", meaning: "Solving real, everyday problems" },

    // how you handle the unknown — a position, never a level
    uncertainty_tolerance: { name: "Working without knowing the outcome", meaning: "Where you sit between wanting a clear plan and being fine not knowing" },

    // ways you solve problems
    divergent_thinking: { name: "Generating many ideas", meaning: "Coming up with lots of different possibilities" },
    convergent_thinking: { name: "Narrowing to one answer", meaning: "Picking the one answer you can defend" },
    collaboration: { name: "Working jointly with others", meaning: "Solving things together rather than alone" },
    propensity_to_go_deep: { name: "Going deep into one subject", meaning: "Staying with one topic until you know it well" },
}

// The owner's order (Round 18). Universals open first on the Profile.
const GUIDE_GROUPS = [
    {
        key: "universals",
        title: "The four fundamentals",
        meaning: "Four qualities that help in every career. All of them grow with practice.",
        factors: ["confidence", "consistency_grit", "learning_capacity", "informed_decision_making"],
    },
    {
        key: "personality",
        title: "Personality",
        meaning: "How you tend to react to the world.",
        factors: ["openness", "conscientiousness", "agreeableness", "extraversion", "emotional_stability"],
    },
    {
        key: "cognitive",
        title: "Cognitive abilities",
        meaning: "How you take in, hold and work with information.",
        factors: ["reasoning", "short_term_memory", "long_term_memory", "processing_speed", "focus", "firmness"],
    },
    {
        // mostly SELF-REPORT — what a student feels drawn to, not a measured ability (mi.js)
        key: "drawn_to",
        title: "Areas you feel drawn to",
        meaning: "The kinds of things you enjoy and lean towards — from your own answers, not a test of ability.",
        factors: [
            "verbal_intelligence", "spatial_intelligence", "musical_intelligence", "bodily_intelligence",
            "naturalistic_intelligence", "existential_intelligence", "logical_intelligence",
            "intrapersonal_intelligence", "interpersonal_intelligence", "emotional_intelligence", "practical_intelligence",
        ],
    },
    {
        key: "uncertainty",
        title: "Uncertainty tolerance",
        meaning: "How you like to work when the outcome isn't known. Neither end is better.",
        factors: ["uncertainty_tolerance"],
    },
    {
        key: "solving",
        title: "Ways you solve problems",
        meaning: "The way you tend to go about a problem.",
        factors: ["divergent_thinking", "convergent_thinking", "collaboration", "propensity_to_go_deep"],
    },
]

// Why each fundamental matters in any career — the report's "The four fundamentals" section
const WHY_IT_MATTERS = {
    confidence: "It decides whether you try for things in the first place.",
    consistency_grit: "Every career has slow, dull stretches; this carries you through them.",
    learning_capacity: "Every field keeps changing, so you will keep learning.",
    informed_decision_making: "Good choices about study and work start with good information.",
}

module.exports = { FACTOR_GUIDE, GUIDE_GROUPS, WHY_IT_MATTERS }
