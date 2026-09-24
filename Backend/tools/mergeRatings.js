// STEP 4b — merge the sample passes into Backend/data/baseline_rating.json, and police them.
//
//     node Backend/tools/mergeRatings.js
//     node Backend/tools/mergeRatings.js --dry-run     validates and reports, writes nothing
//
// Pure: reads files, writes one file, no network and no clock beyond the generation date. Run it
// twice on the same inputs and you get the same output, which is what makes the record auditable.
//
// MIXED PROVENANCE, ON PURPOSE. Nineteen factors were rated on 2026-08-17 against anchors the
// 27-factor migration renamed but did not rewrite; nine were rated today against anchors written
// for them. Both halves carry their own samples, spread and origin, so nobody has to guess later
// which numbers came from which run. Re-rating the nineteen would have cost money to answer a
// question already answered and would have thrown away a review state we hold.
//
// A DISAGREEMENT IS INFORMATION. Any factor whose samples spread more than MAX_SPREAD is flagged
// into admin_review rather than quietly averaged. Averaging a 4/4/9 away destroys the only signal
// that says "the anchors do not settle this one".

const fs = require("fs")
const path = require("path")

const DATA = path.join(__dirname, "..", "data")
const SAMPLES_DIR = process.env.RATINGS_OUT_DIR || path.join(__dirname, "..", "..", ".ratings")
const OUT = path.join(DATA, "baseline_rating.json")

const SCHEMA_VERSION = "2.0"
const MAX_SPREAD = 2
const BIG_JUMP = 2
const GENERATED_ON = "2026-09-21"

// Same nine renames the Phase-A migration applied. Slug and display name only — the `asks` and the
// five bands of those nineteen anchors are unchanged, which is why their scores carry across.
const RENAMES = {
    verbal: "verbal_intelligence",
    spatial: "spatial_intelligence",
    musical: "musical_intelligence",
    bodily: "bodily_intelligence",
    naturalistic: "naturalistic_intelligence",
    existential: "existential_intelligence",
    logical: "logical_intelligence",
    attention_span: "focus",
    dogmatism: "firmness",
}

// The previous file may be a 1.0 record (old slugs) or a 2.0 one being re-merged (new slugs).
// Accepting either keeps this script idempotent — running it twice must not corrupt the carry.
const sourceSlugFor = (slug, previous) => {
    if (slug in previous.factors) return slug
    const oldSlug = Object.keys(RENAMES).find((key) => RENAMES[key] === slug)
    return oldSlug && oldSlug in previous.factors ? oldSlug : null
}

const round2 = (value) => Math.round(value * 100) / 100
const mean = (values) => values.reduce((total, value) => total + value, 0) / values.length

const professionsFile = JSON.parse(fs.readFileSync(path.join(DATA, "ALL-professions.json"), "utf8"))
const factorsFile = JSON.parse(fs.readFileSync(path.join(DATA, "psychometric_factors.json"), "utf8"))
const previousFile = JSON.parse(fs.readFileSync(OUT, "utf8"))

const VOCABULARY = factorsFile.groups.flatMap((group) => group.factors.map((factor) => factor.slug))

const passPaths = fs.existsSync(SAMPLES_DIR)
    ? fs.readdirSync(SAMPLES_DIR).filter((name) => /^ratings_pass\d+\.json$/.test(name)).sort().map((name) => path.join(SAMPLES_DIR, name))
    : []

if (passPaths.length === 0) {
    console.error(`No ratings_pass*.json in ${SAMPLES_DIR} — run rateProfessions.js first`)
    process.exit(1)
}

const passes = passPaths.map((passPath) => {
    const pass = JSON.parse(fs.readFileSync(passPath, "utf8"))
    console.log(`  ${path.basename(passPath)}: ${Object.keys(pass.ratings).length} professions · ${pass.factors.length} factors · ${pass.model}`)
    return pass
})

const NEW_FACTORS = passes[0].factors
const CARRIED_FACTORS = VOCABULARY.filter((slug) => !NEW_FACTORS.includes(slug))

const errors = []

// Every pass must rate the same factor list, or averaging compares different questions.
passes.forEach((pass, index) => {
    if (JSON.stringify(pass.factors) !== JSON.stringify(NEW_FACTORS)) {
        errors.push(`pass ${index + 1} rates a different factor list than pass 1`)
    }
})

const unknownNew = NEW_FACTORS.filter((slug) => !VOCABULARY.includes(slug))
if (unknownNew.length > 0) errors.push(`sample passes rate slugs outside the vocabulary: ${unknownNew.join(", ")}`)

