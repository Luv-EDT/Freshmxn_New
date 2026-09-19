# Freshmxn — Day 1 Handover

**Written for:** the next Claude session picking up this project (Day 2 onwards).
**Date:** 2026-09-19. **State:** Day 1 built, tested and working end to end. Nothing committed to git yet.

Read `00_Master_Plan_and_Theory.md`, `01_Build_PRD.md` and `CODING_STYLE.md` first. This document
records what actually exists and the decisions behind it, so you don't have to rediscover them.

---

## 1. What this is

A psychometric career-guidance platform for Indian students. A student pays for one of two tiers,
fills a long interest questionnaire, later takes a psychometric assessment, and receives a
profession recommendation report. Tier 2 adds a human mentor.

**Only Stage 1 (the interest form) exists.** The psychometric assessment, scoring engine, matching
engine and report are Days 2–4 and are not built.

## 2. Architecture and house style

Two folders, no build tooling beyond CRA:

```
freshmxn/
├── Backend/     Express 5, CommonJS, Mongoose → MongoDB Atlas
└── Frontend/    Create React App, Redux Toolkit, antd, axios
```

`CODING_STYLE.md` governs everything and has been followed strictly:
- **Router → Mongoose model directly.** No controllers, no services, no utils folders. Shared logic
  lives as module-level `const`s at the top of the router that uses it.
- Object-form schemas with `{ timestamps: true }`; allowed values in trailing comments, enforced in
  handlers.
- RPC-style camelCase routes (`/getAllForAdmin`, `/grantForAdmin/:id`).
- Every response is `{ success, message, data }`.
- Inline `async (req, res)` handlers, one try/catch each.
- Double quotes, no semicolons, 4-space indent.

**Two sibling repos are read-only sources, never edited:** `../virtual-career-counselling/` (the
original Vite interest form, ported from) and `../Professions/` (the 223-profession taxonomy,
copied into `Backend/data/`).

## 3. The single most important invariant

**All money flows through `grantAccess` in `Backend/Routers/paymentsRouter.js`.** It is the only
function permitted to set `paid: true` / `currentTier`. The entire `/payments` router is mounted
**before** `express.json()` in `server.js` (the Razorpay webhook needs the raw body for its HMAC
check), and every JSON route inside it adds `express.json()` back per-route.

> Express 5 trap: `req.body` is `undefined` when no parser ran. Forgetting `express.json()` on a
> `/payments` POST gives you `Cannot destructure property … of req.body` as a 500.

**The browser never names a price or a refund amount.** Every money route recomputes server-side
and ignores any amount in the body.

## 4. Data model — 10 collections

| Model | Holds | Key points |
|---|---|---|
| `User` | identity + account + payment state **only** | `paid`, `currentTier`, `progress{interestForm, psychometric, report, mentor}`, `phone`. **No form answers ever.** |
| `Submission` | every form answer | one per student. `interest` and `psychometric` are Mixed — **always write with `findOneAndUpdate` + `$set`**, never `.push()` + `.save()`. `minimize: false`. |
| `Consent` | the temporary V1 parental checkbox | `isTemporary: true` on every row, so V2 can find everyone to re-consent |
| `PasswordReset` | reset tokens | only the sha256 hash is stored; TTL index |
| `EmailVerification` | signup confirmation tokens | same shape; 24h TTL |
| `AccessRequest` | manual-mode "I want to buy" | `callbackDay` + `callbackSlot` |
| `RefundRequest` | refunds and rollbacks | `refundType: full \| rollover`, `initiatedBy: student \| admin` |
| `FinancialAidRequest` | subsidised-rate requests | `approvedAmountInr`, `usedAt` |
| `Payment` | the full money ledger | nothing is ever overwritten. `action: purchase \| upgrade \| refund`, `status: paid \| refund_pending \| refunded \| failed \| reversed` |
| `Coupon` | discount codes | `timesUsed` / `usageLimit` |

## 5. Pricing and the money flows

- **Tier 1** ₹3,500 (Career Discovery). **Tier 2** ₹6,500 (Mentorship). Upgrade = the ₹3,000
  difference. Defined once in `TIER_PRICE_INR` in `paymentsRouter.js` — **never in env**, because a
  missing variable must never mean a ₹0 charge. The frontend hardcodes no prices at all.
