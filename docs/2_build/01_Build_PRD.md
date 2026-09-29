# Freshmxn — Build PRD (Full-Stack Implementation Spec)

Companion to `00_Master_Plan_and_Theory.md`. That document is the *what and why*; this is the
*how* — every system, schema, route, integration, and the order to build them. The 5-day execution
plan is Part D at the end.

---

## A. ARCHITECTURE OVERVIEW

### A.1 Stack
**Follows `CODING_STYLE.md` exactly** — the conventions from my previous projects, not generic
defaults. Key bindings:
| Layer | Choice (per CODING_STYLE.md) |
|---|---|
| Frontend | **Create React App** (not Vite), React Router, Redux Toolkit, axios, antd, dayjs (ES modules) |
| Backend | Node + **Express 5, CommonJS**, Mongoose, bcrypt, jsonwebtoken, dotenv, cors |
| Backend layers | **router file → Mongoose model. NO controllers, NO services** — DB work inline in `Routers/` |
| Repo shape | two top-level folders **`Backend/` and `Frontend/`**, each its own `package.json` (not client/server monorepo) |
| Routes | **RPC-style camelCase actions** — `/getAll`, `/add`, `/update/:id`, `/delete/:id`, `/getById/:id` |
| Response | **`{ success, message, data }`** envelope (auth uses `token`/`userData`) |
| Auth | **email + password + JWT (localStorage) + bcrypt** as the base, **PLUS Google OAuth / magic-link AND a forgot-password/reset flow** (the old flow lacked reset — important for a paid product), `req.user` via middleware, + parental-consent OTP |
| State | pragmatic — the logged-in user + the staged-flow progress are the shared state worth centralising; everything else `useState` (the "Redux only holds the user" rule is relaxed, not mandatory) |
| DB | MongoDB Atlas + Atlas Vector Search |
| Queue | BullMQ + Redis (Upstash) |
| LLM | Claude API · Embeddings: Voyage AI |
| Payments | **Razorpay** (India-domestic: UPI + cards + netbanking; Stripe India can't do domestic INR / UPI). Order created server-side, checkout client-side, webhook verified server-side (signature check) — webhook route mounted with raw body before JSON parsing, per the CODING_STYLE.md pattern; routes `/create-order` + `/payment-verification-webhook` |
| Deploy | Render (web + worker + cron) |
| Email | Resend/Postmark |

### A.1a Auth decision
Base pattern is my existing **email + password + JWT + bcrypt** (CODING_STYLE.md), but V1 **adds**
what that old flow lacked: **Google OAuth and/or magic-link**, and — importantly — a
**forgot-password / reset** flow (missing from the old project, and essential for a paid product).
The **parental-consent OTP** layer sits on top of whichever login method is used. So Google Cloud
OAuth setup is back in Day 0.

### A.2 Services (Render processes)
Three processes, but within the **`Backend/` + `Frontend/`** two-folder shape from CODING_STYLE.md
(each its own `package.json`). The `worker` and `cron` are additional Node entry points alongside
`Backend/server.js`, sharing its `model/` and `config/`:
```
web      — Backend/server.js  (Express API) + serves the Frontend build
worker   — BullMQ consumer: scoring engine, LLM calls, embeddings, report gen
cron     — scheduled: 6/12-month follow-ups, admin Baseline_Rating refresh trigger
```
The scoring and matching engines are **pure modules with no network calls** (in `Backend/`,
imported by the worker) — that purity is what lets golden fixtures test them deterministically.
Note this is the one place the app is larger than a CODING_STYLE.md CRUD app: the pure engines and
the queue are new shapes, but they still live under `Backend/` and follow the file-naming and
formatting conventions.

### A.4 Coding style — follow CODING_STYLE.md
**All code in this project follows `CODING_STYLE.md`** (in the repo root): the `Backend/`+`Frontend/`
layout, file naming (`<entity>Router.js`, `<entity>Model.js`, `<entity>Api.js`, PascalCase `.js`
pages), the router→model flow with **no controllers/services**, object-form Mongoose schemas with
`{ timestamps: true }`, RPC-style routes, the `{success, message, data}` envelope, inline
`async (req,res)` handlers each with one `try/catch` returning 500, JWT-in-localStorage auth with
`req.user` via middleware, Redux-holds-only-the-user, `response.data.data` on the frontend, and the
formatting defaults (double quotes, no semicolons, 4-space indent). Where this PRD describes schemas
or routes generically, implement them in **that** style. Schemas below are shown as field lists;
render them as object-form `<entity>Model.js` files. Routes below are RPC actions, not REST.

### A.3 The two logical input domains, one staged frontend
A **public marketing site** sits in front of everything (no auth, no payment): Landing, Success
Stories, and Mentor Waitlist pages — it sells the depth before signup. Then signup and **payment
come first** — most people sign up only to see the offerings, and only a fraction pay, so payment
is the gate that *unlocks* the staged flow rather than a step inside it:
```
Public site (no auth) → Signup → see both offerings → PAY (Razorpay) → [ staged bar unlocks ]

Stage 1  Interest Form ("Virtual Career Counselling", incl. problems list) → submissions.interest
Stage 2  Psychometric Assessment (built fresh)                             → submissions.psychometric
Stage 3  Report / Recommendations                                          → recommendations
Stage 4  Mentor (paid waitlist in V1)                                      → mentor_waitlist
```
**Resumability rule (pre- vs post-report):**
- **Before the report is generated:** the student may edit the interest form (including the problems
  list) and retake any psychometric module that offers a retake. Each stage is resumable.
- **After the report is generated: the report is locked.** No self-serve edits or retakes. A student
  who is unconvinced requests an **admin-triggered** retake — the platform does not let them silently
  re-roll their own results.

---

## B. DATA MODEL (MongoDB collections)

Every recommendation-bearing record carries five version stamps that change on **independent
schedules**, so you always know exactly what differs between two records (you can only pool data
across records sharing a MAJOR version — separate stamps let you still compare records that differ
only on an unrelated axis):

| Stamp | What it pins | Bumps when |
|---|---|---|
| `scoring_version` | the formulas turning raw answers → the 22+9 profile | a scoring formula/DAG changes |
| `norm_set_id` | the population norms for percentiles | **null in V1** (no norms until 500+/age band) |
| `taxonomy_version` | which version of the 223-profession list | a profession is added/removed/merged |
| `baseline_version` | the profession factor scores/weights | the Baseline_Rating pipeline is re-run |
| `matching_version` | the matching algorithm itself | Program 1–3 logic / 80% floor / tier rules change |

### B.1 `users`
```js
{
  _id, role: "student" | "parent" | "mentor" | "admin",
  email, emailVerified, googleId?,
  name, age,
  journey: "class9_10"|"class11_12"|"college"|"early_professional",
  journeyDetail: {                        // the disambiguating answer per journey
    class?: 9|10|11|12,
    stream?: [...subjects],               // class 11-12: the class12_prerequisite subject-set
    collegeStage?: "pre_admission"|"enrolled",
    preAdmission?: bool,                   // just-passed-12 → college journey, waste=0
    courseYear?: 1|2|3|4,                  // enrolled college students
    experienceYears?: Number               // early professionals
  },
  preferredLanguage: "en"|"hi",           // collected from day 1 (V2 Hindi trigger)
  parentUserId?,                          // for under-18 linkage
  createdAt, lastLoginAt,
  paid: bool,                             // the gate that unlocks the staged flow
  currentTier: 0|1|2,                     // 0=none, 1=Career Discovery, 2=Mentorship; toggles on upgrade/downgrade
  progress: {                             // only meaningful once paid = true
    interestForm: "not_started"|"in_progress"|"done",
    psychometric: "not_started"|"in_progress"|"done",
    report:       "locked"|"ready"|"locked_final",  // locked_final = generated, no self-serve retake
    mentor:       "not_applicable"|"waitlisted"
  }
}
```

### B.2 `consent`  (DPDP — mandatory before any under-18 processing)
```js
{
  _id, userId, isMinor: bool,
  parentName, parentEmail, parentPhone,
  consentGivenAt, consentMethod: "otp",
  otpVerifiedAt, ipAtConsent, policyVersion
}
```

### B.3 `submissions`
```js
{
  _id, userId, sessionId,
  interest: {                              // from the React interest form
    activities: [ { name, reason, persistent, longPursuit,
                    ongoingOnOff, passion, proud, confidence } ],
    problems: [...], generalInfo: {...}
  },
  psychometric: {                          // from the fresh assessment app
    ipip50: {...}, mi: {...}, reasoning: {...}, digitSpan: {...},
    storyRecall: {...}, sartRaw: "<tsv>", perspective: {...}, rosenberg: {...}
  },
  submittedAt
}
```

### B.4 `profiles`  (output of the scoring engine — the Part 1 contract)
```js
{
  _id, userId, sessionId,
  scoring_version: "perspective@5.0.0", norm_set_id: null, computed_at,
  raw_scores:    { /* 22 majors + 9 minors, 0–10 or null */ },
  normed_scores: { /* raw → percentiles vs population. EMPTY in V1 (needs 500+/age band) */ },
  bands:         { /* Low → High labels; also norm-dependent, minimal in V1 */ },
  data_quality:  { /* "full"|"partial"|null per factor = HOW MUCH INPUT was available.
                      NOT the Confidence factor. Never shown to a student as "confidence" */ },
  flags:         { /* validity + quality flags */ },
  banks:         { belief_bank, emotion_bank, clm, self_awareness_bank },
  values_profile:{ /* per area: importance − fulfilment. Largest gap = what pulls the student.
                      Never summed, never mixed into a factor. Part 2 input ("the why") */ },
  completeness   // matching-vector factors with a valid score ÷ total. Drives release rule:
                 // 100% release · 75–99% release-with-note · <75% withhold + prompt completion
}
```

### B.5 `baseline_ratings`  (profession side — separate lifecycle, keyed on profession.id)
```js
{
  _id, professionId, version, generatedAt, review_status,
  factors: { /* the 27-factor matching set, 0–10 */ },
  weights: { /* per-factor relevance 0–1 */ },
  drivingReasons: [ /* 1–3 of the 7 fixed categories */ ],
  embedding: [ /* Voyage vector */ ],
  sample_variance: {}
}
```
Taxonomy (the 223-profession file) stays its own collection `professions`; joined by `professionId`.

### B.6 `activity_factor_cache`
```js
{ _id, canonicalActivity, exampleRaw, factors:{...27}, embedding:[...],
  rubricVersion, lastUpdated }
```

### B.6a `access_requests`  (manual payment mode)
```js
{
  _id, userId, requestedTier: 1|2,        // 2 from an upgrade request too
  isUpgrade: bool,                          // true → amount is the ₹3,000 difference (6,500 − 3,500), not the full 6,500
  coupon?, discountPct?, finalAmountInr,   // captured from the user's request form
  name, phone, callbackTime,
  status: "pending"|"granted"|"declined",
  handledByAdminId?, handledAt?, createdAt
}
```

### B.7 `recommendations`
```js
{
  _id, userId, sessionId, generatedAt,
  scoring_version, norm_set_id, taxonomy_version, baseline_version, matching_version,
  ranked_professions: [
    { professionId, tier, matchScore, comfortScore,
      match_confidence,                 // COMPUTED + STORED, never displayed in V1
      components: {...} }
  ],
  readiness_layer: { confidence, consistency_grit, learning_capacity, idm },
  values_profile: {...}
}
```

### B.8 `recommendation_events`  +  `recommendation_counters`  (the DPDP minor split)
When a student views/expands/saves/dismisses a profession in the report, we log it to answer "which
professions does nobody ever open?" But DPDP restricts individual behavioural tracking of under-18s,
so the storage differs by age — adults get a per-user trail, minors get aggregate counts with no
user link. Same product question answered, without building a per-child behavioural trail.
```js
// adult (18+): per-user trail
recommendation_events   { userId, professionId, eventType, dwellMs, at }
// minor (<18): aggregate only, NO user link
recommendation_counters { professionId, eventType, count }
```
Used to DETECT problems (a never-expanded profession is probably badly described) — never as a
matching signal. Optimise on 6-month outcomes, never on these events.

### B.9 `mentors`  (V1 onboarding — no booking machinery)
```js
{
  _id, userId, name, email, phone,
  currentRole, discipline, sectors: [...], yearsExperience,
  languages: [...], motivation,                  // open text
  transitionCategory: "A"|"B"|"C"|"D",           // same decision-style vocab as students
  preferredCurrency,   // ADMIN-ONLY, never student-visible
  residenceCitizenship,// ADMIN-ONLY, never student-visible
  status: "onboarded"|"pending_review", createdAt
}
```

### B.10 `mentor_waitlist`, `payments`, `follow_ups`
```js
mentor_waitlist {
  userId, paidAt,                       // place held on payment (mentor tier)
  chosenProfessionId?,                  // set when student completes Step 1 + chooses
  choiceSentAt?,                        // 15-business-day match clock starts HERE, not at paidAt
  matchStatus: "awaiting_choice"|"matching"|"matched"|"unmatchable",
  assignedMentorUserId?, matchedAt?,    // admin sets these manually in V1
  resolution?: "matched"|"rolled_over"|"refunded"  // if unmatchable: rollover default, refund on request
}
payments  { userId, mode: "manual"|"razorpay",
            razorpayOrderId?, razorpayPaymentId?,   // razorpay mode only
            tier: 1|2, action: "purchase"|"upgrade"|"refund"|"rollover",
            coupon?, discountPct?, amountInr, status, paidAt, grantedByAdminId? }
follow_ups{ userId, dueAt, type: "6_month"|"12_month",
            status: "scheduled"|"sent"|"answered", chosen_path?, answeredAt? }
```

---

## C. THE SUBSYSTEMS

### C.1 Auth & authorization
- **Student/parent:** email + password + JWT (localStorage) + bcrypt — the CODING_STYLE.md auth
  pattern (`req.user` set by `authMiddleware`), **plus Google OAuth / magic-link and a
  forgot-password/reset flow** (the old project lacked reset — essential for a paid product). No
  phone OTP.
- **Under-18 gate:** if `age < 18`, block all processing until `consent` exists — parent OTP,
  one-per-account, rate-limited.
- **Mentor:** separate login page, same auth stack (email+password / OAuth), `role: "mentor"`.
- **Admin:** seeded manually; guards the review dashboards and Baseline_Rating refresh.
- **Middleware:** `requireAuth`, `requireRole`, `requirePaid`, `requireConsentIfMinor`.

### C.2 Paywall — dual mode (Manual now, Razorpay later)

**A single `PAYMENT_MODE` env flag (`manual` | `razorpay`) switches the active payment path. Both
are fully built; both call the same internal `grantAccess(userId, tier, amount, coupon)` function —
so the admin's manual grant and the verified Razorpay webhook are just two callers of one seam, and
switching launch→live is flipping the flag with zero rework.**

**Launch default = `manual`** (Razorpay KYC needs a bank account not yet available). Razorpay is
built and test-mode-wired now, dormant until KYC clears.

**Tiers are stored as a single current-tier field per user that toggles:**
- `currentTier: 1` — bought Career Discovery (₹3,500)
- `currentTier: 2` — upgraded to Mentorship
- Toggles **1→2** on upgrade, **2→1** on admin downgrade/refund.
`payments` + `access_requests` keep the **full transaction history** (nothing is lost when the tier
toggles) — `currentTier` is just "where they are now."

**Manual mode flow:**
1. Non-admin user at the paywall picks **Tier 1 or Tier 2** + optionally enters a **coupon** → sees
   the computed final amount → submits a **request-access form** (name, phone, callback time). This
   writes an `access_requests` record capturing **tier (1|2), coupon, discount %, final amount**.
2. Admin sees it on the dashboard, collects payment offline (personal UPI/account), clicks **Grant
   access** → calls `grantAccess()` → sets `currentTier`, `paid = true`, writes a `payments` row,
   unlocks the staged flow.

**The upgrade moment (Tier 1 → Tier 2):** when a Tier-1 user completes the service, the report page
shows **their filled profile + recommended professions + a "Choose Tier 2 (Mentorship)" option** for
those recommendations. Choosing it submits a **new access-request for the ₹3,000 difference** (not
the full ₹6,500). Admin grants → toggles `currentTier: 2` → drops them into the mentor waitlist flow.

**Downgrade / refund (Tier 2 → Tier 1):** **admin-only.** The user requests it; the admin toggles
`currentTier` back to 1 and records the refund/rollover on `payments` (per the rollover-first policy).

**Razorpay mode flow (built now, active post-KYC):** create Order server-side for the amount →
Razorpay Checkout client-side (UPI/cards/netbanking) → verify signature on
`/payment-verification-webhook` → `grantAccess()`. Same tier/coupon/amount capture as manual mode.
**Never trust a client-side success callback — verify the webhook signature.**

Nothing in Stage 1–4 renders until a `requirePaid` middleware passes (true regardless of which mode
granted access).

### C.3 The scoring engine (pure module — the spine)
- One function: all inputs → `{ 22 majors + 9 minors }` + `data_quality` + `flags`.
- Sub-scorers: reuse `perspective_scoring_final.js` and `sart_scoring.js` as-is; write the missing
  IPIP-50, MI (35×7), reasoning, digit-span, story-recall scorers to their specs.
- **Strict DAG order** (banks → EI → firmness → idm; clm+sart → focus; …). No circular derivation;
  every input appears once; confidence propagates.
- **Validity gates run first.** Invalid module → factor null → admin_review, never imputed.
- **20 golden fixtures**: known input → known output, run in CI. Any drift fails the build.
- Stamped with `scoring_version`; a formula change is a **recompute**, not a retake.

### C.4 The matching engine (pure module, 27-factor)
- Reads the student's **matching-vector** (21 majors + 6 differentiating minors) — universals
  excluded.
- Program 1 → LP/P lists + dominant reasons. Program 2 → candidates (Voyage + LLM rerank),
  activity factors (rubric + cache), weighted match ≥80% floor. Program 3 → comfort match with
  **null-renormalisation (never impute)** → 16-tier sort.
- `match_confidence` computed + stored per profession, **never displayed, never an input**.
- `ai_exposure` is a **sort** option, never a filter, never in the maths.
- **Journey-aware (per master plan §5.5).** The engine reads `user.journey` + `journeyDetail` and
  applies the DECISIONS.md machinery: waste/τ discounting, journey-scaled AI-exposure weight,
  `class12_prerequisite` hard-filter (11–12), `preAdmission`→waste=0 (college), and shapes the
  **report output per journey** (9–10 stream-inversion + career detail; 11–12 reachable+years;
  college two-list + after_undergrad; early-professional waste-discounted + switch paths).

### C.5 LLM & embeddings (worker only)
- Claude API: Step A rerank, Step B rubric scoring, Step 4 report generation. Temperature 0 for
  scoring. Student text is delimited data, never instructions.
- Voyage: **model = `voyage-4-large` (LOCKED — the professions were already embedded with it, and
  all vectors MUST use the same model to be comparable; the API key can differ, the model cannot).**
  One-time 223-profession index (`document`); runtime activity embeds (`query`); cache
  dedup ≥0.9. Stored in Atlas Vector Search.

### C.6 The queue (BullMQ)
Jobs: `score_profile`, `embed_activities`, `match_professions`, `generate_report`,
`send_followup`. Each retryable/resumable — a failure at report-gen never re-runs scoring.

### C.7 Follow-up cron + admin refresh (V1) — mentor-fed refresh (V2)
**Follow-up cron ships in V1 (Sprint 1, non-negotiable).** Scheduled job + email template. Writes
`follow_ups` at report time (due +6m, +12m); cron sends; captures `chosen_path`. Trivial to build,
produces nothing for 6 months — which is exactly why it cannot be postponed.

**Baseline_Rating refresh — two kinds, only one is possible in V1:**
- **Admin-triggered refresh (V1 ✓):** you re-run the Baseline_Rating pipeline when you improve a
  rubric or catch an error; diff vs previous version, small changes auto-accept, large jumps to
  admin review. This needs no external data and works from day one.
- **Mentor-fed refresh (V2):** re-scoring factors using mentor-override data. Deferred not because
  it's hard but because it has **no fuel in V1** — there are no mentors taking sessions yet (mentor
  tier is waitlist-only). It switches on once V2 has mentor session/override data to learn from.

