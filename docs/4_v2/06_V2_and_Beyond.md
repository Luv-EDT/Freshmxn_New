# Version 2 and Beyond
## Future scope only

Everything here is **not built**. Each entry says why it waits and what should trigger it. What has
been built lives in `docs/3_handover/HANDOVER.md` (Part 5 is the record), not here. When something
below ships, delete it from this file and record it there.

**The point of this document:** stop good ideas being re-litigated, and stop them being forgotten.

*Rewritten in Round 10 (October 2026). Earlier versions of this file, which mixed done and not-done,
are in git history.*

---

# SOON — before or just after real students

## More closing ranks
Round 12 added the official counselling page for each discipline and seven draft closing-rank rows
(B.Tech CSE at six IITs and NIT Tiruchirappalli), checked by the study bot from August. Still to add:
other branches and programmes (MBBS through MCC, the top NLUs through CLAT, B.Arch, B.Des), more
categories (OBC-NCL, SC, ST, EWS, PwD) and state-quota counselling, and seat counts. Every row must be
read off the official result page, never from memory or a summary site.

## AI cost — Haiku for simple grading
Every Claude call is logged, the monthly research runs as a half-price batch, and the admin chooses
its model after the one-time comparison (all Round 12). Still to try: **Haiku for simple grading
items**, only after an eval against the current grades.

## Mentor suggestions — batch the monthly check
The monthly mentor check (`housekeeping/mentorPass.js`, Round 16) asks Claude directly, at most 20
professions a month. If mentor numbers grow, send it in the data refresh's half-price batch
(`researchBatch.js`) and let `batch_collect` file the answers, as the career questions already are.

## Parent consent by SMS
Parent consent is verified by an emailed code today (`/parent-consent`). Add the same flow by SMS for
parents without email: an Indian DLT-registered sender and template, a 6-digit code, the same
expiry, attempt and resend limits, and rate limits.

**Not phone OTP for student login** — see Considered and rejected.

## Accommodated versions of the timed tasks
Today a student who declares a need can skip an affected timed task, and it is recorded as "not
measured", never as low. The next step is to offer adapted versions instead of only skipping:
- a larger-target SART;
- untimed digit span with audio;
- a screen-reader-friendly reasoning set.

Each adapted version must be normed separately before its score counts.

## A committed end-to-end test suite
The browser and API suites used in the cloud sessions (`uiFlow`, `round3/5/6`, the Round 10 suites,
the API suite) are scratch scripts outside the repo. Turn them into a committed Playwright suite with
a seeded test database, and run it in CI.

## Paid background workers
On the free plan both workers and the housekeeping jobs run inside the web service, and the uptime
ping keeps it awake. Once traffic justifies it:
- switch to Render starter workers (about $7 a month each), using the commented block in
  `render.yaml`;
- set `RUN_WORKERS_IN_WEB=false`.

## Report filters — keep or delete
The AI, demand and pay filters were taken off the report page in Round 6. `missedBy`, `optionCounts`
and `hasData` in `Report/reportFilters.js` are fixture-covered and unused. Either:
- bring them back as a "refine" drawer, if students ask; or
- delete them together with their fixtures.

## Hindi language support
**Deferred because** story equivalence across languages needs native adaptation and back-translation
checking, plus 8 human audio recordings per language.

**Needs, in order:**
1. English master → LLM translation.
2. A bilingual human edit.
3. Back-translation and a fact-list comparison.
4. Two reviewers agreeing on difficulty within 1 point.
5. Human audio recording at about 130 wpm.

**Trigger:** a meaningful share of students choosing Hindi at intake.