- **Two payment modes, one `.env` switch** (`PAYMENT_MODE=manual|razorpay`):
  - *manual*: student requests access → admin collects money offline → admin clicks Grant.
  - *razorpay*: Razorpay checkout → the signed webhook (never the browser callback) → `grantAccess`.
- **Refunds.** Tier 2 students choose **rollover** (get the Tier-2 differential back, keep Tier 1) or
  **full**; Tier 1 gets full only. Gated until all three Tier-1 steps are done. In Razorpay mode the
  refund API is called immediately and `refund.processed` / `refund.failed` webhooks settle it.
- **Admin downgrade** (Tier 2 → 1) writes a `RefundRequest` with `initiatedBy: "admin"` so it appears
  in the refund UI rather than existing only as an invisible payment row.
- **Overturn** undoes a grant given when the money never arrived: access revoked, payment row
  `reversed`, request back to `pending`, coupon use and financial aid handed back. **Not a refund** —
  no money row is written.
- **Financial aid.** Student requests a call; admin approves a rupee figure; `calculateQuote` then
  returns that figure for that tier, so it works unchanged in both payment modes. `usedAt` stops it
  being spent twice.

> **Critical guard:** `getRefundableBalance` returns **0** unless the payment's own `status === "paid"`.
> Without it a `reversed` row would count as refundable and the business would pay back money it
> never received. Every refund path funnels through this one function — keep it that way.

## 6. Auth

- Email + password + JWT in localStorage, bcrypt(10), 7-day tokens. Login rate-limited to 10 failed
  attempts / 15 min per IP; `app.set("trust proxy", 1)` so a proxy can't lock out every student.
- **Google OAuth** as a server-side redirect flow (no passport, no sessions), CSRF-protected with a
  short-lived signed JWT as `state`. Google accounts are `isEmailVerified: true` automatically.
