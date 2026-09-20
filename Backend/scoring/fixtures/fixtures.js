const {
    buildSubmission,
    fillIpip,
    fillMi,
    fillRosenberg,
    fillConfidence,
    fillPerspective,
    buildDigitSpan,
    buildSartRaw,
    buildStoryRecall,
} = require("./buildSubmission")

// Golden fixtures: known input → known output. Each `expect` is a path into the profile and the
// value it must have. Expected values are derived from the formulas in 00_Research_Summary_FROZEN.md
// and the gates in 04_Item_Bank.md, so these test the code against the SPEC, not against itself.
//
// More than a third of them exist to prove one property: that an invalid or incomplete session
// NULLS AND FLAGS rather than producing a plausible-looking number. That is the property the whole
// design rests on — "a fluent-looking number from an invalid session is worse than no number."

const partialIpip = () => {
    const answers = fillIpip("D")

    // strip 4 of Openness's 10 items → 60% answered, under the 80% gate
    ;[7, 8, 9, 10].forEach((number) => delete answers[`IPIP_O${number}`])

    return answers
}

const fixtures = [
    {
        name: "01 complete valid session — every module present",
        input: buildSubmission(),
        expect: {
            "completeness.release": "release",
            "completeness.matching": 1,
            "completeness.overall": 1,
            "scoring_version": "profile@1.0.0",
            "component_versions.perspective": "perspective@5.0.0",
            "norm_set_id": null,
        },
        assert: (profile) => {
            const nulls = Object.entries(profile.raw_scores).filter(([, value]) => value === null)
            if (nulls.length > 0) return `expected no null factors, got ${nulls.map(([key]) => key).join(", ")}`
            if (Object.keys(profile.raw_scores).length !== 31) return `expected 31 factors, got ${Object.keys(profile.raw_scores).length}`
            return null
        },
    },
    {
        name: "02 high profile — top-of-scale answers",
        input: buildSubmission({
            ipip50: { answers: fillIpip("E") },
            rosenberg: { answers: fillRosenberg(true) },
            confidence: { answers: fillConfidence("A") },
            extReasoning: { percentile: 95, score_raw: 10, seconds_per_question: 40, extraction_confidence: 0.98 },
        }),
        expect: {
            "raw_scores.openness": 7,           // 3 reversed of 10, all "E" → mean 3.8
            "raw_scores.reasoning": 9.5,
            "completeness.release": "release",
        },
    },
    {
        name: "03 low profile — bottom-of-scale answers",
        input: buildSubmission({
            ipip50: { answers: fillIpip("A") },
            rosenberg: { answers: fillRosenberg(false) },
            confidence: { answers: fillConfidence("E") },
            extReasoning: { percentile: 12, score_raw: 2, seconds_per_question: 40, extraction_confidence: 0.95 },
            digitSpan: buildDigitSpan(3),
        }),
        expect: {
            "raw_scores.reasoning": 1.2,
            "raw_scores.rosenberg": undefined,
            "components.rosenberg": 0,
            "components.own_confidence_items": 0,
            "raw_scores.openness": 3,           // all "A": 7 positive score 1, 3 reversed score 5
        },
    },
    {
        name: "04 mid-range profile",
        input: buildSubmission({
            ipip50: { answers: fillIpip("C") },
            confidence: { answers: fillConfidence("C") },
            extReasoning: { percentile: 50, score_raw: 5, seconds_per_question: 30, extraction_confidence: 0.9 },
        }),
        expect: {
            "raw_scores.openness": 5,           // every item "C" = 3 → mean 3 regardless of keying
            "raw_scores.emotional_stability": 5,
            "raw_scores.reasoning": 5,
        },
    },

    // ── Missing modules — reweight or null, never impute ─────────────────────
    {
        name: "05 no SART — focus reweights to clm and is downgraded to partial",
        input: buildSubmission({ sartRaw: undefined }),
        expect: {
            "raw_scores.processing_speed": null,
            "data_quality.processing_speed": null,
            "data_quality.focus": "partial",
            "flags.sart_not_taken": true,
        },
        assert: (profile) =>
            profile.raw_scores.focus === null ? "focus should still score from clm without SART" : null,
    },
    {
        name: "06 no verbal-memory upload — STM carries on digit span alone, marked partial",
        input: buildSubmission({ extVerbal: undefined }),
        expect: {
            "raw_scores.short_term_memory": 5,      // digit span 6 → 5.0, carrying alone
            "data_quality.short_term_memory": "partial",
        },
        assert: (profile) =>
            profile.data_quality.convergent_thinking !== "partial"
                ? "a partial STM must propagate to convergent_thinking"
                : null,
    },
    {
        name: "07 empty submission — everything null, nothing thrown",
        input: {},
        expect: {
            "completeness.release": "withhold",
            "completeness.matching": 0,
            "raw_scores.openness": null,
            "raw_scores.confidence": null,
            "raw_scores.focus": null,
        },
        assert: (profile) => {
            const scored = Object.entries(profile.raw_scores).filter(([, value]) => value !== null)
            if (scored.length > 0) return `expected every factor null, got ${scored.map(([key]) => key).join(", ")}`
            if ((profile.flags.modules_missing || []).length !== 10) return "expected all 10 modules listed missing"
            return null
        },
    },

    // ── Validity gates — the heart of the thing ──────────────────────────────
    {
        name: "08 reasoning fast AND near-chance — invalid, nulled, flagged",
        input: buildSubmission({
            extReasoning: { percentile: 22, score_raw: 2, seconds_per_question: 6, extraction_confidence: 0.95 },
        }),
        expect: {
            "raw_scores.reasoning": null,
            "data_quality.reasoning": null,
            "flags.reasoning_invalid": true,
            "flags.admin_review": true,
        },
        assert: (profile) =>
            profile.data_quality.emotional_intelligence === "full"
                ? "EI depends on reasoning, so it cannot be full when reasoning is null"
                : null,
    },
    {
        name: "09 reasoning fast AND strong — valid, not punished for being quick",
        input: buildSubmission({
            extReasoning: { percentile: 91, score_raw: 9, seconds_per_question: 7, extraction_confidence: 0.95 },
        }),
        expect: {
            "raw_scores.reasoning": 9.1,
            "flags.exceptional_speed": true,
            "flags.reasoning_invalid": undefined,
        },
    },
    {
        name: "10 reasoning percentile out of range — extraction rejected",
        input: buildSubmission({
            extReasoning: { percentile: 140, score_raw: 9, seconds_per_question: 30, extraction_confidence: 0.95 },
        }),
        expect: {
            "raw_scores.reasoning": null,
            "flags.reasoning_out_of_range": true,
        },
    },
    {
        name: "11 SART with >15% anticipatory presses — session invalid",
        input: buildSubmission({ sartRaw: buildSartRaw({ anticipatoryRate: 0.35 }) }),
        expect: {
            "raw_scores.processing_speed": null,
            "flags.sart_invalid": true,
        },
    },
    {
        name: "12 SART impulsive responding — fast but inaccurate is not speed",
        input: buildSubmission({ sartRaw: buildSartRaw({ meanRt: 240, commissionRate: 0.6 }) }),
        assert: (profile) => {
            const flagged = profile.flags.impulsive_responding === true || profile.flags.sart_invalid === true
            return flagged ? null : "a fast, high-commission session must be flagged, never praised as quick"
        },
    },
    {
        name: "13 IPIP only 60% answered on one trait — nulled, not a partial mean",
        input: buildSubmission({ ipip50: { answers: partialIpip() } }),
        expect: {
            "raw_scores.openness": null,
            "data_quality.openness": null,
            "raw_scores.conscientiousness": 5.5,
        },
    },
    {
        name: "14 story recall past the 72-hour window — LTM nulled",
        input: buildSubmission({ storyRecall: buildStoryRecall({ delayHours: 80 }) }),
        expect: {
            "raw_scores.long_term_memory": null,
            "flags.story_recall_expired": true,
            "flags.admin_review": true,
        },
        assert: (profile) =>
            profile.data_quality.learning_capacity === "full"
                ? "learning_capacity consumes LTM, so it cannot be full when LTM is null"
                : null,
    },
    {
        name: "15 verbal memory above its instrument maximum — rejected",
        input: buildSubmission({ extVerbal: { your_score: 41, peer_average: 24, extraction_confidence: 0.9 } }),
        expect: {
            "flags.verbal_memory_out_of_range": true,
            "data_quality.short_term_memory": "partial",
        },
    },

    // ── Response-quality flags ───────────────────────────────────────────────
    {
        name: "16 straightlined MI block — same option on all 35",
        input: buildSubmission({ mi: { answers: fillMi("C") } }),
        expect: { "flags.straightline_mi": true },
    },
    {
        name: "17 social desirability — P32 claims they never lose momentum",
        input: buildSubmission({
            perspective: fillPerspective("A", {
                narrative: { P31: "Effort compounds.", P32: "I never lose momentum" },
            }),
        }),
        expect: { "flags.social_desirability": true },
    },
    {
        name: "18 strong but unexamined — high belief bank, no revisability",
        input: buildSubmission({
            perspective: fillPerspective("A", {
                open: {
                    P7: { reasons: 3, evidence: 3, revisability: 0 },
                    P13: { criteria: { deep_work_first: true, urgency_order: true, messages_batched: true, fixed_respected: true, recovery: true } },
                    P22: { granularity: 2, complexity: 1, perspective: 1 },
                    P33: { specificity: 2, causal_insight: 2, integration: 2 },
                },
            }),
        }),
        expect: { "flags.strong_but_unexamined": true },
    },
    {
        name: "19 risk uncalibrated — high uncertainty tolerance with an unexamined U7",
        input: buildSubmission({
            perspective: fillPerspective("A", { answers: { U7: "C) a guaranteed return" } }),
        }),
        expect: { "flags.risk_uncalibrated": true },
        assert: (profile) => {
            const raw = profile.raw_scores.uncertainty_tolerance
            const adjusted = profile.components.uncertainty_tolerance_matching
            if (adjusted === raw) return "a flagged score must be pulled toward the mean for matching"
            if (Math.abs(adjusted - (0.7 * raw + 0.3 * 5)) > 0.01) return `expected 0.7*raw + 0.3*5, got ${adjusted}`
            return null
        },
    },

    // ── LLM open items ───────────────────────────────────────────────────────
    {
        name: "20 all four open items unscoreable — banks fall back to MCQ alone",
        input: buildSubmission({ perspective: fillPerspective("A", { open: {} }) }),
        assert: (profile) => {
            if (profile.banks.belief_bank === null) return "belief_bank should still score from its MCQ items"
            if (profile.data_quality.firmness === "full") return "firmness sits downstream of a partial bank, so it cannot be full"
            const unscoreable = profile.flags.llm_unscoreable
            if (!unscoreable || unscoreable.length < 4) return `expected 4 items in llm_unscoreable, got ${JSON.stringify(unscoreable)}`
            return null
        },
    },
    {
        name: "21 P13 returns three of five criteria — rejected outright, not scored 3/5",
        input: buildSubmission({
            perspective: fillPerspective("A", {
                open: {
                    P7: { reasons: 3, evidence: 3, revisability: 3 },
                    P13: { criteria: { deep_work_first: true, urgency_order: true, messages_batched: true } },
                    P22: { granularity: 2, complexity: 1, perspective: 1 },
                    P33: { specificity: 2, causal_insight: 2, integration: 2 },
                },
            }),
        }),
        assert: (profile) => {
            const unscoreable = profile.flags.llm_unscoreable || []
            if (!unscoreable.some((item) => String(item).toLowerCase().includes("13"))) {
                return `P13 should be unscoreable, got ${JSON.stringify(unscoreable)}`
            }
            return profile.data_quality.focus === "full" ? "clm is partial, so focus cannot be full" : null
        },
    },
    {
        name: "22 LLM sub-score out of range — clamped and recorded, never trusted",
        input: buildSubmission({
            perspective: fillPerspective("A", {
                open: {
                    P7: { reasons: 9, evidence: 3, revisability: 3 },
                    P13: { criteria: { deep_work_first: true, urgency_order: true, messages_batched: true, fixed_respected: true, recovery: true } },
                    P22: { granularity: 2, complexity: 1, perspective: 1 },
                    P33: { specificity: 2, causal_insight: 2, integration: 2 },
                },
            }),
        }),
        assert: (profile) => {
            const problems = profile.flags.llm_problems || []
            if (problems.length === 0) return "an out-of-range sub-score must be recorded in llm_problems"
            return profile.banks.belief_bank > 10 ? "belief_bank must stay within 0–10 after clamping" : null
        },
    },
]

module.exports = fixtures