### C.8 Report generation
Claude composes the student-facing report from the profile + recommendations + readiness layer +
values profile. Never displays `match_confidence` or `data_quality`. Uncertainty Tolerance framed
as a position, not a level. Citations from `03` must be verified before any appear publicly.

---

## D. THE 5-DAY EXECUTION PLAN

### D.0 Honest scope note — read this first
Five days is enough to build a **testable end-to-end system on test data** — signup → pay (Razorpay
test mode, coupons working) → staged flow → assessment → scored profile → 27-factor match → tiered
report, plus mentor onboarding and the follow-up cron. It is **not** automatically safe to take
**real payments or real minors' data** on day 5, because **one** thing is external to code and must
clear first:
- **DPDP parental-consent + minor-tracking legal sign-off** (a lawyer's hour). *(Citation
  verification is already done — you validated `03` — so it is no longer a gate.)*
So: build and test in 5 days; complete Razorpay KYC activation and switch to live keys, then open to
real students once the legal sign-off clears. The plan below targets a working, self-tested product;
the one remaining gate is called out on Day 5.

### D.1 What happens where — legend
- 🟦 **Claude Code** (your repo — code, schemas, scoring, matching, integrations)
- 🟩 **Here** (this chat — design decisions, prompt drafting, PRD/spec edits, debugging logic)
- 🟧 **External dashboard** (you, in a browser — accounts & keys)
- 🟥 **Human/legal** (not code)

