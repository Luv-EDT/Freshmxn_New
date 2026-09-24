// STEP 4a — score the NINE NEW factors for all 223 professions, one sample pass at a time.
//
//     node Backend/tools/rateProfessions.js --pass 1
//     node Backend/tools/rateProfessions.js --pass 1 --dry-run     prints the prompt, sends nothing
//     node Backend/tools/rateProfessions.js --pass 1 --limit 20    a short run, to eyeball first
//
// WHY ONLY NINE. The 19-factor baseline was rated on 2026-08-17 against anchors that the 27-factor
// migration renamed but did not rewrite — the `asks` and the five bands of those nineteen are
// unchanged, so their scores still mean exactly what they meant. Re-rating them would burn money to
// produce different numbers for the same question and would reset a review state we already hold.
// The nine genuinely new factors have never been rated at all. Those are what this run produces;
// mergeRatings.js carries the rest across and records which is which.
//
// WHY TEMPERATURE 1, when llmScorer.js insists on 0. Different jobs. There, a student's score must
// be reproducible, so any variation is a defect. Here three passes exist precisely to MEASURE
// variation: if the same rubric read three times gives 4, 4, 9, the anchors do not settle that
// profession and a human has to. Temperature 0 would return three identical answers and report a
// spread of zero — a confidence we have not earned. The output is frozen into a data file and
// reviewed, so determinism buys nothing and costs the only uncertainty signal we have.
//
// The known limitation of the original run still applies and is restated in the merged file: three
// passes by ONE model are correlated, so the spread understates true uncertainty.

const fs = require("fs")
const path = require("path")

require("dotenv").config({ path: path.join(__dirname, "..", ".env") })

const DATA = path.join(__dirname, "..", "data")
const OUT_DIR = process.env.RATINGS_OUT_DIR || path.join(__dirname, "..", "..", ".ratings")

const MODEL = process.env.RATING_MODEL || "claude-sonnet-5"
const BATCH_SIZE = 8
// Eight professions × nine named factor keys × two blocks runs close to 8000, and a reply that
// stops one number short is thrown away entirely. The headroom is cheaper than the retry.
const MAX_TOKENS = 12000
// Long enough to ride out a dropped connection rather than abandoning a run 80 professions in.
// The pass file is written after every batch, so the worst a genuine failure costs is one batch.
const MAX_RETRIES = 9
// Retries for a reply that arrived intact but failed validation. Deliberately small — see the
// catch block in callModelWith for why this is not the same number.
const VALIDATION_RETRIES = 2

const anchorsFile = JSON.parse(fs.readFileSync(path.join(DATA, "factor_anchors.json"), "utf8"))
const factorsFile = JSON.parse(fs.readFileSync(path.join(DATA, "psychometric_factors.json"), "utf8"))
const professionsFile = JSON.parse(fs.readFileSync(path.join(DATA, "ALL-professions.json"), "utf8"))
const previousBaseline = JSON.parse(fs.readFileSync(path.join(DATA, "baseline_rating.json"), "utf8"))

// The slugs to rate are DERIVED, never typed: everything in the current vocabulary that the
// previous baseline has no score for. If a future migration adds a tenth factor this picks it up
// with no edit here, and if someone hand-edits the vocabulary the diff shows up as a rating run.
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

const VOCABULARY = factorsFile.groups.flatMap((group) => group.factors.map((factor) => factor.slug))
const ALREADY_RATED = Object.keys(previousBaseline.ratings[0].factors).map((slug) => RENAMES[slug] || slug)

// THIS ANSWERS "WHAT STILL HAS NO SCORE", which is the right question exactly once — on the run
// that fills the gap — and becomes the empty list the moment that run succeeds. It is a default,
// never an assumption: createRater() refuses an empty list, because an empty list silently
// produces a prompt with no rubric and no output format, and a model handed that invents factor
// names which the validator then rejects one by one. That failure reads like a misbehaving model
// and is entirely self-inflicted. A caller re-rating factors that already HAVE scores — the
// resampler — must pass its own list.
const NEW_FACTORS = VOCABULARY.filter((slug) => !ALREADY_RATED.includes(slug))

const anchorFor = (slug) => anchorsFile.factors.find((factor) => factor.slug === slug)

