const scorePerspective = require("./perspectiveScoring")
const scoreSart = require("./sartScoring")
const scoreIpip50 = require("./ipip50")
const scoreMi = require("./mi")
const scoreRosenberg = require("./rosenberg")
const scoreConfidenceItems = require("./confidenceItems")
const scoreDigitSpan = require("./digitSpan")
const scoreVerbalMemory = require("./verbalMemory")
const scoreReasoning = require("./reasoning")
const scoreStoryRecall = require("./storyRecall")
const { combine, worstQuality, round2 } = require("./scoringHelpers")

/* ============================================================================
   THE SCORING ENGINE — a completed assessment in, a 31-factor profile out.

   PURE. No database, no network, no clock, no randomness. The same input always
   produces byte-identical output, which is what makes `scoring_version` mean
   anything: a formula change is a recompute, never a retake.

   The Day-3 worker reads Submission.psychometric, calls this, and writes the
   result to `profiles` with userId and computed_at stamped on. None of that
   happens here.

   ── INPUT CONTRACT ─────────────────────────────────────────────────────────
   Nothing in the specs defined this, so it is defined here and the Day-4
   assessment UI must produce it. Answers are keyed by item_id — the canonical
   key in the item bank's own schema — so the form, the bank and the scorer
   speak one language, and a stray key is detectable rather than silently
   shifting every answer after it.

   Every module is optional. A missing module is not an error: it nulls its own
   factors and is listed in flags.modules_missing.

   {
     ipip50:      { answers: { IPIP_E1: "D", IPIP_ES3: "B", … } },   // 50, A–E
     mi:          { answers: { MI_V1: "C", MI_L5: "E", … } },        // 35, A–E
     rosenberg:   { answers: { RSE1: "D", … } },                      // 10, A–D
     confidence:  { answers: { CF1: "B", … } },                       // 6,  A–E
     perspective: {
         answers:   { P1: "A) …", P8: "C) …", U7: "C) …", PS1: "B) …", P23: 4, … },
         open:      { P7: {…}, P13: {…}, P22: {…}, P33: {…} },  // full LLM JSON or null
         narrative: { P31: "…", P32: "…" },
     },
     digitSpan:   { trials: [{ length, presented, response, correct, ms }] },
     sartRaw:     "<tab-separated PsyToolkit text>",
     extReasoning:{ percentile, score_raw, seconds_per_question, extraction_confidence },
     extVerbal:   { your_score, peer_average, extraction_confidence },
     storyRecall: { storyId, delayHours, facts: {…}, structured: {…},
                    free: { score, subScores } },   // free already LLM-scored
   }
   ========================================================================== */

const SCORING_VERSION = "profile@1.0.0"

const COMPONENT_VERSIONS = {
    perspective: "perspective@5.0.0",
    sart: "sart@1.0.0",
    instrument: "instrument@1.0.0",
    story: "story@1.0.0",
}

// STM is half digit span, half the external verbal-memory test (04_Item_Bank.md §5)
const STM_WEIGHTS = { digitSpan: 0.5, verbalMemory: 0.5 }

// 00_Research_Summary_FROZEN.md §4 — the one composite the assembler owns before the
// perspective call, because the ported file takes confidence as an already-0–10 input
const CONFIDENCE_WEIGHTS = {
    rosenberg: 0.40,
    ownItems: 0.15,
    conscientiousness: 0.15,
    emotionalStability: 0.15,
    reasoning: 0.15,
}

const LEARNING_CAPACITY_WEIGHTS = {
    reasoning: 0.25,
    focus: 0.25,
    openness: 0.20,
    longTermMemory: 0.15,
    processingSpeed: 0.15,
}

// Convergent Thinking is the ONLY differentiating minor the research doc gives coefficients for.
const CONVERGENT_WEIGHTS = {
    conscientiousness: 0.20,
    reasoning: 0.20,
    shortTermMemory: 0.15,
    longTermMemory: 0.15,
    logical: 0.15,
    processingSpeed: 0.15,
}

