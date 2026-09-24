# Freshmxn — Day 4 Handover

**Written for:** the next Claude session, and the owner deciding what ships.
**Date:** 2026-09-24. **State:** Day 4 is complete — the assessment, the pipeline and the report are
built end to end, and the report has been rebuilt around the profession data.
22/22 scoring · 51/51 matching · 88/88 pipeline fixtures green. Nothing committed to git.

Read `02_Day1_Handover.md` for house style and the `grantAccess` invariant, `03_Day2_Handover.md`
for the scoring engine, and `04_Day3_Handover.md` for matching. `00_Research_Summary_FROZEN.md`
remains the authority for every formula. This document covers Day 4 only.

---

## 1. What Day 4 delivered

```
Backend/
├── Routers/
│   ├── externalTestsRouter.js   ← NEW. Screenshot upload → Haiku 4.5 vision → validate → store
│   ├── reportsRouter.js         ← NEW. GET /getMyReport; strips match_confidence, labels factors
│   ├── storyRouter.js           ← NEW. The two-clock delayed recall
│   └── submissionsRouter.js     + /savePsychometric /submitPsychometric /digitSpan*
├── workers/
│   ├── generateReportWorker.js  ← NEW. job `generate_report` — match → recommend → compose
│   ├── scoreProfileWorker.js    + hands off to generate_report
│   ├── gradeOpenItems.js        ← NEW. the five LLM-graded open items, stored once
│   ├── reportComposer.js        ← NEW. prompt, FACTOR_LABELS, the forbidden-term check
│   ├── extractTestResult.js     ← NEW. vision prompt, range gates, injected client
│   ├── queueHelpers.js          ← NEW. addOnce, connection logging, the DNS workaround
│   └── fixtures/                88 pipeline fixtures
├── model/
│   ├── recommendationsModel.js  reportsModel.js  verificationsModel.js   ← all NEW
└── data/stories.json            ← NEW. 8 stories; facts never leave the server

Frontend/src/pages/
├── Assessment/                  ← NEW. Shell + 10 modules + the registry
│   ├── AssessmentShell.js  AssessmentIntro.js  assessmentModules.js
│   ├── Ipip50.js  Perspective.js  DigitSpan.js  StoryRecall.js  LikertModule.js
│   ├── ExternalTest.js  Sart.js  sartTask.js  OneAttemptWarning.js
│   └── ipip50Items.js  moduleItems.js  perspectiveItems.js  externalTestItems.js
├── Report/                      ← NEW. the rebuilt report
│   ├── ReportPage.js            three release states, both lists, aspiration signals
│   ├── ProfessionCard.js        heading → full detail on tap
│   ├── ReportFilterBar.js       AI / demand / pay, with live survivor counts
│   ├── reportFilters.js         the dim-don't-delete rules
│   └── reportTags.js            student ↔ profession tag joins
├── JourneyProgress.js           ← NEW. the staged progress bar
└── UpgradeToMentorship.js       ← NEW. the Tier 1 → 2 prompt
```

---

## 2. ⚠ DEFERRED TO V2 — two items from `07_Part2_Handoff_Brief.md`

**Owner decision, 2026-09-24.** Both are named in the Part 1 → Part 2 brief. Neither is built, and
both were deliberately deferred rather than missed. They are recorded here because the brief will be
read again by whoever builds Part 2, and "it is not in the code" must not be mistaken for "nobody
noticed".

### 2.1 §7 — DPDP behavioural tracking of minors

The brief requires that for under-18 users, `recommendation_events` writes an **aggregate counter**
per profession rather than a per-user row with `dwell_ms`:

```js
if (user.age < 18) {
  await Counter.increment(professionId, eventType);   // aggregate, no user link
} else {
  await Event.create({ userId, professionId, eventType, dwellMs });
}
```

**Nothing exists yet — and that is the safe state.** No events collection, no counters, no
`dwell_ms` anywhere. So no per-child behavioural trail is being written today, and deferring costs
nothing legally.

**What it costs:** the only question these events answer — *"is this profession never expanded?"* —
is unanswerable until V2. That is a content-quality signal, not a safety one.

