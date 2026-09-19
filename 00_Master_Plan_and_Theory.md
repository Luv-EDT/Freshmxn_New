# Freshmxn — Master Plan & Theory (Part 1 + Part 2 Consolidated)

**Purpose of this document.** One place that holds the whole system — the psychometric
assessment (Part 1) and the profession recommendation engine (Part 2) — reconciled into a
single coherent theory before any full-stack build begins. This is the *what and why*. The
*how* (auth, schemas, routes, APIs, payments) is the second document, written after you mark
this one up.

**Status of inputs.** Part 1 research is frozen (`00_Research_Summary_FROZEN.md`,
`07_Part2_Handoff_Brief.md`). Part 2 taxonomy is built (218 professions, verified, in Claude
Code). Part 2 matching algorithm is specced (the career-matching PRD). This document resolves
the seams between them.

---

## 0. The one-paragraph theory

A student tells us **what they're drawn to** (activities, interests, the reasons behind them).
The psychometric assessment tells us **how they're built** (22 major + 9 minor factors). We match
their interests to professions first, then use the psychometric profile as a *lens* to show how
well-suited they are to each — never the other way round. The output is a tiered list of
professions, plus a readiness layer telling them what they'll need whatever they choose. Paid
mentor sessions turn that report into a decision.

### 0.1 The demand-side thesis (positioning, and a real design constraint)
Most career guidance works only the **supply side** — training students for jobs, often crowded
or fading ones, which is the education-to-employment mismatch on repeat. Freshmxn deliberately
inverts this: the 218-profession taxonomy is curated toward **where demand actually is and is
heading** (AI-resilient, financially viable, in-demand), and matches a supply of well-prepared,
well-fit people *toward* that demand. Over time the network of matched talent + industry mentors
doesn't just meet demand — it helps create it. This is not only marketing copy: it is *why* the
taxonomy carries `ai_exposure`, `demand_signal`, and financial-viability fields, and why
professions are curated for future-viability rather than for "an Indian degree exists." The
public site leads with this ("we don't just train you for a dead end").

---

## 1. THE FIVE RULES THAT MUST NOT DRIFT

These come from the Part 1 handoff and govern every line of Part 2. They are repeated here
because every one of them was being broken in the old Gumloop model.

1. **Universals are excluded from matching.** Confidence, Consistency/Grit, Learning Capacity,
   Informed Decision Making appear in the report as a *readiness layer only*. A factor every
   profession requires cannot discriminate between professions — including them makes all
   professions score alike. This will look like a bug in the code. It is not.

2. **Interests lead, fundamentals follow.** The student picks what interests them; the
   psychometric profile is the lens, never the driver. Never rank on fundamentals alone; never
   tell a student a path is closed because of a score.

3. **Nulls shrink the lens, they never block the picture.** Renormalise the remaining weights.
   Never impute an average.

4. **Uncertainty Tolerance is a position, not a level.** Low means suited to structured work,
   not deficient. It never filters professions.

5. **Never optimise matching on clicks.** Tuning on engagement surfaces pilot/actor/entrepreneur
   and looks like improvement while getting worse. The target is 6-month outcomes.

---

## 2. THE FACTOR MODEL — AUTHORITATIVE (22 majors + 9 minors)

**This section supersedes the "19 factors" in the old Baseline_Rating and the old career PRD.**
The frozen research is the source of truth. The old 19-factor Gumloop set is retired.

### 2.1 The 22 major factors

