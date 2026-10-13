# Freshmxn — Deploy guide (Render free plan + freshmxn.com on Hostinger)

**Who does what.** Claude prepares the code and config; you click through the dashboards. When a
step goes red, copy the error/log into the Claude session — it fixes, pushes, and Render redeploys
by itself.

**What gets deployed.** One free Render *web service* that runs the Express API, serves the built
React app, and — because `RUN_WORKERS_IN_WEB=true` — also runs the background workers in the same
process. Their job queue is a collection in the same MongoDB database (Round 22) — there is no Redis.
Config lives in `render.yaml` at the repo root.

---

## `render.yaml` vs this file — why there are two

| | `render.yaml` (repo root) | `DEPLOY.md` (this file) |
|---|---|---|
| What it is | **Executable configuration** — a Render *Blueprint* | **The human runbook** |
| Who reads it | **Render**, automatically, on every deploy / Blueprint sync | You (and Claude) |
| What it holds | the service type, plan, region, **branch**, build and start commands, health check, and the *names* of env vars (non-secret values inline, secrets as `sync: false`) | everything a machine can't do: dashboard clicks, pasting secrets, Atlas network access, Google OAuth redirect URIs, Cloudflare DNS, Search Console, the smoke test |
| Can it move? | **No** — Render only looks for it at the repo root | Yes (it lives in `docs/2_build/`) |

Keep both. Render cannot follow a runbook, and the yaml cannot hold secrets or manual steps.
Neither belongs inside the Build PRD — the PRD describes *what* the system is; these two describe
*where and how it runs*.

## Moving the live site to `main` (September 2026)

The site was deployed from the preview branch `claude/peaceful-bohr-rkxau6`. After that branch is
merged into `main`, `render.yaml` says `branch: main`, and Render has to be pointed there too:

1. **Render → the `freshmxn` service → Settings → Build & Deploy → Branch → `main` → Save.**
   If the service was created from the Blueprint, also open **Blueprints → freshmxn → Manual sync**
   so the Blueprint picks up `branch: main` from the yaml (otherwise a later sync could flip it back).
2. **Manual Deploy → "Deploy latest commit".** Watch the log: `npm ci`, `react-scripts build`,
   then `Server is running` and both `worker listening` lines.
3. **Nothing else changes** — env vars, the custom domain, Google OAuth and DNS all stay as they are.
4. **Smoke test:** open www.freshmxn.com, log in, open `/report` and `/profile`.
5. From now on every push to `main` redeploys by itself (`autoDeploy: true`). The old preview
   branch can be deleted on GitHub once you're happy.

---

## Step 1 — MongoDB Atlas: let Render in

Render's free plan has no fixed IP address, so Atlas must accept connections from anywhere (the
database is still protected by its username + password).

1. cloud.mongodb.com → your project → **Network Access** → **+ Add IP Address**
2. **Allow access from anywhere** (`0.0.0.0/0`) → Confirm.
3. **Database** → **Connect** → **Drivers** → copy the `mongodb+srv://…` string (with the password
   filled in). This is `DB_URI`.

## Step 2 — (none since Round 22)

There used to be an Upstash Redis step here. The job queue now lives in MongoDB, so there is nothing to
set up: no `REDIS_URL`. If an old service still has `REDIS_URL` set, delete it in Render → Environment;
the Upstash database can be deleted too.

## Step 3 — Render: create the service from the blueprint

1. render.com → sign up / log in **with GitHub** → allow access to `luv-edt/freshmxn_new`.
2. **New +** → **Blueprint** → pick `luv-edt/freshmxn_new`.
3. Branch: **`claude/peaceful-bohr-rkxau6`**. Render reads `render.yaml` and shows one service,
   `freshmxn` (free plan).
4. It asks for each secret. Fill them in:

