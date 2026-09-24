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

### Owner changes round 3 ✅
| Change | Where |
|---|---|
| **`/` is the company landing page for everyone; the student dashboard moved to `/dashboard`** — the logo always leads to the landing page | `App.js` (`RootRoute.js` deleted); every "go to my dashboard" redirect now targets `/dashboard` (Login, Register, OAuthSuccess, Paywall, VerifyEmail, InterestForm, Mentorship, MentorLogin, Admin/MentorProtectedRoute); `Navbar` Home → `/dashboard`; `PublicNav` shows **My dashboard + Profile** to a logged-in visitor instead of Log in. The `*` catch-all still goes to `/` (landing) |
| **No "Interest Form" link in the navbar** — reached from the dashboard | `Navbar.js` (unpaid users still see "Get Access") |
| **Tagline "Explore. Get clarity. Take action."** is the hero `<h1>`, `<title>` and the start of the meta description; "Careers that fit *you*. And the future." is now a closing statement band before About | `Public/Landing.js`, `public/index.html`, and `landing_page_content_v3.md` §1 updated to match |
| **Profile: every section a collapsible panel + "Your psychometric profile"** | `User/Profile.js` (Account open by default; Scores; Payment history; Financial aid when relevant; Contact us), new `User/PsychometricScores.js` |
| **Contact us** on the Profile page — WhatsApp button, call, email (same numbers as the public footer) | `User/Profile.js` |

