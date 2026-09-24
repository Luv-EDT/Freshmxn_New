# Freshmxn — Day 5 Handover (running log)

**Written for:** the owner's local Claude Code session, which picks this work up after a `git pull`.
**Where this work happened:** a Claude Code **cloud** session (the owner was out of local usage).
It works on branch **`claude/peaceful-bohr-rkxau6`** — locally run
`git fetch origin && git checkout claude/peaceful-bohr-rkxau6` to continue from here.
**Updated:** with every commit, newest section at the bottom of §3.

Read `05_Day4_Handover.md` first — everything there still holds. This document covers Day 5 only.

---

## 1. The plan being executed

The owner's **local Day 5 plan** is the source of truth (Stage 1 functionality → Stage 2 purely
presentational design pass → Stage 3 deploy + E2E, with ⏸ STOP checkpoints). Settled with the owner
in that plan, not to be re-asked: puppeteer-core screenshots · `/` renders Landing when logged out
and the dashboard when logged in (`RootRoute`, `ProtectedRoute` untouched) · mentors self-register
and land as `pending_review` · Claude prepares deploys, the owner drives dashboards.

**Changes agreed in the cloud session (2026-09-24):**

| Change | Why |
|---|---|
| **Deploy moved to the front (Stage 0)** | Render auto-deploys the branch on every push, so the owner reviews Stages 1–2 live on a laptop instead of from screenshots alone |
| **Free Render plan, workers inside the web process** | Render has no free background workers. See §2 |
| **Custom domain in two phases** | `beta.freshmxn.com` now (CNAME only, current Hostinger site untouched); `www` + apex at go-live. See `DEPLOY.md` |
| ⏸ STOPs kept | At each: push, the owner checks the live URL, Claude sends 360 px + 1280 px screenshots |
| `shoot.js` reads `CHROME_PATH` | Same script works in the cloud (`/opt/pw-browsers/chromium`) and locally (the cached `C:\Users\DELL\.cache\puppeteer` Chrome) |

"Commit everything to git first" from the local plan was already done (`269dfa5`).

---

## 2. Workers on the free plan — what was verified, and how

### The existing pipeline (unchanged)
Submit → `submissionsRouter.js:378` enqueues `score_profile` and returns instantly → the
**score_profile** worker grades the five open items (stored on the submission, so retries never
re-bill), scores, saves the profile, and enqueues `generate_report` → the **generate_report** worker
matches, recommends, composes, saves, marks `progress.report` → `ReportPage.js:174` polls every
5 s. Five attempts with exponential backoff; `addOnce` stops double-taps.

### What changed
| File | Change |
|---|---|
| `Backend/workers/queueHelpers.js` | New `idleTimings()` → `{ drainDelay: 60, stalledInterval: 120000 }`, env-tunable via `WORKER_DRAIN_DELAY_S` / `WORKER_STALLED_INTERVAL_MS` |
| `scoreProfileWorker.js`, `generateReportWorker.js` | `...idleTimings()` in the `new Worker(...)` options; `start()` now `return worker` |
| `Backend/server.js` | After `listen()`: if `RUN_WORKERS_IN_WEB === "true"`, start both workers in-process. `SIGTERM` → `worker.close()` on both, then exit |

Nothing in `scoring/`, `matching/`, payments or any route changed. Locally, leave
`RUN_WORKERS_IN_WEB` unset and keep using `npm run worker:score` / `worker:report` as before.

### Verified — not assumed
- **BullMQ 6.3.8 source** (`worker.js` `getBlockTimeout()`): with no delayed jobs the idle block is
  `max(drainDelay, minimumBlockTimeout)` — **not** clipped to the 10 s `maximumBlockTimeout`, which
  only applies while a retry is in the delayed set. The backend's watchdog recovers hung blocks.
- **Pickup latency, real Redis:** worker idling in a 60 s block, job added → picked up in **5 ms**.
  Raising `drainDelay` does not delay jobs.
- **Idle traffic, Redis MONITOR on one idle worker:** per 60 s loop the client sends 1 `EVALSHA`
  (moveToActive) + 1 `BZPOPMIN`; plus 1 `EVALSHA` stalled sweep per 120 s → **~2.5 requests/min per
  worker ≈ 108k/month, ~216k/month for both** (BullMQ defaults: ~26/min per worker ≈ 2.2M/month for
  both). ⚠ `INFO commandstats` reports ~4× more because it also counts the commands executed *inside*
  the Lua scripts — confirm against Upstash's own usage graph after a day live. If high, raise
  `WORKER_DRAIN_DELAY_S` (env only).