| # | Factor | Group | Note |
|---|---|---|---|
| 1 | Openness | Personality | |
| 2 | Conscientiousness | Personality | appears exactly once in the model |
| 3 | Agreeableness | Personality | |
| 4 | Extraversion | Personality | |
| 5 | **Emotional Stability** | Personality | NOT Neuroticism. Already reversed. High = calm. No `10−x` anywhere. |
| 6 | Short-Term Memory | Cognitive | |
| 7 | Reasoning | Cognitive | feeds six downstream factors — highest-value input |
| 8 | Long-Term Memory | Cognitive | |
| 9 | Verbal Intelligence | Intelligences | self-report → affinity, not ability |
| 10 | Spatial Intelligence | Intelligences | affinity |
| 11 | Musical Intelligence | Intelligences | affinity |
| 12 | Bodily Intelligence | Intelligences | affinity |
| 13 | Naturalistic Intelligence | Intelligences | affinity |
| 14 | Existential Intelligence | Intelligences | affinity |
| 15 | Logical Intelligence | Intelligences | affinity (measured Reasoning is the ability counterpart) |
| 16 | Confidence | Higher-order | **UNIVERSAL — readiness only, excluded from matching** |
| 17 | Emotional Intelligence | Higher-order | borderline — keep in matching at LOW weight |
| 18 | Focus / Attention Span | Higher-order | |
| 19 | Firmness of Belief | Higher-order | (was "dogmatism" in old set) |
| 20 | **Intrapersonal Intelligence** | Intelligences | NEW vs old 19 |
| 21 | **Processing Speed** | Cognitive | NEW vs old 19 (SART reaction time) |
| 22 | **Uncertainty Tolerance** | Higher-order | NEW vs old 19. A position, not a level. |

### 2.2 The 9 minor factors

**Universal (4) — readiness layer, EXCLUDED from matching:**
Confidence · Consistency/Grit · Learning Capacity · Informed Decision Making

**Differentiating (6) — used in matching:**
Practical Intelligence · Divergent Thinking · Convergent Thinking · Collaboration ·
Interpersonal Intelligence · Propensity to Go Deep

### 2.3 Mapping the OLD 19 → the NEW model (what changes in Baseline_Rating)

| Old Baseline_Rating key | New status |
|---|---|
| neuroticism | → **emotional_stability**, and the *meaning flips* — a profession low on neuroticism becomes high on emotional stability. Any inherited scores must be re-generated, not renamed. |
| dogmatism | → **firmness_of_belief** (rename + re-anchor) |
| persistence_grit | → moves to the **universal readiness layer** (Consistency/Grit) → **removed from matching** |
| confidence | → **universal** → **removed from matching** (kept in report only) |
| (all others: openness, conscientiousness, agreeableness, extraversion, STM, reasoning, LTM, verbal, spatial, musical, bodily, naturalistic, existential, logical) | carry over, but re-scored under the new anchored rubric |
| — | **ADD**: intrapersonal, processing_speed, uncertainty_tolerance |

**Consequence:** the Baseline_Rating regeneration is a fresh 22-factor scoring pass, not a
two-factor patch. Since the current `professions.json` carries no factor scores yet (only
`role_spread`), there is nothing to migrate — generate directly against the 22-factor model.

### 2.4 The matching vector (what actually enters the maths)

**Matching vector = 21 majors + 6 differentiating minors = 27 factors.**

- **Majors:** 22 total − **Confidence** (the only universal *major*) = **21 majors** in matching.
- **Minors:** 6 differentiating minors. The 3 universal *minors* (Consistency/Grit, Learning
  Capacity, Informed Decision Making) are excluded.
- **Total excluded from matching = 4 universals** (1 major + 3 minors), exactly the four readiness
  factors. Everything else discriminates and stays in.
- **Borderline — Collaboration and Emotional Intelligence** stay in matching at **low weight**:
  near-universal now, but genuinely solitary vs genuinely people-facing professions still separate
  on both.

*(Correction on record: an earlier draft wrote "18 majors." That mistakenly removed the 3 minor
universals from the major count. Only Confidence leaves the major set → 21 majors remain.)*

---

## 3. THE TWO-PART SYSTEM, END TO END

