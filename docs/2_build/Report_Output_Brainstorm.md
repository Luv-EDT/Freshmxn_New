# Report output — brainstorm (Sept 2026)

**Status:** answered by the owner (2026-09-29) and built in Round 9 — see §8 and the handover.

**The problem (owner):** the report gives a superficial understanding. A student sees which careers fit
but not **what to do next** — this year, at their stage. `Backend/data/ALL-professions.json` holds much
more than the report uses. Everything below is measured against the real file (223 professions).

---

## 1. Why it feels superficial today

1. **Nothing in a card is about *you*.** It's the same for every student: what the career is, the path,
   exams, pay, demand, AI. The data that says why *you* fit and what *you* would need to work on exists
   in every ranked entry (`supportingFactors`, `divergingFactors`, `matchedBy`), but it isn't shown.
2. **The report doesn't change enough by stage.** A Class 9 student and a working professional get the
   same card. The only per-stage touches are "your next step" on the path, the runway note and the
   switching-cost sort.
3. **Useful fields are sent to the browser and never rendered.**
   - `degreeDependency`, `midStreamEntry`, `afterUndergrad` and `class12Prerequisite` answer "can I get
     there from here, and do I need a master's?".
   - `entryWindow` and its **bypass routes** answer "am I too late, and what's the other way in?".
   - `selfEmployment` and `payback_years` answer "can I do this on my own, and when does it pay back?".
4. **There's no plan.** Nothing turns the top matches into "in the next 12 months, do these 3 things".
   The model's `nextSteps` prose is general. The derived "What to do next" list is short and only
   looks at the top 3.
5. **The class 9–10 stream headline was never built.** The master plan (§5.5) specified a headline like
   *"Commerce keeps 38 of your careers open, PCM 34, PCB 21"*. It is the single most useful thing a
   Class 9–10 student can be told, and it isn't in the report.

---

## 2. The fields — what each one can tell a student

Coverage is out of 223. "Shown" means it's visible in the report card today.

| Field | What it holds | Coverage | Shown? | What it answers for the student |
|---|---|---|---|---|
| `one_liner` | one sentence on the work | 223 | ✅ | "What is this, really?" |
| `job_roles` | named roles (avg ~8) | 223 | ✅ (8 + "and N more") | "What would my job title be?" · internship and search terms |
| `role_spread` | `narrow`/`wide` (79/144) + `deviating_roles` (which roles lean on which traits) | 223 | ✅ only when there are deviating roles | "**Which roles inside this career suit *me*?**" (joined with the student's profile) |
| `industrial_sectors` | where the work happens | 223 | ✅ | "Who hires for this?" |
| `degree_dependency` | `undergrad` 112 · `certificate` 58 · `none` 27 · `professional` 26 | 223 | ❌ | "**Do I need a degree at all?**" A strong reassurance line for many students |
| `mid_stream_entry` | `open` 95 · `after_any_degree` 70 · `restart_undergrad` 58 | 223 | ❌ | "**Can I switch in from what I'm doing now, or must I start over?**" — the key line for college and working students |
| `class12_prerequisite` | `any` 161 · specific subject sets for the rest | 223 | ❌ (used only as a filter) | "**Which stream / subjects keep this open?**" — the heart of the Class 9–10 headline |
| `path_to_entry` | 3–6 steps, each with a `stage` and plain `requirement` | 223 | ✅ (levelled, "your next step") | "What are the steps, and which one is mine now?" |
| `entrance_exams` | public routes, private entrances, a note | 223 | ✅ | "Which exams?" |
| `entry_competition` + `entrance_gates.json` | primary gate, applicants per seat, preparation years | 83 | ✅ partly | "**How hard is the door?**" (e.g. "about 23 people per seat, usually 2 years of preparation") |
| `entry_window` | max years since class 12, hard block?, the constrained route, **bypass routes** | 32 | ❌ | "**Is there a deadline — and if I miss it, what's the other way in?**" (e.g. JEE only for recent pass-outs → diploma + lateral entry) |
| `licensing_body` | the regulator for 31 careers | 31 | ✅ one line | "Do I need a licence, and who gives it?" |
| `years_to_qualify` | 1–9 years | 223 | ✅ | "How long until I can work?" |
| `economics` | cost of entry (₹L), early and mid pay (₹L p.a.), midpoint, **payback years**, distribution (range / power-law / bimodal), basis | 223 (68 verified, 155 judgment) | ✅ except payback | "What does it cost, what does it pay, **when does it pay back**?" |
| `demand_signal` | `high` 101 · `moderate` 97 · `low` 23 · `declining` 2 · pathway (India / anywhere) | 223 | ✅ | "Will there be jobs?" · "can I do this from India for anywhere?" |
| `after_undergrad` | `work_first` 144 · `masters_advantage` 47 · `masters_required` 29 · `masters_is_the_entry` 3 | 223 | ❌ | "**Master's now, or work first?**" — the question every college student asks |
| `self_employment` | `common` 97 · `possible_later` 74 · `rare` 52 · route | 223 (ceiling only 3) | ❌ | "**Could I do this for myself one day, and how?**" |
| `ai_exposure` | band (low 156 · medium 54 · high 13), raw score, reason, work composition, legal accountability | 223 | ✅ band + reason | "Will AI take this?" — the composition could show *which part* of the work is exposed |
| `nuances` | caveats attached to a field | 199 (90 withheld) | ✅ whitelisted ones | "What's the catch?" |
| `verification` | tier A/B/C, status, checked-on date | 223 | ❌ | Trust signal: "pay figures checked Aug 2026" |
| From the match (per student) | `supportingFactors` / `divergingFactors`, `matchedBy` (the activity that led here), `wastedYears`, `tier` | every ranked entry | ❌ (removed on request) | "**Why me**" and "**what to work on**" |
| From `baseline_rating.json` | the 27-trait demand profile of each career | 223 | ❌ | "What this career asks of you, compared with you" |

---

## 3. The shift: from "facts about careers" to "your next moves"

Every card, and the report as a whole, should answer three questions in this order:

1. **Why this fits you** — one line: *"It uses what you're strongest at: logical reasoning and focus.
   You got here through your coding club."*
2. **What you'd do next, at your stage** — up to 3 concrete actions, derived from the data (not model
   prose). Examples:
   - "Take Maths in Class 11 — this needs PCM."
   - "Register for JEE Main — it only admits recent Class 12 pass-outs; if you miss it, a 3-year diploma
     then lateral entry still gets you in."
   - "Build 2 projects on GitHub — that's what gets you hired."
