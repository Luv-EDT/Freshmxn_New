// Grades the written answers before scoring runs — the pipeline step that was missing.
//
// THE BUG THIS PREVENTS, and it is a bad one. The perspective scorer expects each open item as an
// ALREADY-GRADED object — `{ reasons: 3, evidence: 3, revisability: 3 }`. Hand it the student's raw
// text instead and it does not fail: it produces `belief_bank: 10`, a perfect score, for anybody who
// typed anything at all. Silently, for every student, with no flag anywhere.
//
// So raw text and graded scores live under DIFFERENT KEYS and never touch:
//
//     psychometric.perspective.openText   what the student typed        ← written by the UI
//     psychometric.perspective.open       the graded sub-scores         ← written by this file
//
// scoreProfile only ever reads `open`. A submission that has never been graded therefore scores as
// missing — which is true — rather than as perfect, which is a lie a student would act on.
//
// GRADED ONCE, STORED FOREVER. The result is written back onto the submission, so re-scoring a
// profile after a formula change never re-bills a single model call. That is the same property that
// lets the whole scoring engine stay pure and re-runnable.

const { recordUsage } = require("../utils/aiUsage")
const crypto = require("crypto")
const fs = require("fs")
const path = require("path")

const scoreOpenItem = require("../scoring/llmScorer")

// The rubrics are parsed out of these two docs at runtime, so the docs are part of the pipeline:
// moving or renaming them breaks grading (the fixture "every rubric is findable" catches it).
const DOCS = path.join(__dirname, "..", "..", "docs", "5_finalized", "algorithms")

// Which items exist, and where their rubric lives. The four perspective items are in
// llm_scoring_prompts.md; the story's free-recall rubric is in the story bank.
// P13 (the written day plan) retired in Round 13 — it repeated the planning multiple choice
const OPEN_ITEMS = ["P7", "P22", "P33"]

let rubricCache = null

// Pull the "**User prompt:**" fenced block out of an item's section, then REMOVE the
// <response>{{STUDENT_TEXT}}</response> placeholder — llmScorer.buildUserPrompt appends its own,
// and leaving both would hand the model two response blocks to score.
const loadRubrics = () => {
    if (rubricCache) return rubricCache

    const doc = fs.readFileSync(path.join(DOCS, "llm_scoring_prompts.md"), "utf8")
    rubricCache = {}

    OPEN_ITEMS.forEach((itemId) => {
        const section = doc.split(/^## /m).find((part) => part.startsWith(`${itemId} —`))
        if (!section) throw new Error(`no rubric section for ${itemId} in llm_scoring_prompts.md`)

        const block = section.split("**User prompt:**")[1].match(/```\n([\s\S]*?)\n```/)
        if (!block) throw new Error(`no user-prompt block for ${itemId}`)

        rubricCache[itemId] = block[1]
            .replace(/<response>\s*\{\{STUDENT_TEXT\}\}\s*<\/response>/, "")
            .replace(/\n{3,}/g, "\n\n")
            .trim()
    })

    return rubricCache
}

// NO TEMPERATURE. claude-sonnet-5 rejects the parameter outright with a 400, and llmScorer asks its
// injected client for 0. Determinism does not depend on it and never did: the graded result is
// stored on the submission, so a student's score is computed once and cannot drift afterwards.
const createGradingClient = ({ apiKey = process.env.ANTHROPIC_API_KEY, model = process.env.GRADING_MODEL || "claude-sonnet-5" } = {}) => (
    async ({ system, user }) => {
        const response = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
            body: JSON.stringify({
                model,
                max_tokens: 1500,
                // CACHED (Round 11): every student's answer is graded against the same rubric text,
                // so the rubric is read from the cache at a fraction of the price after the first.
                system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
                messages: [{ role: "user", content: user }],
            }),
            signal: AbortSignal.timeout(90000),
        })

        if (!response.ok) throw new Error(`Anthropic HTTP ${response.status} — ${(await response.text()).slice(0, 200)}`)

        const payload = await response.json()
        recordUsage("grading", model, payload)

        // A truncated reply is not a grade; and it will truncate again, so it is said plainly
        // rather than left to look like a malformed (and therefore retryable) one.
        if (payload.stop_reason === "max_tokens") throw new Error("reply hit max_tokens")
        if (!Array.isArray(payload.content)) throw new Error("reply had no content")

        return payload.content.map((block) => block.text || "").join("")
    }
)