---

### DAY 0 (a few hours the night before) — accounts & keys 🟧
Do these first so Day 1 isn't blocked. All are dashboard sign-ups.
1. 🟧 MongoDB Atlas — create an **M0 (free)** cluster, get the connection string. M0 supports Atlas
   Vector Search at your scale (223 professions + a small activity cache) — **no paid tier needed**;
   the Day-3 vector index is created on this same free cluster. Upgrade only if real traffic later
   demands it (a one-click tier bump, no migration).
2. 🟧 Upstash — create Redis, get URL/token.
3. 🟧 Voyage AI — sign up, get API key.
4. 🟧 Anthropic — API key (separate from this chat).
5. 🟧 Razorpay — sign up, get **Test Mode** keys (Key ID + Key Secret). **Stop at KYC** — it needs a
   bank account (a Pvt Ltd current account, being arranged); build on test mode meanwhile. Razorpay
   is built now but **dormant**; launch runs in `manual` payment mode (see C.2). Skip RazorpayX
   (it's a payroll/banking product you don't need). Env: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`.
6. 🟧 Google Cloud — OAuth client ID/secret (consent screen + redirect URIs), since V1 includes
   Google login. Gotcha: redirect URIs must match exactly (localhost port + Render URL later).
7. 🟧 Resend/Postmark — API key + verified sender domain.
8. 🟧 Render — connect the repo (3 services: web, worker, cron).
9. 🟧 Put every key in `.env` (and Render env vars). **Never commit `.env`.** Use the
   CODING_STYLE.md env names where they exist: `DB_URI` (Mongo), `FRONTEND_URL`, `PORT`; plus
   `REDIS_URL`, `VOYAGE_API_KEY`, `ANTHROPIC_API_KEY`, `RAZORPAY_KEY_ID`,
   `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `PAYMENT_MODE` (=`manual` at launch),
   `RESEND_API_KEY`,
   `JWT_SECRET`. A `.env.example` lives in each of `Backend/` and `Frontend/`.