3. **What to know before committing** — the door (competition, deadline, licence), the money (cost,
   pay, payback), the future (demand, AI, self-employment) and the catch (nuances).

**A caution on (1).** The owner removed the "why we selected this" tags in Round 5. Those were
engine-speak ("Reached through something you do now…"). This proposal is different: it names *your
strengths* and *your activity* in plain words. §7 Q1 asks whether it's wanted.

---

## 4. By journey — what the report should lead with

### Class 9–10 — "choose your stream with your eyes open"
- **Report headline: a stream map.** For the student's top ~20 matches, count how many each stream
  keeps open (`class12_prerequisite`) — for example: *"Commerce keeps 14 of your 20 open · PCM 12 · PCB 7 · Humanities 11
  · any stream: 9 of them."* Also name the careers each stream would close.
- **Per card:** the subjects that keep it open. "Do I need a degree?" (`degree_dependency`). Any early
  deadline (`entry_window`: "decide by Class 12"). One try-it-now idea built from `job_roles`: a club,
  a small project, someone to talk to.
- **12-month plan:** stream choice → 2 try-it activities → retake the assessment next year (the profile
  is provisional).

### Class 11–12 — "your exams and your doors"
- **Report headline: your entrance map.** The exams across the top matches, grouped — for example:
  *"JEE Main opens 6
  of your top 10; CUET opens 8; NID DAT/UCEED opens 2."* Each exam shows its competition
  (applicants per seat, preparation years) and the **deadline risk** from `entry_window`.
- **Per card:** reachable with your stream, or "needs an extra subject — possible via NIOS"
  (switching cost). Public vs private routes. **Cost of entry and payback** (`cost_of_entry_lakh`,
  `payback_years`). The bypass route if the main exam is missed.
- **12-month plan:** which exams to register for, which are backups, and what to do if the main one
  doesn't work out.

### College (pre-admission or enrolled) — "use what you've got"
- **Report headline: from your degree to these careers.** Split the top matches by `mid_stream_entry`:
  *"Open to you now (no restart)"*, *"After you graduate"*, *"Would mean starting a new degree"*. With
  `wastedYears`, that is the switching cost made concrete.
- **Per card:**
  - `after_undergrad`: "Work first — a master's isn't needed" / "A master's helps later" / "A master's
    is required".
  - The next step on the path from your year.
  - Certifications and portfolio items.
  - `job_roles` as internship search terms.
  - `self_employment` route.