- **Boot test:** `server.js` with `RUN_WORKERS_IN_WEB=true` against a local Redis — `GET /` 200,
  `GET /report` (SPA refresh) 200, both workers `listening`, 5 Redis connections, clean exit on
  `SIGTERM`.
- **Fixtures:** 22/22 · 51/51 · 99/99 before and after.
- **Redeploy mid-job:** lock expires, the next instance's stalled sweep requeues it within ~2 sweeps
  (~4 min) — safe because both jobs are retryable end to end.

### Deploy findings fixed along the way
- **Both `package-lock.json` files were out of sync** with `package.json` — `npm ci` (what Render
  runs) failed on missing `gcp-metadata`, `google-logging-utils` (Backend) and `yaml` (Frontend).
  Repaired with `npm install`: additive entries only, no installed version changed.
- **`RESEND_API_KEY` is effectively required at boot** — `userRouter.js:17` constructs `new Resend()`
  at require time and throws without a key, despite `server.js` treating email as non-fatal.
  Pre-existing; not changed (out of scope). Marked **required** in `DEPLOY.md`.
- Build runs with `CI=false` (Day 4 §6: `CI=true` promotes `Interest/` warnings to errors) and
  `GENERATE_SOURCEMAP=false` (memory + no source in the browser). Verified: build passes, 0 `.map`
  files, 440 kB main bundle.
- `Frontend/public/index.html` has `<meta name="robots" content="noindex, nofollow">` — **preview
  only, remove at go-live** (DEPLOY.md Phase B step 5).
- **Google sign-in was broken in production (fixed).** `apiCall/userApi.js` `getGoogleSignInUrl()`
  built `${REACT_APP_API_URL}/auth/google`; with the variable unset (same-origin) the bundle shipped
  `href="undefined/auth/google"`. Now falls back to `""`. Axios was already fine (`baseURL`
  undefined → relative). **Any future link built from `REACT_APP_API_URL` needs the same `|| ""`.**
- New API route prefixes must not equal a page's URL prefix (e.g. API `/mentors` vs page
  `/mentor/…`): the SPA fallback is registered after the routers, so a collision 404s on refresh.

---

## 3. Log

### Stage 0 — deploy prep ✅ code done, owner dashboard steps pending
- `render.yaml` — one free web service, Singapore region, autoDeploy from this branch; paid-worker
  layout included commented out.
- `DEPLOY.md` — the owner's click-by-click guide: Atlas, Upstash, Render blueprint + env table,
  Google OAuth, admin seed (from the laptop — free plan has no Shell), smoke test, UptimeRobot,
  and the two-phase freshmxn.com domain move.
- Worker changes, lockfile repair and `noindex` as above.

**Owner deployed** — live at **https://www.freshmxn.com** (went straight to Phase B, `www` on
Render). `noindex` is still on — remove only at go-live.

### Owner corrections round 1 ✅
| Fix | Where |
|---|---|
| Google sign-in link (`undefined/auth/google`) | `apiCall/userApi.js` |
| Admins could not log out — the only button was on `/profile`, which bounces admins to `/admin` | new `pages/LogoutButton.js` (moved out of `Profile.js` unchanged), rendered in `Admin/AdminHome.js`; `Navbar.js` hides the dead name→profile link for admins |
| Password show/hide eye | antd `Input.Password` in `Login.js`, `Register.js`, `ResetPassword.js` (×2); `required`/`minLength` still enforced by the browser |
| **Company logo** | Owner supplied 5 PNGs (500×500). Trimmed copies in `src/assets/brand/`: `logo.png` (navy+teal, main), `logo-light.png` (white text, for dark sections), `logo-navy.png`, `mark-dark.png`, `mark-light.png`, plus `mark.png` — the high-res arrows recoloured to logo 5's exact navy `#1E2A38` / teal `#007582` (top arrow navy, bottom teal). Logo shown in the navbar and above Login/Register — unstyled until Stage 2 |
| **Site icon** (owner chose the navy+teal mark) | `public/favicon.ico` (16/32/48), `favicon-32.png`, `apple-touch-icon.png`, `icon-192/512.png`, `manifest.json`, `theme-color` — built from `mark.png` on a **white rounded tile**, because the navy arrow vanishes on dark browser tabs. The image-3 source file had an opaque white background; converted to transparency |

Verified in Chromium (Playwright) against the production build served by Express: logo renders,
favicon served (200, `image/vnd.microsoft.icon`), Google link is `/auth/google`, eye flips the
input `password → text`, `required` intact, admin page shows Log out, the admin has no `/profile`
link, confirming logout lands on `/login` with the token cleared. Build warnings identical to
before (all pre-existing in `Interest/`, `RequestRefundForm.js`, `VerifyEmail.js`). Fixtures 22/51/99.