/* ── PROVISIONAL WEIGHTS ─────────────────────────────────────────────────────
   00_Research_Summary_FROZEN.md §4 "Minor factors — differentiating" names the
   INPUTS to these five but gives no coefficients — only Convergent Thinking is
   specified. Equal weighting is used here and is deliberately marked, because
   these five land directly in the 27-factor matching vector and therefore shape
   every recommendation.

   Equal weights are a defensible default rather than a guess dressed up as one:
   Part 10 §6 of the same document concedes that ALL its weights are "unit-ish
   judgements, not fitted". With no outcome data, unit weighting is the honest
   choice — fitted weights on no data would only be overfitting.

   Replace these the moment real weights exist. Nothing else needs to change.
   ========================================================================== */
const WEIGHTS_PROVISIONAL = {
    practical_intelligence: ["agreeableness", "extraversion", "short_term_memory", "reasoning", "confidence"],
    divergent_thinking: ["openness", "reasoning", "short_term_memory", "emotional_stability"],
    collaboration: ["openness", "agreeableness", "extraversion", "verbal_intelligence", "conscientiousness", "confidence"],
    interpersonal_intelligence: ["verbal_intelligence", "agreeableness", "extraversion", "short_term_memory", "emotional_intelligence"],
    propensity_to_go_deep: ["existential_intelligence", "conscientiousness", "reasoning", "long_term_memory"],
}

const MAJOR_FACTORS = [
    "openness", "conscientiousness", "agreeableness", "extraversion", "emotional_stability",
    "short_term_memory", "reasoning", "long_term_memory",
    "verbal_intelligence", "spatial_intelligence", "musical_intelligence", "bodily_intelligence",
    "naturalistic_intelligence", "existential_intelligence", "logical_intelligence",
    "confidence", "emotional_intelligence", "focus", "firmness", "intrapersonal_intelligence",
    "processing_speed", "uncertainty_tolerance",
]

const MINOR_FACTORS = [
    "consistency_grit", "learning_capacity", "informed_decision_making",
    "practical_intelligence", "divergent_thinking", "convergent_thinking",
    "collaboration", "interpersonal_intelligence", "propensity_to_go_deep",
]

// Part 5 — universals are excluded from matching: they correlate with everything and so add
// weight without adding discrimination. What remains is the 27-factor matching vector.
const UNIVERSAL_FACTORS = ["confidence", "consistency_grit", "learning_capacity", "informed_decision_making"]

const MATCHING_FACTORS = [...MAJOR_FACTORS, ...MINOR_FACTORS].filter((factor) => !UNIVERSAL_FACTORS.includes(factor))

const RELEASE_FULL = 1
const RELEASE_WITH_NOTE = 0.75

// the ported perspective scorer takes 53 positional arguments in this exact order
const callPerspective = (perspective, sart, traits) => {
    const answers = (perspective && perspective.answers) || {}
    const open = (perspective && perspective.open) || {}
    const narrative = (perspective && perspective.narrative) || {}
    const item = (id) => (answers[id] === undefined ? null : answers[id])

    return scorePerspective(
        item("P1"), item("P2"), item("P3"), item("P4"), item("P5"), item("P6"),
        open.P7 === undefined ? null : open.P7,
        item("P8"), item("P9"), item("P10"), item("P11"), item("P12"),
        open.P13 === undefined ? null : open.P13,
        item("P14"), item("P15"), item("P16"), item("P17"), item("P18"), item("P19"), item("P20"), item("P21"),
        open.P22 === undefined ? null : open.P22,
        item("P23"), item("P24"), item("P25"), item("P26"), item("P27"), item("P28"), item("P29"), item("P30"),
        open.P33 === undefined ? null : open.P33,
        item("U1"), item("U2"), item("U3"), item("U4"), item("U5"), item("U6"), item("U7"),
        item("PS1"), item("PS2"), item("PS3"), item("PS4"),
        sart.attention, sart.processingSpeed,
        narrative.P31 === undefined ? null : narrative.P31,
        narrative.P32 === undefined ? null : narrative.P32,
        traits.agreeableness,
        traits.emotional_stability,     // already reversed — used directly, never inverted
        traits.conscientiousness,
        traits.openness,
        traits.reasoning,
        traits.short_term_memory,
        traits.confidence
    )
}