**⚠ The trap for whoever builds it.** The aggregate-vs-row split must be in place **the first time a
single event is written**. Adding events in V2 and the under-18 branch in V2.1 means every event in
between is a per-child behavioural record that should not exist, and it cannot be un-collected. If
V2 ships events at all, it ships both halves in the same release.

### 2.2 §10 — the 6- and 12-month follow-up

The brief is emphatic that this ships in the first sprint *because* it produces nothing for six
months: `chosen_path` at 6 and 12 months is the only signal that can validate any weight in either
system.

**What it costs, stated plainly:** deferring to V2 means the first outcome data arrives 6 months
after V2 ships, not 6 months after V1. Every weight in `constants.js` and every number in
`baseline_rating.json` stays an approved guess until then. The brief's own warning applies — *"one
added in month 12 produces no usable data until month 18"*.

**⚠ The mitigation that costs almost nothing, and should be done in V1 anyway.** The follow-up needs
`report.generatedAt` and a contactable email, and both already exist on every record. So the data
required to send a retrospective follow-up is being captured today even though the job is not built.
V2 can mail the whole V1 cohort at whatever age they have reached. **Do not delete or overwrite
`reports.generatedAt`** — it is the anchor the deferred job will use.

---

## 2b. Stage 4E — the report a student will actually read

The report was correct and unreadable: ~1,500 words of prose over eight sections, then a flat list.
Meanwhile 18 of the taxonomy's 26 fields reached the client through no path at all.

| Change | Where |
|---|---|
| Profession rows are **headings with tag chips**; detail opens on tap | `Report/ProfessionCard.js` |
| New `POST /professions/getProfessions` — full detail, **batched in one call** | `Routers/professionsRouter.js` |
| Prompt cut from **8 sections to 4**; `REPORT_VERSION` → `report@2.0.0` | `workers/reportComposer.js` |
| Filters for AI exposure, demand and pay | `Report/reportFilters.js` |
| Chips joining the student's own reasons/activities/factors to each profession | `Report/reportTags.js` |
| `dominant_reasons` persisted so the reason join is possible | `recommendationsModel.js` |
| Submit button reads **"Read my report"** when nothing changed since the last submit | `AssessmentIntro.js` |
| `displayFields()` + `demand` (one key — `midCareerMidpoint` was already there) | `matching/program3.js` |

### ⚠ The content-safety finding — read this before touching `nuances`

`nuances` are the best content in the dataset and **they are not uniformly student-safe**. Two
separate leaks, both caught by fixtures rather than by review:

1. **Five nuances sit in builder-only fields** (`filter`, `verification`). The Farmer one reads
   *"Fails the compensation filter… the application must be able to reverse it."* Showing that to a
   student from a farming family is the worst content failure this product can produce.
2. **74 nuances in perfectly student-facing fields contain raw identifiers** — `mid_career`,
   `admin_review`, `verified_facts`, `india_demand` — and 28 contain builder phrasing (`audit.py`,
   *"this record carries"*).

So there are **two screens**: a field whitelist and a wording screen. 348 of 438 nuances are served.

**Do not delete the field whitelist because it looks redundant.** Measured: on today's data the two
screens overlap completely, so removing the whitelist changes nothing a data-driven test can see. It
exists for the nuance that does not exist yet — one added to `filter` later in plain English, which
the wording screen would wave straight through. A fixture plants exactly that case.

### ⚠ Filters dim, they never delete

Three reasons, any one sufficient: the aspiration cards say *"It is #4 in your list above"*;
`reportComposer` writes `yourMatches` against the top eight **by name**; and `high` AI exposure is
13 of 223 while `declining` demand is 2, so on a sector-clustered ranked list a filter is usually
all-or-nothing. Every option shows a live survivor count and zero-count options are disabled, so a
blank list is structurally impossible. The top three and every aspiration are pinned and never dim.

**Pay has nine exemptions.** `power_law` and `bimodal` professions — Doctor, Actor, Athlete,
Entrepreneur, Content Creator, Model, Esports, School Teacher, Coaching Faculty — are never faded,
because `DECISIONS.md` §8.4 says their midpoint *"describes almost nobody"*. That list is close to
a list of what minors most aspire to. Note also that §8.5 classifies salary as *"display + user
sort"* while `years_to_qualify` and `degree_dependency` are *"user filter"* — the dim-don't-delete
form is what reconciles the owner's request with that classification.