---

### DAY 1 — Backend skeleton, auth, DB, paywall
- 🟦 **First: place `CODING_STYLE.md` in the repo root** and have Claude Code read it — all Day
  1–5 code follows it. Combine the two old folders into this repo (interest form → a Frontend page;
  `Professions/` → `Backend/` data), reading from `../virtual-career-counselling/` and
  `../Professions/`, writing only into the new repo.
- 🟦 Scaffold the **`Backend/` + `Frontend/`** two-folder shape (CRA frontend, Express 5 CommonJS
  backend), plus the `worker`/`cron` entry points under `Backend/`. `dotenv` + `config/MongoDBCon.js`.
- 🟦 Connect MongoDB Atlas; write the §B collections as object-form `<entity>Model.js` files.
- 🟦 Build auth: email+password+JWT+bcrypt base (CODING_STYLE.md), **plus Google OAuth / magic-link
  and a forgot-password/reset flow**, `authMiddleware`→`req.user`, role middlewares
  (`adminAuthMiddleware`, mentor guard); `{success, message, data}` envelope.
- 🟦 Build the **consent** flow (parent OTP) + a `requireConsentIfMinor` middleware.
- 🟦 Build the **dual payment system** (C.2): the `grantAccess()` seam; **manual mode** (request-access
  form capturing tier 1|2 + coupon + final amount → `access_requests` → admin Grant action) as the
  active default; **Razorpay mode** (`/create-order` + `/payment-verification-webhook`, signature
  verified, webhook raw-body before JSON) built but dormant behind `PAYMENT_MODE`. Both call
  `grantAccess()` → set `currentTier`, `paid`, write `payments`.