- **12-month plan:** one internship target per top career, one certification or portfolio item, and
  the master's decision with its timing.

### Early professional — "what carries over"
- **Report headline: your transferable edge.** Which top matches are `open` or `after_any_degree`, and
  how many years of your experience carry over (switching cost).
- **Per card:**
  - `supportingFactors` phrased as the skills that transfer.
  - `role_spread`: *which roles inside this career suit you*.
  - Payback on retraining.
  - `self_employment` (common / possible later).
  - AI exposure by *which part of the work* (`work_composition`).
- **12-month plan:** a bridge role, the one credential that matters, and a mentor conversation (Tier 2
  upsell, naturally placed).

---

## 5. A crisper card, the same for every journey

Collapsed, the card stays as it is: **the name only**, with the top 3 coloured (owner's Round 5–6
decisions). Opened, fixed sections in this order, each hidden when it has no data:

1. **What it is** — one-liner, 3 job titles.
2. **Why it fits you** — strengths it uses · the activity that led here · *(one line)*.
3. **Your next steps** — up to 3, derived for your stage (§4).
4. **The road** — path with "you are here", years, exams, competition, deadline + bypass, licence.
5. **Money** — cost to qualify · starting · mid-career · pays back in ~N years · the caveat for
   uneven-pay careers.
6. **The future** — demand · AI (which part of the work) · working for yourself.
7. **Worth knowing** — the whitelisted nuances.

And a **compare view**: tick 2–3 careers and see them side by side (years, cost, pay, demand, AI, the
door). It's cheap to build because every field is already on the page.

---

## 6. Data gaps to know about

- **Pay is mostly judgment:** 155 of 223 economics blocks are `judgment`, 68 `verified`. Say "estimate"
  plainly, and show the verified date where it exists.
- **Competition data is thin:** `entry_competition` exists for 83 careers. Some private gates are
  deliberately blocked in `entrance_gates.json` (no reliable cost/applicant data). Show nothing rather
  than guess.
- **Deadlines:** `entry_window` exists for 32 careers only. That's fine — most careers have no deadline.
  But "no deadline" should be said, not implied.
- **Self-employment income:** `ceiling_lpa` is filled for 3 of 223. Show the route and likelihood,
  never a number.
- **No dates:** no exam calendars, application windows or college lists. The report can name the exam
  but not the date. A small `exam_calendar.json`, maintained yearly, would unlock "register by…".
- **90 withheld nuances** (builder phrasing). A copy pass would recover many "what's the catch" lines.
- **Sector names carry numbers** ("8. Design & Creative Arts") in the source file. Strip them at the
  API, as the card already does.

---

## 7. Questions for the owner

1. **"Why it fits you" — yes or no?** It would be one line naming the student's strengths and the
   activity that led there. This is different from the removed tags.
2. **Where should "next steps" live?** One report-level "Your next 12 months" plan, per-card steps, or
   both?
3. **Class 9–10 stream map** — build it as the report headline? This is recommended: it's the highest
   value for the lowest effort.
4. **Money:** show payback years ("pays back in ~1 year") or keep to ranges?
5. **Compare view** (2–3 careers side by side) — wanted?
6. **Report prose** (`reportComposer.js`): should the model's four sections shrink further so the
   data-driven sections carry the report? The prompt is still awaiting owner approval.
7. **An exam calendar file** — worth maintaining once a year to unlock "register by [date]"?

**Suggested build order once answered:**
1. The card sections using fields already sent to the browser (no backend change).
2. The per-journey headline (stream map / entrance map / degree split / transferable edge).
3. Next steps.
4. Compare view.
5. Exam calendar.

---

## 8. Owner's answers (2026-09-29) and what was built

1. **Why it fits you** — yes. Built from data, one or two plain lines, never a number.
2. **Next steps** — both per card and report-level, and everything collapsible so the report is not overwhelming.
3. **Stream map** — built as the class 9–10 headline.
4. **Money** — ranges only; no payback.
5. **Compare** — its own page (`/report/compare`), linked from the top of the report; the student picks the careers.
6. **Shrink the prose** — `report@3.0.0`: three lines, no model-written next steps, readers 14–25.
7. **Exam calendar** — explained, not built: an alias map from the 174 exam spellings to ~55 real exams, each with "usually opens {months}" plus the official link, re-checked yearly with a staleness fixture.

Later decisions in the same round: `filter_rules.json`'s pay rule becomes a **pay caution** (nothing hidden);
"Show first: core engineering"; a reviewed **blue-collar** list with a tag and an opt-out **filter** (no sort).