### Path levels are anchored and forward-filled, not enumerated

`stage` is free-form with ~90 distinct values. Eight tokens are anchored; every unrecognised stage
inherits the previous step's level. `step` is strictly increasing in all 223 records, so levels
cannot go backwards — a fixture asserts that over all 911 steps. A new taxonomy value lands in the
right bucket instead of a wrong one.

### 🟩 SART shows the red cross in the SCORED block too — a deliberate departure from §6

04_Item_Bank.md §6 gives feedback to the practice block only. **The owner chose teaching value over
norm comparability**, and the cost is real: knowing you have just erred causes *post-error slowing*,
so reaction times right after a mistake are inflated.

It is not fatal. The commission count — the primary lapse measure — is unaffected, and RT
variability rises rather than falls, which makes the attention score **conservative** rather than
flattering. But **this cohort's reaction times are not comparable with a published no-feedback SART
norm.** Every session records `sartMeta.feedbackInScoredBlock: true` so that can never be forgotten
when norms are built at ~200 sessions, and a fixture fails if that disclosure is removed.

### 🟩 `profession.filter` is read nowhere

12 professions are marked `filter: false` (Anganwadi Educator, Sanitation Worker, Commercial Driver,
Housekeeping…) and nothing reads the flag, so they are ranked and shown today. Pre-existing.
**Flagged, not silently wired** — those records' own nuances argue that listing them is the point,
so switching it on is an owner decision.

---

## 3. The decisions that are now code

| Decision | Where |
|---|---|
| Story recall is text-only; the clock is server-side | `storyRouter.js` |
| External tests keep upload + vision extraction | `extractTestResult.js` |
| Report prose lives in its own collection | `reportsModel.js` |
| `match_confidence` stored, stripped at the API boundary | `reportsRouter.js` |
| Factor slugs translated at the boundary, never in the page | `reportsRouter.js` + `FACTOR_LABELS` |
| SART emits PsyToolkit format so `sartScoring.js` is untouched | `sartTask.js` |
| A SART session that fails its timing check saves **nothing** | `Sart.js` |
| Four sections do not gate submission, and the UI never says so | `assessmentModules.js` |

### Four sections do not block Submit — and this is a safety valve, not a feature

`storyRecall`, `extReasoning`, `extVerbal`, `sartRaw`. Each would otherwise trap somebody with no
way out: the story's clock runs 24 hours, the two external tests live on another company's website,
and a phone that fails SART's 50 Hz or 20 ms gate can **never** complete it — making it a
requirement would lock the cheapest devices out of the product entirely.

**Nothing in the UI says which sections these are.** A section students are told is skippable is a
section most of them skip, and a report built without the reasoning test is measurably worse at its
only job. A fixture fails if the word "optional" reaches student-facing code.

### SART refuses rather than guesses

The device check watches frame delivery for **two seconds** (an earlier version ran 20 blocks of real
trials — 7.5 minutes — which made the module impossible to start). The scored block then re-measures
its own 225 trial durations and refuses to save if they drifted, which catches a phone that passed
while cool and throttled four minutes later.

A refused session writes `sartMeta` and **no `sartRaw`**, so the engine sees no SART at all:
`processing_speed` nulls, **focus survives at 7.7**, and the report releases with a note. That path
is fixture-proven, which is what makes refusing to fake the number affordable.

---

## 4. Alignment with `07_Part2_Handoff_Brief.md`

Verified in code on 2026-09-24, not from memory.

| Brief rule | Status |
|---|---|
| §3 Universals excluded from matching | ✅ zero leak, checked programmatically |
| §4 Interests lead, fundamentals follow | ✅ candidates come from Program 1 → 2; Program 3 only ranks them |
| §5 Nulls dropped and renormalised, never imputed | ✅ fixture-pinned |
| §5 Completeness 0.75 / three release states | ✅ |
| §5 `match_confidence` computed, stored, never displayed | ✅ stripped at the boundary |
| §6 Uncertainty tolerance `0.7×raw + 0.3×5`, never filters | ✅ matching reads the adjusted value |
| §9 Version stamps | ✅ all five |
| §7 DPDP under-18 aggregates | ⛔ **deferred to V2 — see §2.1** |
| §10 6/12-month follow-up | ⛔ **deferred to V2 — see §2.2** |