**`GET /reports/getMyScores` — the rules it enforces (owner chose "High / Medium / Low words"):**
raw 0–10 → **High ≥ 6.7 · Medium ≥ 3.4 · Low** on the server; **no number ever leaves the server**;
**`confidence` excluded** (PRD §B.4 — never shown as "your confidence score"); **uncertainty
tolerance returned as a position** ("prefers a clear plan" / "somewhere in between" / "comfortable
not knowing" — Master Plan rule 4, a position not a level); `data_quality`, flags, banks, components
never sent; labels from `FACTOR_LABELS` so the Profile names factors exactly as the report does;
`null` → "not measured yet" (e.g. a SART the device refused); behind `requirePaid`; `data: null`
before the assessment is scored. 29 factors in 4 groups + the uncertainty position = all 31.
⚠ The thresholds are un-normed thirds of the raw scale — revisit when V2 norms exist.

Verified: new suite 31/31 (API: levels right, no raw numbers anywhere in the JSON, no confidence,
no data_quality, position not level, unpaid refused, no-profile null; browser at 360 px: real
password login → `/dashboard`, no Interest Form link, logo → landing while logged in, tagline +
closing statement, My dashboard link, all Profile panels fold, scores in words with no digits,
WhatsApp link, no sideways scroll, no JS errors). Regression: browser 36/36, API 38/38, fixtures
22/51/99. Build warnings unchanged.

**DNS re-checked:** `www.freshmxn.com` → CNAME `freshmxn.onrender.com` → Render ✅. The bare
`freshmxn.com` still has **no record** — owner adds `CNAME @ → freshmxn.onrender.com` (DNS only) in
Cloudflare and `freshmxn.com` in Render → Custom Domains. A `google-site-verification` TXT is
already on the domain.

### Round 4 bugs ✅
Logo on Login / Register / Mentor Login / Mentor Register was a bare image → now links to `/`;
Forgot/Reset Password and Verify Email got the same linked logo. Profile panels all start collapsed.

### Stage 2 — the design pass ✅ built · ⏸ STOP 2 (owner review)

**Purely presentational** — no route, schema, scoring, matching, worker or payment change. Copy
unchanged. Fixtures 22/51/99 after every edit in `Report/` and `Assessment/`; browser suites
36/36 + 39/39 and API 38/38 green at the end.

| Layer | What |
|---|---|
| Fonts | **Self-hosted** `@fontsource/orelega-one` + `@fontsource/lato` (400/700/900), imported in `index.js` — deliberate change from the local plan's Google Fonts `<link>`: no third-party request on a site for minors, no remote-stylesheet layout jump |
| Tokens | `styles/tokens.css` — navy ink, teal star (+ dark / tint), pink highlighter, cream/page, fluid type scale, spacing, radii, shadows |
| antd | `src/theme.js` + `ConfigProvider` in `index.js` (teal primary, Lato, 44px controls, Collapse/Tabs/Table tokens) |
| Styles | `base.css` (extended: typography; element defaults wrapped in **`:where()` so any class or antd wins**), `components.css` (buttons, highlighter, cards, chips, app header, journey bar, upgrade card, AuthCard, antd refinements), `public.css` (hero, sections, steps, pricing, closing band, footer, stories, waitlist), `app.css` (report, paywall, assessment, question cards, choice rows, caution card, forms) |
| Public site | Landing restyled in **3 critique rounds** vs `Frontendref1.png` (tagline hero as three beats, illustrative matches preview, strikethrough beat, 4 step cards with inline-SVG icons, navy promise band, pricing cards, teal closing band, dark footer with `logo-light.png`). Pink used once per section max. Phone header = logo + "Get started" in one row |
| App | Sticky app header (active link, avatar → Profile, one row on a phone); content after the header inherits the page column via `.app-header ~ …` so pages didn't need rewrapping; dashboard; journey bar; upgrade card |
| Auth | `pages/AuthCard.js` — one centred card for Login, Register, Forgot/Reset, Verify Email, Mentor Login/Register |
| Report | `ProfessionCard`, `ReportPage`, `ReportFilterBar`: **0 inline styles left** (were 35/25/17) — classes for cards, pill filters, section labels; `is-dimmed` still a fade; 44/48px targets moved into CSS; every fixture-checked string (`dimmed={missed.length > 0}`, `orderedSwitch`, `levelPath`, …) untouched |
| Assessment | intro section cards; `LikertModule` question cards; full-width answer rows (`label.choice`, plus a `:has()` rule for other forms); primary forward buttons; `OneAttemptWarning` → warm caution card. **SART stimulus (Sart.js 346–411), `FONT_SIZES`, `sartTask.js` untouched**; the `button` 44px objects kept, class added beside them |
| Paywall / interest / mentor | plan cards; full-width interest inputs; `AspirationalProfessions` fixed `width: 360` → `100%` / max 360 (overflowed a phone); Mentorship + Mentor onboarding use choice rows |
| Tooling | `Frontend/scripts/shoot.js` (puppeteer-core devDependency, `CHROME_PATH`, `TOKEN`, `WIDTHS`); `/Frontend/shots/` gitignored |

Not restyled beyond tokens (Tier 2 per plan): the admin dashboard. Remaining inline styles are the
functional ones (SART, DigitSpan's big digit display and answer box, ExternalTest/StoryRecall input
widths) — safe to class up later, but they measure things, so each needs its own careful pass.

### Round 5 — owner changes after STOP 2 ✅ built · ⏸ STOP 3 (owner review)

Owner decisions: parental consent **stays the self-declared checkbox for now** (the legal pages say
so honestly and say verified consent is coming); company **Freshmxn Education India Private Limited**,
CIN U85500DL2025PTC453582, registered 3477 Sarwan Building, Nicholson Road, Chandni Chowk, Delhi
110006 (PAN/TAN deliberately not published); keep and fix the hero illustration; remove every
"illustrative" on Success stories.

| Area | What changed |
|---|---|
| **Legal** (new) | `Public/LegalPage.js` (shared layout: contents list, "Last updated 24 September 2026", `COMPANY` constants), `Public/Privacy.js` at `/privacy` (DPDP Act 2023 + Rules 2025: fiduciary, what we collect — mapped to the real models, screenshots **never stored** per `externalTestsRouter.js`, purposes, no ads/sale/child tracking, children + the current checkbox consent recorded with time/IP/`POLICY_VERSION`, processors incl. cross-border, retention, rights, breach, Grievance Officer, Data Protection Board), `Public/Terms.js` at `/terms` (plans, minors, INR pricing, refunds incl. the **same** `MentorRolloverPolicy` component, guidance-not-guarantees / not a diagnosis, independent mentors, AssessmentDay, acceptable use, IP, liability, Delhi courts). Linked from the footer, Register ("By creating an account you agree…"), CompleteProfile, and both under-18 consent checkboxes. **Draft — not legal advice; DPDP lawyer review is still a go-live gate.** Grievance officer = Luv Goel, luvgoel@freshmxn.com (**assumption — owner to confirm**) |
| **Landing** | Now: hero (trimmed copy) → "You need a system" with **four collapsed questions** (`<details>`; answers trimmed, stats + sources kept) → **new "Who it's for"** (School Class 9–12 / College / Early professionals) → Why we're different → closing band → footer. Promise, steps, invite, pricing and About **moved off** the landing page |
| **Hero art** | Shapes were hanging off the card with negative offsets and the hero's overflow clip cut the teal blob to a sliver on phones. `.hero-visual` now reserves padding right/below so the blob and pink dot always show (phone + desktop) |
| **How it works** (new) | `Public/HowItWorks.js` at `/how-it-works`: opens on "We don't just train you for a dead end" (navy band, page `h1`), then the four steps + How we rank, "By invitation only", Pricing (server prices). Copy moved verbatim. Hero "See how it works" links here |
| **About us** (new) | `Public/About.js` at `/about`: the owner's story, edited for spelling/flow only, first person, + LinkedIn, company name, CTA. (Closes the old "About section" open item) |
| **Nav / footer / sitemap** | PublicNav: How it works · Success stories · Mentors · About us · Log in/Profile + CTA (wraps to two rows on a phone — accepted). Footer: + How it works, About us, Terms, Privacy; "© 2026 Freshmxn Education India Private Limited · CIN …". `sitemap.xml` + 4 URLs |
| **Success stories** | Per-card "(Illustrative example.)" and the intro parenthetical removed; `success_stories_page.md` updated with the owner decision. (The landing hero's small "Illustrative example" note on the mock matches card is a different thing and stays) |
| **Assessment** | "Open now" heading removed from `AssessmentIntro.js` |
| **Mentorship** | "We'll confirm your mentor **via WhatsApp** by {date}" |
| **Report** | Collapsed `ProfessionCard` = **name only** on a teal-tint row with a teal-dark name. Sector line (the "11. Sports & Fitness" numbering), years, chips and the filter note left the row. Inside the card: years to qualify first, worth-the-switch cost as a plain line ("About N years of what you've done so far would be left behind" — DECISIONS §5 keeps the cost visible), the filter note. **Removed entirely:** chips and the per-profession "why we selected this" (`tierReason`); "Not in the list above" gone. `reportTags.js` untouched (`studentTags` still drives "What seems to drive you"; its "you will see this alongside the careers below" clause was dropped because the tags no longer appear) |

⚠ **One fixture changed, on purpose:** `workers/fixtures` "TIERS — the ranking explains itself"
asserted `const tierReason` exists in `ReportPage.js`. The owner explicitly removed the per-profession
reason, so that one assertion was replaced by a comment; the rest of the fixture (5 group boundaries
matching the engine, every group states its `why:`, "How this list is ordered") still runs — the
ranking still explains itself at group level. No other fixture touched. Still 99/99.

Verified: build (same 8 pre-existing warnings), fixtures 22/51/99, API 38/38, `uiFlow` **54/54**
(updated for the new landing + new checks: questions start collapsed and open on tap, How it works
opens on the dead-end band with server prices, About/Terms/Privacy render with the CIN, footer links,
Register links Terms/Privacy, no "illustrative" on stories, "via WhatsApp"), `round3` 39/39, new
`round5` 16/16 (report rows are name-only, coloured, no chips, years inside, no tier reason, no
"Open now", 360 + 1280), no sideways scroll at 360 on every new page.

### Round 6 — owner feedback after STOP 3 ✅ built · ⏸ STOP 4 (owner review)

| Area | What changed |
|---|---|
| **Report — one list** | The "Reachable from here" heading, the five band headings and the separate "Worth the switch" section are gone. The student sees ONE list under "Your matches". The five bands (`TIER_GROUPS`, unchanged) are explained inside the collapsed "How this list is ordered", plus a line on switching cost |
| **Report — sort, no filters** | New `Report/ReportSortMenu.js` replaces `ReportFilterBar.js` (deleted): a **☰ Sort your list** button, collapsed, with the current order as a marker. Two highlighted primaries: **Best match** (engine: 16 tiers + switching cost) and **Best fit, ignoring switching cost** (not offered to class 9–10 — `switchIsDistinct` — where the lists are identical). Optional **Then order by**: AI exposure / quickest / mid-career pay / demand. **Filters removed** (owner). List logic is a pure `buildList()` in `reportFilters.js`: ignoring-cost = ranking ∪ worth-the-switch extras ordered on raw fit (`comfortScore`); a secondary sort ties on the primary position; nothing is ever removed. In ignoring-cost mode the card shows the "years left behind" line |
| **Report — top 3** | The engine's top three are always coloured (teal / navy / pink-tint, "Top match" badge) and keep the colour under any sort. Next steps always use the engine's top three |
| **Report — card text** | Section titles are real subheadings (Orelega One, navy, sentence case); body 1rem navy, secondary text navy-soft — no pale grey micro-text. Unlabelled stages are sentence-cased ("Portfolio") |
| **Copy** | "Here's what they should actually ask." · "Who is it for" · "4 steps. 0 gyaan." · invite paragraph drops "Your story goes first; your marks never get a veto." · "walked that path" (no "exact"). Copy docs updated to match |
| **Footer / CTAs** | Root cause: React Router kept the scroll position, so a footer link or "Join the waitlist →" opened the next page still scrolled to the bottom. New `src/ScrollToTop.js` in `App.js`: every page change starts at the top; a `#hash` scrolls to its section (legal contents links) |
| **About photo** | Slot built (`/founder.jpg`, circular, beside "My story"; hidden until the file exists — no broken image). **Needs the photo as a file** — it arrived only as an inline image |
| **Success stories** | Three realistic journeys (Class 12 PCM → Industrial & Product Designer, B.Com → Sustainability & ESG, IT support → Cybersecurity), real taxonomy names, plausible timelines, one quiet note "Names and details changed; stories are representative of real student journeys." `success_stories_page.md` rewritten to match |

⚠ **Two page-level fixtures rewritten, on the owner's decision to remove filters and the second list**
(module-level filter fixtures untouched and still running):
- "sort and filter govern worth-the-switch too" → **"one list: ignoring switching cost surfaces every
  worth-the-switch career"** — drives `buildList`: Best match = engine order; ignoring-cost ⊇ ranking ∪
  switch list, raw-fit order, nulls last; a secondary sort is a permutation that ties on the primary;
  the page uses `buildList` and gates the option on `switchIsDistinct`.
- "nothing is pinned; the controls apply uniformly" → **"no control hides or fades a career"** — no
  `missedBy(`/`dimmed=` on the page, and the rendered list is the full ordered list.
Still 99/99. `missedBy`/`optionCounts`/`hasData` remain in `reportFilters.js` (tested, unused by the page) —
delete them together with their fixtures if filters are never coming back.

Verified: build (same 8 pre-existing warnings), fixtures 22/51/99, API 38/38, `uiFlow` **63/63** (new: copy,
three stories + note, footer links and plan CTAs land at scrollY 0, privacy contents still jumps, no broken
image on About), `round3` 39/39, `round5` **34/34** (one list, no filter text, menu collapsed → opens,
3 distinct top colours that follow their careers, secondary sort is a permutation, ignoring-cost adds the
switch career, marker text, class 9–10 gets no ignoring-cost option — at 360 and 1280).

**Backend review (item 5):** run as a read-only subagent; findings relayed to the owner in chat, nothing
changed from it without their go.

### Round 7 — founder photo + the top three backend-review fixes ✅

A read-only review subagent audited workers, report generation, psychometric scoring and matching
(report: owner's chat, Round 6). The owner asked for the first three findings fixed:

| # | Problem | Fix |
|---|---|---|
| 1 | **P13 day-plan grade ignored for every student.** `llmScorer` stores P13 flat (`{deep_work_first: 1, …}`); `perspectiveScoring` reads `criteria.<name>` as true/false only | Adapter `asP13Criteria` at the boundary in `scoring/scoreProfile.js` `callPerspective` — flat 0/1 → `{criteria: {…: true/false}}`, anything else passes through. Fixes already-stored submissions with no migration; the ported scorer is untouched. **`SCORING_VERSION` → `profile@1.0.1`** (scoring fixture 01 updated with it) |
| 2 | **A temporary grading failure blanked a written answer forever.** `call_failed`/`malformed_json` were stored as `null`, and only `undefined` items were regraded | `gradeOpenItems.js`: those reasons are **transient** — left ungraded and reported in `transient`; the worker writes what did grade, then throws so BullMQ retries only the rest. On the **last attempt** (`acceptTransient`) the null is stored with its reason so the student still gets a profile; a stored transient null is regraded on the next run; a genuine unscoreable answer is never re-sent. `openMeta` is now merged, not replaced. Same rule for the story's free recall |
| 3 | **A job out of retries left the student on "generating" forever** | New `User.reportFailedAt` (NOT a `progress.report` value — refunds/"Tier 1 delivered" read `report !== "locked"`). Set by both workers' `failed` handlers on the final attempt (with a loud log naming the student); cleared on a successful report, a new submit, or a retry. `getMyReport` → `status: "failed"` (no usable report) or `rebuildFailed: true` (older report kept, banner). New `POST /reports/retryMyReport` — only when a failure is recorded; enqueues first, clears after. ReportPage: "We hit a problem… Your answers are safe" + **Try again**, and a banner on an older report |

Fixtures: **worker suite 99 → 102** — "P13 stored shape actually counts" (verified to FAIL on the old
`scoreProfile.js`), "a failed CALL is retried, never stored as a blank grade", "a job out of retries tells
the student". API **42/42** (+ failed status, retry refused with nothing to retry, retry without a queue
keeps the retry screen). Browser: round5 **38/38** (+ failed screen calls retry, About photo), uiFlow 63/63,
round3 39/39. Build: same 8 pre-existing warnings.

⚠ Existing students' profiles pick up the P13 fix only when re-scored — next submit, or
`node Backend/workers/scoreProfileWorker.js --once <userId>` (grades are stored, so no model calls).

**Founder photo:** `Frontend/public/founder.jpg`, cropped to head and shoulders (250×250) from the
owner's photo; shown round beside "My story".

**Still open from the review (not done — owner's call):** forbidden-term rejection triggered by a
student's own words (now at least ends in "failed + retry", not a spinner); resubmit during an active
job can be lost; `generatedAt` overwritten on every run; story-recall rescaling when free recall is
missing; digit-span `completedAt`; `savePsychometric` field allow-list; age hard filter reads the wrong
field (low). Full report: ask Claude for `backend_review.md`, or rerun the review.

## 4. Open items carried forward
- **Bare domain** `freshmxn.com` has no DNS record yet (see round 3).
- **DNS move in Cloudflare** (owner) — then ask Claude to re-check that www and the bare domain
  resolve to Render (`216.24.57.x`).
- **Server waker** — recommended before sharing with students (UptimeRobot, 10 min, `/robots.txt`); see chat.
- **Legal pages** — lawyer review (DPDP) before go-live; confirm the Grievance Officer name/email;
  the verified parental consent step (V2) must land before the pages' "coming" promise gets old.
- `User/Mentorship.js` "How it works" promises in-app session booking; V1 has none — reword or keep.
- Everything in Day 4 §5 (owner gates) still stands.
- Price mismatch in the content docs: `mentor_waitlist_page.md` says ₹6,500, `00_Master_Plan` says
  ₹7,000 — the pages will read `GET /payments/getPricing`, so the server's number wins; the copy doc
  should be corrected.
- `RESEND_API_KEY` crash-at-boot (§2) — a one-line lazy construction would fix it; owner's call.
