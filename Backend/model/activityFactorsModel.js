const mongoose = require("mongoose")

// THE ACTIVITY-FACTOR CACHE. Program 2 compares an activity against a profession on the same 27
// factors, which means every activity a student names has to be rated on those factors first —
// an LLM call and a Voyage embedding per activity.
//
// Students overwhelmingly name the same things. "playing cricket", "Cricket", "i play cricket for
// my school team" are one activity, and rating them separately costs three times as much and
// returns three slightly different vectors for the same thing. So each canonical activity is
// scored ONCE and reused, and near-duplicates are folded in by cosine similarity rather than by
// string matching, which would never catch those three.
//
// THIS IS THE COLLECTION THAT NEEDS ATLAS VECTOR SEARCH, not the professions. There are 223
// professions and their vectors live in a JSON file — an exact in-memory cosine over 223 rows is
// faster than a network round trip and cannot be approximate. This collection grows with every
// student, has no ceiling, and is queried on every match, which is exactly what ANN search is for.
//
// Index definition (Atlas → Search → Create Search Index → Vector Search), name "activity_vector":
//
//   {
//     "fields": [
//       { "type": "vector", "path": "embedding", "numDimensions": 1024, "similarity": "cosine" },
//       { "type": "filter", "path": "rubricVersion" }
//     ]
//   }
//
// rubricVersion is a filter field and not decoration: a vector scored against one rubric must
// never be reused under another. When the rubric changes, entries do not migrate — they are
// rescored, and until then the old ones simply stop matching.

const activityFactorsSchema = new mongoose.Schema(
    {
        canonicalActivity: {
            type: String,
            required: true,
            unique: true, // the lookup key — lowercased, whitespace-collapsed student text
        },
        exampleRaw: {
            type: [String],
            default: [], // the phrasings that folded into this entry, kept for review and for tuning the dedup threshold
        },
        // Round 14: every near-hit with the similarity that let it in — the last 100 — so the 0.90
        // threshold can be checked against real answers (admin → Activity matches)
        folds: {
            type: [{ _id: false, text: String, score: Number, at: Date }],
            default: [],
        },
        // phrasings an admin said are NOT this activity ("Not the same"): never folded in again, so the
        // next student who writes one gets it rated on its own
        refusedFolds: {
            type: [String],
            default: [],
        },
        factors: {
            type: Object, // rows before Round 21 only: the activity rated on the 27 slugs. No longer written or read by matching
        },
        pointsTo: {
            type: [String],
            default: undefined, // Round 21: the 2-4 areas this activity points to ("social work", "public service"); absent on older rows until topped up
        },
        candidateProfessionIds: {
            type: [String],
            default: [], // the shortlist this activity points at (its name and areas searched by meaning, then the AI shortlist) — cached, because re-running it for a known activity buys nothing. Since Round 22 only the careers marked STRONG
        },
        partialProfessionIds: {
            type: [String],
            default: [], // Round 22: careers the shortlist marked PARTIAL — stored for the admin trace, never matched
        },
        shortlistVersion: {
            type: String,
            default: null, // Round 22: "strict-1" once shortlisted strong/partial; an older row is shortlisted again on first use
        },
        embedding: {
            type: [Number],
            required: true, // voyage-4-large, 1024 dimensions, input_type "query"
        },
        embeddingModel: {
            type: String,
            required: true, // recorded so the "voyage-4 family shares a space" promise can be checked, not assumed
        },
        rubricVersion: {
            type: String,
            required: true, // factor_anchors.json schema_version the scoring used
        },
        samples: {
            type: Number,
            default: 1, // how many scoring passes were averaged
        },
        sampleVariance: {
            type: Object,
            default: {}, // per factor { samples[], spread } — same discipline as baseline_rating.json
        },
        reviewStatus: {
            type: String,
            default: "unreviewed", // unreviewed | approved | corrected
        },
        adminReview: {
            required: {
                type: Boolean,
                default: false, // set when the passes disagreed by more than the allowed spread
            },
            priority: {
                type: String,
                default: "none", // none | medium | high
            },
            reason: {
                type: String,
                default: null,
            },
        },
        timesUsed: {
            type: Number,
            default: 0, // which activities actually carry the matching — tells us what to review first
        },
    },
    {
        timestamps: true, // createdAt, and updatedAt IS the "last updated" the spec asks for
        minimize: false, // keep empty sub-objects instead of silently dropping them
    }
)

// The dedup path filters on rubricVersion before the vector search, and the review queue reads by
// priority and usage — an activity scored once and used by four hundred students is worth a
// human's attention long before one used twice.
activityFactorsSchema.index({ rubricVersion: 1 })
activityFactorsSchema.index({ "adminReview.required": 1, timesUsed: -1 })

const ActivityFactors = mongoose.model("ActivityFactors", activityFactorsSchema)

module.exports = ActivityFactors
