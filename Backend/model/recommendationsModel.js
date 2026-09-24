const mongoose = require("mongoose")

// THE MATCHING ENGINE'S OUTPUT, STORED. One row per student, rewritten whenever matching is re-run.
//
// Kept separate from `reports` on purpose. This is the RANKING — which professions, in what order,
// and the numbers behind that. `reports` is the PROSE a model wrote about it. Regenerating the
// wording of a report must never disturb the ranking it describes, and re-running the match must
// never be blocked by a report that failed to write.
//
// FIVE VERSION STAMPS, not one. A ranking is only reproducible if you know which scoring formulas,
// which profession list, which baseline ratings and which matching logic produced it. Any of the
// five moving means this row can be recomputed rather than retaken — which is the whole reason the
// engines are pure.
//
// `ranked_professions` is Mixed: it is the engine's own output shape and it will grow. Mongoose
// does not track changes inside it, so always write with findOneAndUpdate + $set.

const recommendationSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            unique: true, // one current ranking per student
        },
        sessionId: {
            type: String,
        },
        generatedAt: {
            type: Date,
            required: true, // stamped by the caller — matchProfile() is pure and has no clock
        },
        scoring_version: {
            type: String,
            required: true,
        },
        norm_set_id: {
            type: String,
            default: null, // null until there are norms
        },
        taxonomy_version: {
            type: String,
            default: null, // which version of the 223-profession list
        },
        baseline_version: {
            type: String,
            default: null, // baseline_rating.json schema_version
        },
        matching_version: {
            type: String,
            required: true,
        },
        ranked_professions: {
            type: Array,
            default: [], // matchProfile().ranked — tier, matchScore, comfortScore, match_confidence, the explanation blocks
        },
        worth_the_switch: {
            type: Array,
            default: [], // the §5 second list. Ranked on RAW fit, cost shown but not applied — shown BESIDE the ranking, never instead of it
        },
        filtered: {
            type: Array,
            default: [], // professions removed because entry is genuinely impossible, with the reason
        },
        aspiration_signals: {
            type: Array,
            default: [], // per aspiration: ranked / blocked / unranked / unmatched, and why
        },
        readiness_layer: {
            type: Object,
            default: {}, // confidence, consistency_grit, learning_capacity, informed_decision_making — the four universals, excluded from matching by design
        },
        values_profile: {
            type: Object,
            default: {}, // importance − fulfilment per area. Never summed, never mixed into a factor
        },
        list_counts: {
            type: Object,
            default: {}, // A / B / C — how much of the ranking rests on long-pursued activity evidence
        },
        // The student's own dominant driving reasons — 1-3 of the seven-word vocabulary Program 1
        // derives from the interest form.
        //
        // PERSISTED SO THE REPORT CAN SAY WHY IN THE STUDENT'S OWN TERMS. Every ranked profession
        // already carries its `drivingReasons` from baseline_rating.json, drawn from the identical
        // vocabulary, so the join is exact — "you pursue things out of curiosity, and so do the
        // people in this profession". It was computed and thrown away.
        //
        // NOT the same as `reasonOverlap` on a ranked entry, which must NOT be used for this:
        // program2 sets it to [] for every list-A profession before it is ever computed, so the
        // strongest-evidence matches would all show nothing. It is also a ranking input there
        // (it decides B vs C), and one value with two meanings drifts.
        dominant_reasons: {
            type: [String],
            default: [],
        },
    },
    {
        timestamps: true,
        minimize: false, // keep empty sub-objects instead of silently dropping them
    }
)

const Recommendation = mongoose.model("Recommendation", recommendationSchema)

module.exports = Recommendation
