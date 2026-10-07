# Freshmxn — notes for Claude Code

Career-guidance web app for Indian students (www.freshmxn.com). React (CRA) + antd in `Frontend/`,
Express 5 + Mongoose in `Backend/`, with the job queue kept in MongoDB (`workers/jobQueue.js` — no
Redis since Round 22). One free Render web service runs the API, the built site and the workers
(`render.yaml`, deploys from `main`).

## Read first
1. `docs/3_handover/HANDOVER.md` — Part 1 (where things stand) and Part 3 (open items, owner gates).
2. `docs/README.md` — where every document is.
3. `docs/HOW_FRESHMXN_WORKS.md` — the request → server → queue → worker → database flow.

## House rules
- Follow `docs/2_build/CODING_STYLE.md`: router → model (no controllers/services), every response
  `{ success, message, data }`, one try/catch returning 500 per handler, double quotes, **no
  semicolons**, 4-space indent. Match the comment density of the file you're in.
- Never show a student `match_confidence` or `data_quality`; confidence is shown only as a word level
  (High / Medium / Low), never a number (owner, Round 18);
  uncertainty tolerance and firmness are positions, not levels (owner, Round 20). The one owner-approved exception is the coverage
  line "Partial · N%" (a share, never the raw field) — on the assessment page and the profile only,
  never on a career card or the compare page (owner, Round 13).
- Disability answers never rank, hide or score a career; a skipped task is "not measured", never low.
- Nothing from the data refresh or the careers scout changes the product without an admin approval,
  and matching never reads the overrides.
- The word "optional" never appears in student-facing assessment code.
- Don't touch SART stimulus rendering (`Sart.js` stimulus block, `FONT_SIZES`, `sartTask.js`).
- Prices come from the server (`GET /payments/getPricing`), never from copy.
- An API prefix must never equal a page URL (a page refresh would 404).
- A failed report is `User.reportFailedAt`, never a `progress.report` value.
- The fixtures read some frontend files and two docs **as text** — if one fails after an edit, fix
  the code, don't weaken the fixture (unless the owner changed the product; then say so).
- Never commit `.env` or keys. Never publish the company PAN/TAN.

## Data patches (owner, Round 17)
When the owner gives you an exported data patch, run `node Backend/tools/applyDataPatch.js <file> --write`,
then also apply its `mentorNotes` (approved mentor wording) by hand. Write each edit into
ALL-professions.json, or into baseline_rating.json for a quality (one level at most). Then run the
fixtures and commit. If `profession_embeddings.json` lists `pending_reembed`, run
`node Backend/tools/verifyEmbeddings.js --write` (needs VOYAGE_API_KEY).

## Test before every commit
```
node Backend/scoring/fixtures/runFixtures.js     # 25/25
node Backend/matching/fixtures/runFixtures.js    # 66/66
node Backend/workers/fixtures/runFixtures.js     # 191/191
cd Frontend && CI=false npm run build            # 8 known warnings, no new ones
```

## Keep the docs current
Every change that ships: add it to `docs/3_handover/HANDOVER.md` (Part 3 if it opens or closes an
item, Part 5 for the record) and, if behaviour changed, to `docs/HOW_FRESHMXN_WORKS.md` in the same
plain words. Anything deferred goes in `docs/4_v2/06_V2_and_Beyond.md`.
