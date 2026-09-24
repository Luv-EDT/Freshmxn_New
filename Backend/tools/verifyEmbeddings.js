// Are the stored profession vectors still current?
//
//     node Backend/tools/verifyEmbeddings.js
//
// The 223 × 1024 voyage-4-large vectors were generated during the professions work and are REUSED
// rather than regenerated: they embed name + one_liner + job_roles, and the 27-factor migration
// rewrote role_spread, which is not part of that text. This script is how that claim gets checked
// instead of assumed.
//
// IDEMPOTENT BY CONTENT HASH, and the hash covers the MODEL and the DIMENSION as well as the text.
// A different model is a different vector space and a different truncation is a different space
// too, so comparing across them is nonsense and the hash has to notice. The formula is copied from
// the generator that wrote the file — if it drifts from that, this script reports false alarms,
// which is the safe direction.
//
// Anything this reports as drifted must be re-embedded before it is searched against. A stale
// index is worse than an obviously missing one, because it fails silently.

const crypto = require("crypto")
const fs = require("fs")
const path = require("path")

const DATA = path.join(__dirname, "..", "data")

const professions = JSON.parse(fs.readFileSync(path.join(DATA, "ALL-professions.json"), "utf8")).professions
const stored = JSON.parse(fs.readFileSync(path.join(DATA, "profession_embeddings.json"), "utf8"))

const MODEL = stored.model
const DIMENSIONS = stored.dimensions

const sourceTextOf = (profession) => `${profession.profession}. ${profession.one_liner} Job roles include: ${(profession.job_roles || []).join(", ")}.`

const contentHash = (text) => crypto.createHash("sha256").update(`${MODEL}\x00${DIMENSIONS}\x00${text}`, "utf8").digest("hex")

const byId = {}
stored.embeddings.forEach((entry) => { byId[entry.id] = entry })

const missing = []
const drifted = []
const malformed = []

professions.forEach((profession) => {
    const entry = byId[profession.id]

    if (!entry) {
        missing.push(profession.id)
        return
    }

    if (!Array.isArray(entry.embedding) || entry.embedding.length !== DIMENSIONS) {
        malformed.push(`${profession.id}: ${Array.isArray(entry.embedding) ? entry.embedding.length : "no"} dimensions, expected ${DIMENSIONS}`)
    }

    if (entry.model !== MODEL) malformed.push(`${profession.id}: model ${entry.model}, expected ${MODEL}`)

    // The stored side must be "document". A query embedded as a document, or a document embedded
    // as a query, degrades similarity silently rather than erroring — the worst failure available.
    if (entry.input_type !== "document") malformed.push(`${profession.id}: input_type ${entry.input_type}, expected document`)

    if (contentHash(sourceTextOf(profession)) !== entry.content_hash) drifted.push(profession.id)
})

const orphaned = stored.embeddings.filter((entry) => !professions.some((profession) => profession.id === entry.id)).map((entry) => entry.id)

console.log(`model ${MODEL} · ${DIMENSIONS} dimensions · ${stored.embeddings.length} stored vectors for ${professions.length} professions`)
console.log(`  missing   ${missing.length}`)
console.log(`  drifted   ${drifted.length}`)
console.log(`  malformed ${malformed.length}`)
console.log(`  orphaned  ${orphaned.length}`)

;[["missing", missing], ["drifted", drifted], ["orphaned", orphaned]].forEach(([label, list]) => {
    list.slice(0, 10).forEach((id) => console.log(`  ! ${label}: ${id}`))
    if (list.length > 10) console.log(`  ! … and ${list.length - 10} more ${label}`)
})
malformed.slice(0, 10).forEach((problem) => console.log(`  ! ${problem}`))

const clean = missing.length === 0 && drifted.length === 0 && malformed.length === 0 && orphaned.length === 0

console.log(clean
    ? "\nclean — every profession has a current vector, nothing needs re-embedding"
    : "\nNOT CLEAN — re-embed the drifted and missing professions before searching against this index")

process.exitCode = clean ? 0 : 1