- **Forgot password** — hashed token, 30-min expiry, one constant response whether or not the email
  exists (so the box can't be used to discover who has an account).
- **Email verification blocks *paying*, not browsing.** `requestAccess`, `create-order` and
  `requestFinancialAid` return 403 until confirmed. This is the fix for students signing up with an
  address that doesn't exist and then being unable to reset their password.
- Middlewares: `authMiddleware` → `req.user`, `adminAuthMiddleware`, `mentorAuthMiddleware`,
  `requirePaid`. Chain is always auth → requirePaid.

## 7. The interest form (Stage 1)

Ported from `../virtual-career-counselling/`, Tailwind stripped, structure and field names preserved
because `interest.extractedActivities` / `extractedProblems` are Program 1's input on Day 3.

**Steps, computed from the student's journey** (a Class 9 student never sees College):
`intro → [post-college] → [college] → high-school → pre-high-school → current-interests →
challenges → background → aspirations → done`

- **Autosave to the server on every section change** plus a **Save** button on each page. There is no
  submit page: the last section's **Finish** marks it complete and lands on a thank-you page.
  `progress.interestForm` goes `not_started → in_progress → done`.
- localStorage (`freshmxnInterestForm_<userId>`) is kept as a crash buffer, written *before* the
  network call; on load the newer of server vs local wins.
- **Challenges is one page**: the persistent checklist (derived from the life-stage answers) first,
  then "anything else right now?".
- **Aspirations** autocompletes against the 223-profession taxonomy and stores
  `{ professionText, professionId }` — `professionId` is `null` when nothing matched, and the raw
  text is always kept either way (see §9).
- `problemPrompts.js` holds 132 click-to-add prompt suggestions, 11 per problem type per life stage.

> **The 7 life-stage group keys** (`personalGrowth`, `curiosityDriven`, `socialRecognition`,
> `effortlessEngagement`, `individualInternalProblems`, `interpersonalInternalProblems`,
> `externalProblems`) are exactly `driving_reasons_vocabulary` in `baseline_rating.json`. **Do not
> rename them.**

## 8. Admin

One page, five antd tabs: Access Requests, Refund Requests, Financial Aid, Students, Coupons.

- **One shared `dataVersion` counter** in `AdminHome.js` that every student-facing tab both bumps and
  watches, so an edit on one tab can never leave another showing a stale name.
- **The `User` document is canonical.** All tables display the populated user's live `name`/`phone`,
  never a copy frozen on a request row. One shared `StudentEditForm` writes through
  `PUT /user/updateForAdmin/:id`.
- Admin editing is **contact details only**. `paid`, `currentTier`, `role` and every amount are
  server-owned and change only through Grant / Refund / Downgrade / Overturn, so an edit can never
  contradict the payment trail.

## 9. Findings that affect Days 2–4

1. **223 professions, not 218.** All three data files agree and their `id` sets join cleanly.
2. **`baseline_rating.json` is the OLD 19-factor set.** Day 3 must regenerate it against the
   27-factor matching vector. Before that run, `psychometric_factors.json` goes 19→27 and
   `factor_anchors.json` needs anchors for the 8 new factors. **Stop and ask the user to review
   those anchors before scoring** — he has explicitly asked for this checkpoint.
3. **Voyage embeddings are reusable** — 223 × 1024, `voyage-4-large`. Query with
   `input_type: "query"`. Regenerating the factors does not invalidate them (they embed profession
   text, not factors).
4. **Aspirational professions are a deliberate bias signal, not a filter.** Each one is also stored as
   a `persistentInterests` row at `confidence: "Medium"` with `source: "aspiration"`, so Day 3 can
   see the student's stated career preference *separately* from their evidenced activities. An
   unmatched entry keeps its raw text with `professionId: null` — do not discard these; they are
   exactly the aspirations our taxonomy does not yet cover and worth reviewing as a set.
5. `entrance_gates.json` and `verified_facts.json` are referenced by key from other data files.

## 10. Open items

1. **`problemPrompts.js` needs a human read-through.** 132 prompts; some are sensitive
   (discrimination, illness, family money problems) and the three problem types should stay balanced
   in count and intensity. **Not yet reviewed.**
2. **Accounts created before email verification existed are unverified and cannot pay.** Either they
   use Profile → "Resend confirmation email", or `isEmailVerified` is set directly in Atlas.
3. **Nothing is committed to git.** `.gitignore` is correct (`.env`, `node_modules/` ignored).
4. **The browser walkthrough of the latest round has not been done by hand** — the automated suites
   pass, but a click-through is still owed.
5. **V2 parental consent.** V1 is a self-declared checkbox with a parent's name and mobile; nobody is
   blocked by age. V2 replaces it with a verified OTP flow. Design is preserved in the plan file.
6. **Deferred:** Redis store for rate limiting (only needed with >1 server instance); a dedicated
   sending subdomain is already set up in Resend (`send.freshmxn.com`).

## 11. Verification status

- **52/52** automated end-to-end checks on the Day-1.5 feature set, against the running server and
  real Atlas.
- **29/29** on the second round (overturn, guards, the refundable-money hole).
- The 52 were re-run after the second round: **no regressions**.
- Day 1 itself: 46/46 manual-mode API checks, 17/17 Razorpay-mode checks with real test orders and
  real webhooks over ngrok, 22/22 form-logic checks.
- Frontend compiles clean (warnings are deliberate `react-hooks/exhaustive-deps` suppressions where
  adding the dependency would cause a loop).
- All test data was deleted after every run.

## 12. Environment

`Backend/.env` (gitignored; `.env.example` mirrors every key blank):
`DB_URI`, `JWT_SECRET`, `PORT=5000`, `FRONTEND_URL`, `PAYMENT_MODE`, `RAZORPAY_KEY_ID`,
`RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`,
`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`,
`ADMIN_NAME`, plus `REDIS_URL`, `VOYAGE_API_KEY`, `Embedding_Model`, `ANTHROPIC_API_KEY` for Days 2–4.

Two local quirks worth knowing:
- `config/MongoDBCon.js` contains a **Windows DNS workaround** — Node reports loopback-only DNS on
  this machine, so Atlas SRV lookups fail without switching to public resolvers. Any standalone
  script that connects to Atlas needs the same three lines.
- `npm run seed:admin` creates or promotes the admin account. There is deliberately no way to become
  an admin through the website.