// ── the rubric the model is handed, built from the anchor file rather than restated ──────────────
const createRater = (factorSlugs) => {
    if (!Array.isArray(factorSlugs) || factorSlugs.length === 0) {
        throw new Error("createRater: no factors to rate. Every factor in the vocabulary already has a score, so there is nothing for a fresh pass to do — pass an explicit list if you mean to re-rate.")
    }

    const missingAnchor = factorSlugs.filter((slug) => !anchorFor(slug))
    if (missingAnchor.length > 0) throw new Error(`No anchor set for: ${missingAnchor.join(", ")} — refusing to run`)

    const unknown = factorSlugs.filter((slug) => !VOCABULARY.includes(slug))
    if (unknown.length > 0) throw new Error(`Not in the vocabulary: ${unknown.join(", ")} — refusing to run`)

    const rubricText = factorSlugs.map((slug) => {
        const anchor = anchorFor(slug)
        const bands = anchorsFile.bands.map((band) => `    ${band.padEnd(6)}${anchor.anchors[band]}`).join("\n")
        return `${anchor.slug}  (${anchor.name} — ${anchor.group})\n  ASKS: ${anchor.asks}\n${bands}`
    }).join("\n\n")

    const SYSTEM_PROMPT = buildSystemPrompt(rubricText, factorSlugs)

    return {
        factorSlugs,
        SYSTEM_PROMPT,
        callModel: (batch, validate) => callModelWith(SYSTEM_PROMPT, batch, validate),
        checkBatch: (parsed, batch) => checkBatchWith(factorSlugs, parsed, batch),
    }
}

const buildSystemPrompt = (rubricText, factorSlugs) => `You rate PROFESSIONS against a fixed psychometric rubric for a career-guidance
platform used by Indian students. You are given a batch of professions and you return two numbers
per factor for each one.

WHAT THE TWO NUMBERS MEAN

  factors[slug]   0-10 integer. HOW MUCH THE WORK DEMANDS this factor. Rate the demand of the work,
                  never a person who does it, and never how admirable the profession is.
                  The scale is anchored: pick the band whose line the work actually resembles, then
                  pick a number inside that band. 0 is a real and common answer — it means the work
                  demands none of this, not "a little".

  weights[slug]   0.0-1.0, one decimal. HOW RELEVANT this factor is to deciding whether someone
                  belongs in this profession. This is what lets an irrelevant factor drop OUT of
                  matching instead of diluting it. 0.0 means the factor is beside the point for this
                  work and should carry no vote at all. A factor can be scored 0 and weighted 0.0;
                  it can also be scored 0 and weighted high, when the ABSENCE of the demand is
                  itself characteristic of the work.

RULES

1. Several of these factors are FIT dimensions, not quality dimensions. uncertainty_tolerance,
   divergent_thinking, convergent_thinking, collaboration and propensity_to_go_deep are not better
   when higher. An Accountant scoring 1 on uncertainty_tolerance is not a worse profession than an
   Entrepreneur scoring 10; they are different work suiting different people. Never let prestige,
   pay or difficulty pull a score up.

2. Use the anchors as the scale. Each band names real professions. If the profession you are rating
   sits between two named referents, the number between them is the answer. Do not invent a private
   scale and do not let one factor's score drag another's.

3. Rate the profession as a whole, across the job roles listed. Where roles differ, rate the centre
   of gravity, not the most extreme role.

4. interpersonal_intelligence is about reading a GROUP — its alliances, politics and unspoken
   positions — and moving it. It is deliberately separate from emotional intelligence, which is
   reading and regulating emotion one person at a time. Keep that line.

5. Return ONLY a JSON object. No preamble, no markdown fences, no commentary, no explanation.

THE RUBRIC

${rubricText}

OUTPUT FORMAT — exactly this shape, one key per profession id you were given, and only the ${factorSlugs.length}
factor slugs above:

{
  "<profession-id>": {
    "factors": { ${factorSlugs.map((slug) => `"${slug}": 0`).join(", ")} },
    "weights": { ${factorSlugs.map((slug) => `"${slug}": 0.0`).join(", ")} }
  }
}`

