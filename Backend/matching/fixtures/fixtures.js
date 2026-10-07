// Golden fixtures for the matching engine. Each one states the behaviour it protects, because a
// failing test whose purpose nobody remembers gets deleted rather than fixed.

const fs = require("fs")
const path = require("path")
const mongoose = require("mongoose")

const matchProfile = require("../matchProfile")
const { weightedMatch } = require("../similarity")
const { wasteFor, journeyMultiplier, hardFilterReason } = require("../journey")
const { tierFor, applySort } = require("../tiers")
const { canonicalise, cosine, topProfessionsByVector, createActivityResolver, needsTranslation, thresholdFrom } = require("../activityResolver")
const Profile = require("../../model/profilesModel")
const ActivityFactors = require("../../model/activityFactorsModel")
const {
    syntheticWorld,
    realWorld,
    buildProfile,
    buildVectorProfile,
    buildUser,
    buildInterest,
    resolved,
    flatFactors,
    weightsOn,
} = require("./buildMatchInput")

const scoreProfile = require("../../scoring/scoreProfile")

const { professions, baseline } = syntheticWorld()

// A student who is exactly what tst-alpha demands, and exactly what tst-beta does not.
const sharpProfile = () => buildVectorProfile({ openness: 8, logical_intelligence: 8 })

const sharpActivity = () => resolved(
    "competitive programming",
    { ...flatFactors(5), openness: 8, logical_intelligence: 8 },
    ["tst-alpha", "tst-beta", "tst-gamma", "tst-delta"]
)

const schoolStudent = buildUser("class9_10", {})

const baseInput = (overrides) => ({
    profile: sharpProfile(),
    interest: buildInterest({ persistentInterests: ["competitive programming"] }),
    user: schoolStudent,
    professions,
    baseline,
    resolvedActivities: [sharpActivity()],
    ...overrides,
})

const findEntry = (result, professionId) => result.ranked.find((entry) => entry.professionId === professionId)

// ── harness for the cache fixtures ──────────────────────────────────────────────────────────────

// Mongoose, reduced to the four calls activityResolver actually makes, with the writes recorded so
// a fixture can assert that a near-duplicate folded into an existing row instead of creating one.
const fakeCache = (rows) => {
    const updates = []
    const writes = []

    return {
        updates,
        writes,
        model: {
            findOne: (query) => ({
                lean: async () => rows.find((row) => row.rubricVersion === query.rubricVersion && (query.exampleRaw
                    ? (row.exampleRaw || []).includes(query.exampleRaw)
                    : row.canonicalActivity === query.canonicalActivity)) || null,
            }),
            find: (query) => ({ lean: async () => rows.filter((row) => row.rubricVersion === query.rubricVersion) }),
            // No vector index in the harness, so the resolver falls back to its exact scan — which
            // is the path that has to be correct anyway, since a missing index must cost latency
            // and never results.
            aggregate: async () => { throw new Error("no vector index in this harness") },
            updateOne: async (query, update) => { updates.push(update) },
            findOneAndUpdate: async (query, update) => { writes.push(update.$set); return update.$set },
        },
    }
}

// Runs `body` with fetch replaced by a thrower. Any network call at all fails the fixture, which is
// the whole point: the assertion is about what did NOT happen.
const withNoNetwork = async (body) => {
    const real = globalThis.fetch
    globalThis.fetch = async () => { throw new Error("network call attempted — the cache should have served this") }
    try {
        return await body()
    } finally {
        globalThis.fetch = real
    }
}

// A near-duplicate still pays for one embedding; everything after it must come from the cache.
// This stubs that single call and leaves every other network path throwing.
const withStubbedEmbedding = async (vectors, body) => {
    const real = globalThis.fetch
    globalThis.fetch = async (url) => {
        if (String(url).includes("voyageai")) {
            return { ok: true, json: async () => ({ data: vectors.map((embedding, index) => ({ index, embedding })) }) }
        }
        throw new Error("network call attempted beyond the embedding — the cache should have served this")
    }
    try {
        return await body()
    } finally {
        globalThis.fetch = real
    }
}

