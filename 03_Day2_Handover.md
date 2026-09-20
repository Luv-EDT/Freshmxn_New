# Freshmxn — Day 2 Handover

**Written for:** the next Claude session picking up Day 3 (Baseline_Rating + embeddings + the matching engine).
**Date:** 2026-09-20. **State:** the scoring engine is built and green. Nothing committed to git.

Read `02_Day1_Handover.md` first for house style, the data model and the `grantAccess` invariant.
Then `00_Research_Summary_FROZEN.md` — it is the authority for every formula and it has not changed.
This document covers only what Day 2 added and what Day 3 needs from it.

---

## 1. What Day 2 delivered

A **pure** scoring engine: a completed assessment in, a 31-factor psychometric profile out. No
database, no network, no clock, no randomness. The same input always produces byte-identical
output — which is what makes `scoring_version` mean anything: a formula change is a recompute, never
a retake.

```
Backend/scoring/
├── scoreProfile.js         ← THE ENTRY POINT. This is all Day 3 needs to import.
├── perspectiveScoring.js   ported unchanged          (perspective@5.0.0)
├── sartScoring.js          ported unchanged          (sart@1.0.0)
├── ipip50.js · mi.js · rosenberg.js · confidenceItems.js
├── digitSpan.js · verbalMemory.js · reasoning.js · storyRecall.js
├── llmScorer.js            the 5 open items, client injected — NOT imported by the engine
├── scoringHelpers.js       letter parsing, coverage gate, the one `combine()` every composite uses
└── fixtures/
    ├── buildSubmission.js  hand-built submissions
    ├── fixtures.js         22 golden fixtures
    └── runFixtures.js      the runner
```

**Verification status:** 22/22 fixtures + a determinism check; 32/32 hand-computed sub-scorer
checks. Both ported files diffed byte-identical to their originals apart from one appended
`module.exports`. Purity, weight-sum, Principle-2 (no input twice in one formula) and
emotional-stability-inversion audits all clean.

```
node Backend/scoring/fixtures/runFixtures.js     # exits non-zero on failure — CI-ready
```

---

## 2. The output contract — what Day 3 consumes

```js
const scoreProfile = require("./Backend/scoring/scoreProfile")
const profile = scoreProfile(submission.psychometric)
```

```js
{
    scoring_version: "profile@1.0.0",
    component_versions: { perspective, sart, instrument, story },
    norm_set_id: null,                       // no norms until 500+ per age band
    raw_scores:    { …31 keys, 0–10 or null },
    normed_scores: {},  bands: {},           // empty in V1
    data_quality:  { …31 keys, "full" | "partial" | null },
    banks:         { belief_bank, emotion_bank, clm, self_awareness_bank },
    components:    { …every sub-score, plus uncertainty_tolerance_matching and the SART descriptives },
    values_profile: { safety, social, esteem, self_actualisation, strongest_pull },
    flags:          { … },
    completeness:   { matching, overall, release },
}
```

`userId` and `computed_at` are **deliberately not set** — the function is pure. The Day-3 worker
stamps those when it writes to the `profiles` collection (schema in `01_Build_PRD.md` §B.4).

**Three things Day 3 must respect:**

1. **`data_quality` is not confidence.** It records how much input was available, per factor. The
   Confidence *factor* is `raw_scores.confidence`. Do not conflate them.
2. **A null is an absence, never a zero.** Never impute, never substitute a middle value. The engine
   refuses to score rather than producing a plausible number, and matching must preserve that —
   `01_Build_PRD.md` §C.4 already specifies null-renormalisation for Program 3.
3. **Use `components.uncertainty_tolerance_matching`, not the raw score,** when building the
   matching vector. Part 7: a flagged student's score is pulled toward the mean
   (`0.70 × raw + 0.30 × 5.0`). Both are stored — raw for the record, adjusted for matching. U7
   never removes a profession from anyone's list.

### The 27-factor matching vector

21 majors (all 22 **minus Confidence**) + the 6 differentiating minors. The four universals —
Confidence, Consistency/Grit, Learning Capacity, Informed Decision Making — are the report's
readiness section and are **excluded from the matching maths**. `scoreProfile.js` exports these
groupings as `MAJOR_FACTORS`, `MINOR_FACTORS` and `UNIVERSAL_FACTORS`; derive the vector from those
rather than retyping the list.

---

## 3. Decisions carried into Day 3

### 3.1 The Confidence leak — needs a decision

Part 5 excludes Confidence from the matching vector because universals "add weight without adding
discrimination." But two minors that *are* in the vector are built partly from it:

- Practical Intelligence = A + E + STM + Reasoning + **Confidence** (0.20)
- Collaboration = O + A + E + Verbal + C + **Confidence** (⅙)