- 🟩 **Here:** review the schema set against §B before you code models; catch anything missing.
- 🟧 (Razorpay webhook testing deferred — dormant at launch; test it when KYC clears via ngrok +
  Razorpay test webhooks.)
- ✅ **End-of-day check:** in **manual mode** — a user signs up, (minor →) consents, picks Tier 1/2
  + a coupon on the request form, submits; admin sees it, clicks Grant; `paid`+`currentTier` set and
  the staged bar unlocks. (Also confirm Razorpay test-mode order creation works in isolation.)

---

### DAY 2 — The scoring engine + golden fixtures (the spine)
**Attach for this day:** `00_Research_Summary_FROZEN.md`, `perspective_scoring_final.js`,
`sart_scoring.js`, `llm_scoring_prompts.md`, `04_Item_Bank.md`, `05_Story_Bank.md`, plus the
Day 1 handover (`02_Day1_Handover.md`) so it knows the house style and the `Submission` model.

- 🟦 Port `perspective_scoring_final.js` and `sart_scoring.js` into `Backend/` **unchanged** (they're
  tested). Follow CODING_STYLE.md for anything new around them.
- 🟦 Write the missing sub-scorers: IPIP-50, MI (35×7), reasoning, digit-span, story-recall — to
  their specs in the frozen research.
