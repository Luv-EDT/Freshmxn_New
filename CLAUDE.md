# Freshmxn — notes for Claude Code

Career-guidance web app for Indian students (www.freshmxn.com). React (CRA) + antd in `Frontend/`,
Express 5 + Mongoose + BullMQ in `Backend/`. One free Render web service runs the API, the built
site and both workers (`render.yaml`, deploys from `main`).

## Read first
1. `docs/3_handover/HANDOVER.md` — Part 1 (where things stand) and Part 3 (open items, owner gates).
2. `docs/README.md` — where every document is.
3. `docs/HOW_FRESHMXN_WORKS.md` — the request → server → queue → worker → database flow.

## House rules
- Follow `docs/2_build/CODING_STYLE.md`: router → model (no controllers/services), every response
  `{ success, message, data }`, one try/catch returning 500 per handler, double quotes, **no
  semicolons**, 4-space indent. Match the comment density of the file you're in.
- Never show a student `match_confidence` or `data_quality`; confidence is never a score;
  uncertainty tolerance is a position, not a level.
- The word "optional" never appears in student-facing assessment code.
- Don't touch SART stimulus rendering (`Sart.js` stimulus block, `FONT_SIZES`, `sartTask.js`).
- Prices come from the server (`GET /payments/getPricing`), never from copy.
- An API prefix must never equal a page URL (a page refresh would 404).
- A failed report is `User.reportFailedAt`, never a `progress.report` value.
- The fixtures read some frontend files and two docs **as text** — if one fails after an edit, fix
  the code, don't weaken the fixture (unless the owner changed the product; then say so).
- Never commit `.env` or keys. Never publish the company PAN/TAN.

## Test before every commit
```
node Backend/scoring/fixtures/runFixtures.js     # 22/22
node Backend/matching/fixtures/runFixtures.js    # 51/51
node Backend/workers/fixtures/runFixtures.js     # 102/102
cd Frontend && CI=false npm run build            # 8 known warnings, no new ones
```

## Keep the docs current
Every change that ships: add it to `docs/3_handover/HANDOVER.md` (Part 3 if it opens or closes an
item, Part 5 for the record) and, if behaviour changed, to `docs/HOW_FRESHMXN_WORKS.md` in the same
plain words. Anything deferred goes in `docs/4_v2/06_V2_and_Beyond.md`.