### Stage 1 — public site + mentor tier ✅ built, ⏸ STOP 1 (owner reviews live)

Owner decisions this round: About section leaves the "(2–3 lines in your own voice)" placeholder
**out** (owner adds their own words later) · a student's career choice is **locked once sent**
(admin can reset it) · **mobile-responsive from Stage 1**, not deferred to Stage 2.

**Public site** — `Frontend/src/pages/Public/`
| File | What |
|---|---|
| `Landing.js` | `landing_page_content_v3.md` §1–9 verbatim; `<s>career gyaan</s>`; hero CTA → `/register`, "See how it works" → `#how-it-works` |
| `SuccessStories.js` | Aarav + Meera from `success_stories_page.md`, both labelled illustrative; the doc's `/start` link (doesn't exist) → `/register` |
| `MentorWaitlistPublic.js` | `mentor_waitlist_page.md` verbatim; "Pay & join" → `/paywall` (ProtectedRoute sends visitors to log in first) |
| `MentorRolloverPolicy.js` | the rollover-first/refund-on-request paragraph, shared with the student's `/mentorship` so both say exactly the same thing |
| `usePricing.js` | every price from `GET /payments/getPricing` — ₹3,500 / ₹6,500 / ₹3,000 upgrade. The copy docs' ₹7,000 was stale; the server wins |
| `PublicNav.js`, `PublicFooter.js` | logo, links, WhatsApp / call / email, "Mentor with us" |
| `pages/RootRoute.js` | `/` = Landing without a token, else the untouched `ProtectedRoute` + `Home` |

**Mentor tier — backend (new files; only `server.js` mounts changed)**
- `model/mentorsModel.js` — PRD §B.9's 12 fields; `status` pending_review → onboarded.
  `preferredCurrency`/`residenceCitizenship` are admin-only.
- `model/mentorWaitlistModel.js` — PRD §B.10. **Clock starts at `choiceSentAt`, never payment.**
- `Routers/mentorsRouter.js` (`/mentors/...`) — `register` (**role hard-coded "mentor"**, no
  verification email: admin approval is the gate), `onboard`, `getMyMentorProfile`,
  `updateMyMentorProfile` (whitelisted fields; status is server-owned and an approved mentor stays
  approved), `getAllForAdmin`, `approveForAdmin/:id`.
- `Routers/mentorWaitlistRouter.js` (`/mentorWaitlist/...`) — `getMyWaitlist` (tier 2 only;
  **upserts the row on first visit, so no payment code changed** — `grantAccess` already flips
  `progress.mentor`), `chooseProfession` (**id must be in the student's own
  `Recommendation.ranked_professions`; the name is read from there, never the body; one-time**),
  admin `getAllForAdmin` (every tier-2 student, virtual row if never visited), `matchForAdmin/:id`
  (approved mentors only), `resolveForAdmin/:id` (rolled_over | refunded — **records only**, the
  refund itself still goes through Refund Requests), `resetChoiceForAdmin/:id`. Admin `:id` is the
  **student's user id**. `dueBy` = choice + 15 weekdays (no holiday calendar).
- API prefixes (`/mentors`, `/mentorWaitlist`) deliberately differ from page URLs (`/mentor/...`,
  `/mentorship`) — see §2 on refresh-404s.

**Mentor tier — frontend**
- `pages/Mentor/` — `MentorRegister`, `MentorLogin` (separate page, same `/user/login`; a
  non-mentor is sent to their own home), `MentorProtectedRoute` (copy of `AdminProtectedRoute`),
  `MentorHome` (form until submitted, then status + summary + edit), `MentorOnboarding` (the 12
  fields; A/B/C/D wording **imported** from `Interest/BackgroundInfo.js` `ACADEMIC_OPTIONS`, now
  exported, so students and mentors read identical labels).
- `Login.js` + `User/ProtectedRoute.js` — one added line each: `role === "mentor"` → `/mentor`,
  beside the existing admin line. A mentor can no longer land in the student journey.
- `User/Mentorship.js` — rewritten: picker from the student's own report ranking → confirm modal →
  "finding your mentor by {date}" → "mentor confirmed" (name + role only). **"20 days" → "15
  business days."** The owner's "Who your mentor will be" / "How it works" text is kept verbatim —
  ⚠ note "How it works" says students can "book further sessions" here, which V1 does not build.
- Admin — new tabs `Mentors` (approve; the only screen showing the two admin-only fields) and
  `Mentor Matches` (match / roll over / refunded / reset choice, business days left).