const scoreProfile = (psychometric = {}) => {
    const raw_scores = {}
    const data_quality = {}
    const flags = {}
    const modules_missing = []

    const mergeFlags = (source) => {
        Object.entries(source || {}).forEach(([key, value]) => {
            if (value === true) {
                flags[key] = true
            } else if (Array.isArray(value) && value.length > 0) {
                flags[key] = (flags[key] || []).concat(value)
            } else if (value && !Array.isArray(value) && flags[key] === undefined) {
                flags[key] = value
            }
        })
    }

    const set = (factor, result) => {
        raw_scores[factor] = result && result.value !== undefined ? result.value : null
        data_quality[factor] = result && result.quality !== undefined ? result.quality : null
    }

    // ── STAGE 1 — leaves, all independent ────────────────────────────────────
    const ipip = scoreIpip50(psychometric.ipip50)
    const mi = scoreMi(psychometric.mi)
    const rosenberg = scoreRosenberg(psychometric.rosenberg)
    const ownConfidence = scoreConfidenceItems(psychometric.confidence)
    const digitSpan = scoreDigitSpan(psychometric.digitSpan)
    const verbalMemory = scoreVerbalMemory(psychometric.extVerbal)
    const reasoning = scoreReasoning(psychometric.extReasoning)
    const storyRecall = scoreStoryRecall(psychometric.storyRecall, psychometric.storyRecall && psychometric.storyRecall.free)

    const sartResult = psychometric.sartRaw ? scoreSart(psychometric.sartRaw) : null
    const sart = {
        attention: sartResult && sartResult.valid ? sartResult.sart_attention : null,
        processingSpeed: sartResult && sartResult.valid ? sartResult.processing_speed : null,
    }

    if (!psychometric.ipip50) modules_missing.push("ipip50")
    if (!psychometric.mi) modules_missing.push("mi")
    if (!psychometric.rosenberg) modules_missing.push("rosenberg")
    if (!psychometric.confidence) modules_missing.push("confidence")
    if (!psychometric.digitSpan) modules_missing.push("digitSpan")
    if (!psychometric.extVerbal) modules_missing.push("extVerbal")
    if (!psychometric.extReasoning) modules_missing.push("extReasoning")
    if (!psychometric.storyRecall) modules_missing.push("storyRecall")
    if (!psychometric.sartRaw) modules_missing.push("sart")
    if (!psychometric.perspective) modules_missing.push("perspective")

    ;[ipip, mi, rosenberg, ownConfidence, digitSpan, verbalMemory, reasoning, storyRecall].forEach((result) => {
        mergeFlags(result.flags)
    })

    if (sartResult && !sartResult.valid) {
        flags.sart_invalid = true
        flags.sart_invalid_reasons = sartResult.invalid_reasons
    }

    if (sartResult && sartResult.flags) {
        mergeFlags(sartResult.flags)
    }

    // Big Five and the seven intelligences go straight in
    MAJOR_FACTORS.forEach((factor) => {
        if (ipip.scores[factor] !== undefined) {
            raw_scores[factor] = ipip.scores[factor]
            data_quality[factor] = ipip.quality[factor]
        }
        if (mi.scores[factor] !== undefined) {
            raw_scores[factor] = mi.scores[factor]
            data_quality[factor] = mi.quality[factor]
        }
    })

    raw_scores.reasoning = reasoning.score
    data_quality.reasoning = reasoning.quality
    raw_scores.long_term_memory = storyRecall.score
    data_quality.long_term_memory = storyRecall.quality

    // a self-reported logical score far from measured reasoning is a calibration signal, not an error
    if (mi.scores.logical_intelligence !== null && reasoning.score !== null) {
        flags.logical_vs_reasoning_gap = round2(mi.scores.logical_intelligence - reasoning.score)
    }

    // ── STAGE 2 — short-term memory ──────────────────────────────────────────
    set("short_term_memory", combine([
        { value: digitSpan.score, weight: STM_WEIGHTS.digitSpan, quality: digitSpan.quality },
        { value: verbalMemory.score, weight: STM_WEIGHTS.verbalMemory, quality: verbalMemory.quality },
    ], { minUsedWeight: 0.5 }))     // either half alone carries it, marked partial

    // ── STAGE 3 — confidence ─────────────────────────────────────────────────
    // Both directly-measured components missing means there is nothing left but supporting traits,
    // and a confidence score built only from traits is the circular derivation Principle 1 forbids.
    const hasMeasuredConfidence = rosenberg.score !== null || ownConfidence.score !== null

    set("confidence", hasMeasuredConfidence ? combine([
        { value: rosenberg.score, weight: CONFIDENCE_WEIGHTS.rosenberg, quality: rosenberg.quality },
        { value: ownConfidence.score, weight: CONFIDENCE_WEIGHTS.ownItems, quality: ownConfidence.quality },
        { value: raw_scores.conscientiousness, weight: CONFIDENCE_WEIGHTS.conscientiousness, quality: data_quality.conscientiousness },
        { value: raw_scores.emotional_stability, weight: CONFIDENCE_WEIGHTS.emotionalStability, quality: data_quality.emotional_stability },
        { value: reasoning.score, weight: CONFIDENCE_WEIGHTS.reasoning, quality: reasoning.quality },
    ]) : { value: null, quality: null })

    // ── STAGE 4 — the ported perspective scorer ──────────────────────────────
    const perspective = callPerspective(psychometric.perspective, sart, {
        agreeableness: raw_scores.agreeableness,
        emotional_stability: raw_scores.emotional_stability,
        conscientiousness: raw_scores.conscientiousness,
        openness: raw_scores.openness,
        reasoning: raw_scores.reasoning,
        short_term_memory: raw_scores.short_term_memory,
        confidence: raw_scores.confidence,
    })

    mergeFlags(perspective.flags)

    // The ported file receives its fetched traits as bare numbers, so it cannot know how good they
    // were. Re-propagate here, or a factor built on a partial input would report "full".
    const ported = [
        ["emotional_intelligence", perspective.ei_score, perspective.data_quality.ei,
            ["agreeableness", "emotional_stability", "reasoning"]],
        ["firmness", perspective.firmness_score, perspective.data_quality.firmness,
            ["confidence", "emotional_stability"]],
        ["focus", perspective.focus_score, perspective.data_quality.focus,
            ["short_term_memory", "reasoning"]],
        ["intrapersonal_intelligence", perspective.intrapersonal_intelligence, perspective.data_quality.intrapersonal,
            ["openness"]],
        ["consistency_grit", perspective.consistency_score, perspective.data_quality.consistency,
            ["conscientiousness"]],
        ["informed_decision_making", perspective.informed_decision_making, perspective.data_quality.idm,
            ["reasoning", "openness"]],
    ]

    ported.forEach(([factor, value, ownQuality, upstreams]) => {
        raw_scores[factor] = value
        data_quality[factor] = value === null
            ? null
            : worstQuality([ownQuality, ...upstreams.map((input) => data_quality[input])])
    })

    raw_scores.processing_speed = perspective.processing_speed
    data_quality.processing_speed = perspective.processing_speed === null ? null : "full"
    raw_scores.uncertainty_tolerance = perspective.uncertainty_tolerance
    data_quality.uncertainty_tolerance = perspective.uncertainty_tolerance === null ? null : "full"

    // Without SART, focus renormalises onto clm and the ported file reports "full" — but its
    // strongest input is absent, so that overstates it.
    if (flags.sart_not_taken && data_quality.focus === "full") {
        data_quality.focus = "partial"
    }

    // ── STAGE 5 — learning capacity and the differentiating minors ───────────
    set("learning_capacity", combine([
        { value: raw_scores.reasoning, weight: LEARNING_CAPACITY_WEIGHTS.reasoning, quality: data_quality.reasoning },
        { value: raw_scores.focus, weight: LEARNING_CAPACITY_WEIGHTS.focus, quality: data_quality.focus },
        { value: raw_scores.openness, weight: LEARNING_CAPACITY_WEIGHTS.openness, quality: data_quality.openness },
        { value: raw_scores.long_term_memory, weight: LEARNING_CAPACITY_WEIGHTS.longTermMemory, quality: data_quality.long_term_memory },
        { value: raw_scores.processing_speed, weight: LEARNING_CAPACITY_WEIGHTS.processingSpeed, quality: data_quality.processing_speed },
    ]))

    set("convergent_thinking", combine([
        { value: raw_scores.conscientiousness, weight: CONVERGENT_WEIGHTS.conscientiousness, quality: data_quality.conscientiousness },
        { value: raw_scores.reasoning, weight: CONVERGENT_WEIGHTS.reasoning, quality: data_quality.reasoning },
        { value: raw_scores.short_term_memory, weight: CONVERGENT_WEIGHTS.shortTermMemory, quality: data_quality.short_term_memory },
        { value: raw_scores.long_term_memory, weight: CONVERGENT_WEIGHTS.longTermMemory, quality: data_quality.long_term_memory },
        { value: raw_scores.logical_intelligence, weight: CONVERGENT_WEIGHTS.logical, quality: data_quality.logical_intelligence },
        { value: raw_scores.processing_speed, weight: CONVERGENT_WEIGHTS.processingSpeed, quality: data_quality.processing_speed },
    ]))

    Object.entries(WEIGHTS_PROVISIONAL).forEach(([factor, inputs]) => {
        const weight = 1 / inputs.length

        set(factor, combine(inputs.map((input) => ({
            value: raw_scores[input],
            weight,
            quality: data_quality[input],
        }))))
    })

    // ── STAGE 6 — matching adjustment, completeness ──────────────────────────
    // Part 7: U7 never removes a profession from a student's list. A single item qualifies, it does
    // not gate. Both figures are stored — raw for the record, adjusted for matching.
    const uncertaintyRaw = raw_scores.uncertainty_tolerance
    const uncertainty_tolerance_matching = flags.risk_uncalibrated && uncertaintyRaw !== null
        ? round2(0.7 * uncertaintyRaw + 0.3 * 5)
        : uncertaintyRaw

    if (modules_missing.length > 0) {
        flags.modules_missing = modules_missing
    }

    const countScored = (factors) => factors.filter((factor) => raw_scores[factor] !== null && raw_scores[factor] !== undefined).length

    const matching = round2(countScored(MATCHING_FACTORS) / MATCHING_FACTORS.length)
    const allFactors = [...MAJOR_FACTORS, ...MINOR_FACTORS]
    const overall = round2(countScored(allFactors) / allFactors.length)

    let release = "withhold"
    if (matching >= RELEASE_FULL) release = "release"
    else if (matching >= RELEASE_WITH_NOTE) release = "release_with_note"

    // make sure every declared factor has a key, even one nothing produced
    allFactors.forEach((factor) => {
        if (raw_scores[factor] === undefined) raw_scores[factor] = null
        if (data_quality[factor] === undefined) data_quality[factor] = null
    })

    return {
        scoring_version: SCORING_VERSION,
        component_versions: COMPONENT_VERSIONS,
        norm_set_id: null,              // no norms until 500+ per age band
        raw_scores,
        normed_scores: {},              // empty in V1
        bands: {},                      // empty in V1
        data_quality,
        banks: {
            belief_bank: perspective.belief_bank,
            emotion_bank: perspective.emotion_bank,
            clm: perspective.clm,
            self_awareness_bank: perspective.self_awareness_bank,
        },
        components: {
            ...perspective.components,
            digit_span: digitSpan.score,
            verbal_memory: verbalMemory.score,
            rosenberg: rosenberg.score,
            own_confidence_items: ownConfidence.score,
            persistence_raw: perspective.persistence_raw,
            story_structured_points: storyRecall.structured_points === undefined ? null : storyRecall.structured_points,
            story_free_recall_points: storyRecall.free_recall_points === undefined ? null : storyRecall.free_recall_points,
            numeric_recall: storyRecall.numeric_recall === undefined ? null : storyRecall.numeric_recall,
            verbal_recall: storyRecall.verbal_recall === undefined ? null : storyRecall.verbal_recall,
            uncertainty_tolerance_matching,
            sart: sartResult ? sartResult.descriptives : null,
        },
        values_profile: perspective.values_profile,
        belief_category: perspective.belief_category,
        momentum_blocker: perspective.momentum_blocker,
        flags,
        completeness: { matching, overall, release },
    }
}

module.exports = scoreProfile