// ── the professions, trimmed to what a rater needs to judge the demand of the work ───────────────
const professionBrief = (profession) => {
    const roles = (profession.job_roles || []).join(", ")
    const spread = profession.role_spread && profession.role_spread.spread
    return [
        `id: ${profession.id}`,
        `profession: ${profession.profession}`,
        `sector: ${profession.professional_sector}`,
        `what it is: ${profession.one_liner}`,
        roles ? `job roles: ${roles}` : null,
        spread ? `role spread: ${spread}` : null,
    ].filter(Boolean).join("\n")
}

const chunk = (list, size) => {
    const out = []
    for (let index = 0; index < list.length; index += size) out.push(list.slice(index, index + size))
    return out
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// `validate` lets a reply that parses but is WRONG — a tenth factor the vocabulary does not have,
// a score outside 0-10 — go round the same retry loop as a dropped connection. Without it a
// malformed reply burned the whole call, and on a six-pass resample that meant losing every pass
// to a fault the next attempt would not have repeated.
const callModelWith = async (systemPrompt, batch, validate) => {
    const userMessage = `Rate these ${batch.length} professions.\n\n${batch.map(professionBrief).join("\n\n---\n\n")}`

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
        try {
            const response = await fetch("https://api.anthropic.com/v1/messages", {
                method: "POST",
                headers: {
                    "x-api-key": process.env.ANTHROPIC_API_KEY,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                body: JSON.stringify({
                    model: MODEL,
                    max_tokens: MAX_TOKENS,
                    temperature: 1,
                    system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
                    messages: [{ role: "user", content: userMessage }],
                }),
            })

            if (!response.ok) throw new Error(`HTTP ${response.status} — ${(await response.text()).slice(0, 300)}`)

            const payload = await response.json()

            // Named rather than positional output costs tokens, and a reply cut off mid-number
            // parses as a syntax error three lines later. Say what actually happened.
            if (payload.stop_reason === "max_tokens") throw new Error(`reply hit max_tokens (${MAX_TOKENS}) — lower BATCH_SIZE`)

            const text = payload.content.map((block) => block.text || "").join("")
            const start = text.indexOf("{")
            const end = text.lastIndexOf("}")

            if (start === -1 || end === -1) throw new Error(`no JSON object in reply: ${text.slice(0, 200)}`)

            const parsed = JSON.parse(text.slice(start, end + 1))

            if (validate) {
                const problems = validate(parsed, batch)
                if (problems.length > 0) throw new Error(`invalid reply — ${problems[0]}`)
            }

            return { parsed, usage: payload.usage }
        } catch (error) {
            // A DETERMINISTIC FAILURE IS NOT WORTH NINE ATTEMPTS. A dropped connection or a 429
            // clears if you wait; a reply the validator rejects means the request itself is wrong,
            // and asking the same question eight more times with a 60-second sleep between tries
            // buys nothing but a bill. This cost real money before the cap existed: an empty
            // rubric made every reply invalid, and each rejection still spent a full request with
            // up to MAX_TOKENS of output behind it.
            const deterministic = error.message.startsWith("invalid reply")
            const limit = deterministic ? VALIDATION_RETRIES : MAX_RETRIES

            if (attempt >= limit) throw error

            const wait = deterministic ? 1000 : Math.min(2000 * 2 ** (attempt - 1), 60000)
            console.log(`      retry ${attempt}/${limit - 1} in ${wait / 1000}s — ${error.message.slice(0, 120)}`)
            await sleep(wait)
        }
    }
}

// A malformed sample must never reach a file the merger trusts. Rejecting the batch and retrying is
// cheaper than discovering a string where a score should be, three steps downstream.
const checkBatchWith = (factorSlugs, parsed, batch) => {
    const problems = []

    batch.forEach((profession) => {
        const entry = parsed[profession.id]
        if (!entry) {
            problems.push(`${profession.id}: missing from the reply`)
            return
        }

        ;[["factors", 0, 10], ["weights", 0, 1]].forEach(([block, low, high]) => {
            const got = entry[block] || {}
            factorSlugs.forEach((slug) => {
                const value = got[slug]
                if (typeof value !== "number" || Number.isNaN(value) || value < low || value > high) {
                    problems.push(`${profession.id}: ${block}.${slug} = ${JSON.stringify(value)}, must be ${low}-${high}`)
                }
            })
            Object.keys(got).forEach((slug) => {
                if (!factorSlugs.includes(slug)) problems.push(`${profession.id}: ${block} has unknown factor ${slug}`)
            })
        })
    })

    return problems
}

const main = async () => {
    const args = process.argv.slice(2)
    const passNumber = Number(args[args.indexOf("--pass") + 1]) || 1
    const dryRun = args.includes("--dry-run")
    const limitIndex = args.indexOf("--limit")
    const limit = limitIndex === -1 ? Infinity : Number(args[limitIndex + 1])

    const professions = professionsFile.professions.slice(0, limit)

    // Throws, with an explanation, when every vocabulary factor already has a score — which is the
    // state this repo is in now. Silently rating nothing is the failure mode that cost money.
    const rater = createRater(NEW_FACTORS)
    const { SYSTEM_PROMPT, callModel, checkBatch } = rater

    console.log(`rating ${NEW_FACTORS.length} new factors: ${NEW_FACTORS.join(", ")}`)
    console.log(`pass ${passNumber} · model ${MODEL} · ${professions.length} professions · batches of ${BATCH_SIZE}`)

    if (dryRun) {
        console.log(`\n${"=".repeat(80)}\nSYSTEM PROMPT\n${"=".repeat(80)}\n${SYSTEM_PROMPT}`)
        console.log(`\n${"=".repeat(80)}\nFIRST USER MESSAGE\n${"=".repeat(80)}`)
        console.log(`Rate these ${BATCH_SIZE} professions.\n\n${professions.slice(0, BATCH_SIZE).map(professionBrief).join("\n\n---\n\n")}`)
        console.log("\n(dry run — nothing sent)")
        return 0
    }

    if (!process.env.ANTHROPIC_API_KEY) {
        console.error("ANTHROPIC_API_KEY is not set — refusing to run")
        return 1
    }

    fs.mkdirSync(OUT_DIR, { recursive: true })
    const outPath = path.join(OUT_DIR, `ratings_pass${passNumber}.json`)

    // Resumable on purpose: a rate limit or a dropped connection halfway through 223 professions
    // should cost the remaining batches, not the whole pass.
    const done = fs.existsSync(outPath) ? JSON.parse(fs.readFileSync(outPath, "utf8")) : { pass: passNumber, model: MODEL, factors: NEW_FACTORS, ratings: {} }
    const todo = professions.filter((profession) => !done.ratings[profession.id])

    if (todo.length < professions.length) console.log(`resuming — ${professions.length - todo.length} already scored`)

    const batches = chunk(todo, BATCH_SIZE)
    let inputTokens = 0
    let outputTokens = 0
    let cachedTokens = 0

    for (let index = 0; index < batches.length; index += 1) {
        const batch = batches[index]
        const { parsed, usage } = await callModel(batch)
        const problems = checkBatch(parsed, batch)

        if (problems.length > 0) {
            console.error(`\nbatch ${index + 1} rejected — nothing written for it:`)
            problems.slice(0, 10).forEach((problem) => console.error(`  ! ${problem}`))
            return 1
        }

        batch.forEach((profession) => {
            done.ratings[profession.id] = {
                factors: parsed[profession.id].factors,
                weights: parsed[profession.id].weights,
            }
        })

        inputTokens += usage.input_tokens
        outputTokens += usage.output_tokens
        cachedTokens += usage.cache_read_input_tokens || 0

        fs.writeFileSync(outPath, JSON.stringify(done, null, 2) + "\n")
        console.log(`  batch ${String(index + 1).padStart(2)}/${batches.length}  ${Object.keys(done.ratings).length}/${professions.length} scored  ${batch[batch.length - 1].profession}`)
    }

    console.log(`\n${outPath}`)
    console.log(`  ${Object.keys(done.ratings).length} professions · ${inputTokens} in (${cachedTokens} cached) · ${outputTokens} out`)
    return 0
}

if (require.main === module) {
    main().then((code) => { process.exitCode = code }).catch((error) => {
        console.error(error)
        process.exitCode = 1
    })
}

// Exported so resampleRatings.js can ask the SAME question in the SAME shape. That matters more
// than saving a few lines: an extra sample is only comparable to the original three if the model
// saw the identical prompt, rated the identical nine factors together, and was validated by the
// identical checker. A second, slightly different prompt would produce samples that cannot
// honestly be averaged with the first ones.
module.exports = { createRater, NEW_FACTORS, VOCABULARY, professionBrief, MODEL, BATCH_SIZE }
