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
const { sortIntoTiers, applySort } = require("./tiers")
const { buildAspirationSignals } = require("./aspirationSignal")
const { readJourney } = require("./journey")
const { findCombined } = require("./combined")
const COMBINED_CAREERS = require("../data/combined_careers.json")
const constants = require("./constants")

// 1.1.0 (Round 10): undergrad switching cost rises with every year (1, 2, 2.5, 3); the age limit
// reads the student's real age. A different ranking from the same answers, hence the bump — a stored
// report on 1.0.0 shows as stale and rebuilds itself.
// 1.2.0 (Round 10): combined careers are found beside the ranking; a career's fit is the better of the whole career and its best role group
// (role_spread); a student's own degree waives switching cost for the careers it leads to.
// 1.3.0 (Round 17): every new activity wording is NAMED before it is matched ("Cricketer", a long
// sentence and Hinglish all become "playing cricket"), so the same answers can reach different
// careers. Students see "Update my report"; nothing rebuilds by itself.
// 2.0.0 (Round 20, owner): a student's fit is ONE-SIDED — more of a quality than the work asks is a
// full fit (uncertainty tolerance and firmness stay two-sided); "fits how you think" is 0.85, not 0.7;
// careers are ordered by fit inside a tier (the switching cost no longer reorders them); the
// worth-the-switch extras are gone. Students see "Update my report"; nothing rebuilds by itself.
// 2.1.0 (Round 21, owner): activities are no longer rated and there is no 0.80 activity gate —
// every career an activity points to (its name and the areas it points to, a meaning search, the AI
// shortlist) is a candidate, and the student's own profile decides fit and tier.
// 2.2.0 (Round 22, owner): the AI shortlist is strict — it marks each career strong or partial and
// only strong ones become candidates (no cap); cached activities are shortlisted again once.
const MATCHING_VERSION = "matching@2.2.0"

const matchProfile = ({ profile, interest, user, professions, baseline, resolvedActivities, sort, combinedCareers = COMBINED_CAREERS }) => {
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
            degree: journey.degree,
            subject: journey.subject,
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

        // Careers that join two of the student's areas (combined.js) — beside the ranking, never in it.
        combined: findCombined({ ranked, universe: programThree.universe, data: combinedCareers }),

        // Removed because entry is genuinely impossible, not because it ranked badly.
        filtered: programThree.filtered,

        aspirationSignals: buildAspirationSignals({
            aspirations: programOne.aspirations,
            ranked,
            filtered: programThree.filtered,
        }),

        sort: sort || "default",
        constants: {
            COMFORT_THRESHOLD: constants.COMFORT_THRESHOLD,
            MINOR_GROUP_WEIGHT: constants.MINOR_GROUP_WEIGHT,
            WEIGHTS_PROVISIONAL: true,
        },
    }
}

module.exports = matchProfile
module.exports.MATCHING_VERSION = MATCHING_VERSION