| Key | Where it comes from | Required? |
|---|---|---|
| `DB_URI` | Step 1 | ✅ |
| `JWT_SECRET` | Any long random string (e.g. 64 random characters). **New** one, not your local one | ✅ server refuses to start |
| `RESEND_API_KEY` | resend.com → API Keys | ✅ **the server crashes at boot without it** |
| `EMAIL_FROM` | The sender you use locally, e.g. `Freshmxn <onboarding@resend.dev>`. Round 29: a bare address is sent as `Freshmxn <address>`, so students never see "no-reply" as the name | ✅ |
| `EMAIL_DAILY_CAP` | Round 29: emails a day before reminders wait (default 90 — Resend's free plan sends 100 a day, 3,000 a month) | optional |
| `DB_LIMIT_MB` | Round 29: the database size the admin's line measures against (default 512, Atlas's free tier) | optional |
| `ANTHROPIC_API_KEY` | console.anthropic.com | ✅ grading + reports |
| `VOYAGE_API_KEY` | dash.voyageai.com — **also add a payment method there** (Billing): without one Voyage allows 3 requests a minute, and activity matching stalls | ✅ activity matching |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google Cloud → Credentials (same as local) | for Google sign-in |
| `FRONTEND_URL` | Put `https://freshmxn.onrender.com` for now — fix in Step 5 once you see the real URL | ✅ |
| `GOOGLE_CALLBACK_URL` | `https://freshmxn.onrender.com/auth/google/callback` for now — fix in Step 5 | for Google sign-in |
| `ADMIN_EMAIL` / `ADMIN_NAME` / `ADMIN_PASSWORD` | What you want the admin login to be | for Step 6 |

Already set by `render.yaml` (no action): `RUN_WORKERS_IN_WEB=true`,
`NODE_VERSION=22`. Render sets
`PORT` itself — do **not** add it.

5. **Apply**. The first build takes ~5–8 minutes.

## Step 4 — Watch the first build

Render → `freshmxn` → **Logs**. A healthy start ends with these lines:

```
Server is running on http://localhost:10000
score_profile worker listening
generate_report worker listening
Database connected.
```

Anything red → copy the log into the Claude session.

## Step 5 — Fix the two URLs, then Google

1. Top of the service page shows the real URL, e.g. `https://freshmxn-xxxx.onrender.com`.
2. Render → **Environment** → set `FRONTEND_URL` to exactly that (no trailing slash), and
   `GOOGLE_CALLBACK_URL` to that + `/auth/google/callback`. Save (it redeploys).
3. console.cloud.google.com → **APIs & Services** → **Credentials** → your OAuth client →
   **Authorized redirect URIs** → **+ Add URI** → the same callback URL → Save. Keep the localhost
   one so local development still works.

## Step 6 — Create the admin account

Render's free plan has no Shell tab, so run the seed **from your laptop** against the same Atlas
database Render uses:

1. If your local `Backend/.env` `DB_URI` is the **same** Atlas database you gave Render, your admin
   probably already exists — just try logging in with it and skip the rest.
2. Otherwise, temporarily put the Render `DB_URI` and the `ADMIN_*` values in your local
   `Backend/.env` and run:

```
cd Backend && npm run seed:admin
```

Then put your local `.env` back.

## Step 7 — Smoke test together

1. Open the URL on your laptop. (First load after idle can take ~50 s — the free plan was asleep.)
2. Register → verify email → log in.
3. Request access (manual mode) → log in as admin → grant it.
4. Interest form → assessment → submit.
5. In **Logs**, watch for `score_profile … scored` then `generate_report … release …`.
6. The report page shows the report.

## Step 8 — Keep it awake (optional, free)

uptimerobot.com → **New monitor** → HTTP(s) → your Render URL → every **10 minutes**. One service
running all month fits inside Render's 750 free hours.

From here on, **every push to the branch redeploys automatically** — refresh the site to review.

---

## ⚠ freshmxn.com's DNS is on CLOUDFLARE, not Hostinger

Checked 2026-09-24: the domain's nameservers are `zahir.ns.cloudflare.com` and
`connie.ns.cloudflare.com`. **Hostinger is only the registrar and the email host** (MX
`mx1/mx2.hostinger.com`). Any record changed in Hostinger's DNS editor is ignored — which is why the
old site kept showing. Every DNS step below happens in **Cloudflare** instead.

At the time of the check, `www` still pointed at the old site (Cloudflare-proxied) and the bare
`freshmxn.com` had no address record at all.

### Point freshmxn.com at Render (in Cloudflare)

1. Log in at **dash.cloudflare.com** with the account that holds `freshmxn.com`. If nobody knows
   which account, whoever built the old site added it — ask them. *(Fallback if the account can't be
   recovered: in Hostinger → Domains → freshmxn.com → Nameservers, switch back to Hostinger's own
   nameservers — but first copy every MX and TXT record from Cloudflare into Hostinger's DNS, or
   email breaks.)*
2. **Render** → `freshmxn` → Settings → **Custom Domains**: make sure both `www.freshmxn.com` and
   `freshmxn.com` are listed. Note the target Render shows (`<name>.onrender.com`, and an IP for
   the bare domain if it offers one).