- 🟦 Assemble the single **pure module** (no network calls): inputs → 22 majors + 9 minors +
  `data_quality` + `flags`, strict DAG order, validity gates first, **nulls never imputed**. Reads
  its inputs from `Submission.psychometric` (Mixed field — write with `findOneAndUpdate`+`$set`).
- 🟦 Write **~20 golden fixtures** (known input → known output) and wire them into the test suite,
  matching the Day-1 testing discipline (automated checks against real Atlas, test data deleted
  after). This is the non-negotiable safety net.
- 🟩 **Here:** draft/adjust the 4 LLM open-item scoring prompts (P7/P22/P13/P33) at temperature 0;
  debug any DAG-order or null-propagation question.
- ⚠️ **Note the dependency:** the scoring engine consumes `Submission.psychometric`, but the
  **psychometric assessment UI that produces it doesn't exist yet** (it's Day 4). So Day 2 tests the
  engine against hand-built fixture submissions, not live form data — that's expected and fine.
- ✅ **End-of-day check:** feed a known fixture submission → correct 22+9 profile out; all fixtures
  green; invalid-session fixtures correctly null their factors rather than imputing.

---

### DAY 3 — Factor migration + Baseline_Rating + matching engine
**Attach for this day:** the `Backend/data/` files (`ALL-professions.json`/professions,
`baseline_rating.json`, `psychometric_factors.json`, `factor_anchors.json`, `DECISIONS.md`,
`entrance_gates.json`, `verified_facts.json`), plus the Day 1 handover.