// ── transient failures ──────────────────────────────────────────────────────────────────────────
//
// A FAILED CALL IS NOT A GRADE. llmScorer turns an HTTP/network error into `call_failed: …` and an
// unparseable reply into `malformed_json`, both with a null score. Those used to be stored exactly
// like a genuine "this answer cannot be scored" — and since only `undefined` items are ever graded,
// a single 529 blanked that written answer for good (backend review, 2026-09-24).
//
// Now they are TRANSIENT: left ungraded so the job retries them, unless this is the job's last
// attempt, when the null is stored (with its reason) so the student still gets a profile with one
// factor dropped rather than no report at all. A stored transient null is graded again on the
// next run; a genuine unscoreable answer (blank, off-topic) never is, so it is never re-billed.
//
// Within call_failed, two failures will repeat however often they are retried, so they are not
// transient: a reply cut off at max_tokens, and a 4xx that is not a rate limit or timeout (the
// request itself is wrong). 429 / 408 / 409 and 5xx are the service being busy.
const PERMANENT_CALL_FAILURE = /max_tokens|HTTP 4(?!08|09|29)\d\d/

const isTransient = (reason) => typeof reason === "string"
    && ((reason.startsWith("call_failed") && !PERMANENT_CALL_FAILURE.test(reason)) || reason === "malformed_json")

// A short fingerprint of the text a grade was given for. Before this, an edited answer kept its old
// grade forever — only ungraded items were ever sent (backend review #10). Now a grade whose text has
// changed is graded again, and an answer that was cleared loses its grade. Grades from before this
// field existed have no fingerprint and are kept as they are — never re-billed on a guess.
const textHash = (text) => crypto.createHash("sha256").update(String(text).trim(), "utf8").digest("hex").slice(0, 16)

// ── the story's free recall ─────────────────────────────────────────────────────────────────────
//
// Same separation as the perspective items and for the same reason:
//
//     storyRecall.freeText   the three answers the student narrated   ← written by the UI
//     storyRecall.free       the graded { score, subScores }          ← written here
//
// The rubric lives in 05_Story_Bank.md rather than llm_scoring_prompts.md, and it needs the
// STORY'S FACTS to mark against — problem, cause and resolution differ per story, so a generic
// prompt would be scoring recall against nothing.
//
// THE PLACEHOLDERS ARE FILLED HERE. The story bank writes them with SINGLE braces ({STUDENT_TEXT},
// {DELAY_HOURS}, {slot_10}…); this used to strip only a double-braced {{STUDENT_TEXT}}, so the model
// was handed a literal "{slot_10}" as the fact list plus a stray empty response block, and the real
// facts only as an afterthought below it. Called with no story it returns the template with only
// the response block removed, which is what the "every rubric is findable" fixture checks.
const loadStoryRubric = (story) => {
    const doc = fs.readFileSync(path.join(DOCS, "05_Story_Bank.md"), "utf8")
    const section = doc.split("# LLM SCORING PROMPT — FREE RECALL")[1]
    if (!section) throw new Error("no free-recall scoring prompt in 05_Story_Bank.md")

    const block = section.match(/```\n([\s\S]*?)\n```/)
    if (!block) throw new Error("no fenced rubric under the free-recall prompt")

    let rubric = block[1].replace(/<response>\s*\{\{?STUDENT_TEXT\}?\}\s*<\/response>/, "").trim()
    if (!story) return rubric

    const facts = story.facts || {}
    const hours = typeof story.delayHours === "number" ? String(Math.round(story.delayHours)) : "several"
    rubric = rubric
        .replace(/\{DELAY_HOURS\}/g, hours)
        .replace(/\{slot_10\}/g, facts.problem || "(not recorded)")
        .replace(/\{slot_11\}/g, facts.cause || "(not recorded)")
        .replace(/\{slot_12\}/g, facts.resolution || "(not recorded)")

    return rubric
}