3. **Cloudflare → freshmxn.com → DNS → Records:**
   - **Delete** the existing `www` record(s) and any `A` / `AAAA` / `CNAME` record for `@`
     (`freshmxn.com`) that points at the old site.
   - **Add** `CNAME` · Name `www` · Target `<name>.onrender.com` · **Proxy status: DNS only (grey
     cloud)**.
   - **Add** `CNAME` · Name `@` · Target `<name>.onrender.com` · **DNS only**. (Cloudflare allows a
     CNAME on the bare domain. If Render gave you an A-record IP for it, use `A` · `@` · that IP.)
   - **Do not touch** `MX` or `TXT` records — they carry your Hostinger email, SPF and DKIM.
   - Grey cloud matters: Render issues the HTTPS certificate itself, and Cloudflare's proxy in front
     can block that. You can switch the proxy on later if you want Cloudflare's features.
4. **Cloudflare → Rules** (Page Rules, Redirect Rules) and **Workers Routes**: delete anything that
   forwards or redirects `freshmxn.com` to the old site. Then **Caching → Configuration → Purge
   Everything**.
5. **Render** → Custom Domains → **Verify** both. Wait for "Certificate issued" (minutes, sometimes
   up to an hour).
6. Open `https://www.freshmxn.com` and `https://freshmxn.com` in a **private window**. Tell Claude
   — it can re-check the DNS from its side (the records should resolve to Render's `216.24.57.x`,
   not Cloudflare's `104.21.x` / `172.67.x`).
7. Render → Environment: `FRONTEND_URL=https://www.freshmxn.com`,
   `GOOGLE_CALLBACK_URL=https://www.freshmxn.com/auth/google/callback` (and that URI in Google
   Cloud) — if they aren't set that way already.

### Status 2026-09-24
`www` ✅ points at Render. **The bare `freshmxn.com` has no record yet** — Cloudflare → DNS → Add
record: `CNAME` · `@` · `freshmxn.onrender.com` · DNS only; then Render → Custom Domains → add
`freshmxn.com` → Verify.

### Replace the old site in Google search

The site is now open to search engines (the preview `noindex` tag was removed on 2026-09-24;
`/robots.txt` allows crawling and `/sitemap.xml` lists the public pages). Once step 6 works:

1. **search.google.com/search-console** → Add property → **Domain** (left box) → `freshmxn.com` →
   Continue. Google shows a value like `google-site-verification=abc123…` — **Copy** it.
   - The domain **already has** `google-site-verification=3yYaqToU8Mw82v0pIRoFkng_QZ_FwNCgioIZ0UqgpGw`.
     If Google shows exactly that value, just click **Verify**.
   - Otherwise: Cloudflare → freshmxn.com → DNS → Records → **Add record** → Type `TXT` · Name `@`
     · Content = the pasted value · TTL Auto → Save. Keep the existing `v=spf1 …hostinger…` TXT
     (email). Back in Search Console → **Verify** (retry after 10 minutes if it fails).
2. **Sitemaps** → submit `https://www.freshmxn.com/sitemap.xml`.
3. **URL Inspection** → `https://www.freshmxn.com/` → **Request indexing**.
4. Old-site pages still showing in results? **Removals** → New request → paste each old URL. That
   hides it for about 6 months; meanwhile Google recrawls and finds the new site at those
   addresses (every old path now opens the new landing page).
5. Expect the results to change over a few days to two weeks — Google's timing, not ours.

## Razorpay live — taking payments online (Round 26)

The code has been ready since Day 1: the paywall's **Pay** button opens Razorpay's checkout, and a plan is
granted **only** when Razorpay's server tells ours the money arrived (the webhook, signature-checked) —
never on the browser's word. Refunds from the admin go back through Razorpay automatically. Nothing below
goes in chat or git: keys are pasted into Render only.

1. **Razorpay Dashboard → switch to Live mode** (top toggle). Account & Settings → **API Keys** →
   **Generate Key** (Live). Copy the **Key Id** and **Key Secret** (the secret is shown once).
2. **Account & Settings → Payment capture → Automatic** (so a paid order is captured at once; our
   webhook listens for `payment.captured`).
3. **Account & Settings → Webhooks → Add New Webhook:**
   - URL `https://www.freshmxn.com/payments/payment-verification-webhook`
   - Secret: make up a long random string (e.g. from a password manager) and keep it for step 4
   - Active events: **payment.captured**, **payment.failed**, **refund.processed** and **refund.failed** → Create
     (refund.failed shows a failed refund in admin with a retry; payment.failed — Round 28 — records the
     failed attempt with its payment id and the bank's reason in the student's payment history, and
     emails them that no money was taken)
4. **Render → the service → Environment**:
   - `RAZORPAY_KEY_ID` = the Key Id (`rzp_live_…`)
   - `RAZORPAY_KEY_SECRET` = the Key Secret
   - `RAZORPAY_WEBHOOK_SECRET` = the secret from step 3
   - `PAYMENT_MODE` = `razorpay` (change it from `manual`)
   → **Save, rebuild and deploy**.
5. **Test with real money, then undo it:**
   - Admin → Coupons → add `LIVETEST`, 99% off, usage limit 1.
   - Log in as a test student with a confirmed email → Paywall → Career Discovery → apply `LIVETEST`
     → **Pay ₹25** (or whatever 1% comes to) → pay with UPI.
   - Within a minute the student's plan unlocks (the webhook). Render's logs show the webhook call;
     Razorpay → Webhooks shows it delivered with 200.
   - Admin → Refund Requests (or Students → Downgrade) to refund it; Razorpay shows the refund,
     and the `refund.processed` webhook marks it refunded and stores the bank reference (ARN), which
     the student sees and is emailed (Round 28). Razorpay never reports when the bank actually credits
     it — "sent to your bank, usually 5–7 working days, quote this ARN" is the most anyone can say.
   - **WhatsApp for mentor invites (Round 28) needs no setup:** the mentor's invite is emailed on a
     match, and admin → Mentor Matches → **Send invite on WhatsApp** opens WhatsApp with the same text
     typed in; you press send. An automatic WhatsApp provider (Meta Cloud API) can come later.
6. **If a payment doesn't unlock the plan:** Razorpay → Webhooks → the delivery log. A 400 "Invalid
   signature" means the secret in Render differs from the one in Razorpay. **No delivery at all** usually
   means payment capture is not Automatic (step 2): the payment sits "authorized", `payment.captured`
   never fires, and Razorpay refunds it after a few days.
7. A smaller real test than the 99% coupon: a test student asks for financial aid, and admin approves it
   at **₹1** — an approved aid replaces the price.

Students with a 100% coupon, or a plan you give free, never see Razorpay: a ₹0 price shows **Request
access** (you grant it), and admin → Students → **Give free access** grants a plan directly. To pause
online payments, set `PAYMENT_MODE=manual` again.

## Cloudflare Turnstile — the sign-up spam check (Round 25)

Built and **off until these two keys exist**. Nothing else changes when they are missing.

1. **dash.cloudflare.com** → left menu **Turnstile** → **Add widget**.
2. Widget name `Freshmxn sign-up` · Hostnames `freshmxn.com` and `www.freshmxn.com` · Widget mode
   **Managed** → **Create**.
3. Copy the two keys it shows into **Render → the service → Environment**:
   - **Site key** → `REACT_APP_TURNSTILE_SITE_KEY` (public; it is built into the page)
   - **Secret key** → `TURNSTILE_SECRET_KEY` (secret)
4. **Render → Manual Deploy → Deploy latest commit.** A rebuild is needed because the site key is
   baked into the frontend at build time.
5. Check: open `https://www.freshmxn.com/register` in a private window — a small Cloudflare box sits
   above "Create account" (usually it just ticks itself) — and register a test account.

The DNS records are not touched (keep them grey-cloud, MX/TXT as they are). To switch the check off,
delete both keys and redeploy.

## Custom domain — www.freshmxn.com (original plan — superseded by the Cloudflare section above)

### Phase A — now: `beta.freshmxn.com` (your current site is untouched)

1. Render → `freshmxn` → **Settings** → **Custom Domains** → **+ Add** → `beta.freshmxn.com`.
   Render shows a target like `freshmxn-xxxx.onrender.com`.
2. hpanel.hostinger.com → **Domains** → `freshmxn.com` → **DNS / Nameservers** → **DNS records** →
   add: **Type** `CNAME` · **Name** `beta` · **Target** `freshmxn-xxxx.onrender.com` · TTL `3600`.
   Do not edit or delete anything else.
3. Back in Render → **Verify**. HTTPS is issued automatically (minutes; DNS can take up to 24 h).
4. Render → Environment: `FRONTEND_URL=https://beta.freshmxn.com`,
   `GOOGLE_CALLBACK_URL=https://beta.freshmxn.com/auth/google/callback`.
5. Google Cloud → OAuth client → add that callback URI. **OAuth consent screen** → **Authorized
   domains** → add `freshmxn.com`.

### Phase B — go-live: move `www` and `freshmxn.com` to Render

Do this only after the go-live gates (legal sign-off etc.). **The current Hostinger site stops
showing on www the moment you change these records** — if you still need it, ask Claude about
moving it to `old.freshmxn.com` first.

1. Render → Custom Domains → add `www.freshmxn.com` and `freshmxn.com` (Render redirects the bare
   one to www). Note the **A-record IP** Render shows for `freshmxn.com`.
2. Hostinger → DNS records:
   - **Delete** the existing `www` record → **add** `CNAME` · `www` → `freshmxn-xxxx.onrender.com`.
   - **Edit** the `@` **A** record → Render's IP.
   - **Delete** any `@` **AAAA** records (Render requires this).
   - **Do not touch MX or TXT records** — they carry your email.
3. If Hostinger refuses to edit `www`/`@` because a website is attached to the domain, detach it in
   hPanel (Websites) first.
4. Render → Environment: `FRONTEND_URL=https://www.freshmxn.com`,
   `GOOGLE_CALLBACK_URL=https://www.freshmxn.com/auth/google/callback`; add that URI in Google Cloud.
5. ~~Remove the `noindex` tag~~ — done 2026-09-24 (owner chose to let Google list the site). The
   site.
6. Optional: resend.com → **Domains** → add `freshmxn.com` → paste the TXT/MX records it gives you
   into Hostinger, then set `EMAIL_FROM` to e.g. `Freshmxn <hello@freshmxn.com>`.

Last: in `render.yaml`, change `branch:` to `main` once the work is merged.

---

## If Google sign-in fails

Check all five — any one of them breaks it:
1. Render → Environment → `FRONTEND_URL` is exactly `https://www.freshmxn.com` (no trailing slash).
   This is also the CORS allow-list, so a wrong value breaks every login, not just Google.
2. `GOOGLE_CALLBACK_URL` is exactly `https://www.freshmxn.com/auth/google/callback`.
3. Google Cloud → Credentials → OAuth client → **Authorized redirect URIs** contains that exact URL.
4. Google Cloud → **OAuth consent screen** → Publishing status **In production**. In *Testing*,
   only listed test users can sign in; everyone else sees "Access blocked".
5. OAuth consent screen → **Authorized domains** contains `freshmxn.com`.

If it still fails, Render → Logs shows a line starting `Google callback failed:` — paste it to Claude.

## Things to know

- **Free plan sleeps** after ~15 min with no visitors; the next visit takes ~50 s. A student
  waiting on a report keeps it awake (the page checks every 5 s). Step 8 removes the sleep.
- **The job queue is in MongoDB (Round 22).** Until October 2026 it was BullMQ on Upstash Redis; an
  idle scheduled queue re-asked Redis every 10 seconds and used up the free 500k commands a month
  before launch, after which every Submit, "Try again" and "Update my report" failed. Atlas has no
  command quota. An idle worker asks MongoDB "anything for me?" every 10 s (`JOB_POLL_MS`); a job a
  student starts runs at once. Finished jobs delete themselves after 7 days.
- **Is the queue working?** Admin → **Assessment issues** shows "Job queue: working / not moving /
  not reachable" above the list. A report that could not be queued is an issue of its own ("Report
  could not be queued", emailed to `ADMIN_EMAIL`) with the real error. `npm run pipeline:status --
  --probe` (with `DB_URI` set) proves the workers are alive.
- **Redeploys never lose a job.** Workers get ~30 s to finish; anything cut off is taken over by the
  next start within ~5 minutes (its lock runs out) and runs again.
- **`HOUSEKEEPING_ENABLED=false`** stops the calendar jobs (follow-up scan, data refresh, scout, study
  bot, batch collect) being registered; admin "Run now" still works.
- **Moving to paid workers later:** see the commented section at the bottom of `render.yaml`.
- **Email budget (Round 29).** Resend's free plan: 100 emails a day, 3,000 a month. Above `EMAIL_DAILY_CAP`
  only reminders (the short story's, system updates, "take it again" offers) wait; codes, payments,
  retakes and mentor emails always go. Move to Resend's paid plan (50,000 a month) once there are more
  than about 20 students a day. Admin → AI usage shows emails today.
- **Database size (Round 29).** Atlas's free tier holds 512 MB; 13 Oct 2026: 38.5 MB. Admin → AI usage
  shows the share and the biggest collections, amber at 70%, and emails the admin at 85%. When it nears
  full: Atlas Flex or M10, or trim retake history and old job rows.