```
┌─────────────────────────── PART 1: WHO THEY ARE ───────────────────────────┐
│                                                                            │
│  React intake form  ─►  Assessment modules:                                │
│  (already built,         • IPIP-50 (Big Five)                              │
│   feeds "Activities      • MI 35-item ×7 intelligences                     │
│   Analysis")             • Reasoning test    • Digit span (STM)            │
│                          • Delayed story recall (LTM)                       │
│                          • SART (attention + processing speed)             │
│                          • Perspective block (belief/emotion/CLM/self)      │
│                          • Rosenberg (confidence)                           │
│                                    │                                        │
│                                    ▼                                        │
│                   Scoring engine (pure, versioned, golden fixtures)         │
│                   → profile { 22 majors + 9 minors, each 0–10 or null }     │
│                   → data_quality, flags, banks                             │
└────────────────────────────────────┬───────────────────────────────────────┘
                                     │  the profile is the LENS
                                     ▼
┌─────────────────────────── PART 2: WHAT THEY DO ───────────────────────────┐
│                                                                            │
│  Activities + reasons  ─►  Program 1: extract LP/P lists, dominant reasons │
│  (from the same form)      + the person's matching-vector scores           │
│                                    │                                        │
│                                    ▼                                        │
│  Program 2: activities ─► candidate professions (embeddings + LLM rerank)  │
│             activities ─► activity-factor scores (rubric + cache)          │
│             weighted match vs Baseline_Rating → AList / BetaList           │
│             reason-alignment → BList / CList                                │
│                                    │                                        │
│                                    ▼                                        │
│  Program 3: comfort-match each list vs the STUDENT'S profile               │
│             (nulls renormalise, never impute) → 16-tier ranked list        │
│                                    │                                        │
│                                    ▼                                        │
│  Report: tiered professions + readiness layer + values profile            │
│             match_confidence computed & stored, never shown, never an input│
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. PART 1 SUMMARY (the assessment) — for context, already frozen

The full detail lives in the frozen research + master spec. What Part 2 needs to know:

- **Output contract:** a `profile` document — `{ raw_scores, normed_scores, bands, data_quality,
  flags, banks }`, 22 majors + 9 minors each 0–10 or null, keyed by `user_id` + `session_id`,
  stamped with `scoring_version` and `norm_set_id`.
- **`data_quality` ≠ Confidence.** `data_quality` describes how much input a value had; Confidence
  (#16) describes the student. Never merge them; never show `data_quality` to a student as
  "confidence."
- **Composites follow a strict DAG** (belief/emotion/clm/self-awareness banks → EI → firmness →
  idm; clm+sart → focus; etc.). No circular derivation; every input appears exactly once;
  confidence propagates (no factor reports higher confidence than its weakest input).
- **Validity gates run before scores.** SART fakeability, straightlining, social desirability,
  reasoning-too-fast, MI all-50%, out-of-range screenshots — each can null a module.
- **Values profile** (8 Likert items) reported as `importance − fulfilment` per area, never summed,
  never mixed into a factor — it is Part 2 input ("the why"), not a Part 1 score.

---

## 5. PART 2 — THE RECOMMENDATION ENGINE (reconciled to the 22-factor model)

The career-matching PRD stands, with these reconciliations applied:

### 5.1 Program 1 — per-user extraction
- **LP list** = activities "Yes" on both Persistent and Long-Pursuit.
- **P list** = "Yes" on Persistent only.
- **ReasonList** = dominant reason(s), multi-select, from the **7 fixed reason categories** (no
  custom). Empty is valid.
- **Profile object** = the student's **matching-vector** scores (21 majors + 6 differentiating
  minors = 27 factors), pulled from the Part 1 profile — NOT a re-computation. Universals are read
  for the readiness layer but never enter matching.

### 5.2 Program 2 — profession matching
- **Step A (candidates):** embedding retrieval (Voyage voyage-4) over the 218 professions →
  top 15–20 → LLM filter/rerank. Never free-generation.
- **Step B (activity factors):** rubric-scored on the **matching-vector factors**, cached with
  `rubricVersion`, embedding-dedup ≥ 0.9, multi-sample 3×, high-variance → admin review.
- **Step C (weighted match):** `similarity(f) = 1 − |prof[f] − act[f]| / 10`;
  `match = Σ(weight_f · similarity_f) / Σ(weight_f)`. **Keep every match ≥ 80%** (a floor, not a
  window — no upper bound; a 95% match is a *better* match, never discarded) and rank by score.
  → AList (LP) / BetaList (P).
- **Step D (reason alignment):** BetaList split into BList (drivingReasons ∩ dominantReasons ≠ ∅)
  and CList (no overlap). If dominantReasons empty → BList = BetaList, CList = ∅.

### 5.3 Program 3 — comfort matching + tiering
- **Step E (comfort):** match each of AList/BList/CList against the **student's own** matching-vector
  profile, using the same weights. **Nulls: drop the factor, renormalise remaining weights, never
  impute.** ≥ threshold → `_comfort`, else `_nonComfort`.
- **`match_confidence`** = `1 − (weight of missing factors ÷ total weight)` — **computed and stored
  per profession from V1, never displayed and never an input to any score** until Stage 4b
  validates it. It is a stored diagnostic only.
- **Step F (16-tier sort):** by comfort tier × confidence_exp × passion × achievement, top-down
  first-match. Tiers 11 & 16 (C-list) are single buckets.

### 5.3a `ai_exposure` — a user-controlled SORT, never a matching input
`ai_exposure` (already scored per profession in the taxonomy) may act as a **student-facing sort
option** — the student can choose to re-order the recommended list by AI-exposure (e.g. most
future-proof first), and high-exposure professions are explicitly flagged in the report. Because it
is a **sort, not a filter, no profession is ever hidden or removed** — the list is only re-ordered,
so nothing is silently culled and "interests lead, fundamentals follow" is preserved. It must
**never enter the match maths**. Lives in `filter_rules.json` as a sort preset.

### 5.5 Per-category (journey) flows — inputs and report shape
V1 serves all four journeys. **One interest form with a shared core + a journey-specific block, and
one report engine whose output shape is driven by `journey`** — not four separate forms/engines. The
profession side (DECISIONS.md) already carries the journey machinery (waste/τ discounting,
journey-scaled AI-exposure weight, the `class12_prerequisite` stream-inversion, `after_undergrad`);
the input side must feed it and the report side must shape to it.

**Journey detection:** ask category up front (4 options), then one disambiguating question:
| Category | Disambiguating question | Drives |
|---|---|---|
| Class 9–10 | which class (9/10) | waste=0, AI-weight 1.0, stream not yet chosen |
| Class 11–12 | class + stream / subject-set | `class12_prerequisite` hard-filter, AI-weight 0.8 |
| College | pre-admission (just-passed-12) **or** enrolled + which year | `preAdmission` flag → waste=0; else τ=8; AI-weight 0.5 |
| Early professional | years of experience | τ=4 (1–3 yrs) / 2.5 (4+); employment-waste cap; AI-weight 0.25 |

"Just passed 12th, choosing college/course" → **College journey + `preAdmission` flag** (waste=0,
but the college-shaped report).

**Shared core inputs (all journeys):** interests, activities done, problems faced, beliefs — the
existing interest-form content. **Journey-specific inputs** are the disambiguating fields above
(stream/subject-set, course+year, experience-years) — the additions missing from the current form.

**Report shape by journey:**
- **9–10:** stream-inversion headline (*"Commerce keeps 38 open, PCM 34, PCB 21"*) **plus** career
  detail on the top matches.
- **11–12:** ranked professions reachable from the stream (`class12_prerequisite` filters), each with
  `years_to_qualify`, plus the "worth the switch" raw-fit list.
- **College:** two lists (reachable/cost-weighted + worth-the-switch/raw-fit), `after_undergrad`
  guidance, `self_employment` routes.
- **Early professional:** waste-discounted reachable list, `after_any_degree`/`open` finish-then-switch
  paths highlighted, self-employment emphasised.

### 5.6 Baseline_Rating (the profession-side data)
Per profession, keyed on `profession.id`, kept **separate** from the taxonomy file (different
lifecycles), stitched at build time:
```
{ id, factors:{…22 or the matching subset}, weights:{…}, drivingReasons:[1–3 of 7],
  embedding:[…], version, generatedAt, sample_variance, review_status }
