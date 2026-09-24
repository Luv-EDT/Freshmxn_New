const mongoose = require("mongoose")

// THE OUTPUT OF THE SCORING ENGINE, stored. One row per student, rewritten whenever the profile is
// recomputed rather than appended to — `scoring_version` says which formulas produced it, so a
// formula change is a recompute, never a retake.
//
// scoreProfile() is pure and deliberately sets neither userId nor computed_at. This row is where
// they get stamped, by the worker, because that is the only part of the pipeline that knows what
// time it is and whose profile this is.
//
// THE SCORE BLOCKS ARE Object, NOT NESTED SCHEMAS. Thirty-one factor keys, four banks and a flags
// object whose members change with the item bank would be four hundred lines of schema restating
// what Backend/scoring/ already defines, and every new flag would need a migration. Mongoose does
// NOT track changes inside these, so they are always written with findOneAndUpdate + $set, never
// mutated in place and saved.
//
// data_quality IS NOT CONFIDENCE. It records how much INPUT was available per factor. The
// Confidence factor is raw_scores.confidence, an entirely different thing, and neither is ever
// shown to a student as "your confidence score".

const profileSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            unique: true, // one current profile per student
        },
        sessionId: {
            type: String,
        },
        scoring_version: {
            type: String,
            required: true, // e.g. "profile@1.0.0" — which assembler produced this
        },
        component_versions: {
            type: Object,
            default: {}, // perspective / sart / instrument / story — the sub-scorers move independently
        },
        norm_set_id: {
            type: String,
            default: null, // stays null until there are 500+ students per age band
        },
        computed_at: {
            type: Date,
            required: true, // stamped here, not by the pure function
        },
        raw_scores: {
            type: Object,
            required: true, // 22 majors + 9 minors, 0-10 or null
        },
        normed_scores: {
            type: Object,
            default: {}, // empty in V1 — percentiles need norms
        },
        bands: {
            type: Object,
            default: {}, // empty in V1 — also norm-dependent
        },
        data_quality: {
            type: Object,
            default: {}, // "full" | "partial" | null per factor
        },
        flags: {
            type: Object,
            default: {}, // validity and quality flags
        },
        banks: {
            type: Object,
            default: {}, // belief_bank, emotion_bank, clm, self_awareness_bank
        },
        components: {
            type: Object,
            default: {}, // every sub-score, including uncertainty_tolerance_matching, which matching reads instead of the raw value
        },
        values_profile: {
            type: Object,
            default: {}, // importance − fulfilment per area. Never summed, never mixed into a factor
        },
        completeness: {
            type: Object,
            default: {}, // { matching, overall, release } — drives the release rule, not a score
        },
    },
    {
        timestamps: true,
        minimize: false, // keep empty sub-objects instead of silently dropping them
    }
)

// The admin review queues read by recency, and a recompute after a formula change reads by version.
profileSchema.index({ scoring_version: 1, computed_at: -1 })

const Profile = mongoose.model("Profile", profileSchema)

module.exports = Profile