**Mobile** — new `src/styles/base.css` (structure only, imported in `index.js`; Stage 2 extends
it): box-sizing, `.page` container with 16 px gutters, full-width inputs capped at 480 px,
`.table-scroll`, wrapping `.nav-row`, `.tap` (≥44 px), `.grid-*`. It also fixed a **pre-existing**
phone bug: `/admin` rendered 708 px wide on a 360 px screen because the antd tables had no scroll
container — `.ant-table-wrapper` now scrolls inside itself.
⚠ `img:not([height]) { height: auto }` is deliberate — a plain `img { height: auto }` overrode the
logo's `height="32"` and blew it up to full width.

**Verified**
- **Backend, 38/38** against a real MongoDB-protocol server (FerretDB 1.24 + SQLite from GitHub
  releases — the container blocks MongoDB's own download hosts): role can't be spoofed via the body;
  status/user forced server-side; duplicates and bad input rejected; students can't call mentor or
  admin routes; tier-1 refused; ranking check rejects foreign ids and ignores a body-supplied name;
  `dueBy` is exactly 15 weekdays; second choice locked; pending mentors can't be matched; reset →
  re-choose; **no student response contains currency, residence, or the mentor's email/phone.**
- **Browser, 36/36** (Playwright + Chromium against the production build served by Express, real DB):
  the full visitor → mentor → admin → tier-2 student journey, **no sideways scroll at 360 px on
  every public page, the mentor pages, `/mentorship` and each admin tab**, and zero JS errors.
- Fixtures 22/22 · 51/51 · 99/99. Build warnings unchanged (BackgroundInfo's pre-existing one moved
  a line). `Backend/scoring/`, `Backend/matching/`, `paymentsRouter.js` untouched.
- Found while testing: the mentor register/login pages treated a non-JSON error page as success —
  they now require an explicit `success: true` and a token.

**Next:** owner reviews www.freshmxn.com → go-ahead → Stage 2 (design pass).

**Next (superseded):** owner runs `DEPLOY.md` Steps 1–7 and sends back the Render URL / any red logs → then
Stage 1 (public site + mentor tier).

---

### Owner changes after STOP 1 ✅
| Change | Where |
|---|---|
| **Mentor match time is now 20 BUSINESS days** (owner's choice — Mon–Fri, still counted from the student's choice, not payment) | `MATCH_BUSINESS_DAYS = 20` in `mentorWaitlistRouter.js`; every student-facing mention (`Mentorship.js`, `MentorWaitlistPublic.js`, `MentorRolloverPolicy.js`); comments; and the source docs `mentor_waitlist_page.md` + `06_V2_and_Beyond.md` so copy and site can't drift. The PRD/Master Plan still say 15 — historical, superseded by this decision |
| **Site is open to Google** (owner's choice) | `noindex` removed from `public/index.html`; added a meta description and a descriptive `<title>`; new `public/robots.txt` (allow all + sitemap) and `public/sitemap.xml` (the 5 public URLs on www). Express serves both as static files (verified `text/plain` / `application/xml`, not the page fallback) |
| **Old site still on freshmxn.com — diagnosed, owner action** | The domain's nameservers are **Cloudflare** (`zahir`/`connie.ns.cloudflare.com`), so Hostinger DNS edits were ignored. `www` was still Cloudflare-proxied to the old site; the bare domain had no A record; MX is Hostinger (keep). Step-by-step fix + Google Search Console steps in `DEPLOY.md` → "freshmxn.com's DNS is on CLOUDFLARE" |

⚠ Going indexable is **not** go-live: DPDP legal sign-off and Razorpay KYC still gate real students
and real money; the site stays in `PAYMENT_MODE=manual`.

Verified: API 38/38 (due date exactly 20 weekdays after the choice), browser 36/36 at 360 px,
fixtures 22/51/99, the production bundle contains only "20 business days".

## 4. Open items carried forward
- **DNS move in Cloudflare** (owner) — then ask Claude to re-check that www and the bare domain
  resolve to Render (`216.24.57.x`).
- **About section** — the owner's own 2–3 lines (why Freshmxn exists) still to be written.
- `User/Mentorship.js` "How it works" promises in-app session booking; V1 has none — reword or keep.
- Everything in Day 4 §5 (owner gates) still stands.
- Price mismatch in the content docs: `mentor_waitlist_page.md` says ₹6,500, `00_Master_Plan` says
  ₹7,000 — the pages will read `GET /payments/getPricing`, so the server's number wins; the copy doc
  should be corrected.
- `RESEND_API_KEY` crash-at-boot (§2) — a one-line lazy construction would fix it; owner's call.
