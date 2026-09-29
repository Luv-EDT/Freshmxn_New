# Freshmxn docs — start here

Every project document, and when to read it. Numbers give the reading order.

| Where | File | What it is · when to read it |
|---|---|---|
| `docs/` | **HOW_FRESHMXN_WORKS.md** | The whole system in plain words — front end → server → queue → workers → database. **Living**: update it with every feature. Read first if you're new |
| **1_research/** | 00_Master_Plan_and_Theory.md | The *what and why*: the theory, the 22+9 factor model, the two-part system, product & commercials. Starts with a **★ Current state (Sept 2026)** table of what changed during the build |
| | 00_Research_Summary_FROZEN.md | The frozen Part-1 research the assessment is built on. Never edited |
| **2_build/** | 01_Build_PRD.md | The *how*: architecture, schemas, routes, integrations, the build order |
| | CODING_STYLE.md | House style every file follows (router → model, `{ success, message, data }`, no semicolons, 4 spaces) |
| | DEPLOY.md | The deploy runbook: Render, Atlas, Upstash, Google OAuth, Cloudflare DNS, moving the site to `main`; also why `render.yaml` (repo root) and this file are separate |
| | Report_Output_Brainstorm.md | What `ALL-professions.json` holds and how a richer, journey-shaped report could use it — discussion, with open questions for the owner |
| **3_handover/** | HANDOVER.md | **The single handover**: where things stand, how to run and test, open items and owner gates, decisions that must not drift, then the full day-by-day record (Day 1 → Day 5 and its rounds) |
| **4_v2/** | 06_V2_and_Beyond.md | Everything deliberately deferred — instrument (V1.1 → V3), product and platform, and the Day 5 addendum (backend-review items, report output, ops, legal) |
| **5_finalized/algorithms/** | 04_Item_Bank.md | Every assessment item and the SART spec (§6). Fixtures check the code against it |
| | 05_Story_Bank.md | The story-recall stories and the free-recall marking prompt — **read by the running pipeline** |
| | llm_scoring_prompts.md | The rubrics Claude marks written answers with — **read by the running pipeline** (`Backend/workers/gradeOpenItems.js`) |
| | Perspective_Section_FINAL.md | The "How you think" section, finalised |
| | perspective_scoring_final.js · sart_scoring.js | The original scoring references; `Backend/scoring/` holds the ports ("ported unchanged") |
| **5_finalized/content/** | landing_page_content_v3.md · success_stories_page.md · mentor_waitlist_page.md | The public-site copy the pages are built from |
| **6_media/** | founder_photo.jpg · Frontendref1.png · Frontendref2.png | The owner's photo (original; the site uses a crop in `Frontend/public/founder.jpg`) and the two design references |

**Not in `docs/`, on purpose:** `render.yaml` (Render only reads it at the repo root) and
`CLAUDE.md` (Claude Code loads it from the root).

⚠ **Two docs are part of the pipeline.** `llm_scoring_prompts.md` and `05_Story_Bank.md` are parsed at
runtime. Don't rename or move them, or change their headings, without updating
`Backend/workers/gradeOpenItems.js` — the worker fixtures will tell you if you broke it.