```
- `factors`/`weights`/`drivingReasons`: one admin-curated, multi-sampled, mentor-reviewed,
  versioned LLM pass. **Confidence and the 3 universal minors are NOT scored for matching.**
- `embedding`: separate model, regenerated only when profession text changes.
- **Weights carry the same review discipline as scores** — an unanchored weight is as damaging as
  an unanchored score.

---

## 6. THE PRODUCT, THE FLOW & COMMERCIALS

### 6.1 The user journey — one website, one staged flow
The whole experience is a **single frontend** presented as a **staged horizontal progress bar**,
so the user always sees where they are and what remains:

```
[ 1. Interest Form ]──[ 2. Psychometric Assessment ]──[ 3. Report / Recommendations ]──[ 4. Mentor (waitlist V1) ]
   "Virtual Career          the 22+9 assessment            16-tier professions +
    Counselling"            (built fresh, was Forms+Gumloop) readiness + values
```

The two input domains (interest/activities vs psychometric) are separate *pages/stages* of the
same app, not separate apps. A student mid-journey simply sits at a stage on the bar — that is the
"half-done" state, made visible rather than special-cased.

### 6.2 Paywall placement
**Payment is taken immediately after signup**, after both offerings are shown, **before any
deliverable** (assessment, recommendation, or mentorship). One gate up front, not per-stage.

### 6.3 The two offerings
| Tier | Price | What it includes |
|---|---|---|
| **Career Recommendation + Psychometric Analysis** | **₹3,500** | Full assessment, the 22+9 profile, the journey-shaped profession report, the readiness layer, the values profile |
| **Mentor Connection** | **₹7,000** | The above PLUS a mentor matched to the chosen profession: one 1-hour clarity session + one 20-min follow-up/doubts session |

- **Payments:** Razorpay (India-domestic: UPI + cards + netbanking), amounts ₹3,500 / ₹7,000
  (+ ₹3,500 upgrade top-up).
- **Upgrade path:** a student who bought the ₹3,500 tier sees, *after* their report is generated, an
  **"Upgrade to Mentorship"** option costing the **difference (₹3,500)**, not the full ₹7,000. On
  payment it flips them to the mentor tier and drops them into the paid-waitlist flow (§6.4). The
  `payments` collection records both the original tier and the upgrade as separate charges.

### 6.4 Mentor scope in V1 (mentor-as-user + paid waitlist)
There is **no mentor base yet**. V1 does **not** build automated booking, scheduling, or
mentor-student matching — those are V2. **But the mentor tier is live and payable in V1 as a paid
waitlist**, not a "coming soon" placeholder.

**V1 mentor build:**
- **Mentor as a user role**, with its own **sign-in page**.
- A **mentor onboarding form** capturing (stored, admin-visible), with two admin-only fields:
  1. Full name (profile-visible) · 2. Email · 3. Contact number (country code) · 4. Current
  role/title · 5. Discipline/profession · 6. Industry domain(s)/sector(s) incl. past · 7. Years
  of experience · 8. Languages · 9. Motivation (open) · 10. High-school→college approach
  (Category A/B/C/D — same decision-style vocabulary as the student model) · 11. Preferred payment
  currency **(admin-only)** · 12. Country of residence/citizenship **(admin-only)**.
- **Student-facing paid waitlist** for the ₹7,000 tier. The flow, stated on the waitlist page:
  1. Student **pays** to join the waitlist (place held on payment).
  2. Student **completes Step 1** (career discovery + profile) and **chooses a career** from their
     matches, then sends it to us.
  3. We **match a best-fit mentor in that field within 15 business days** of the choice (the clock
     starts at the choice, not at payment). Matching is a **manual admin action in V1.**
- Sessions: 1-hour clarity + 20-min follow-up, delivered manually/off-platform in V1.

**Deferred to V2:** automated mentor directory/matching, in-app scheduling, session delivery,
payouts, and the mentor-override → Baseline_Rating refresh loop (which needs mentor session data
to exist first). V1 Baseline_Rating refresh is **admin-only**.

The point of a *paid* waitlist rather than "coming soon": it captures real demand and revenue for
the tier now, and captures mentor supply via onboarding — so V2 launches with both sides seeded.

### 6.5 The public marketing site (pre-signup, no payment)
Before the paywall, a public site sells the depth so a student/parent understands the product
before paying. Pages: **Landing** (hero → problem-with-verified-stats → demand-side thesis →
who-it's-for → how-it-works → why-we're-different → pricing → about → contact),
**Success Stories** (two illustrative result cards showing story→strengths→ranked matches→choice→
outcome), and **Mentor Waitlist** (the §6.4 paid-waitlist flow). Copy rules: intelligence *sorts,
never filters* is stated explicitly in the how-it-works steps; "human connection" routes to the
mentor tier; every statistic is verified to a citable source (India Skills Report 2026,
Mercer-Mettl Graduate Skill Index, India Today careers-awareness survey, ET work-experience
survey) — no unsourced folklore figures. WhatsApp (wa.me/918882756287) is the primary contact.

---

## 7. GOVERNANCE, LEGAL & DATA RULES CARRIED FROM PART 1

These are non-optional and shape the schemas in the build PRD:

- **DPDP / minors:** for under-18 users, per-profession behavioural events
  (`viewed/expanded/saved/dismissed/dwell_ms`) must be stored as **aggregates, not per-user
  trails**. Parental consent flow required. Get a lawyer's hour on DPDP parental consent + the
  minor-tracking rule (open verification task).
- **Phone OTP excluded** for student login (SMS pumping fraud). V1 login is email + password + JWT
  + bcrypt (per CODING_STYLE.md); magic-link + Google OAuth deferred to V2.
  Parent-consent OTP is a different, rate-limited, one-per-account case.
- **Never impute averages** for invalid modules — null stays visible.
- **6- and 12-month follow-up must ship in V1.** It is a scheduled job + email template, but one
  added later produces no usable data for 18 months, and every future model improvement depends
  on it. This is the single most time-sensitive thing in the whole build.
- **Versioning on every recommendation record:** `profile_id · scoring_version · norm_set_id ·
  taxonomy_version · baseline_version · matching_version`. Pool data only within a MAJOR version.
- **Citations in `03_Research_Evidence_Base` must be verified before any public display** — they
  were recalled from training, not looked up.

---

## 8. RESOLVED DECISIONS (locked for the build PRD)

1. **Matching vector = 21 majors + 6 differentiating minors (27 factors).** Only Confidence leaves
   the majors; the 3 minor universals leave the minors. Collaboration + EI stay at low weight.
2. **Activities are scored on the same 27-factor matching vector as professions** — so Step C
   compares like with like.
3. **One frontend, staged flow.** Interest form + psychometric assessment are stages of the same
   website, shown as a horizontal progress bar. The psychometric assessment is built fresh (was
   Google Forms + Gumloop); the interest form ("Virtual Career Counselling") already exists.
4. **Paywall immediately after signup**, after showing both offerings, before any deliverable.
5. **Mentor tier = V2**, but V1 ships **mentor-as-a-user**: sign-in + onboarding form (§6.4) + a
   student-facing **waitlist** for the ₹7,000 tier. No booking/scheduling/matching in V1.
6. **V1 serves all four journeys** (class 9–10, 11–12, college, early-professional), filtered by the
   taxonomy's `degree_dependency` / `class12_prerequisite` / `mid_stream_entry` fields.

---

## 9. WHAT THE BUILD PRD (document 2) WILL COVER

Now that §8 is locked, the second document specifies:

- **Auth:** email + password + JWT + bcrypt (CODING_STYLE.md pattern); parental-consent OTP for
  under-18; separate mentor sign-in. (Magic-link + Google OAuth = V2.)
- **Authorization / roles:** student · parent · **mentor** · admin.
- **The staged single-frontend flow:** progress-bar state machine across Interest Form →
  Psychometric Assessment → Report → Mentor(waitlist), with a resumable per-stage position.
- **Paywall:** Razorpay gate immediately post-signup, amounts ₹3,500 / ₹7,000 (+ ₹3,500 upgrade),
  before any
  deliverable; ₹7,000 currently resolves to a waitlist entry.
- **DB:** MongoDB Atlas + Atlas Vector Search.
- **Schema set:** users, consent, sessions, profiles (22+9), submissions (interest + psychometric),
  baseline_ratings (separate, versioned), activity_factor_cache (rubric-versioned), recommendations
  (with stored `match_confidence` + version stamps), recommendation_events **and** aggregate
  counters (the under-18 split), **mentors** (the §6.4 onboarding fields, with admin-only currency/
  residence), mentor_waitlist, payments, follow_ups.
- **Routes + controllers** for each.
- **The spine:** BullMQ/Redis queue + the pure, versioned scoring engine with golden fixtures +
  the 6/12-month follow-up cron (ships in the first sprint).
- **LLM/embeddings:** Claude API (rerank, rubric scoring, report generation) + Voyage embeddings;
  the 27-factor matching maths as a pure no-network module.
- **Filters & sorts:** `filter_rules.json` — incl. the user-controlled `ai_exposure` **sort**
  (re-orders, never hides) and the `degree_dependency` / journey filters.
- **Versioning + deployment** on Render.
