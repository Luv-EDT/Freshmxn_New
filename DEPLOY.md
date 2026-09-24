# Freshmxn — Deploy guide (Render free plan + freshmxn.com on Hostinger)

**Who does what.** Claude prepares the code and config; you click through the dashboards. When a
step goes red, copy the error/log into the Claude session — it fixes, pushes, and Render redeploys
by itself.

**What gets deployed.** One free Render *web service* that runs the Express API, serves the built
React app, and — because `RUN_WORKERS_IN_WEB=true` — also runs both BullMQ workers in the same
process. Config lives in `render.yaml` at the repo root.

---

## Step 1 — MongoDB Atlas: let Render in

Render's free plan has no fixed IP address, so Atlas must accept connections from anywhere (the
database is still protected by its username + password).

1. cloud.mongodb.com → your project → **Network Access** → **+ Add IP Address**
2. **Allow access from anywhere** (`0.0.0.0/0`) → Confirm.
3. **Database** → **Connect** → **Drivers** → copy the `mongodb+srv://…` string (with the password
   filled in). This is `DB_URI`.

## Step 2 — Upstash Redis: copy the URL

1. console.upstash.com → your database → **Connect** / **Details**.
2. Copy the URL that starts with **`rediss://`** (two s's — TLS). This is `REDIS_URL`.

## Step 3 — Render: create the service from the blueprint

1. render.com → sign up / log in **with GitHub** → allow access to `luv-edt/freshmxn_new`.
2. **New +** → **Blueprint** → pick `luv-edt/freshmxn_new`.
3. Branch: **`claude/peaceful-bohr-rkxau6`**. Render reads `render.yaml` and shows one service,
   `freshmxn` (free plan).
4. It asks for each secret. Fill them in:

| Key | Where it comes from | Required? |
|---|---|---|
| `DB_URI` | Step 1 | ✅ |
| `REDIS_URL` | Step 2 (`rediss://…`) | ✅ reports never generate without it |
| `JWT_SECRET` | Any long random string (e.g. 64 random characters). **New** one, not your local one | ✅ server refuses to start |
| `RESEND_API_KEY` | resend.com → API Keys | ✅ **the server crashes at boot without it** |
| `EMAIL_FROM` | The sender you use locally, e.g. `Freshmxn <onboarding@resend.dev>` | ✅ |
| `ANTHROPIC_API_KEY` | console.anthropic.com | ✅ grading + reports |
| `VOYAGE_API_KEY` | dash.voyageai.com | ✅ activity matching |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google Cloud → Credentials (same as local) | for Google sign-in |
| `FRONTEND_URL` | Put `https://freshmxn.onrender.com` for now — fix in Step 5 once you see the real URL | ✅ |
| `GOOGLE_CALLBACK_URL` | `https://freshmxn.onrender.com/auth/google/callback` for now — fix in Step 5 | for Google sign-in |
| `ADMIN_EMAIL` / `ADMIN_NAME` / `ADMIN_PASSWORD` | What you want the admin login to be | for Step 6 |

Already set by `render.yaml` (no action): `PAYMENT_MODE=manual`, `RUN_WORKERS_IN_WEB=true`,
`WORKER_DRAIN_DELAY_S=60`, `WORKER_STALLED_INTERVAL_MS=120000`, `NODE_VERSION=22`. Render sets
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

## Custom domain — www.freshmxn.com (Hostinger)

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
5. Tell Claude to remove the `noindex` tag from `Frontend/public/index.html` so Google can list the
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
- **Redis usage.** Idle workers make ~2.5 requests/minute each (~220k/month for both) — measured
  with Redis MONITOR on this exact code. Check Upstash → your DB → **Usage** after a day. If it is
  high, raise `WORKER_DRAIN_DELAY_S` to `120` in Render → Environment — no code change, and jobs are
  still picked up instantly.
- **Redeploys never lose a job.** Workers get ~30 s to finish; anything cut off re-runs by itself
  within ~4 minutes.
- **Upstash restricts `CLIENT LIST`**, so `pipeline:status` without `--probe` under-reports workers
  (Day 4 §6). Not an error.
- **Moving to paid workers later:** see the commented section at the bottom of `render.yaml`.