const previousById = {}
previousFile.ratings.forEach((rating) => { previousById[rating.id] = rating })

const DRIVING_REASONS = previousFile.driving_reasons_vocabulary

const entries = professionsFile.professions.map((profession) => {
    const previous = previousById[profession.id]

    if (!previous) {
        errors.push(`${profession.id}: no previous rating to carry the ${CARRIED_FACTORS.length} unchanged factors from`)
        return null
    }

    const factors = {}
    const weights = {}
    const variance = {}
    const wide = []

    // ── the carried nineteen: same numbers, new slugs, original samples preserved ────────────
    CARRIED_FACTORS.forEach((slug) => {
        const oldSlug = sourceSlugFor(slug, previous)

        if (!oldSlug) {
            errors.push(`${profession.id}: previous rating has nothing to carry into ${slug}`)
            return
        }

        factors[slug] = previous.factors[oldSlug]
        weights[slug] = previous.weights[oldSlug]
        variance[slug] = { ...previous.sample_variance[oldSlug], origin: "carried-1.0" }

        if (variance[slug].spread > MAX_SPREAD) wide.push(`${slug} (samples ${variance[slug].samples}, spread ${variance[slug].spread})`)
    })

    // ── the new nine: averaged across the passes, spread kept ────────────────────────────────
    NEW_FACTORS.forEach((slug) => {
        const scores = []
        const weightValues = []

        passes.forEach((pass, index) => {
            const rating = pass.ratings[profession.id]
            if (!rating) {
                errors.push(`${profession.id}: missing from pass ${index + 1} — refusing to average a partial set`)
                return
            }
            scores.push(rating.factors[slug])
            weightValues.push(rating.weights[slug])
        })

        if (scores.length !== passes.length) return

        const spread = Math.max(...scores) - Math.min(...scores)

        factors[slug] = round2(mean(scores))
        weights[slug] = round2(mean(weightValues))
        variance[slug] = { samples: scores, spread: round2(spread), origin: `rated-${SCHEMA_VERSION}` }

        if (spread > MAX_SPREAD) wide.push(`${slug} (samples ${scores}, spread ${spread})`)
    })

    const reasons = []

    if (wide.length > 0) {
        reasons.push(`THE SAMPLES DISAGREED by more than ${MAX_SPREAD} points on: ${wide.join("; ")}. Averaged for now, but a disagreement this wide means the anchors do not settle this profession and a human should decide.`)
    }

    // A review already open on the 1.0 record stays open — the migration answered a different
    // question and is no reason to consider an old concern closed.
    const carriedReason = previous.admin_review && previous.admin_review.required ? previous.admin_review.reason : null
    if (carriedReason) reasons.push(`CARRIED FROM 1.0: ${carriedReason}`)

    return {
        id: profession.id,
        profession: profession.profession,
        professional_sector_id: profession.professional_sector_id,
        professional_sector: profession.professional_sector,
        factors,
        weights,
        drivingReasons: previous.drivingReasons,
        samples: passes.length,
        sample_variance: variance,
        version: SCHEMA_VERSION,
        generated_on: GENERATED_ON,
        review_status: "unreviewed",
        admin_review: {
            required: reasons.length > 0,
            priority: wide.length > 0 ? "high" : reasons.length > 0 ? "medium" : "none",
            reason: reasons.join(" ") || null,
        },
    }
}).filter(Boolean)

// ── validation: nothing malformed reaches the file the matching engine reads ─────────────────────
entries.forEach((entry) => {
    ;[["factors", 0, 10], ["weights", 0, 1]].forEach(([block, low, high]) => {
        VOCABULARY.forEach((slug) => {
            const value = entry[block][slug]
            if (typeof value !== "number" || Number.isNaN(value) || value < low || value > high) {
                errors.push(`${entry.id}: ${block}.${slug} = ${JSON.stringify(value)}, must be ${low}-${high}`)
            }
        })
        Object.keys(entry[block]).forEach((slug) => {
            if (!VOCABULARY.includes(slug)) errors.push(`${entry.id}: ${block} has unknown factor ${slug}`)
        })
    })

    const reasonList = entry.drivingReasons || []
    if (reasonList.length < 1 || reasonList.length > 3) errors.push(`${entry.id}: drivingReasons has ${reasonList.length}, must be 1-3`)
    reasonList.forEach((reason) => {
        if (!DRIVING_REASONS[reason]) errors.push(`${entry.id}: drivingReasons '${reason}' is not in the closed set`)
    })
})

