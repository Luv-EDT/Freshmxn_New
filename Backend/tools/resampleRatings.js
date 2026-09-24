// Resolve a flagged Baseline_Rating by GATHERING MORE EVIDENCE, not by overruling it.
//
//     node Backend/tools/resampleRatings.js                  every profession with an open review
//     node Backend/tools/resampleRatings.js --passes 6       how many extra samples (default 6)
//     node Backend/tools/resampleRatings.js eng-railway-operations
//     node Backend/tools/resampleRatings.js --dry-run
//
// WHY THIS AND NOT THE OTHER TWO OPTIONS.
//
// When three passes disagree by more than two points there are three things one could do. Rewrite
// the anchor — wrong here, because the rest of these records agree tightly and 221 other
// professions rate cleanly against the same bands; a rubric that works everywhere else is not the
// problem. Hand-pick a number — worse, because it puts an unrecorded human judgement into a
// generated file that says at the top never to hand-edit it, and nobody can later tell which
// numbers were reasoned and which were typed. So: ask again, more times.
//
// Three samples is thin. A single unlucky draw moves the spread from 1 to 3 and trips the flag,
// and with three points you cannot tell an outlier from a genuine split. Nine points can:
// [3,6,5,4,4,4,5,4,4] is one stray draw around a clear centre, while [3,6,6,3,6,3,6,3,6] is a
// profession that really does straddle two bands, and those two deserve opposite responses.
//
// ALL NINE FACTORS ARE RE-RATED, not just the flagged one. The original pass rated them together,
// against each other, in one reading of the profession. Asking about one factor in isolation is a
// different question, and its answer would not be comparable with the three samples it is being
// averaged into.
//
// THE FLAG CAN SURVIVE THIS. If the spread stays wide across nine samples, that is a finding, not
// a failure — the work genuinely sits between two bands — and the record says so in its own words
// instead of quietly averaging the disagreement away.

const fs = require("fs")
const path = require("path")

const { createRater, MODEL, BATCH_SIZE } = require("./rateProfessions")

const DATA = path.join(__dirname, "..", "data")
const OUT = path.join(DATA, "baseline_rating.json")

const MAX_SPREAD = 2
const DEFAULT_EXTRA_PASSES = 6
const TODAY = "2026-09-22"

const round2 = (value) => Math.round(value * 100) / 100
const mean = (values) => values.reduce((total, value) => total + value, 0) / values.length

const median = (values) => {
    const sorted = [...values].sort((left, right) => left - right)
    const middle = Math.floor(sorted.length / 2)
    return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle]
}

const professions = JSON.parse(fs.readFileSync(path.join(DATA, "ALL-professions.json"), "utf8")).professions
const baseline = JSON.parse(fs.readFileSync(OUT, "utf8"))

// WHICH FACTORS TO RE-RATE, read from the file's own record of what the 2.0 run produced.
//
// It must NOT come from rateProfessions.NEW_FACTORS. That list answers "what still has no score",
// which is empty the moment the run it was written for succeeds — so the resampler inherited an
// empty rubric, the model was handed a prompt listing no factors, and every reply was rejected as
// containing unknown ones. The provenance block exists precisely so a later tool can ask "what did
// that run rate?" and get a real answer instead of re-deriving a question that has moved on.
const RESAMPLE_FACTORS = (() => {
    const rated = Object.entries(baseline.provenance || {}).find(([key]) => key.startsWith("rated-"))
    if (!rated || !Array.isArray(rated[1].factors) || rated[1].factors.length === 0) {
        console.error("baseline_rating.json has no provenance block naming the rated factors — refusing to run")
        process.exit(1)
    }
    return rated[1].factors
})()

const { callModel, checkBatch } = createRater(RESAMPLE_FACTORS)