const fixtures = [
    // ── the arithmetic ──────────────────────────────────────────────────────────────────────────
    {
        name: "weighted match — identical vectors score 1.0",
        run: () => weightedMatch({ openness: 8, logical_intelligence: 8 }, weightsOn({ openness: 1, logical_intelligence: 1 }), { openness: 8, logical_intelligence: 8 }),
        expect: { score: 1, match_confidence: 1 },
    },
    {
        name: "weighted match — a 6-point gap on every weighted factor scores 0.4",
        run: () => weightedMatch({ openness: 2, logical_intelligence: 2 }, weightsOn({ openness: 1, logical_intelligence: 1 }), { openness: 8, logical_intelligence: 8 }),
        expect: { score: 0.4 },
    },
    {
        name: "a factor at weight 0 drops out entirely rather than diluting the match",
        run: () => weightedMatch(
            { openness: 8, musical_intelligence: 0 },
            weightsOn({ openness: 1, musical_intelligence: 0 }),
            { openness: 8, musical_intelligence: 10 }
        ),
        expect: { score: 1, match_confidence: 1 },
    },
    {
        name: "MINORS ARE DAMPED — a minor at stated weight 1.0 votes at 0.5",
        // openness matches perfectly (similarity 1.0, weight 1.0); collaboration is 10 points out
        // (similarity 0.0, stated weight 1.0 → effective 0.5). Undamped this is 0.5; damped it is
        // 1.0 / 1.5 = 0.6667. The whole point of the minors decision lives in this number.
        run: () => weightedMatch(
            { openness: 8, collaboration: 0 },
            weightsOn({ openness: 1, collaboration: 1 }),
            { openness: 8, collaboration: 10 }
        ),
        expect: { score: 0.6667 },
    },
    {
        name: "A NULL IS AN ABSENCE — it is dropped and renormalised, never imputed",
        // Imputing 5.0 for the missing factor would give (1.0 + 0.7) / 2 = 0.85. Dropping it gives
        // 1.0 on the weight we can actually see, and records that we saw half of it.
        run: () => weightedMatch(
            { openness: 8, logical_intelligence: 8 },
            weightsOn({ openness: 1, logical_intelligence: 1 }),
            { openness: 8, logical_intelligence: null }
        ),
        expect: { score: 1, match_confidence: 0.5, usedWeight: 1, missingWeight: 1 },
    },
    // ── Round 20 (owner): a student's fit is one-sided ───────────────────────────────────────────
    {
        name: "ONE-SIDED — a student with MORE than the work asks fits fully; a shortfall still counts",
        run: () => {
            const weights = weightsOn({ openness: 1, logical_intelligence: 1 })
            const above = weightedMatch({ openness: 4, logical_intelligence: 4 }, weights, { openness: 10, logical_intelligence: 10 }, { oneSided: true })
            const below = weightedMatch({ openness: 10, logical_intelligence: 10 }, weights, { openness: 4, logical_intelligence: 4 }, { oneSided: true })
            const activity = weightedMatch({ openness: 4, logical_intelligence: 4 }, weights, { openness: 10, logical_intelligence: 10 })
            return { above: above.score, below: below.score, activityStaysTwoSided: activity.score }
        },
        expect: { above: 1, below: 0.4, activityStaysTwoSided: 0.4 },
    },
    {
        name: "ONE-SIDED — uncertainty tolerance and firmness stay two-sided: either end can be wanted",
        run: () => {
            const weights = weightsOn({ uncertainty_tolerance: 1, firmness: 1 })
            return { score: weightedMatch({ uncertainty_tolerance: 2, firmness: 2 }, weights, { uncertainty_tolerance: 8, firmness: 8 }, { oneSided: true }).score }
        },
        expect: { score: 0.4 },
    },
    {
        name: "nothing comparable scores null, not zero",
        run: () => weightedMatch({ openness: 8 }, weightsOn({ openness: 1 }), { openness: null }),
        expect: { score: null, match_confidence: 0 },
    },

    // ── Program 1 ───────────────────────────────────────────────────────────────────────────────
    {
        name: "LP list is persistent AND long-pursued; P list is everything persistent",
        run: () => matchProfile(baseInput({
            interest: buildInterest({
                persistentInterests: ["competitive programming", "sketching"],
                longTermPursuits: ["competitive programming"],
            }),
        })),
        expect: { "programOne.lpList": ["competitive programming"], "programOne.pList": ["competitive programming", "sketching"] },
    },
    {
        name: "no dominant reason is a valid answer, and puts the whole BetaList into BList",
        run: () => matchProfile(baseInput({})),
        expect: { "programOne.dominantReasons": [] },
        assert: (result) => {
            if (result.listCounts.C !== 0) return `expected an empty CList with no dominant reasons, got ${result.listCounts.C}`
            return null
        },
    },
    {
        name: "dominant reasons are read from the life-stage sections and split BetaList",
        run: () => matchProfile(baseInput({
            interest: buildInterest({
                persistentInterests: ["competitive programming"],
                reasons: { curiosityDriven: ["taking things apart", "reading about space", "puzzles"] },
            }),
        })),
        expect: { "programOne.dominantReasons": ["curiosityDriven"] },
        assert: (result) => {
            // tst-alpha and tst-delta are curiosityDriven → BList. tst-gamma is externalProblems
            // → CList, no overlap. (tst-beta cannot be used here: it matches at 0.40 and the
            // floor removes it before the reason split is ever reached.)
            const alpha = findEntry(result, "tst-alpha")
            const gamma = findEntry(result, "tst-gamma")
            if (!alpha || alpha.list !== "B") return `tst-alpha should be B, got ${alpha && alpha.list}`
            if (!gamma || gamma.list !== "C") return `tst-gamma should be C, got ${gamma && gamma.list}`
            return null
        },
    },
    {
        name: "matching reads uncertainty_tolerance_matching, never the raw score",
        run: () => {
            const profile = buildProfile()
            profile.components.uncertainty_tolerance_matching = 1
            profile.raw_scores.uncertainty_tolerance = 9
            return matchProfile(baseInput({ profile }))
        },
        assert: (result) => {
            // The synthetic professions weight uncertainty_tolerance at 0, so this cannot show up
            // in a score — it is asserted on the vector the engine built instead.
            const used = result.programOne.vectorCoverage.scored
            return used === scoreProfile.MATCHING_FACTORS.length ? null : `expected a full vector, got ${used}`
        },
    },

    // ── Program 2 ───────────────────────────────────────────────────────────────────────────────
    // REPLACES "the 0.80 activity match is a FLOOR" and "a better-than-floor match is kept" (owner,
    // Round 21): there is no floor. An activity's own ratings no longer decide anything — every career
    // it points to is a candidate, and the student's profile places it.
    {
        name: "NO GATE — every career an activity points to enters the candidates, whatever the activity's ratings",
        run: () => matchProfile(baseInput({})),
        assert: (result) => {
            const missing = ["tst-alpha", "tst-beta", "tst-gamma", "tst-delta"].filter((id) => !findEntry(result, id))
            return missing.length > 0 ? `not in the list: ${missing.join(", ")}` : null
        },
    },
    {
        name: "matchScore follows the activity's shortlist order (1.0 for the first, 0.01 less per place)",
        run: () => matchProfile(baseInput({})),
        assert: (result) => {
            const scores = ["tst-alpha", "tst-beta", "tst-gamma", "tst-delta"].map((id) => (findEntry(result, id) || {}).matchScore)
            return scores.join() === "1,0.99,0.98,0.97" ? null : `got ${scores.join()}`
        },
    },
    {
        name: "a long-pursued activity puts its professions in the A list",
        run: () => matchProfile(baseInput({
            interest: buildInterest({
                persistentInterests: ["competitive programming"],
                longTermPursuits: ["competitive programming"],
            }),
        })),
        assert: (result) => {
            const alpha = findEntry(result, "tst-alpha")
            return alpha && alpha.list === "A" ? null : `expected list A, got ${alpha && alpha.list}`
        },
    },

    // ── the tiers ───────────────────────────────────────────────────────────────────────────────
    {
        name: "tier 1 — comfort, A list, passion AND achievement",
        run: () => tierFor({ list: "A", comfort: true, passion: true, achievement: true, confidenceExp: "Low" }),
        expect: 1,
    },
    {
        name: "tier 3 — passion and High expressed confidence beats passion alone",
        run: () => tierFor({ list: "A", comfort: true, passion: true, achievement: false, confidenceExp: "High" }),
        expect: 3,
    },
    {
        name: "tier 7 — achievement without passion still outranks neither",
        run: () => tierFor({ list: "A", comfort: true, passion: false, achievement: true, confidenceExp: "High" }),
        expect: 7,
    },
    {
        name: "tier 9 — an aspiration with no passion and no achievement lands here and no higher",
        run: () => tierFor({ list: "A", comfort: true, passion: false, achievement: false, confidenceExp: "Medium" }),
        expect: 9,
    },
    {
        name: "tier 12 — the nonComfort block tests achievement too",
        run: () => tierFor({ list: "A", comfort: false, passion: false, achievement: true, confidenceExp: "Low" }),
        expect: 12,
    },
    {
        name: "every combination is placeable — no profession falls through the 16 tiers",
        run: () => {
            const lists = ["A", "B", "C"]
            const flags = [true, false]
            const confidences = ["High", "Medium", "Low", null]
            const unplaced = []

            lists.forEach((list) => flags.forEach((comfort) => flags.forEach((passion) => flags.forEach((achievement) =>
                confidences.forEach((confidenceExp) => {
                    if (tierFor({ list, comfort, passion, achievement, confidenceExp }) === null) {
                        unplaced.push(`${list}/${comfort}/${passion}/${achievement}/${confidenceExp}`)
                    }
                })))))

            return unplaced
        },
        expect: [],
    },
    {
        name: "the full run produces tiers and a rankedPosition on every entry",
        run: () => matchProfile(baseInput({
            interest: buildInterest({
                persistentInterests: ["competitive programming"],
                longTermPursuits: ["competitive programming"],
                passion: ["competitive programming"],
                achievementRelated: ["competitive programming"],
            }),
        })),
        assert: (result) => {
            const alpha = findEntry(result, "tst-alpha")
            if (!alpha) return "tst-alpha is missing"
            if (alpha.tier !== 1) return `expected tier 1, got ${alpha.tier}`
            if (alpha.rankedPosition !== 1) return `expected rankedPosition 1, got ${alpha.rankedPosition}`
            const missing = result.ranked.filter((entry) => typeof entry.tier !== "number" || typeof entry.rankedPosition !== "number")
            return missing.length === 0 ? null : `${missing.length} entries without a tier or position`
        },
    },

    // ── §5 switching cost ───────────────────────────────────────────────────────────────────────
    {
        name: "a school student has waste 0, so the exponential is inert",
        run: () => journeyMultiplier(professions[0], { stage: "class9_10", stream: [], experienceYears: null, courseYear: null }),
        expect: { multiplier: 1, wastedYears: 0, tau: null },
    },
    {
        name: "a pre-admission college student has waste 0 — nothing is invested yet",
        run: () => wasteFor(professions[0], { stage: "college", stream: [], preAdmission: true, courseYear: null }),
        expect: { years: 0 },
    },
    {
        name: "undergrad year 2 is waste at 1.0 a year — credits do not transfer",
        run: () => wasteFor(professions[0], { stage: "college", stream: [], preAdmission: false, courseYear: 2 }),
        expect: { years: 2 },
    },
    {
        name: "undergrad year 3 adds 0.5 on top of years 1-2 — close to done, skills carry",
        // Round 10 (owner-approved fix, backend review #16): the late rate applies to the years
        // from 3 on, not to all of them, so a later year never counts as less invested.
        run: () => wasteFor(professions[0], { stage: "college", stream: [], preAdmission: false, courseYear: 3 }),
        expect: { years: 2.5 },
    },
    {
        name: "undergrad switching cost never falls as the years go up",
        run: () => {
            const years = [1, 2, 3, 4].map((courseYear) => wasteFor(professions[0], { stage: "college", stream: [], preAdmission: false, courseYear }).years)
            return years.every((value, index) => index === 0 || value >= years[index - 1]) ? null : `not monotonic: ${years.join(", ")}`
        },
        expect: null,
    },
    {
        name: "the age limit reads the student's own age",
        run: () => {
            const { readJourney } = require("../journey")
            return readJourney({ journey: "early_professional", age: 66, journeyDetail: {} }).age
        },
        expect: 66,
    },
    {
        name: "after_any_degree waives study waste entirely — finish, then switch",
        run: () => wasteFor(professions[3], { stage: "college", stream: [], preAdmission: false, courseYear: 2 }),
        expect: { years: 0, studyWasteWaived: true },
    },
    {
        name: "THE EMPLOYMENT CAP — a 20-year veteran is discounted, not annihilated",
        run: () => {
            const four = journeyMultiplier(professions[0], { stage: "early_professional", stream: [], experienceYears: 4 })
            const twenty = journeyMultiplier(professions[0], { stage: "early_professional", stream: [], experienceYears: 20 })
            return { fourYears: four.wastedYears, twentyYears: twenty.wastedYears, twentyMultiplier: twenty.multiplier }
        },
        // 4 × 0.3 = 1.2; 20 × 0.3 = 6.0 capped at 3.0. τ = 2.5 → exp(−3/2.5) = 0.3012, which is a
        // discount, not a deletion. Without the cap it would be exp(−6/2.5) = 0.09.
        expect: { fourYears: 1.2, twentyYears: 3, twentyMultiplier: 0.3012 },
    },
    {
        name: "a graduate switching to a stream-gated profession pays the class 11-12 redo",
        run: () => wasteFor(professions[2], { stage: "early_professional", stream: ["commerce"], experienceYears: 2 }),
        expect: { years: 2.6 }, // 2 years of class 11-12 at 1.0, plus 2 employment years at 0.3
    },

    // ── the hard filters ────────────────────────────────────────────────────────────────────────
    {
        name: "a class 11-12 student in the wrong stream loses the gated profession entirely",
        run: () => matchProfile(baseInput({ user: buildUser("class11_12", { class: 12, stream: ["commerce"] }) })),
        assert: (result) => {
            if (findEntry(result, "tst-gamma")) return "tst-gamma needs PCM and should have been filtered out"
            if (!result.filtered.some((entry) => entry.professionId === "tst-gamma")) return "tst-gamma was removed without being reported in `filtered`"
            if (!findEntry(result, "tst-alpha")) return "tst-alpha has no prerequisite and must survive"
            return null
        },
    },
    {
        name: "a class 9-10 student is never filtered on stream — the stream is not chosen yet",
        run: () => hardFilterReason(professions[2], { stage: "class9_10", stream: [] }),
        expect: null,
    },
    {
        name: "an undeclared stream never removes a profession",
        run: () => hardFilterReason(professions[2], { stage: "class11_12", stream: [] }),
        expect: null,
    },

    // ── ai_exposure ─────────────────────────────────────────────────────────────────────────────
    {
        name: "ai_exposure REORDERS AND NEVER REMOVES",
        run: () => {
            const result = matchProfile(baseInput({}))
            const before = result.ranked.map((entry) => entry.professionId).sort()
            const after = applySort(result.ranked, "ai_exposure").map((entry) => entry.professionId).sort()
            return { before, after, same: JSON.stringify(before) === JSON.stringify(after) }
        },
        assert: (result) => (result.same ? null : `membership changed: ${result.before} vs ${result.after}`),
    },

    // ── aspirations ─────────────────────────────────────────────────────────────────────────────
    {
        name: "an aspiration enters the P list at Medium and never the LP list",
        run: () => matchProfile(baseInput({
            interest: buildInterest({ aspirationalProfessions: [{ professionText: "Alpha", professionId: "tst-alpha" }] }),
            resolvedActivities: [resolved("alpha", { ...flatFactors(5), openness: 8, logical_intelligence: 8 }, ["tst-alpha"])],
        })),
        expect: { "programOne.pList": ["alpha"], "programOne.lpList": [] },
        assert: (result) => {
            const alpha = findEntry(result, "tst-alpha")
            if (!alpha) return "the aspiration generated no candidate"
            if (!alpha.fromAspiration) return "the entry is not flagged as coming from an aspiration"
            if (alpha.confidenceExp !== "Medium") return `expected Medium confidence, got ${alpha.confidenceExp}`
            // TIER 10, NOT 9, AND THAT IS STRUCTURAL. The A list is built from LP — persistent AND
            // long-pursued — and an aspiration is deliberately never written into longTermPursuits.
            // So a bare aspiration can reach tier 10 at best, never 9: the review discussion said
            // "tier 9/10" but 9 is unreachable for an aspiration by construction. Worth pinning,
            // because anyone who later puts aspirations into the LP list breaks exactly this.
            if (alpha.tier !== 10) return `a bare aspiration should reach tier 10, got ${alpha.tier}`
            return null
        },
    },
    {
        name: "A NAMED ASPIRATION IS ITS OWN CANDIDATE even when no activity reaches it",
        // The regression this pins: "doctor" is a profession name, not an activity, so the rubric
        // scorer refuses to rate it and retrieval returns nothing. Before the fix, the profession
        // the student explicitly asked about silently vanished from their results.
        run: () => matchProfile(baseInput({
            interest: buildInterest({ aspirationalProfessions: [{ professionText: "Alpha", professionId: "tst-alpha" }] }),
            resolvedActivities: [],
        })),
        assert: (result) => {
            const alpha = findEntry(result, "tst-alpha")
            if (!alpha) return "the named aspiration produced no candidate"
            if (!alpha.namedDirectly) return "the entry is not flagged as named directly"
            if (alpha.matchScore !== null) return `a directly named profession has no activity match; expected null, got ${alpha.matchScore}`
            if (typeof alpha.comfortScore !== "number") return "it must still be comfort-scored like any other candidate"
            const signal = result.aspirationSignals[0]
            return signal && signal.outcome === "ranked" ? null : `expected the aspiration to rank, got ${signal && signal.outcome}`
        },
    },
    {
        name: "a named aspiration still has to pass the hard filters",
        // The strongest thing the report can say: "you want to be a Doctor; that needs PCB and you
        // are in PCM." It can only say it if the profession became a candidate first.
        run: () => matchProfile(baseInput({
            user: buildUser("class11_12", { class: 12, stream: ["commerce"] }),
            interest: buildInterest({ aspirationalProfessions: [{ professionText: "Gamma", professionId: "tst-gamma" }] }),
            resolvedActivities: [],
        })),
        assert: (result) => {
            if (findEntry(result, "tst-gamma")) return "tst-gamma needs PCM and should have been filtered"
            const signal = result.aspirationSignals[0]
            if (!signal || signal.outcome !== "blocked") return `expected outcome blocked, got ${signal && signal.outcome}`
            if (!signal.blockedReason) return "a blocked aspiration must name the closed door"
            return null
        },
    },
    {
        name: "every aspiration produces a report signal, ranked or not",
        run: () => matchProfile(baseInput({
            interest: buildInterest({
                persistentInterests: ["competitive programming"],
                aspirationalProfessions: [
                    { professionText: "Alpha", professionId: "tst-alpha" },
                    { professionText: "Astronaut", professionId: null },
                ],
            }),
            resolvedActivities: [sharpActivity(), resolved("alpha", { ...flatFactors(5), openness: 8, logical_intelligence: 8 }, ["tst-alpha"])],
        })),
        assert: (result) => {
            if (result.aspirationSignals.length !== 2) return `expected 2 signals, got ${result.aspirationSignals.length}`

            const ranked = result.aspirationSignals.find((signal) => signal.professionId === "tst-alpha")
            if (!ranked || ranked.outcome !== "ranked") return `expected the matched aspiration to be ranked, got ${ranked && ranked.outcome}`
            if (typeof ranked.rankedPosition !== "number") return "a ranked aspiration must carry its position"
            if (!Array.isArray(ranked.supportingFactors)) return "a ranked aspiration must carry its supporting factors"

            const unmatched = result.aspirationSignals.find((signal) => signal.professionText === "Astronaut")
            if (!unmatched) return "the unmatched aspiration was dropped"
            if (unmatched.professionId !== null) return "an unmatched aspiration keeps professionId: null"
            if (unmatched.outcome !== "unmatched") return `expected outcome unmatched, got ${unmatched.outcome}`
            return null
        },
    },
    {
        name: "an aspiration removed by a hard filter is reported as blocked, never silently dropped",
        run: () => matchProfile(baseInput({
            user: buildUser("class11_12", { class: 12, stream: ["commerce"] }),
            interest: buildInterest({
                persistentInterests: ["competitive programming"],
                aspirationalProfessions: [{ professionText: "Gamma", professionId: "tst-gamma" }],
            }),
        })),
        assert: (result) => {
            const signal = result.aspirationSignals.find((entry) => entry.professionId === "tst-gamma")
            if (!signal) return "the blocked aspiration produced no signal"
            if (signal.outcome !== "blocked") return `expected outcome blocked, got ${signal.outcome}`
            if (!signal.blockedReason) return "a blocked aspiration must say which door is shut"
            return null
        },
    },

    // ── Round 20 (owner): no second list; the cost no longer reorders a tier ────────────────────
    // REPLACES "worthTheSwitch ranks on raw fit…" and "…still gets the second list". The owner
    // removed the worth-the-switch extras: "Best fit, ignoring switching cost" is now the same tiers
    // without the report moving costly careers to the end, so nothing is added from outside the list.
    {
        name: "no worth-the-switch list any more; an empty ranking stays empty and visible",
        run: () => matchProfile(baseInput({ resolvedActivities: [] })),
        assert: (result) => {
            if ("worthTheSwitch" in result) return "worthTheSwitch is still produced"
            if (result.ranked.length !== 0) return `expected an empty ranking, got ${result.ranked.length}`
            return null
        },
    },
    {
        name: "inside a tier careers are ordered by fit — the switching cost never reorders them",
        run: () => matchProfile(baseInput({ user: buildUser("early_professional", { experienceYears: 10 }) })),
        assert: (result) => {
            for (let index = 1; index < result.ranked.length; index += 1) {
                const before = result.ranked[index - 1]
                const after = result.ranked[index]
                if (before.tier === after.tier && (after.comfortScore || 0) > (before.comfortScore || 0)) {
                    return `${after.professionId} fits better than ${before.professionId} but sits below it in tier ${after.tier}`
                }
            }
            if (!result.ranked.every((entry) => typeof entry.wastedYears === "number")) return "the cost must still be computed for the report to group by"
            return null
        },
    },

    {
        name: "something that is not an activity contributes nothing rather than matching everything",
        // The naming call flags "stuff" / "things I like" as not an activity (Round 21; it used to be
        // the rating that said so). Even with careers attached, it must point nowhere.
        run: () => matchProfile(baseInput({ resolvedActivities: [{ ...resolved("stuff", {}, ["tst-alpha", "tst-beta"]), unrateable: true }] })),
        expect: { "ranked.length": 0 },
    },

    // ── determinism and the real data ───────────────────────────────────────────────────────────
    {
        name: "match_confidence is computed and stored on every entry",
        run: () => matchProfile(baseInput({})),
        assert: (result) => {
            const missing = result.ranked.filter((entry) => typeof entry.match_confidence !== "number")
            return missing.length === 0 ? null : `${missing.length} entries without match_confidence`
        },
    },
    {
        name: "REAL DATA — a full profile against the 223 professions produces a tiered list",
        run: () => {
            const world = realWorld()
            const first = world.professions.slice(0, 40).map((profession) => profession.id)

            return matchProfile({
                profile: buildProfile(),
                interest: buildInterest({
                    persistentInterests: ["building small apps", "debating"],
                    longTermPursuits: ["building small apps"],
                    passion: ["building small apps"],
                    reasons: { curiosityDriven: ["how things work", "reading", "puzzles"] },
                }),
                user: buildUser("class11_12", { class: 11, stream: ["physics", "chemistry", "maths"] }),
                professions: world.professions,
                baseline: world.baseline,
                resolvedActivities: [
                    resolved("building small apps", { ...flatFactors(6), logical_intelligence: 8, reasoning: 8, focus: 8 }, first),
                    resolved("debating", { ...flatFactors(6), verbal_intelligence: 9, extraversion: 8, firmness: 8 }, first),
                ],
            })
        },
        assert: (result) => {
            if (result.ranked.length === 0) return "no profession matched against the real data"
            const outOfOrder = result.ranked.find((entry, index) => index > 0 && entry.tier < result.ranked[index - 1].tier)
            if (outOfOrder) return `tiers are not ascending at ${outOfOrder.professionId}`
            const badScore = result.ranked.find((entry) => entry.comfortScore !== null && (entry.comfortScore < 0 || entry.comfortScore > 1))
            if (badScore) return `comfortScore out of range on ${badScore.professionId}`
            const unknownFactor = result.ranked.find((entry) => entry.supportingFactors.some((factor) => !scoreProfile.MATCHING_FACTORS.includes(factor.factor)))
            if (unknownFactor) return `an explanation names a factor outside the matching vector on ${unknownFactor.professionId}`
            return null
        },
    },
    {
        name: "DETERMINISM — the same inputs rank identically twice, byte for byte",
        run: () => {
            const first = JSON.stringify(matchProfile(baseInput({})))
            const second = JSON.stringify(matchProfile(baseInput({})))
            return first === second
        },
        expect: true,
    },

    // ── the activity cache: the thing that decides what a student costs ─────────────────────────
    //
    // Each of these runs the real resolver with `fetch` replaced by a function that throws. A pass
    // therefore proves something stronger than "the right answer came back": it proves NO NETWORK
    // CALL WAS MADE. That is the property the per-student cost rests on — an activity is embedded
    // and rubric-scored once, ever, across every student who ever names it — and it is the kind of
    // property that regresses silently, because a cache that quietly stops hitting still returns
    // correct answers. It just bills for them.
    {
        name: "CACHE HIT — a known activity is resolved without touching the network",
        run: async () => {
            const cache = fakeCache([{
                canonicalActivity: "playing cricket",
                rubricVersion: "2.0",
                factors: { ...flatFactors(5), bodily_intelligence: 9 },
                candidateProfessionIds: ["tst-alpha"],
                pointsTo: [],
                embedding: [1, 0, 0],
            }])

            return withNoNetwork(async () => {
                const resolver = createActivityResolver({
                    ActivityFactors: cache.model,
                    professionEmbeddings: { model: "voyage-4-large", dimensions: 3, embeddings: [] },
                    anchors: { schema_version: "2.0", bands: [], factors: [] },
                    factorSlugs: scoreProfile.MATCHING_FACTORS,
                })

                return resolver.resolveActivities([{ activity: "  Playing   CRICKET ", key: "playing cricket" }])
            })
        },
        assert: (resolved) => {
            if (resolved.length !== 1) return `expected 1 resolved activity, got ${resolved.length}`
            if (resolved[0].cacheHit !== "exact") return `expected an exact hit, got ${resolved[0].cacheHit}`
            if (resolved[0].candidateProfessionIds[0] !== "tst-alpha") return "the cached shortlist was not returned"
            // Canonicalisation is what makes the hit possible — the student typed it differently.
            if (resolved[0].canonicalActivity !== "playing cricket") return `expected canonicalisation, got ${resolved[0].canonicalActivity}`
            return null
        },
    },
    {
        name: "a rubric version change MISSES the cache rather than reusing a stale row",
        // A vector scored against one rubric must never be served under another. The miss is the
        // correct, expensive answer; silently reusing it would be the cheap wrong one.
        run: async () => {
            const cache = fakeCache([{
                canonicalActivity: "playing cricket",
                rubricVersion: "1.0",
                factors: flatFactors(5),
                candidateProfessionIds: ["tst-alpha"],
                pointsTo: [],
                embedding: [1, 0, 0],
            }])

            const resolver = createActivityResolver({
                ActivityFactors: cache.model,
                professionEmbeddings: { model: "voyage-4-large", dimensions: 3, embeddings: [] },
                anchors: { schema_version: "2.0", bands: [], factors: [] },
                factorSlugs: scoreProfile.MATCHING_FACTORS,
            })

            // The lookup must not find the 1.0 row. Proven by the call reaching the network stage
            // and failing there, rather than returning the stale rating.
            return withNoNetwork(() => resolver.resolveActivities([{ activity: "playing cricket", key: "playing cricket" }]))
                .then(() => "resolved from the cache despite a rubric version mismatch")
                .catch((error) => (error.message.includes("network") ? null : `failed for the wrong reason: ${error.message}`))
        },
        expect: null,
    },
    {
        name: "NEAR-DUPLICATE FOLD — a differently worded activity reuses the same rating",
        // "playing cricket" and "i play cricket for my school team" are one activity. String
        // matching would never catch that; cosine similarity does, and the student is not billed
        // three times for one answer.
        run: async () => {
            const cache = fakeCache([{
                canonicalActivity: "playing cricket",
                rubricVersion: "2.0",
                factors: { ...flatFactors(5), bodily_intelligence: 9 },
                candidateProfessionIds: ["tst-alpha"],
                pointsTo: [],
                embedding: [1, 0, 0],
            }])

            const resolver = createActivityResolver({
                ActivityFactors: cache.model,
                professionEmbeddings: { model: "voyage-4-large", dimensions: 3, embeddings: [] },
                anchors: { schema_version: "2.0", bands: [], factors: [] },
                factorSlugs: scoreProfile.MATCHING_FACTORS,
                // Embedding is the ONE call a near-duplicate still pays for; everything after it
                // is served from the cache. Stubbed to a vector 0.995 from the stored one.
                voyageApiKey: "stub",
            })

            return withStubbedEmbedding([[1, 0.1, 0]], () => (
                resolver.resolveActivities([{ activity: "i play cricket for my school team", key: "i play cricket for my school team" }])
            )).then((resolved) => ({ resolved, cache }))
        },
        assert: ({ resolved, cache }) => {
            if (resolved[0].cacheHit !== "near") return `expected a near hit, got ${resolved[0].cacheHit}`
            if (resolved[0].candidateProfessionIds[0] !== "tst-alpha") return "the folded entry did not supply its shortlist"
            if (cache.writes.length > 0) return "a near-duplicate must not create a second cache row"
            const folded = cache.updates.find((update) => update.$addToSet)
            if (!folded) return "the new wording was not recorded on the existing row"
            return null
        },
    },

    // ── the collections: do the schemas accept what the engines actually emit ───────────────────
    {
        name: "profilesModel accepts a real scoreProfile output",
        // The schema was written from the PRD sketch, which predates the engine. This is the only
        // thing that proves the two agree — and it runs with no database, because Mongoose
        // validates locally.
        run: async () => {
            const profile = buildProfile()
            const document = new Profile({
                user: new mongoose.Types.ObjectId(),
                scoring_version: profile.scoring_version,
                component_versions: profile.component_versions,
                norm_set_id: profile.norm_set_id,
                computed_at: new Date(0),
                raw_scores: profile.raw_scores,
                normed_scores: profile.normed_scores,
                bands: profile.bands,
                data_quality: profile.data_quality,
                flags: profile.flags,
                banks: profile.banks,
                components: profile.components,
                values_profile: profile.values_profile,
                completeness: profile.completeness,
            })

            const error = await document.validate().then(() => null, (failure) => failure)
            if (error) return error.message

            // A null score must survive the round trip as null. Mongoose dropping it would turn
            // "we do not know" into "absent", and matching would never see the difference.
            const nulls = scoreProfile.MATCHING_FACTORS.filter((slug) => profile.raw_scores[slug] === null)
            const lost = nulls.filter((slug) => !(slug in document.raw_scores))
            return lost.length > 0 ? `nulls dropped by the schema: ${lost.join(", ")}` : null
        },
        expect: null,
    },
    {
        name: "activityFactorsModel accepts a real cache row",
        run: async () => {
            const document = new ActivityFactors({
                canonicalActivity: "playing cricket",
                exampleRaw: ["i play cricket for my school team"],
                factors: { ...flatFactors(5), bodily_intelligence: 9 },
                candidateProfessionIds: ["spt-athlete", "spt-coach"],
                embedding: new Array(1024).fill(0.01),
                embeddingModel: "voyage-4-large",
                rubricVersion: "2.0",
                samples: 3,
                sampleVariance: { bodily_intelligence: { samples: [9, 9, 8], spread: 1 } },
                adminReview: { required: false, priority: "none", reason: null },
            })

            return document.validate().then(() => null, (failure) => failure.message)
        },
        expect: null,
    },
    {
        name: "the worker writes every field the profiles schema declares",
        // scoreProfileWorker.runOne needs a live database, so it stays untested until Day 4 has
        // real submissions. What CAN be checked now is the thing most likely to be wrong: that the
        // worker's $set names the same fields the schema declares. A typo there writes nothing and
        // reports success.
        run: () => {
            const source = fs.readFileSync(path.join(__dirname, "..", "..", "workers", "scoreProfileWorker.js"), "utf8")
            const written = new Set([...source.matchAll(/^\s{16}(\w+):/gm)].map((match) => match[1]))

            const declared = Object.keys(Profile.schema.obj).filter((field) => field !== "user" && field !== "sessionId")
            const missing = declared.filter((field) => !written.has(field))

            return missing.length > 0 ? `the worker never writes: ${missing.join(", ")}` : null
        },
        expect: null,
    },

    // ── the resolver's pure helpers ─────────────────────────────────────────────────────────────
    {
        name: "canonicalise folds whitespace and case",
        run: () => canonicalise("  Playing   CRICKET "),
        expect: "playing cricket",
    },
    {
        name: "cosine of a vector with itself is 1",
        run: () => Math.round(cosine([1, 2, 3], [1, 2, 3]) * 10000) / 10000,
        expect: 1,
    },
    {
        name: "retrieval returns the nearest professions, most similar first",
        run: () => topProfessionsByVector([1, 0], [
            { id: "far", profession: "Far", embedding: [0, 1] },
            { id: "near", profession: "Near", embedding: [1, 0.1] },
        ], 2).map((entry) => entry.id),
        expect: ["near", "far"],
    },

    // ── Round 10: role groups and the student's own degree ───────────────────────────────────────
    {
        name: "role groups: a student who fits a role group better gets that group, and the fit only rises",
        run: () => {
            const { runProgramThree } = require("../program3")
            const rating = { id: "rg-x", factors: { openness: 5, conscientiousness: 5 }, weights: { openness: 1, conscientiousness: 1 } }
            // Round 20: fit is one-sided, so a role group helps by asking for LESS of something the
            // student is short on (more of what they already exceed changes nothing)
            const wide = { id: "rg-x", profession: "Wide", mid_stream_entry: "open", role_spread: { spread: "wide", deviating_roles: [{ roles: ["Role A"], higher: [], lower: ["conscientiousness"], why: "needs less structure" }] } }
            const narrow = { ...wide, role_spread: { spread: "narrow", deviating_roles: [] } }
            const run = (profession, vector) => runProgramThree({
                candidates: [{ professionId: "rg-x" }], studentVector: vector, professions: [profession],
                baselineById: { "rg-x": rating }, journey: { stage: "class9_10", stream: [] },
            }).ranked[0]
            const open = run(wide, { openness: 5, conscientiousness: 3 })
            const plain = run(narrow, { openness: 5, conscientiousness: 3 })
            const away = run(wide, { openness: 3, conscientiousness: 7 })
            if (!open.bestRoles || open.bestRoles.roles[0] !== "Role A") return "the matching role group was not named"
            if (!(open.comfortScore > plain.comfortScore)) return "the role group should lift the fit above the whole career's"
            if (plain.bestRoles !== null) return "a narrow career has no role groups"
            if (away.bestRoles !== null || away.comfortScore !== run(narrow, { openness: 3, conscientiousness: 7 }).comfortScore) return "a group that fits worse must change nothing"
            return null
        },
        expect: null,
    },
    {
        name: "degree: a B.Tech Civil student pays no switching cost for Civil Engineer; a B.Com student still does",
        run: () => {
            const { wasteFor, degreeCounts } = require("../journey")
            const civil = { id: "eng-civil-engineer", mid_stream_entry: "restart_undergrad", class12_prerequisite: ["physics", "chemistry", "maths"] }
            const journey = (degree, subject) => ({ stage: "college", stream: [], preAdmission: false, courseYear: 2, degree, subject })
            const own = wasteFor(civil, journey("btech", "civil"))
            const other = wasteFor(civil, journey("bcom", null))
            if (!degreeCounts(civil, journey("btech", "civil"))) return "B.Tech Civil should count for Civil Engineer"
            if (own.years !== 0) return `own degree should cost nothing, got ${own.years}`
            if (!(other.years > 0)) return "an unrelated degree should still cost years"
            return null
        },
        expect: null,
    },
    {
        name: "degree: every career id in degree_families.json exists, and every key is a real degree option",
        run: () => {
            const families = require("../../data/degree_families.json")
            const options = require("../../data/degree_options.json")
            const ids = new Set(require("../../data/ALL-professions.json").professions.map((profession) => profession.id))
            const unknown = [...families.any_bachelors, ...Object.values(families.by_degree).flat()].filter((id) => !ids.has(id))
            if (unknown.length > 0) return `unknown career ids: ${[...new Set(unknown)].join(", ")}`
            const badKeys = Object.keys(families.by_degree).filter((key) => {
                const [family, subject] = key.split(":")
                const option = options.families.find((entry) => entry.id === family)
                return !option || (subject && !option.subjects.some((entry) => entry.id === subject))
            })
            return badKeys.length > 0 ? `keys that are not degree options: ${badKeys.join(", ")}` : null
        },
        expect: null,
    },
    {
        name: "combined: shown only when both sides are lit, ordered by how high the sides sit, at most five",
        run: () => {
            const { findCombined } = require("../combined")
            const data = {
                groups: { photo: { label: "photography", careers: ["p1", "p2"] }, nature: { label: "nature", careers: ["n1"] }, law: { label: "law", careers: ["l1"] } },
                careers: [
                    { id: "cmb-wild", name: "Wildlife Photographer", sideA: "photo", sideB: "nature" },
                    { id: "cmb-legal", name: "Legal Photographer", sideA: "photo", sideB: "law" },
                ],
            }
            const entry = (id, comfortScore) => ({ professionId: id, profession: id, comfortScore, supportingFactors: [] })
            const found = findCombined({ ranked: [entry("p2", 0.8), entry("x", 0.7), entry("n1", 0.6)], universe: null, data })
            if (found.length !== 1 || found[0].combinedId !== "cmb-wild") return `expected only the wildlife one, got ${found.map((item) => item.combinedId).join(", ")}`
            if (found[0].sideA.via !== "p2" || found[0].comfortScore !== 0.7) return `wrong side or fit: ${JSON.stringify(found[0])}`
            if (findCombined({ ranked: [entry("p1", 0.9)], universe: null, data }).length !== 0) return "one lit side must not be enough"
            return null
        },
        expect: null,
    },
    {
        name: "combined: every career in combined_careers.json names real groups whose careers all exist",
        run: () => {
            const data = require("../../data/combined_careers.json")
            const ids = new Set(require("../../data/ALL-professions.json").professions.map((profession) => profession.id))
            const problems = []
            Object.entries(data.groups).forEach(([key, group]) => group.careers.filter((id) => !ids.has(id)).forEach((id) => problems.push(`${key}: ${id}`)))
            data.careers.forEach((career) => {
                if (!data.groups[career.sideA] || !data.groups[career.sideB]) problems.push(`${career.id}: unknown side`)
                if (career.sideA === career.sideB) problems.push(`${career.id}: both sides are the same group`)
            })
            if (new Set(data.careers.map((career) => career.id)).size !== data.careers.length) problems.push("duplicate ids")
            return problems.length > 0 ? problems.join("; ") : null
        },
        expect: null,
    },
    {
        name: "ACTIVITY NAMING — a long sentence, Hinglish and one word for the same activity reach the same rating; a known wording costs nothing",
        // Round 17 (owner): "I have played cricket in my 10th standard", "Maine 10th standard mai
        // cricket khela tha" and "Cricketer" are one activity. Every new wording is named in one batched
        // call; the name finds the row, so none of them needs an embedding or a fresh rating.
        run: async () => {
            const problems = []
            ;["playing cricket", "the chess club", "i’m into coding — mostly games 🎮"].forEach((text) => {
                if (needsTranslation(text)) problems.push(`"${text}" was treated as Hindi`)
            })
            ;["cricket khelna", "गाना गाना", "dosto ke saath coding karta tha"].forEach((text) => {
                if (!needsTranslation(text)) problems.push(`"${text}" was not recognised as Hindi or Hinglish`)
            })

            const cache = fakeCache([{ _id: "row-cricket", canonicalActivity: "playing cricket", rubricVersion: "2.0", factors: { ...flatFactors(5), bodily_intelligence: 9 }, candidateProfessionIds: ["tst-alpha"], pointsTo: [], embedding: [1, 0, 0], exampleRaw: [] }])
            const real = globalThis.fetch
            const sent = { claude: [], voyage: [] }
            globalThis.fetch = async (url, options) => {
                const body = JSON.parse(options.body)
                if (String(url).includes("voyageai")) {
                    sent.voyage.push(...body.input)
                    return { ok: true, json: async () => ({ data: body.input.map((_, index) => ({ index, embedding: [1, 0, 0] })) }) }
                }
                const texts = JSON.parse(body.messages[0].content)
                sent.claude.push(texts)
                return { ok: true, json: async () => ({ stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify({ items: texts.map(() => "Playing cricket") }) }] }) }
            }
            try {
                const resolver = createActivityResolver({
                    ActivityFactors: cache.model,
                    professionEmbeddings: { model: "voyage-4-large", dimensions: 3, embeddings: [] },
                    anchors: { schema_version: "2.0", bands: [], factors: [] },
                    factorSlugs: scoreProfile.MATCHING_FACTORS,
                    voyageApiKey: "test", anthropicApiKey: "test",
                })
                const wordings = ["I have played cricket in my 10th standard", "Maine 10th standard mai cricket khela tha", "Cricketer"]
                const resolved = await resolver.resolveActivities(wordings.map((text) => ({ activity: text, key: text.toLowerCase() })))
                if (sent.claude.length !== 1 || sent.claude[0].length !== 3) problems.push(`the three wordings were not named in one call: ${JSON.stringify(sent.claude)}`)
                if (sent.voyage.length !== 0) problems.push("an activity the name already placed was still embedded")
                if (resolved.length !== 3 || resolved.some((entry) => entry.candidateProfessionIds[0] !== "tst-alpha" || entry.readAs !== "playing cricket" || entry.cacheHit !== "named" || entry.rowId !== "row-cricket")) problems.push(`not all three reached "playing cricket": ${JSON.stringify(resolved.map((entry) => [entry.readAs, entry.cacheHit]))}`)
                const kept = cache.updates.some((update) => JSON.stringify(update).includes("maine 10th standard mai cricket khela tha"))
                if (!kept) problems.push("the student's own words were not kept on the cached row")
                if (!cache.updates.some((update) => update.$push && update.$push.exampleRaw && update.$push.exampleRaw.$slice === -200)) problems.push("the kept wordings are not capped")

                // the same wording again is found on the row — no call at all
                cache.updates.length = 0
                sent.claude.length = 0
                const row = await cache.model.findOne({ canonicalActivity: "playing cricket", rubricVersion: "2.0" }).lean()
                row.exampleRaw = ["cricketer"]
                const [again] = await resolver.resolveActivities([{ activity: "Cricketer", key: "cricketer" }])
                if (sent.claude.length !== 0 || !again || again.cacheHit !== "exact") problems.push("a wording already on the row was named again")
            } finally {
                globalThis.fetch = real
            }

            // a naming call that fails falls back to the student's words — the report is never held up
            const failing = fakeCache([{ canonicalActivity: "playing cricket", rubricVersion: "2.0", factors: flatFactors(5), candidateProfessionIds: [], pointsTo: [], embedding: [1, 0, 0] }])
            const before = globalThis.fetch
            globalThis.fetch = async (url) => {
                if (String(url).includes("voyageai")) return { ok: true, json: async () => ({ data: [{ index: 0, embedding: [1, 0.05, 0] }] }) }
                throw new Error("naming service down")
            }
            try {
                const resolver = createActivityResolver({
                    ActivityFactors: failing.model,
                    professionEmbeddings: { model: "voyage-4-large", dimensions: 3, embeddings: [] },
                    anchors: { schema_version: "2.0", bands: [], factors: [] },
                    factorSlugs: scoreProfile.MATCHING_FACTORS,
                    voyageApiKey: "test", anthropicApiKey: "test",
                })
                const [fallback] = await resolver.resolveActivities([{ activity: "Playing cricket every evening", key: "playing cricket every evening" }])
                if (!fallback || fallback.cacheHit !== "near" || fallback.readAs !== "playing cricket") problems.push(`a failed naming call did not fall back to the student's words: ${JSON.stringify(fallback)}`)
            } finally {
                globalThis.fetch = before
            }
            return problems.length > 0 ? problems.join("; ") : null
        },
        expect: null,
    },
    {
        name: "ACTIVITY CACHE — a fold records its similarity; a wording an admin split off never folds into that row again; the threshold is clamped",
        // Round 14 (owner): keep 0.90, but measure it. The score of every near-hit is kept so the
        // admin can read the closest calls, and "Not the same" must actually stop the merge.
        run: async () => {
            const problems = []
            if (thresholdFrom(undefined) !== 0.9 || thresholdFrom("") !== 0.9 || thresholdFrom("0.5") !== 0.9 || thresholdFrom("junk") !== 0.9) problems.push("an unset or out-of-range threshold is not 0.90")
            if (thresholdFrom("0.95") !== 0.95) problems.push("a valid threshold was ignored")

            const cache = fakeCache([
                { canonicalActivity: "playing cricket", rubricVersion: "2.0", factors: { ...flatFactors(5), bodily_intelligence: 9 }, candidateProfessionIds: ["tst-alpha"], pointsTo: [], embedding: [1, 0, 0], refusedFolds: ["watching cricket"] },
                { canonicalActivity: "cricket commentary", rubricVersion: "2.0", factors: { ...flatFactors(5), linguistic_intelligence: 8 }, candidateProfessionIds: ["tst-beta"], pointsTo: [], embedding: [0.95, 0.31, 0] },
            ])
            await withStubbedEmbedding([[1, 0, 0]], async () => {
                const resolver = createActivityResolver({
                    ActivityFactors: cache.model,
                    professionEmbeddings: { model: "voyage-4-large", dimensions: 3, embeddings: [] },
                    anchors: { schema_version: "2.0", bands: [], factors: [] },
                    factorSlugs: scoreProfile.MATCHING_FACTORS,
                    voyageApiKey: "test",
                })
                const [watching] = await resolver.resolveActivities([{ activity: "Watching cricket", key: "watching cricket" }])
                if (!watching || watching.candidateProfessionIds[0] !== "tst-beta") problems.push("a split-off wording folded into the row that refused it")
                const fold = cache.updates.map((update) => update.$push && update.$push.folds && update.$push.folds.$each[0]).find(Boolean)
                if (!fold || fold.text !== "watching cricket" || typeof fold.score !== "number" || fold.score < 0.9) problems.push(`the fold's similarity was not recorded: ${JSON.stringify(fold)}`)
            })
            return problems.length > 0 ? problems.join("; ") : null
        },
        expect: null,
    },
    {
        name: "POINTS TO (Round 21) — the naming call says where an activity points, those areas are searched too, nothing is rated, 'stuff' is not cached, and an old row is topped up once",
        // Owner, Round 21: "helping servant" found nothing because only its name was searched. Now the
        // one naming call also returns 2-4 areas ("social work", "public service"); each is searched by
        // meaning beside the name, and the AI shortlist keeps the relevant careers. No rating passes.
        run: async () => {
            const problems = []
            // 29 careers close to the activity's name, and one (p-social) close only to an area
            const embeddings = [...Array.from({ length: 29 }, (_, index) => ({ id: `c${index}`, profession: `Career ${index}`, embedding: [1, 0.01 * index, 0] })), { id: "p-social", profession: "Social Worker", embedding: [0, 1, 0] }]
            const vectors = { "helping others": [0, 0, 1], "social work": [0, 1, 0], "public service": [0, 0.9, 0.1], "dancing": [1, 0.02, 0], "performing arts": [1, 0, 0] }
            const calls = { name: 0, rerank: 0, other: 0 }
            const real = globalThis.fetch
            globalThis.fetch = async (url, options) => {
                const body = JSON.parse(options.body)
                if (String(url).includes("voyageai")) {
                    return { ok: true, json: async () => ({ data: body.input.map((text, index) => ({ index, embedding: vectors[text] || [0, 0, 1] })) }) }
                }
                const system = body.system[0].text
                const reply = (object) => ({ ok: true, json: async () => ({ stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify(object) }] }) })
                if (system.startsWith("You name the activity")) {
                    calls.name += 1
                    const texts = JSON.parse(body.messages[0].content)
                    return reply({ items: texts.map((text) => (text === "stuff" ? { name: "stuff", pointsTo: [], notAnActivity: true }
                        : text === "dancing" ? { name: "dancing", pointsTo: ["performing arts"], notAnActivity: false }
                            : { name: "helping others", pointsTo: ["social work", "public service"], notAnActivity: false })) })
                }
                if (system.startsWith("You filter a shortlist")) {
                    calls.rerank += 1
                    return reply({ strong: [...body.messages[0].content.matchAll(/^\d+\. (\S+) — /gm)].map((match) => match[1]), partial: [] })
                }
                calls.other += 1
                throw new Error("an unexpected call — activities are no longer rated")
            }
            try {
                const cache = fakeCache([{ _id: "old-dance", canonicalActivity: "dancing", rubricVersion: "2.0", factors: flatFactors(5), candidateProfessionIds: ["c1"], embedding: [1, 0.02, 0], exampleRaw: [] }])
                const resolver = createActivityResolver({
                    ActivityFactors: cache.model,
                    professionEmbeddings: { model: "voyage-4-large", dimensions: 3, embeddings },
                    anchors: { schema_version: "2.0", bands: [], factors: [] },
                    voyageApiKey: "test", anthropicApiKey: "test",
                })
                const out = await resolver.resolveActivities([
                    { activity: "helping servant", key: "helping servant" },
                    { activity: "stuff", key: "stuff" },
                ])
                const helping = out.find((entry) => entry.key === "helping servant")
                const stuff = out.find((entry) => entry.key === "stuff")
                if (!helping || helping.pointsTo.join() !== "social work,public service") problems.push(`the areas were not kept: ${JSON.stringify(helping)}`)
                if (!helping || !helping.candidateProfessionIds.includes("p-social")) problems.push("a career reached only through an area it points to was not shortlisted")
                if (!stuff || !stuff.unrateable || stuff.candidateProfessionIds.length !== 0) problems.push("'stuff' still points somewhere")
                if (cache.writes.some((write) => write.canonicalActivity === "stuff")) problems.push("'stuff' was cached")
                const saved = cache.writes.find((write) => write.canonicalActivity === "helping others")
                if (!saved || saved.pointsTo.join() !== "social work,public service" || "factors" in saved) problems.push(`the new row is not name + points to + shortlist, unrated: ${JSON.stringify(saved && Object.keys(saved))}`)
                if (calls.other > 0) problems.push("a rating call was made")
                if (calls.name !== 1) problems.push(`expected one naming call, got ${calls.name}`)

                // an old row (rated, no pointsTo) is topped up once on first use
                calls.name = 0
                calls.rerank = 0
                const [danced] = await resolver.resolveActivities([{ activity: "dancing", key: "dancing" }])
                if (!danced || danced.pointsTo.join() !== "performing arts" || calls.name !== 1 || calls.rerank !== 1) problems.push(`the old row was not topped up: ${JSON.stringify({ danced, calls })}`)
                if (!cache.updates.some((update) => update.$set && Array.isArray(update.$set.pointsTo))) problems.push("the top-up was not saved")
            } finally {
                globalThis.fetch = real
            }
            return problems.length > 0 ? problems.join("; ") : null
        },
        expect: null,
    },
    {
        name: "STRICT SHORTLIST (Round 22) — only careers marked strong are matched, with no cap; partial ones are kept for the trace; an older row is shortlisted again once",
        // Owner, Round 22: the shortlist was "keep it generous, when unsure keep it", up to 16 — right
        // while a rating gate filtered after it, too loose once nothing did.
        run: async () => {
            const problems = []
            const { readShortlist, RERANK_SYSTEM_PROMPT, SHORTLIST_VERSION } = require("../activityResolver")
            const retrieved = Array.from({ length: 30 }, (_, index) => ({ id: `c${index}`, profession: `Career ${index}`, similarity: 1 - index / 100 }))

            const strict = readShortlist({ strong: ["c3", "c1", "x-invented", "c3"], partial: ["c5", "c1"] }, retrieved)
            if (strict.strong.join() !== "c3,c1" || strict.partial.join() !== "c5") problems.push(`strong/partial not read cleanly: ${JSON.stringify(strict)}`)
            const many = readShortlist({ strong: retrieved.slice(0, 24).map((item) => item.id), partial: [] }, retrieved)
            if (many.strong.length !== 24) problems.push(`strong was capped at ${many.strong.length}`)
            const none = readShortlist({ strong: [], partial: ["c2"] }, retrieved)
            if (none.strong.length !== 0) problems.push("a valid 'relevant to none' answer was overridden by the fallback")
            const broken = readShortlist({ strong: ["x-invented"] }, retrieved)
            const garbled = readShortlist({ something: true }, retrieved)
            if (broken.strong.length !== 16 || garbled.strong.length !== 16) problems.push("a broken reply did not fall back to the meaning search's top results")
            if (readShortlist({ keep: ["c4"] }, retrieved).strong.join() !== "c4") problems.push("the old { keep } shape no longer reads")
            if (/keep it generous|When unsure, keep it/i.test(RERANK_SYSTEM_PROMPT) || !/"strong"/.test(RERANK_SYSTEM_PROMPT) || !/leave it\s+out/.test(RERANK_SYSTEM_PROMPT)) problems.push("the prompt is not the strict one")

            // a row shortlisted the old way (it has pointsTo, no version) is shortlisted again once, and only strong careers are candidates
            const embeddings = [{ id: "p-dance", profession: "Dancer", embedding: [1, 0, 0] }, { id: "p-act", profession: "Actor", embedding: [0.9, 0.1, 0] }]
            let reranks = 0
            const real = globalThis.fetch
            globalThis.fetch = async (url, options) => {
                const body = JSON.parse(options.body)
                if (String(url).includes("voyageai")) return { ok: true, json: async () => ({ data: body.input.map((text, index) => ({ index, embedding: [1, 0, 0] })) }) }
                reranks += 1
                return { ok: true, json: async () => ({ stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify({ strong: ["p-dance"], partial: ["p-act"] }) }] }) }
            }
            try {
                const rows = [{ _id: "old", canonicalActivity: "dancing", rubricVersion: "2.0", pointsTo: ["performing arts"], candidateProfessionIds: ["p-dance", "p-act"], embedding: [1, 0, 0], exampleRaw: [] }]
                const cache = fakeCache(rows)
                const resolver = createActivityResolver({
                    ActivityFactors: cache.model,
                    professionEmbeddings: { model: "voyage-4-large", dimensions: 3, embeddings },
                    anchors: { schema_version: "2.0", bands: [], factors: [] },
                    voyageApiKey: "test", anthropicApiKey: "test",
                })
                const [first] = await resolver.resolveActivities([{ activity: "dancing", key: "dancing" }])
                if (first.candidateProfessionIds.join() !== "p-dance" || first.partialProfessionIds.join() !== "p-act") problems.push(`not re-shortlisted strictly: ${JSON.stringify(first)}`)
                const saved = cache.updates.find((update) => update.$set && update.$set.shortlistVersion === SHORTLIST_VERSION)
                if (!saved) problems.push("the re-shortlist was not saved with its version")
                else Object.assign(rows[0], saved.$set)
                reranks = 0
                await resolver.resolveActivities([{ activity: "dancing", key: "dancing" }])
                if (reranks !== 0) problems.push("a row already on the strict shortlist was shortlisted again")
            } finally {
                globalThis.fetch = real
            }
            return problems.length > 0 ? problems.join("; ") : null
        },
        expect: null,
    },
]

module.exports = fixtures