- ⚠️ **FIRST, the migration checkpoint (§9.2 of the handover — user-requested STOP):**
  `baseline_rating.json` is currently the **OLD 19-factor** set. Before any scoring:
  1. Update `psychometric_factors.json` 19 → **27** (the matching vector).
  2. Add `factor_anchors.json` anchors for the **8 new factors**.
  3. **STOP and have the user review those 8 anchors before running the scoring pass.** This is an
     explicit checkpoint he asked for — do not auto-proceed.
- 🟦 After anchor sign-off: run the **Baseline_Rating pipeline** to regenerate `factors/weights/
  drivingReasons` for all **223 professions** (handover §9.1 — it's 223, not 218) against the
  27-factor vector — multi-sample, variance flags, `review_status: unreviewed`, routed through the
  admin-review discipline.
- 🟦 **Voyage embeddings: reuse the existing 223 × 1024 `voyage-4-large` vectors** — regenerating the
  factors does NOT invalidate them (they embed profession *text*, not factors). Only build the
  runtime activity-embed path (`input_type: "query"`) + the activity-factor cache + LLM rerank node.
  Store/query via Atlas Vector Search.
- 🟦 Build the **matching engine** (pure module): Programs 1–3, journey-aware (waste/τ, AI-weight,
  `class12_prerequisite` filter, `preAdmission`), ≥80% floor, null-renormalisation, `match_confidence`
  stored-never-shown-never-an-input, 16-tier sort, `ai_exposure` as sort.
- 🟦 **Consume the aspiration bias signal (handover §9.4):** the interest form already stores each
  aspirational profession as a `persistentInterests` row (`confidence: "Medium"`,
  `source: "aspiration"`), separate from evidenced activities. Program 1 must read stated career
  preference *separately* from evidenced activities. Keep unmatched aspirations (`professionId: null`)
  — don't discard.
- 🟩 **Here:** review the 8 new-factor anchors (the checkpoint above); sanity-check a few
  activity→profession matches to calibrate the 80% floor.
- ✅ **End-of-day check:** a fixture profile + a real interest submission → a 16-tier ranked list,
  journey-shaped, with stored `match_confidence`.

---

### DAY 4 — Psychometric assessment UI + pipeline + report
**Already built in Day 1 (do NOT rebuild):** the staged progress bar exists via `progress{}`, the
admin dashboard (5 tabs), mentor-adjacent flows, and the interest form (Stage 1). Day 4 adds the
*missing* stages and the pipeline that connects everything.

- 🟦 Build the **psychometric assessment UI** (Stage 2 — the big new frontend piece, replaces Google
  Forms): each module (IPIP-50, MI, reasoning, digit-span, story-recall two-clock flow, SART, the
  perspective block, Rosenberg), writing answers to `Submission.psychometric` via
  `findOneAndUpdate`+`$set`. `progress.psychometric` goes not_started→in_progress→done.
- 🟦 Wire the **BullMQ jobs** (score → embed activities → match → generate report) so completing
  Stage 2 triggers the pipeline. Each job retryable/resumable (a report-gen failure never re-runs
  scoring). Uses `REDIS_URL`.
- 🟦 Build **report generation** (Claude) + the report page (Stage 3): journey-shaped output,
  readiness layer, values profile; **never show `match_confidence`/`data_quality`**; Uncertainty
  Tolerance framed as a position not a level. The Tier-1 upgrade CTA on the report page already has
  its payment plumbing from Day 1 — just surface it here for their recommended professions.
- 🟦 Build the **follow-up cron** (6/12-month): scheduled job + email (Resend) writing `follow_ups`
  at report time. **Ships now** — it produces nothing for 6 months, which is exactly why it can't be
  postponed.
- 🟩 **Here:** draft the report-generation prompt (safety-sensitive — minors); draft the follow-up
  email copy; help shape the assessment UI's module-by-module flow if needed.
- ✅ **End-of-day check:** full click-through — signup → pay(manual/test) → interest form → **new**
  psychometric assessment → pipeline runs → report renders correctly per journey; Tier-1 upgrade CTA
  shows on the report.

---

### DAY 5 — Public site + mentor onboarding + integrate + deploy
**Still to build (not done in Day 1):** the public marketing site and the mentor-facing UI. Plus
integration testing and deploy.

- 🟦 Build the **public marketing site** (no auth): Landing, Success Stories (two illustrative result
  cards), Mentor Waitlist pages — content ready in `landing_page_content_v3.md` (the finalised copy),
  `success_stories_page.md`, `mentor_waitlist_page.md`; verified stats only; WhatsApp/call/email
  wired.
- 🟦 **Apply the finalised visual design (PRD §E.1):** Kira-style light-mode layout, Orelega One +
  Lato, teal-navy palette with pink as a rare highlight only. This is the one visual pass — the rest
  of the app (staged flow, assessment, report, admin) also gets styled to these tokens now that
  functionality is proven.
- 🟦 Build **mentor sign-in + onboarding form** (12 fields, currency/residence admin-only) and the
  **student-facing paid mentor waitlist**: request/pay → hold place → student completes Tier 1 +
  chooses a career → admin matches within 15 business days (manual in V1). Uses the existing
  `mentorAuthMiddleware`.
- 🟦 Deploy the **3 Render processes** (web + worker + cron); move env vars over; add the Render URL
  to Google OAuth's authorized redirect URIs and the Razorpay/Resend configs; smoke-test in cloud.
- 🟦 End-to-end test across the **4 journeys** with seeded profiles; verify tiers, nulls, version
  stamps, the under-18 aggregate-counter split, the readiness layer, the manual grant flow.
- 🟩 **Here:** work through any failing behaviour; final logic review.
- 🟥 **Before real students / real money — gates go-live, not the build:**
  - Lawyer's hour on **DPDP parental consent + minor behavioural-tracking** (V1 is a self-declared
    checkbox — handover §10.5; verified-OTP flow is V2).
  - **Launch in `manual` payment mode** (no KYC needed). Complete Razorpay KYC (needs the Pvt Ltd
    bank account) → flip `PAYMENT_MODE=razorpay` + live keys whenever it clears — zero rework.
  - `problemPrompts.js` human read-through (handover §10.1 — 132 prompts, some sensitive).
  - Resolve pre-verification legacy accounts (handover §10.2).
  *(Citation verification already done — not a gate.)*