So Confidence re-enters matching through the back door. More broadly, all five equal-weighted minors
are near-linear combinations of majors already in the vector — Practical is 80% A/E/STM/Reasoning,
all four scored separately alongside it. They add correlated re-weightings rather than new
measurement, which is the "professions bunch together" failure Part 5 warns about.

**Day 2 implemented the doc as written.** Day 3 should decide whether the vector keeps all six
minors, down-weights them, or drops those that duplicate their own inputs. This is a matching
question, not a scoring one.

### 3.2 Provisional weights

Five of the six differentiating minors name their inputs but give no coefficients — only Convergent
Thinking is specified. Equal weights are used, marked `WEIGHTS_PROVISIONAL` at the top of
`scoreProfile.js`. Defensible rather than arbitrary: Part 10 §6 concedes all the doc's weights are
"unit-ish judgements, not fitted," and with no outcome data unit weighting is the honest default.
Replace them the moment real weights exist — nothing else needs to change.

### 3.3 Reasoning validity gate

The item bank's conditional 10 s table is authoritative (agreed with the owner); the research doc's
flat "under 20 s → invalid" is superseded and survives as a soft `reasoning_brisk` flag. Fast *and*
near-chance nulls the factor; fast *and* strong scores it and flags `exceptional_speed`.

### 3.4 Story recall totals — resolved, immaterial

`05_Story_Bank.md` states the total two incompatible ways ("Total 12 points" vs "7 structured +
3 × 2 = 6", which is 13). Implemented as 7 structured + free recall's 0–6 mapped onto 5 → 12, the
only reading where every stated figure holds. The difference between the two readings is at most
**0.05 on a 0–10 scale**, so it is not worth revisiting; constants at the top of `storyRecall.js` if
it ever needs changing.

---

## 4. What Day 3 has to build

From `01_Build_PRD.md` Day 3:

1. **Baseline_Rating pipeline** — attach 27-factor `factors` / `weights` / `drivingReasons` to every
   profession, multi-sample with variance flags, `review_status: "unreviewed"`.
2. **Voyage embeddings** — `voyage-4-large`. The professions were already embedded during the
   professions work; **reuse those stored vectors** and only re-embed where the text changed. Query
   with `input_type: "query"`. Store in Atlas Vector Search.
3. **The matching engine** (pure module, same discipline as the scoring engine) — Programs 1–3,
   ≥80% floor, null-renormalisation, `match_confidence` stored per profession, 16-tier sort,
   `ai_exposure` as a sort option only.
4. **Activity-factor cache** + the Voyage runtime query path + the LLM rerank node.
5. **The worker and `profiles` collection** — Day 2 deliberately left these out. The thin wrapper
   reads `Submission.psychometric`, calls `scoreProfile()`, and writes to `profiles` with `userId`
   and `computed_at`. The BullMQ job is named `score_profile`.

### ⏸ Stop-and-ask checkpoint — the owner asked for this explicitly

`baseline_rating.json` is the **old 19-factor set**. Before regenerating it against the 27-factor
vector, `psychometric_factors.json` goes 19→27 and `factor_anchors.json` needs anchors for the
**8 new factors**. **Stop and have the owner review those anchors before the scoring run.** He has
asked for this checkpoint twice; do not skip it.

---

## 5. Gotchas

- **223 professions, not 218.** The PRD says 218 in several places; all three data files agree on
  223 and their `id` sets join cleanly. Trust the data.
- **`match_confidence` is stored, never displayed and never an input** to the maths.
- **The assessment UI does not exist** — it is Day 4. Day 3 tests against hand-built fixture
  submissions from `Backend/scoring/fixtures/buildSubmission.js`, which is expected and correct.
- **`llmScorer.js` is the only non-pure file** and nothing in the engine imports it. It runs *before*
  scoring, takes an injected client, and its JSON output is stored on the submission — so
  re-scoring a profile never re-bills an API call. Temperature 0, student text delimited as data,
  and the code sums the sub-scores while ignoring any total the model returns.
- **Two documented style deviations**, both in `Backend/scoring/`: the folder itself (CODING_STYLE.md
  names only `config/ middlewares/ model/ Routers/`), and `scoringHelpers.js` exporting an object
  rather than a single value.
- **Emotional Stability is already reversed.** It is used directly everywhere. There is no `(10 − x)`
  anywhere in the model and there must never be one.

---

## 6. Still open from earlier days

1. **The 132 interest-form problem prompts** (`Frontend/src/pages/Interest/problemPrompts.js`) have
   never been reviewed. Some are sensitive — discrimination, illness, family money problems.
2. **The four open-item LLM prompts** are the owner's to review (PRD marks them 🟩). The rubrics are
   implemented in `llmScorer.js` per `llm_scoring_prompts.md`.
3. **Accounts created before email verification existed cannot pay** until `isEmailVerified` is set.
4. **Nothing is committed to git.** `.gitignore` is correct.
