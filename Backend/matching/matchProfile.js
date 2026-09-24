// THE MATCHING ENGINE — entry point. A scored profile and a filled-in interest form go in, a
// ranked list of professions comes out.
//
//     const matchProfile = require("./Backend/matching/matchProfile")
//     const result = matchProfile({ profile, interest, user, professions, baseline, resolvedActivities })
//
// PURE, on the same terms as the scoring engine: no database, no network, no clock, no randomness.
// The same inputs always produce byte-identical output, which is what makes `matching_version`
// mean anything — a formula change is a recompute, never a retake, and a ranking can be
// reproduced months later to explain itself.
//
// The one impure part, turning a student's raw activity text into a 27-factor vector and a
// candidate shortlist, lives in activityResolver.js and is INJECTED as `resolvedActivities`.
// Nothing here imports it, exactly as scoreProfile.js never imports llmScorer.js.
//
// THE THREE PROGRAMS
//   1  read the student            program1.js
//   2  activity → profession       program2.js      ≥ 0.80 floor, A / B / C lists
//   3  student → profession        program3.js      comfort, switching cost, hard filters
//   then the 16-tier sort          tiers.js
//
// WEIGHTS_PROVISIONAL. Every invented number is in constants.js with its reasoning. None is
// fitted to outcome data, because none exists yet.

const scoreProfile = require("../scoring/scoreProfile")
const { runProgramOne } = require("./program1")
const { runProgramTwo } = require("./program2")
const { runProgramThree } = require("./program3")
const { sortIntoTiers, worthTheSwitch, applySort } = require("./tiers")
const { buildAspirationSignals } = require("./aspirationSignal")
const { readJourney } = require("./journey")
const constants = require("./constants")

const MATCHING_VERSION = "matching@1.0.0"

const matchProfile = ({ profile, interest, user, professions, baseline, resolvedActivities, sort }) => {
    if (!profile) throw new Error("matchProfile: profile is required")
    if (!Array.isArray(professions) || professions.length === 0) throw new Error("matchProfile: professions is required")
    if (!baseline || !Array.isArray(baseline.ratings)) throw new Error("matchProfile: baseline.ratings is required")

    const baselineById = {}
    baseline.ratings.forEach((rating) => { baselineById[rating.id] = rating })

    const journey = readJourney(user)

    const programOne = runProgramOne({ interest, profile })

    const programTwo = runProgramTwo({
        pList: programOne.pList,
        resolvedActivities,
        baselineById,
        dominantReasons: programOne.dominantReasons,
    })

    const programThree = runProgramThree({
        candidates: programTwo.candidates,
        studentVector: programOne.studentVector,
        professions,
        baselineById,
        journey,
    })

    const ranked = sortIntoTiers(programThree.ranked)
    const rankedIds = new Set(ranked.map((entry) => entry.professionId))

    const tierCounts = {}
    ranked.forEach((entry) => { tierCounts[entry.tier] = (tierCounts[entry.tier] || 0) + 1 })

    // How much of the 27-factor vector the student actually produced. Not a score, not displayed
    // as one — it is what tells the report whether a thin list is the student's answers or ours.
    const vectorCoverage = scoreProfile.MATCHING_FACTORS.filter((slug) => typeof programOne.studentVector[slug] === "number").length

    return {
        matching_version: MATCHING_VERSION,
        scoring_version: profile.scoring_version || null,
        baseline_version: baseline.schema_version || null,
        rubric_version: baseline.rubric || null,

        // userId and computed_at are deliberately NOT set. The function is pure; the worker stamps
        // them when it writes the result, the same split the scoring engine uses.

        journey: {
            stage: journey.stage,
            stream: journey.stream,
            courseYear: journey.courseYear,
            experienceYears: journey.experienceYears,
            preAdmission: journey.preAdmission,
        },

        programOne: {
            lpList: programOne.lpList.map((row) => row.activity),
            pList: programOne.pList.map((row) => row.activity),
            dominantReasons: programOne.dominantReasons,
            reasonCounts: programOne.reasonCounts,
            vectorCoverage: { scored: vectorCoverage, of: scoreProfile.MATCHING_FACTORS.length },
        },

        listCounts: programTwo.counts,
        tierCounts,

        // "Reachable from here" — cost-weighted, tier-sorted.
        ranked: applySort(ranked, sort || "default"),

        // "Worth the switch" — top 3 by raw fit, cost shown but not applied. §5 insists both lists
        // are always shown, because fit × cost alone will never advise the hard change.
        worthTheSwitch: worthTheSwitch(programThree.universe, rankedIds),

        // Removed because entry is genuinely impossible, not because it ranked badly.
        filtered: programThree.filtered,

        aspirationSignals: buildAspirationSignals({
            aspirations: programOne.aspirations,
            ranked,
            filtered: programThree.filtered,
        }),

        sort: sort || "default",
        constants: {
            ACTIVITY_MATCH_FLOOR: constants.ACTIVITY_MATCH_FLOOR,
            COMFORT_THRESHOLD: constants.COMFORT_THRESHOLD,
            MINOR_GROUP_WEIGHT: constants.MINOR_GROUP_WEIGHT,
            WEIGHTS_PROVISIONAL: true,
        },
    }
}

module.exports = matchProfile
module.exports.MATCHING_VERSION = MATCHING_VERSION