- ✅ **End-of-state:** deployed, self-tested on manual-mode test data, public site live, mentor
  onboarding open — legal sign-off + KYC the only remaining go-live gates.

---

## E. WHAT'S EXPLICITLY NOT IN THESE 5 DAYS (V2)
- **Mentor tier automation:** booking, scheduling, session delivery, payouts, mentor↔student
  matching (V1 is manual admin matching within 15 business days).
- **The mentor-override → Baseline_Rating refresh loop** (needs mentor session data that only exists
  once the mentor tier is live).
- **Verified parental-consent OTP flow** — V1 is a self-declared checkbox with parent name + mobile,
  and `Consent.isTemporary: true` on every row so V2 can find everyone to re-consent (handover §4).
- **`match_confidence` display** (computed + stored in V1, shown only after Stage-4b validation).
- **Norms / percentiles** (needs 500+ responses per age band), **RIASEC interests**, **adaptive item
  selection**, **fitted weights** (need outcome data), **Hindi**, **mental-rotation** real spatial
  ability. All detailed in `06_V2_and_Beyond.md`.
- **Redis-backed rate limiting** (only needed once running >1 server instance).
- **The final visual design pass** (Orelega One + Lato + colour tokens + inspiration site) — applied
  after all functionality, per §E.1.
None of these block the V1 build.

## E.1 DESIGN DIRECTION (finalised — applied in the Day 5 visual pass)
Build functionality first with minimal styling; apply this in the Day 5 design pass.

**Reference & feel:** structure and energy of the **Kira** education site (bright, playful,
product-forward, the strikethrough "you don't need X, you need a system" beat, 4-card how-it-works),
borrowing only *warmth* (soft edges, gentle gradients) from the Cofounder pixel-art reference — NOT
its atmospheric/muted style. Playful but trustworthy: students AND parents read this.

**Base = LIGHT mode.** Off-white/near-white page background, navy ink, teal accents. Navy is the
ink, not the canvas.

**Typography:** Orelega One (H1/H2/H3 — display personality), Lato (H4–H6, body, links — readability).

**Colours (from TypographyAndColor.docx):**
- Primary `#1E2A38` (deep navy) — headings/text on the light background, NOT the page background
- Accent `#007582` (teal) — THE star colour: every CTA, link, highlight
- Secondary `#BEBEBE`, Text `#D1D1D1` — muted text / text on any dark section only
- **Pink `#FFB3C7`** (soft pastel) — a single Kira-style highlighter accent, ~5% usage, ONE key
  phrase per section max; used as a swipe/underline BEHIND navy text (never as text colour — too
  low-contrast on white); never a structural or co-lead colour. Teal stays the star.

**Content:** use `landing_page_content_v3.md` (the finalised copy) for the public landing page —
Kira-style section rhythm, verified stats only, the "your marks never get a veto" framing.

## F. THE FIVE THINGS THAT MUST NOT DRIFT (carried into every file)
1. Universals excluded from matching. 2. Interests lead, fundamentals follow. 3. Nulls shrink the
lens, never impute. 4. Uncertainty Tolerance is a position, not a level. 5. Optimise on 6-month
outcomes, never clicks.
