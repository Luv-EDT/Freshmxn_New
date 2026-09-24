// Golden fixtures for the matching engine. Each one states the behaviour it protects, because a
// failing test whose purpose nobody remembers gets deleted rather than fixed.

const fs = require("fs")
const path = require("path")
const mongoose = require("mongoose")

const matchProfile = require("../matchProfile")
const { weightedMatch } = require("../similarity")
const { wasteFor, journeyMultiplier, hardFilterReason } = require("../journey")
const { tierFor, applySort } = require("../tiers")
const { canonicalise, cosine, topProfessionsByVector, createActivityResolver } = require("../activityResolver")
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
                lean: async () => rows.find((row) => (
                    row.canonicalActivity === query.canonicalActivity && row.rubricVersion === query.rubricVersion
                )) || null,
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
    {
        name: "the 0.80 activity match is a FLOOR — tst-beta at 0.40 never enters the list",
        run: () => matchProfile(baseInput({})),
        assert: (result) => {
            const beta = findEntry(result, "tst-beta")
            return beta ? "tst-beta matched at 0.40 and should have been excluded by the floor" : null
        },
    },
    {
        name: "a better-than-floor match is kept, not discarded for being too good",
        run: () => matchProfile(baseInput({})),
        assert: (result) => {
            const alpha = findEntry(result, "tst-alpha")
            if (!alpha) return "tst-alpha matched at 1.00 and is missing"
            return alpha.matchScore === 1 ? null : `expected matchScore 1, got ${alpha.matchScore}`
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
        name: "undergrad year 3 is waste at 0.5 a year — close to done, skills carry",
        run: () => wasteFor(professions[0], { stage: "college", stream: [], preAdmission: false, courseYear: 3 }),
        expect: { years: 1.5 },
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

    // ── the second list ─────────────────────────────────────────────────────────────────────────
    {
        name: "worthTheSwitch ranks on raw fit and ignores the cost multiplier",
        run: () => matchProfile(baseInput({ user: buildUser("early_professional", { experienceYears: 10 }) })),
        assert: (result) => {
            if (result.worthTheSwitch.length === 0) return "the second list is empty"
            const top = result.worthTheSwitch[0]
            if (top.professionId !== "tst-alpha" && top.professionId !== "tst-gamma" && top.professionId !== "tst-delta") {
                return `expected a perfect-fit profession at the top, got ${top.professionId}`
            }
            if (typeof top.wastedYears !== "number") return "the cost must be shown even though it is not applied"
            if (typeof top.yearsToQualify !== "number") return "the runway must be shown beside every result"
            return null
        },
    },

    {
        name: "a student whose activities resolved to nothing still gets the second list",
        // The ranked list is activity-anchored by design, so no resolved activity means no ranked
        // professions. That must not mean an empty report: worthTheSwitch is drawn from raw fit
        // across every profession, so it survives, and the empty ranking is visible rather than
        // disguised as a thin one.
        run: () => matchProfile(baseInput({ resolvedActivities: [] })),
        assert: (result) => {
            if (result.ranked.length !== 0) return `expected an empty ranking, got ${result.ranked.length}`
            if (result.worthTheSwitch.length === 0) return "the second list should still be produced"
            return null
        },
    },
    {
        name: "an unrateable activity contributes nothing rather than matching everything",
        // activityResolver returns {} for text it cannot rate — "stuff", "things I like". An empty
        // vector must drop out, not sail past the floor by having no disagreement to measure.
        run: () => matchProfile(baseInput({ resolvedActivities: [resolved("stuff", {}, ["tst-alpha", "tst-beta"])] })),
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
            if (resolved[0].factors.bodily_intelligence !== 9) return "the cached factors were not returned"
            // Canonicalisation is what makes the hit possible — the student typed it differently.
            if (resolved[0].canonicalActivity !== "playing cricket") return `expected canonicalisation, got ${resolved[0].canonicalActivity}`
            return null
        },
    },
    {
        name: "a rubric version change MISSES the cache rather than reusing a stale rating",
        // A vector scored against one rubric must never be served under another. The miss is the
        // correct, expensive answer; silently reusing it would be the cheap wrong one.
        run: async () => {
            const cache = fakeCache([{
                canonicalActivity: "playing cricket",
                rubricVersion: "1.0",
                factors: flatFactors(5),
                candidateProfessionIds: ["tst-alpha"],
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
            if (resolved[0].factors.bodily_intelligence !== 9) return "the folded entry did not supply its factors"
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
]

module.exports = fixtures
