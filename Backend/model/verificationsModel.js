const mongoose = require("mongoose")

// THE HUMAN-VERIFICATION QUEUE — one row per extraction a person has to look at before the number
// it produced is allowed to stand.
//
// 04_Item_Bank.md §7 gives two rules that both end here:
//     · extraction_confidence < 0.8  → human verification queue
//     · a value outside its own range → reject the extraction, request a re-upload
// and one warning that is the whole reason this file exists: "a hallucinated number that lands in
// range is the failure mode to guard against".
//
// WHY A ROW RATHER THAN A FLAG ON THE SUBMISSION. A flag is only ever seen by whoever goes looking
// at that one student. These are the cases where nobody knows to go looking — the numbers are
// plausible, the report reads normally, and the only thing wrong is that a model misread a
// screenshot. A queue is a list somebody works through; a flag is a thing somebody finds.
//
// THE IMAGE IS NOT STORED. `imageReceived` records that one arrived and how big it was, nothing
// more. A screenshot of a test result is a minor's personal data and it has done its job the moment
// the numbers are out of it — keeping it turns a verification queue into a photo library. The
// reviewer's job is therefore "does this number look sane, and does the student agree it is
// theirs", which is what `studentConfirmed` is for: the student is shown what was read back and
// says whether it matches.

const verificationSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        // "extReasoning" | "extVerbal" — the psychometric block the extraction writes to
        module: {
            type: String,
            required: true,
        },
        instrument: {
            type: String, // assessmentday_logical_v1 | mindcrowd_verbal_v1
            required: true,
        },
        // Why this landed in the queue: "low_confidence" | "out_of_range" | "implausible" |
        // "wrong_instrument" | "student_disputed". Stored rather than recomputed so a later change
        // to the thresholds cannot rewrite the history of why someone was reviewed.
        reason: {
            type: String,
            required: true,
        },
        extracted: {
            type: Object,
            default: {}, // exactly what the model returned. Mixed — always $set
        },
        extraction_confidence: {
            type: Number,
            default: null,
        },
        imageReceived: {
            bytes: {
                type: Number,
                default: null,
            },
            mediaType: {
                type: String,
                default: null,
            },
        },
        // Whether the student agreed with the numbers read back to them. A disagreement is worth
        // more than any confidence score the model reports about itself.
        studentConfirmed: {
            type: Boolean,
            default: null,
        },
        status: {
            type: String,
            default: "open", // open | corrected | accepted | rejected
        },
        // What a reviewer decided the numbers actually were. Written back onto the submission only
        // by the admin screen, never by this collection.
        corrected: {
            type: Object,
            default: {},
        },
        reviewedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },
        reviewedAt: {
            type: Date,
            default: null,
        },
    },
    {
        timestamps: true,
        minimize: false,
    }
)

// The queue is worked oldest-first within the open set, and a student's own history is read per
// module when they re-upload.
verificationSchema.index({ status: 1, createdAt: 1 })
verificationSchema.index({ user: 1, module: 1 })

const Verification = mongoose.model("Verification", verificationSchema)

module.exports = Verification