const main = async () => {
    const args = process.argv.slice(2)
    const dryRun = args.includes("--dry-run")
    const passesIndex = args.indexOf("--passes")
    const extraPasses = passesIndex === -1 ? DEFAULT_EXTRA_PASSES : Number(args[passesIndex + 1])
    const named = args.filter((arg) => !arg.startsWith("--") && arg !== String(extraPasses))

    const targets = named.length > 0
        ? baseline.ratings.filter((rating) => named.includes(rating.id))
        : baseline.ratings.filter((rating) => rating.admin_review.required)

    if (targets.length === 0) {
        console.log("nothing to resample — no profession has an open review")
        return 0
    }

    console.log(`resampling ${targets.length} profession(s) · ${extraPasses} extra passes · model ${MODEL}`)
    targets.forEach((rating) => {
        const wide = Object.entries(rating.sample_variance).filter(([, variance]) => variance.spread > MAX_SPREAD)
        console.log(`  ${rating.profession} — wide on ${wide.map(([slug]) => slug).join(", ") || "(none; named explicitly)"}`)
    })

    if (dryRun) {
        console.log("\n(dry run — nothing sent, nothing written)")
        return 0
    }

    // THE ORIGINAL BATCH IS RECONSTRUCTED — the same eight professions, in the same order, as the
    // request that produced the three samples already in the file.
    //
    // The reason is comparability, the same one that governs re-rating all nine factors together:
    // an extra sample only belongs in the same average if the model faced the same task, and the
    // originals came from batches of eight in taxonomy order.
    //
    // A CORRECTION KEPT ON THE RECORD, because the wrong version of it is the more plausible
    // story. Earlier attempts here failed with the model apparently inventing factor names —
    // `analytical_reasoning`, `physical_strength` — and that looked like a batching effect: one
    // profession alone, or one in the first slot, elaborating where a full batch would not. It was
    // not. The rubric handed to the model was EMPTY, because the factor list came from
    // rateProfessions.NEW_FACTORS, which had gone to zero once the 2.0 run succeeded. Given no
    // factors to rate, the model reasonably made some up, and the validator then rejected every
    // key. Batching had nothing to do with it. Reconstructing the original batch is still correct,
    // but on the evidence argument alone — not because it fixes a bug it never fixed.
    const batchIndexOf = (professionId) => Math.floor(professions.findIndex((entry) => entry.id === professionId) / BATCH_SIZE)

    const batches = new Map()
    targets.forEach((rating) => {
        const index = batchIndexOf(rating.id)
        if (index < 0) return
        if (!batches.has(index)) batches.set(index, professions.slice(index * BATCH_SIZE, (index + 1) * BATCH_SIZE))
    })

    const extraById = {}
    targets.forEach((rating) => { extraById[rating.id] = [] })

    for (const [index, batch] of batches) {
        const inThisBatch = targets.filter((rating) => batchIndexOf(rating.id) === index)
        console.log(`\nbatch ${index} — ${batch.length} professions, targeting ${inThisBatch.map((rating) => rating.profession).join(", ")}`)

        for (let pass = 1; pass <= extraPasses; pass += 1) {
            try {
                const { parsed } = await callModel(batch, checkBatch)
                inThisBatch.forEach((rating) => extraById[rating.id].push(parsed[rating.id]))
                console.log(`  pass ${pass}/${extraPasses} accepted`)
            } catch (error) {
                console.error(`  pass ${pass} failed after retries — ${error.message.slice(0, 140)}`)
            }
        }
    }

    for (const rating of targets) {
        const extra = extraById[rating.id]

        console.log(`\n${rating.profession}`)

        if (extra.length === 0) {
            console.error(`  every extra pass was rejected — leaving ${rating.id} untouched`)
            continue
        }

        const stillWide = []
        const resolved = []

        RESAMPLE_FACTORS.forEach((slug) => {
            const variance = rating.sample_variance[slug]
            const original = variance.samples
            const combined = [...original, ...extra.map((sample) => sample.factors[slug])]

            const spread = Math.max(...combined) - Math.min(...combined)
            const before = rating.factors[slug]

            // THE MEDIAN, NOT THE MEAN, once there are enough points for it to mean something.
            // The whole reason this record was flagged is a suspected outlier, and the mean is the
            // one statistic an outlier moves most. With nine samples the median is the centre of
            // agreement; with three it would just be the middle draw, which is why the original
            // run averaged instead.
            rating.factors[slug] = combined.length >= 5 ? round2(median(combined)) : round2(mean(combined))
            rating.weights[slug] = round2(mean([...extra.map((sample) => sample.weights[slug]), rating.weights[slug]]))

            rating.sample_variance[slug] = {
                samples: combined,
                spread: round2(spread),
                origin: `rated-2.0+resampled-${TODAY}`,
                estimator: combined.length >= 5 ? "median" : "mean",
            }

            if (spread > MAX_SPREAD) stillWide.push(`${slug} (samples ${combined}, spread ${spread})`)
            if (variance.spread > MAX_SPREAD) resolved.push(`${slug}: ${before} → ${rating.factors[slug]} over ${combined.length} samples`)
        })

        rating.samples = rating.sample_variance[RESAMPLE_FACTORS[0]].samples.length
        rating.generated_on = TODAY

        if (stillWide.length > 0) {
            // A real straddle, not thin evidence. The flag stays, and now it says which.
            rating.admin_review = {
                required: true,
                priority: "medium",
                reason: `RESAMPLED to ${rating.samples} samples on ${TODAY} and the disagreement PERSISTED on: ${stillWide.join("; ")}. More evidence did not settle it, so this is not an unlucky draw — the work genuinely sits between two bands and a human should decide which. The stored value is the median of all samples.`,
            }
            console.log(`  still wide: ${stillWide.join("; ")}`)
        } else {
            rating.admin_review = {
                required: false,
                priority: "none",
                reason: `Flagged on the 3-sample run, then RESAMPLED to ${rating.samples} samples on ${TODAY}; the disagreement did not survive the extra evidence. ${resolved.join("; ")}. Stored values are medians. review_status stays unreviewed — this resolved a sampling question, not a correctness one.`,
            }
            console.log(`  resolved: ${resolved.join("; ")}`)
        }
    }

    baseline.counts.admin_review_required = baseline.ratings.filter((rating) => rating.admin_review.required).length
    baseline.resampled = {
        on: TODAY,
        note: `Professions whose three samples disagreed by more than ${MAX_SPREAD} points were re-rated ${DEFAULT_EXTRA_PASSES} more times against the same anchors and the same prompt, rather than having a number chosen for them. Their records carry every sample and store the MEDIAN; all other records carry three samples and store the mean. Backend/tools/resampleRatings.js.`,
    }

    fs.writeFileSync(OUT, JSON.stringify(baseline, null, 2) + "\n")

    console.log(`\nBackend/data/baseline_rating.json`)
    console.log(`  ${baseline.counts.admin_review_required} of ${baseline.ratings.length} still need a human`)
    return 0
}

main().then((code) => { process.exitCode = code }).catch((error) => {
    console.error(error)
    process.exitCode = 1
})