const orphaned = Object.keys(previousById).filter((id) => !professionsFile.professions.some((profession) => profession.id === id))
if (orphaned.length > 0) errors.push(`previous baseline rates ${orphaned.length} id(s) the taxonomy no longer has: ${orphaned.slice(0, 5).join(", ")}`)

if (errors.length > 0) {
    console.error(`\n! ${errors.length} error(s) — nothing written:`)
    errors.slice(0, 25).forEach((error) => console.error(`  ! ${error}`))
    process.exit(1)
}

// A refresh that moves a carried factor is impossible by construction here, but the check stays:
// the next real refresh re-rates everything and this is the thing that stops a drifted scale
// going live unnoticed.
let jumped = 0
entries.forEach((entry) => {
    const previous = previousById[entry.id]
    const moved = CARRIED_FACTORS.filter((slug) => {
        const oldSlug = sourceSlugFor(slug, previous)
        return oldSlug && Math.abs(previous.factors[oldSlug] - entry.factors[slug]) > BIG_JUMP
    })

    if (moved.length > 0) {
        jumped += 1
        entry.admin_review = {
            required: true,
            priority: "high",
            reason: `${entry.admin_review.reason || ""} REFRESH MOVED THIS RECORD by more than ${BIG_JUMP} points on ${moved.join(", ")}. A jump that large is either a real correction or a drifted scale; it does not go live until a human says which.`.trim(),
        }
    }
})

const output = {
    schema_version: SCHEMA_VERSION,
    generated_on: GENERATED_ON,
    generated_by: "Backend/tools/mergeRatings.js — GENERATED, joins to the taxonomy on profession.id. Never hand-edit; re-merge the samples.",
    joins_to: "Backend/data/ALL-professions.json by `id`",
    rubric: "Backend/data/factor_anchors.json",
    vocabulary: "Backend/data/psychometric_factors.json",
    samples_per_profession: passes.length,
    max_spread_before_review: MAX_SPREAD,
    factor_count: VOCABULARY.length,
    matching_note: `All ${VOCABULARY.length} vocabulary factors are rated here. The matching engine uses ${VOCABULARY.length - 1} of them: \`confidence\` is a universal, scored for the report's readiness layer and available to role_spread, but excluded from the matching vector because a factor every profession needs cannot tell you which profession to choose. Its score and weight are stored anyway so that decision stays reversible without a re-rating run.`,
    provenance: {
        [`carried-1.0`]: {
            factors: CARRIED_FACTORS,
            rated_on: previousFile.generated_on,
            note: "Rated in the 19-factor run against anchors the 27-factor migration renamed but did not rewrite. The `asks` and the five bands of these are unchanged, so the scores still answer the same question. Samples and spread are the originals.",
        },
        [`rated-${SCHEMA_VERSION}`]: {
            factors: NEW_FACTORS,
            rated_on: GENERATED_ON,
            model: passes[0].model,
            note: "Newly rated against anchors written for the 27-factor vector and reviewed by the owner before this run. Three passes at temperature 1, so the spread measures how far the anchors leave the question open.",
        },
    },
    driving_reasons_vocabulary: DRIVING_REASONS,
    driving_reasons_note: "Carried unchanged from the 1.0 run. What motivates people toward a profession is not a function of the factor vocabulary, so the migration gave no reason to re-derive them.",
    known_limitation: "The samples come from ONE model scoring the same rubric three times, not from three independent raters. Correlated error is likely and sample_variance therefore UNDERSTATES true uncertainty — a factor all three passes agree on may still be wrong together. Treat low variance as 'the rubric was unambiguous', never as 'this is correct'. Every record starts review_status: unreviewed for that reason.",
    counts: {
        rated: entries.length,
        of_total: professionsFile.professions.length,
        admin_review_required: entries.filter((entry) => entry.admin_review.required).length,
        moved_on_refresh: jumped,
    },
    ratings: entries,
}

if (process.argv.includes("--dry-run")) {
    console.log(`\nvalidated ${entries.length} professions × ${VOCABULARY.length} factors — clean (dry run, nothing written)`)
    process.exit(0)
}

fs.writeFileSync(OUT, JSON.stringify(output, null, 2) + "\n")

console.log(`\nBackend/data/baseline_rating.json`)
console.log(`  rated ${output.counts.rated} of ${output.counts.of_total}  ·  ${VOCABULARY.length} factors  ·  ${output.counts.admin_review_required} need review  ·  ${output.counts.moved_on_refresh} moved on refresh`)
console.log(`  carried ${CARRIED_FACTORS.length} from ${previousFile.generated_on}  ·  newly rated ${NEW_FACTORS.length}`)