Written answers already accept English, Hindi or a mix (typed or, since Round 13, spoken through the
browser's dictation); only the material we present is English-only.

**A Hinglish speech service** (for example Sarvam) if browser dictation turns out poor for Hindi and
Hinglish speakers — it would replace only the speech-to-text step in `Frontend/src/pages/VoiceInput.js`,
and audio would then pass through us, so the Privacy Policy changes with it.

## Design polish
One design pass shipped (Kira-style, teal and navy, a pink accent, Orelega One + Lato). Still to do
after launch: a deeper motion, illustration and brand system.

---

# V2 — AFTER 150+ COMPLETED ASSESSMENTS

## Norms for the in-house reasoning test
The in-house reasoning test (`assessment/reasoningBank.js`) is scored `correct ÷ 16 × 10` and flagged
`provisional_norms`. Once there are enough answers:
1. Estimate each item type's difficulty from real answers, and check that the generator's
   difficulty steps are real steps.
2. Replace raw-share scoring with age-band percentile bands.
3. Drop the "provisional" label at 500+ answers per age band.

## Item analysis and the first instrument revision
The first MAJOR `instrument_version` bump. Expect to cut 4–6 questions with no loss of information.
This covers the questionnaires and the reasoning bank.

**It needs the instrument frozen for the first 150 responses.** Batch every change into one release —
fixing one question in March and another in April splits the data into pools too small to analyse.

## Provisional norms for every factor
Raw scores become percentile bands, and the "provisional" label stays visible until there are 500+
per age band.

**Needed first:** enough responses per age band, and a check for ceiling or floor effects above 20%
on any factor.

## RIASEC in matching
The O\*NET Interest Profiler checklist was removed in Round 13 (it repeated the "what you're drawn to"
items); answers already given are stored but no longer scored or asked. If interest fit is wanted in
matching, it needs a deliberately non-repeating interest measure first. O\*NET publishes RIASEC codes for
occupations, so:
1. Map the 223 careers to O\*NET occupation codes, by hand-checked crosswalk.
2. Give each career a RIASEC code.
3. Add interest fit as a matching input **alongside** the 31 factors, not instead of them.

It needs its own fixtures and a version bump.

## Working abroad — beyond the licence route
Round 13 says how each career travels and, for licensed careers, what the top five countries ask first.
Still out on purpose: foreign pay and demand figures. Next step, once there are real students: an
"also in demand abroad" link per career to the official occupation pages (US BLS Occupational Outlook,
Canada Job Bank, UK National Careers Service, Australia's Your Career) after the careers are mapped to
those countries' occupation codes; and licence routes for the other 16 re-qualify careers.

## Adaptive item selection
Stop asking questions whose answer is already predictable from earlier responses. This could cut
20–30% of the assessment's length at no cost to reliability.

**Needs:** item-level response data from 300+ students. It genuinely cannot be built earlier.

## Longitudinal delay comparison
The 24-hour versus same-session question for story recall, settled with data. `delay_minutes` is
stored on every record for exactly this.

## Mentor tier — full automation
V1 has mentor onboarding, a paid waitlist and admin matching within 20 business days. Still to build:
- automatic mentor-to-student matching, keyed on the student's chosen career;
- in-app scheduling for the two sessions (a 1-hour clarity session and a 20-minute follow-up);
- session delivery and mentor payouts;
- **a mentor / counsellor portal** for `mentor_overrides` (a schema field with no interface today),
  and the loop that refreshes the baseline ratings from those overrides. Fifty logged overrides will
  teach more about rating errors than a thousand assessments. **Trigger:** about 50 overrides.

## Payments — Razorpay live
V1 runs in `manual` payment mode. Razorpay is built and dormant behind `PAYMENT_MODE`.
- Turning it on is blocked on Razorpay KYC. It is the same `grantAccess` seam, so there is no rework.
- Razorpay Offers could replace the server-side coupon maths.

## Auth — richer flows
- Magic-link login.
- Redis-backed rate limiting, needed only once there is more than one server instance.

## ⚠ DPDP under-18 behavioural tracking
There is still **no events collection, no counters and no `dwell_ms`** anywhere — which is the safe
state, because no per-child trail exists. What is lost until then is the content signal "is this
career ever expanded?".

**⚠ THE TRAP:** the split between aggregate and per-user data must be in place the **first time a single
event is written**. Ship both halves in the same release, or every event in the gap is a per-child
behavioural record that should never have existed.

## Data refresh into the source files
The monthly refresh's approved values are a database layer, and are exported as a patch
(`tools/applyDataPatch.js`). If the per-sector source files behind `ALL-professions.json` come back
into the repo, the patch should write to them instead.

---

# V3 — AFTER OUTCOME DATA (18–24 MONTHS)

The 6- and 12-month follow-up now runs (a monthly scan from each student's latest assessment, emailed form). The first answers arrive six months
after the first real reports. Everything below waits for them.

## Fitted weights (machine learning)
Every weight in the model is expert judgement today. Replacing them needs 220–440 students who
completed the assessment **and** answered the follow-up.

The method:
- ridge regression with an 80/20 split;
- **if fitted weights do not beat equal weights on the held-out set, keep equal weights.** That is a
  common result and not a failure.

No model fine-tuning is involved; the AI only writes text and grades answers.

## Learned ranking
The target is outcome satisfaction from the follow-up. **Never clicks:** tuning on engagement would
learn to surface pilot, actor and entrepreneur, and would look like it was improving the entire time
it got worse.

## Showing match confidence beside a career
Students see "Partial · N% measured" today, which is coverage, not confidence. Whether a separate
confidence mark helps is a question for outcome data. At about 150 recommendations containing a null,
compare follow-up outcomes between the high- and low-coverage groups:
- if low-coverage matches really fare worse, say so more strongly;
- if they do not, keep the plain coverage line.

## Professional benchmarking at scale
15–20 careers × 20–30 professionals each, compared on **ipsatised profile shape**, never absolute
levels. A professional's profile is an endpoint shaped by years in the role, not an entry requirement.

## Correcting effective-weight leakage
Emotional stability is stated at 0.20 in firmness but runs at 0.270 across all paths. It was left
uncorrected in V1 by decision. Revisit once the weights are fitted rather than judged.

---

# CONSIDERED AND REJECTED

Not "later" — decided against.

| Idea | Why not |
|---|---|
| **Fine-tuning an LLM on responses** | Rubric scoring and report writing are controlled better by prompts. Fine-tuning freezes the rubric, so every revision means retraining. |
| **Lateral thinking as a factor** | Built from four of the same inputs as divergent thinking. It would correlate about 0.8 and add a dimension without adding discrimination. |
| **Introversion as a separate factor** | It is the low pole of Extraversion, which is already measured. |
| **Grit as its own scale** | Credé et al. (2017): grit is largely conscientiousness relabelled. The persistence items feed consistency; they are not a separate score. |
| **IPIP-NEO-120 for facets** | About 10 extra minutes for facets that matching never uses. Consistency is already built from conscientiousness, focus, decision-making and the persistence items (owner, Round 10). |
| **Optimising recommendations on clicks** | It would degrade the advice while every dashboard metric improved. |
| **Phone OTP for student login** | SMS-pumping fraud. Parent consent by SMS is different: one per account, after signup, rate-limited. |
| **Imputing averages for invalid or skipped modules** | That records a measurement that was never taken, and it becomes invisible downstream. A skipped task is "not measured". |
| **Values gap in the report** | It is directional rather than developmental, and a difference score compounds the error of both measures it is built from. |
| **Scraping LinkedIn or X for the data refresh** | Terms of service, legal risk, and personal data under the DPDP Act. Only licensed APIs and published reports are used. |