### ⚠ One arithmetic slip in the brief itself, not in the code

§3 says the matching vector is *"the 18 remaining majors + the 6 differentiating minors"* = 24.

By the brief's own §2 lists, only **one** of the four universals (Confidence) is a major — the other
three (Consistency/Grit, Learning Capacity, Informed Decision Making) are listed under the nine
minors. Removing the universals from 22 majors therefore leaves **21**, not 18.

Our vector is **21 + 6 = 27**, which applies the brief's *rule* correctly. **Do not "fix" the code
to match the brief's number** — fix the number in the brief.

### One honest leak, already damped

Confidence is excluded directly but re-enters indirectly through Practical Intelligence (0.20) and
Collaboration (1/6). Documented in `matching/constants.js` and damped by `MINOR_GROUP_WEIGHT = 0.5`.
First thing to refit when outcome data exists.

---

## 5. What is still open

| Item | Owner action |
|---|---|
| 🟩 The report prompt in `reportComposer.js` | **Yours to approve before it runs on a real student.** Most readers are minors. Now `report@2.0.0` — four short sections instead of eight, ~60% fewer tokens. |
| 🟩 `profession.filter` is unused | 12 professions marked `filter: false` are shown today. Wire it on, or decide it stays off. See §2b. |
| 🟩 90 nuances are withheld from students | Excluded for builder phrasing or raw identifiers. Several are genuinely useful and only need rewording — a copy pass would recover them. |
| Nuances still say "taxonomy" and "Sector 5" | Not identifiers, so not excluded, but meaningless to a student. Copy review. |
| 🟩 The five LLM rubrics (`llm_scoring_prompts.md`) | Never reviewed |
| 🟩 132 interest-form problem prompts | Never reviewed |
| P22 and LR_FREE_RECALL | Never exercised against the live API |
| Two flagged baseline professions | Railway Operations Professional, Model — need the admin screen |
| Nothing is committed to git | Still true |

### Never validated on real hardware

**SART's 20 ms timing gate has not been run on a low-end Android.** The device check is built, the
virtual-display fixtures prove the scheduler does not drift, and the refusal path is proven safe —
but no physical budget phone has taken the task. If it turns out most cheap Androids fail the gate,
that is a product decision (loosen the gate, or ship without processing speed), not a code fix.

**The external tests have never been run against the live vision API.** Every gate is fixture-proven
with a stubbed client; no real screenshot has been through Haiku 4.5.

---

## 6. Gotchas carried forward

- `claude-sonnet-5` **rejects `temperature`** with a 400. Haiku 4.5 accepts it; `extractTestResult.js`
  retries without it on a temperature-related 400.
- BullMQ job ids **cannot contain `:`** — it reserves that for Redis key namespacing.
- `jobId` uniqueness **persists after completion**. Use `addOnce`; the naive version silently
  swallowed every resubmit for 24 hours.
- `dns.setServers()` affects `dns.resolve*()` only, **not** `dns.lookup()` — which is what ioredis
  uses. See `withDnsWorkaround`.
- Upstash restricts `CLIENT LIST`, so BullMQ's `getWorkers()` is unreliable. `pipelineStatus.js`
  uses queue depth and a `--probe` mode instead.
- Mongoose **Mixed** fields need `findOneAndUpdate` + `$set`, and `returnDocument: "after"` rather
  than `new: true`.
- `CI=true npm run build` promotes pre-existing warnings in `Interest/` to errors. The normal build
  is clean.

---

## 7. How to run it

```
node Backend/scoring/fixtures/runFixtures.js     # 22/22
node Backend/matching/fixtures/runFixtures.js    # 51/51
node Backend/workers/fixtures/runFixtures.js     # 88/88 — offline, no DB, no API key

npm run dev            # Backend/
npm run worker:score   # Backend/ — the score_profile worker
npm run worker:report  # Backend/ — the generate_report worker
npm run pipeline:status -- --probe
```

All three suites are offline. The pipeline fixtures stub every model call, load the **real**
frontend `sartTask.js` and drive it against a virtual 60 Hz display, so the browser task is tested
without a browser.