const gradeStoryRecall = async ({ psychometric, callLlm, force = false, acceptTransient = false }) => {
    const block = (psychometric && psychometric.storyRecall) || {}
    const freeText = block.freeText || {}

    const retryable = block.free === null && block.freeMeta && isTransient(block.freeMeta.unscoreable_reason)
    if (!force && block.free && !retryable) return null
    if (!force && block.free === null && !retryable) return null

    const narrated = ["LR1", "LR2", "LR3"].map((id) => freeText[id]).filter((text) => typeof text === "string" && text.trim() !== "")
    if (narrated.length === 0) return null

    // The facts are handed to the model as the mark scheme, filled into the rubric's own fact list.
    // Without them "what was the problem" has no correct answer to compare against.
    const rubric = loadStoryRubric(block)

    const answer = ["LR1", "LR2", "LR3"].map((id) => `${id}: ${freeText[id] || ""}`).join("\n\n")
    const result = await scoreOpenItem("LR_FREE_RECALL", answer, rubric, callLlm)

    const meta = { score: result.score, unscoreable_reason: result.unscoreable_reason, gradedAt: new Date().toISOString() }

    // Not stored as a grade unless this is the last attempt — see isTransient above.
    if (isTransient(result.unscoreable_reason) && !acceptTransient) return { transient: true, meta }

    return {
        free: result.subScores ? { score: result.score, subScores: result.subScores } : null,
        meta,
    }
}

// Returns { open, meta, transient } — or null when there is nothing new to grade.
//
// Only ungraded items are sent, plus any stored as null because the CALL failed. A student who edits
// one written answer and resubmits re-grades that one, not all four. `transient` lists the items
// whose call failed this time; they are left out of `open` (so they stay ungraded) unless
// `acceptTransient` is set on the job's last attempt.
const gradeOpenItems = async ({ psychometric, callLlm, force = false, acceptTransient = false }) => {
    const perspective = (psychometric && psychometric.perspective) || {}
    const openText = perspective.openText || {}
    const alreadyGraded = perspective.open || {}
    const previousMeta = perspective.openMeta || {}

    const open = { ...alreadyGraded }
    // Merged, not replaced: the meta of items graded on an earlier run is kept.
    const meta = { ...previousMeta }
    let housekeeping = false

    const todo = OPEN_ITEMS.filter((itemId) => {
        const text = openText[itemId]
        const blank = typeof text !== "string" || text.trim() === ""

        // CLEARED since it was graded — the text is there and empty — so the grade no longer
        // describes anything the student wrote. (No text record at all is not a clearing; a grade
        // with nothing beside it is carried through as before.)
        if (blank) {
            if (typeof text === "string" && open[itemId] !== undefined) {
                delete open[itemId]
                delete meta[itemId]
                housekeeping = true
            }
            return false
        }

        if (force || alreadyGraded[itemId] === undefined) return true

        const previous = previousMeta[itemId]
        if (previous && previous.textHash && previous.textHash !== textHash(text)) return true

        return alreadyGraded[itemId] === null && Boolean(previous) && isTransient(previous.unscoreable_reason)
    })

    if (todo.length === 0) return housekeeping ? { open, meta, transient: [] } : null

    const rubrics = loadRubrics()
    const transient = []

    for (const itemId of todo) {
        const result = await scoreOpenItem(itemId, openText[itemId], rubrics[itemId], callLlm)

        meta[itemId] = {
            score: result.score,
            unscoreable_reason: result.unscoreable_reason,
            problems: result.problems,
            gradedAt: new Date().toISOString(),
            textHash: textHash(openText[itemId]),
        }

        if (isTransient(result.unscoreable_reason) && !acceptTransient) {
            // Left ungraded, so the retry sends it again. Not stored as null.
            delete open[itemId]
            transient.push(itemId)
            continue
        }

        // A null score is a real outcome — blank, off-topic, gibberish, or a prompt-injection
        // attempt. It is recorded as null rather than omitted, so the factor is dropped and
        // renormalised instead of being quietly treated as un-attempted.
        open[itemId] = result.subScores || null
    }

    return { open, meta, transient }
}

module.exports = { gradeOpenItems, gradeStoryRecall, createGradingClient, loadRubrics, loadStoryRubric, OPEN_ITEMS, isTransient, textHash }
