const mongoose = require("mongoose")

// A CACHE of job-title vectors for the weekly scout (Round 11) — every job title in our 223 careers
// (~1,700), embedded once with the model named here and kept, so a run re-embeds only titles that
// are new since the last one. Rebuildable at any time: delete the collection and the next run fills
// it again.

const roleEmbeddingSchema = new mongoose.Schema(
    {
        key: {
            type: String,
            required: true,
            unique: true, // `${model}::${normalised title}`
        },
        professionId: {
            type: String,
            required: true,
        },
        role: {
            type: String,
            required: true,
        },
        vector: {
            type: [Number],
            required: true,
        },
    },
    {
        timestamps: true,
    }
)

const RoleEmbedding = mongoose.model("RoleEmbedding", roleEmbeddingSchema)

module.exports = RoleEmbedding
