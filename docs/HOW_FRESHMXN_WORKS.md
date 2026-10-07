# How Freshmxn works — explained simply

*Written so a Class 7 student could follow it. If you're a developer, every part names the real file
so you can go and look.*

> **Keep this updated.** Whenever we add or change a feature, add a line here in the same plain
> words. If this file and the code disagree, the code is right and this file needs fixing.
> Last updated: October 2026 (Round 10).

---

## 1. The big picture — Freshmxn is like a school

Imagine a school that helps you find the right career:

| In the school | In Freshmxn | The real thing |
|---|---|---|
| **The reception desk** — where you walk in, fill forms and read notices | the **website** you see | `Frontend/` (React) |
| **The office** — checks who you are, takes your forms, files them | the **server** | `Backend/server.js` + `Backend/Routers/` (Express) |
| **The filing cabinet** — where every form and result is kept | the **database** | MongoDB Atlas |
| **The in-tray** — a tray where "jobs to do" wait their turn | the **job queue** | a `jobs` drawer in the same MongoDB filing cabinet (`workers/jobQueue.js`, since Round 22) |
| **The back-room team** — teachers who mark your tests later, so you don't wait at the desk | the **workers** | `Backend/workers/` |
| **The expert helpers the school calls** | outside services | Claude (AI), Voyage (word-matching), Resend (email), Google (sign-in), Razorpay (payments) |

```
   YOU (phone / laptop)
        │  1. you click something
        ▼
   ┌──────────────┐   2. "please do this"   ┌──────────────┐   3. read / write   ┌─────────────────┐
   │  WEBSITE     │ ──────────────────────▶ │   SERVER     │ ─────────────────▶ │  DATABASE        │
   │  (reception) │ ◀────────────────────── │   (office)   │ ◀───────────────── │  (filing cabinet)│
   └──────────────┘   5. "here you go"      └──────┬───────┘                    └─────────────────┘
                                                   │ 4. big jobs go in the tray
                                                   ▼
                                            ┌──────────────┐    ┌──────────────────────────┐
                                            │  IN-TRAY      │ ─▶ │  WORKERS (back room)      │
                                            │  (MongoDB)    │    │  mark tests, write report │
                                            └──────────────┘    └──────────────────────────┘
```

Every click that needs something from the office is a **request**. The website sends it, the server
answers, and the website shows the answer. Every answer comes back in the same shape:
`{ success: true/false, message: "...", data: ... }` — like every letter from the office using the
same template.

---

## 2. Signing up and logging in

1. You type your name, email and password on the **Register** page (`Frontend/src/pages/Register.js`).
   If you're under 18, you also give your parent's name, mobile and **email**.
2. The website sends that to the server: `POST /user/register` (`Backend/Routers/userRouter.js`).
3. The server **never stores your password as-is**. It scrambles it with *bcrypt* — like putting it
   through a paper shredder that always shreds the same way, so it can check a password later
   without ever keeping the real one.
4. It saves you in the filing cabinet (the `users` collection) and, for under-18s, saves the
   parent's permission with the time, your IP address and the policy version (`consents`).
5. It emails you a "verify your email" link (through **Resend**).
6. When you log in, the server gives the website a **token** (a *JWT*) — think of it as a
   **visitor's pass** with your name on it and a signature the office can check. The website keeps
   it in your browser and shows it with every request (`apiCall/axiosInstance.js`), so you don't
   log in again on every page.
7. **"Sign in with Google"** works the same way, except Google vouches for who you are
   (`/auth/google`).
8. **Under 18? Your parent says yes by email.** On `/parent-consent` you press a button and your
   parent gets a 6-digit code by email (`POST /consent/sendParentOtp`). You type it in
   (`/consent/verifyParentOtp`). The code is stored shredded (like a password), works for 10 minutes
   and allows 5 tries. Until it's done you can look around but not pay. (SMS comes later.)

---

## 3. Paying

Right now payments are in **manual mode**: you ask for access (`POST /payments/requestAccess`), our
team calls you, collects the money, and the admin presses **Grant** in the admin dashboard. That one
button (`grantAccess` in `paymentsRouter.js`) unlocks your plan. When online payments (Razorpay) are
switched on, Razorpay will press the same button automatically after you pay — nothing else changes.

Prices are never typed into the website; it always asks the server (`GET /payments/getPricing`), so
there is only one place to change them (`Backend/utils/plans.js`). There are three **plans**:

| Plan | Price | What you get |
|---|---|---|
| **Career Discovery** | ₹2,499 | the assessment and your ranked career report |
| **Discovery + Mentor** | ₹5,499 | both — and the mentor is picked from your own report |
| **Mentor Only** | ₹2,999 | skip the assessment: choose a career and a job role (or describe your own), get a mentor |

Adding a mentor to Career Discovery later costs the difference (₹3,000); adding Career Discovery to
Mentor Only costs ₹2,500. A Mentor Only student cannot open the assessment or the report — the server
checks this on every one of those pages (`middlewares/requireDiscovery.js`).

---

## 4. Telling us your story and taking the assessment

- **The interest form** is where you tell us what you love, what you've actually done, problems you
  care about and what you want to be. Each stage of your life is a set of cards with a plain question,
  a "See examples" fold, and your answers as little chips. Every step is saved as you go
  (`POST /submissions/saveInterest`), so closing the tab loses nothing. College students also tell us
  their degree and subject, working people their degree and field — so the report can say "your
  B.Com already counts".
- **"← Dashboard"** (Round 19) is always in sight on the interest form, the assessment, the report, the
  matches page, compare and the mentor page — those pages no longer show the four-step journey bar (it
  stays on your dashboard). On the interest form it asks first: **Save and go**, **Leave without saving** or
  **Stay**. Inside an assessment questionnaire it offers to save first; inside a test that saves itself it
  warns that leaving mid-test ends it.
- **The stages open in order** (Round 13). You can always go back, but you can't jump ahead, or press
  Finish, while **any** stage you'd skip past has a required answer missing (Round 17: the form checks
  every stage in between, not just the one you're on, and a typed link can't skip either). A box names
  the stage and lists exactly what it still needs, and takes you there. The form remembers how far you got, so next time it says **"Continue where you left off"**.
  It says "already submitted" only after you have pressed Finish. Editing a form you already sent shows
  one **Save changes** button (Round 18). A college student sees the **College** stage unless they said
  they haven't joined yet. For an activity you stopped, "What held you back?" asks what kind of
  **problem** it was — internal, interpersonal or external — or **"Life moved on / time didn't allow"**,
  which is not a problem and never shows up in your challenges.
- **You can speak instead of typing** (Rounds 13 and 17). One **Speak** button beside the written
  answers, including the problem boxes, uses your browser's own speech service. It listens as Indian
  English, which writes Hinglish in Roman letters ("maine 10th mein cricket khela"). The words appear
  in the box **as you speak**, and pressing Stop keeps what was heard. You fix anything before it is
  saved; we never get any audio. Pressing **Add** turns the words into a chip and empties the box; the
  mic stops there, so the old words never come back (Round 18). Hinglish is fine everywhere: the markers judge what you mean, not your
  language or spelling.
- **If you tell us about a disability** in the interest form, it asks which tasks it makes harder (vision,
  hearing, movement, reading, attention). Those timed tests are then **set aside** on the assessment
  page — shown faded, marked "not measured", never a low score — with a small link if you'd like to try
  one anyway. It is never used to rank careers.
- **If you hope to study or work abroad** (No / Maybe / Yes), your report shows a folded "Going abroad"
  part for each career. Nothing else uses that answer. (Round 17: the form no longer asks which countries.)
- **The assessment** (about 81 minutes) is a deck of cards: one big card for the part you're on, arrows to
  move, and a strip showing every part's state — **Done**, **In progress · N% left**, **Set aside** or
  **Answer now**. Story questions that are waiting for you come first, in bold. The parts: a short story
  you're asked about the next day, personality questions, what you're drawn to, how you rate yourself,
  confidence in three situations, how you think (with three short written answers), a number-memory game, **our own word-memory game** (two lists of 15 words, shown one at a time,
  then you type the ones you remember), a focus game (SART), and **our own 16 reasoning puzzles** — picture
  patterns, letter-number series, word problems and 3D shapes (`Assessment/assessmentModules.js`). Round 13
  removed the questions that asked the same thing twice (a 60-activity checklist, a written day plan, three
  "what you're drawn to" items and three confidence situations).
- **Tests you can take only once** (word memory, number memory, the reasoning puzzles, the focus game)
  warn you before you refresh or leave mid-way (Round 17). If you leave anyway, the list or sequence is
  **not shown again** (that would be a second look). You write what you remember, and the admin sees a
  "Left or refreshed mid-test" note so they can allow one retake if something went wrong.
- **How you think** now shows every question it counts (Round 17). Five were counted but never shown,
  which stuck it at "13% left" and kept Submit switched off. "What do you believe in most?" and "What
  most often causes you to lose momentum?" are **tick all that apply**.
- **Each puzzle has its own clock** — 60 seconds for word and series puzzles, 90 for pictures and shapes.
  When it runs out the puzzle counts as not answered and the next one appears. A retake (only if the admin
  allows one) gets a different set of word puzzles and newly made picture puzzles.
- **The puzzles' answers never reach your phone.** The server makes each puzzle from a secret seed,
  sends it without the answer, and marks your pick itself (`/submissions/reasoningNext`,
  `/submissions/reasoningAnswer`). The number-memory and word-memory games work the same way — the
  server marks your words itself, forgiving plurals and one-letter typos in longer words.
- Answers are saved as you go (`POST /submissions/savePsychometric`). The server only accepts the
  parts the page is allowed to write — it never lets the page send its own marks.
- Some parts time you in milliseconds, so they're built very carefully (for example the focus
  game checks your screen is fast enough before it starts, and refuses rather than guesses if it
  isn't).
- **The page tells you how much is measured so far** ("N of 31 factors") and, behind "Why we do this",
  what each part measures and the research behind it.
- **Tests are taken once**, because a second try scores higher from practice alone. If something
  technical goes wrong, press **"Something went wrong with this test"**. The admin sees it (and SART
  problems are caught automatically) and can **allow one retake**. Your old attempt is kept but not
  scored.

---

## 5. Pressing Submit — the big journey

This is the most important part. Marking your assessment and writing your report takes a minute or
two, and some of it depends on outside AI services that can be slow. So **the office doesn't make
you wait at the desk**. Instead:

1. **You press Submit.** The website sends `POST /submissions/submitPsychometric`.
2. **The office drops a job in the in-tray** called `score_profile` and immediately tells you
   "your report is being prepared". *(The job carries your student id, and while one of yours is
   waiting or running a second is not added — so pressing Submit twice doesn't create two jobs. Once
   it is finished, the next Submit makes a new one.)* The in-tray is a drawer in the same database
   (Round 22). It used to be Redis on Upstash, until the free plan's 500,000 commands a month ran out
   before launch — an idle worker with a calendar job waiting was asking Redis "anything for me?" every
   10 seconds — and every Submit, "Try again" and "Update my report" failed. MongoDB has no such limit;
   a worker checks the drawer every 10 seconds, and a job you start is picked up at once. If a job
   can't be put in the tray, the admin gets an **Assessment issue** ("Report could not be queued") and
   an email with the reason.
3. **A back-room worker picks it up** (`workers/scoreProfileWorker.js`) and:
   - **marks your written answers** by asking Claude, with a strict marking scheme
     (`gradeOpenItems.js`, rubrics in `docs/5_finalized/algorithms/llm_scoring_prompts.md`). The
     marks are saved so they're never paid for twice;
   - if Claude is busy or broken, it **tries again later** (up to 5 times, waiting longer each
     time) instead of giving you a zero;
   - **scores your whole profile** (`Backend/scoring/scoreProfile.js`): 22 main traits and 9 extra
     ones, each on a 0–10 scale. This part is pure maths — same answers, same result, every time.
     The "ways of being smart" are built from how you rate yourself and — for spatial, logical and
     verbal — your reasoning puzzles too. It also
     records **how much of each trait was actually measured** (`factor_coverage`);
   - then **drops a second job in the tray**: `generate_report`.
4. **Another worker picks that up** (`workers/generateReportWorker.js`) and:
   - **reads your activities** (`matching/activityResolver.js`) and works out **where each one points**
     (Round 21, owner). A wording we have never seen goes to Claude in one small call that **names** it
     in a few English words — "I have played cricket in my 10th standard", "Maine 10th mein cricket
     khela tha" and "Cricketer" all become "playing cricket" (Round 17) — and says **what it points
     to**: 2–4 areas of work, so "helping servant" → "helping others", pointing to social work, public
     service, NGO and philanthropy, care work. Voyage turns the name and each area into numbers
     (embeddings) and compares them with the 223 careers by meaning; the nearest are pooled, and
     Claude **sorts them strictly** (Round 22, owner): **strong** — doing this activity builds a core
     skill the career is built on (dancing → Dancer & Choreographer, Fitness Trainer) — or **partial** —
     it helps, but it isn't what the work is about (dancing → Actor). Only strong careers join your
     list, as many as there are; "when unsure, leave it out". Partial ones are kept for the admin's
     trace, so a "missing" career can be checked. That shortlist is saved, so each activity is worked
     out only once; an activity saved before Round 22 is sorted again the first time a report uses it. **Activities are not rated any more**: they used to be scored
     on the 27 qualities and had to match each career's ratings at 0.80, which kept Dancer &
     Choreographer out of a dancer's list (a hobby's "what it demands, mostly 0" against a career's
     full job profile). Now every career an activity points to joins your list, and **your own
     measured profile** decides how well it fits you. All the
     new wordings in a report go in one small, cheap call; the student's own words are kept on the row
     (the latest 200), so the same words are recognised next time with no call at all.
     **How "the same activity" is decided:** the exact same words (ignoring capitals and spaces), or the
     same activity name, reuse the saved shortlist. Otherwise, if the meaning is at least **90% similar** (a cosine of 0.90 between
     the two sets of numbers) to an activity already worked out — "i play cricket for my school team" and
     "playing cricket" — it reuses that shortlist too; below that it is worked out fresh. An activity
     saved before Round 21 gets its "points to" areas once, the first time a report uses it. Each such reuse is
     recorded with its similarity, and the admin's **Activity matches** tab lists the closest calls
     first with a **"Not the same"** button that splits a wrong one off for every later student. The
     90% is a starting judgement; it can be changed on Render (`ACTIVITY_DEDUP_COSINE`) once real
     answers show where it should sit (Round 14). The same tab can look a student up by email to see
     each of their activities, **what it was read as** (Round 17), what it points to (Round 21) and where each
     career it reached landed in their report. Only activities ticked as
     **ongoing** in Current interests reach this step;
   - **matches you against 223 Indian careers** (`Backend/matching/`), in three steps:
     1. what you've done → which careers it points to;
     2. how well each career fits how you think and work. For each of your qualities we compare
        what you have with what the work asks: **having more than the work asks counts as a full
        fit; only falling short counts against you** (Round 20, owner). Two qualities are
        different — how comfortable you are not knowing the outcome, and how firmly you hold a
        view — because a career can want either end of them, so a gap either way counts. A career
        "fits how you think and work" from **0.85** up (it was 0.7, which nearly every career
        cleared);
     3. **16 tiers**: careers you love *and* have achieved something in *and* that fit you come
        first; within a tier, the careers that fit you best come first. The **switching cost**
        (years of what you've already done that a career would leave behind) no longer reorders
        anything — the report uses it to group (below). If your degree already counts for a career
        (`data/degree_families.json`), it isn't counted as wasted. A career with very different
        roles inside it (a game developer can build VR worlds or write game logic) is also checked
        role by role, and the report names **the roles that suit you best**;
     4. **careers that join two of yours** (`data/combined_careers.json`, 42 hand-checked ones such as
        Sports Journalist or Wildlife Photographer): each has two sides, and if your list or your own
        activities touch both, it is shown in its own short section;
   - **no AI writes anything for the report** (Round 19, owner: "remove the AI summary entirely").
     The report is the ranking plus the data behind each career, so building it costs no AI call
     (`report@4.0.0`). `reportComposer.js` stays in the repo as reference, unused;
   - **files it** in the cabinet (`reports`, `recommendations`).
5. **Meanwhile your report page checks every 5 seconds** (`GET /reports/getMyReport`) and shows
   "preparing" until the report is there — then shows it.

**The report (`/report`) is a short overview** (Round 19, owner), in this order: **"Your report"** at the
top centre; **Your matches** — your top three, with three buttons: "See all N matches", "Combined careers
(N)" (careers that mix two professions, often from different sectors) and "Compare careers"; **What seems
to drive you**; **The five fundamentals** — confidence, sticking with things, picking up new material and
deciding with good information, each as a word (High / Medium / Low) with what it means and why it
matters, and a fifth: **the rest of your qualities**, with a link to your Profile and why they aren't here
(they matter once you've chosen a profession, and then we work on the ones it needs); and **What you said
you wanted**. The last three share one medium heading size; Your matches is only slightly larger (Round 20).

**"See all" opens `/report/matches`**, the whole list: the first **three** of the order you've chosen,
each with its **rank number** (1, 2, 3…) on the left, and a **"Show the other N careers"** button for the
rest (choosing a new order starts again at three). Opened, the list is shown **under its tier headings**
— "Long-time passions you've achieved in", "Current passions", "Fits your profile", "A stretch — …" — only
the ones you have, numbers running on across them (Round 20). Under **Best match**, careers that would leave
**2 or more years** of what you've done behind move into a last fold, "Would cost you 2+ years to switch",
the least affected first; **Best fit, ignoring switching cost** leaves them in their tiers. Nothing is ever
added from outside your list. Just the names, with your top 3 coloured, and a
**Blue-collar** label on hands-on trade careers. The combined careers are at the bottom of this page in the
**same card** as every other career (what it is, why we chose it, why it fits, how people get there).
Above the list, two plain lines say which of your top ten have **good prospects for studying abroad** and
which have **good chances of working abroad** (careers that travel well) — each only when it names something.

Tap a career to open it (Round 18 — everything about a career lives inside it, in one layout):
*what it is* (with its **job roles**, the ones that suit you first, and **where the work happens**, each
folded), **why we chose it for you** (one line from what put it in your list: "Something you've kept up
for years — long distance running — leads here, and you love it; it fits how you think and work"), *why it
fits you* (each strength named once), **what to work on** (the qualities this work leans on where you are well below
what it asks — names only, never a number), and **your next 12 months**. A **college or working student** is never told to start a bachelor's — their
next step is the one after the first degree, unless the career needs its own degree from the start — and
their road leaves out the school steps and the Class 11–12 subjects (Round 19). A master's that isn't
required reads "**usually** not needed". Then folded parts, each split
into the questions a student asks: **the road** (how long and the path · subjects in Class 11–12 — *per
route* where routes differ, e.g. BCA takes any stream but B.Tech needs Physics, Chemistry and Maths · do I
need a degree? · can I move into this from another course or job? · exams · is there a deadline? · where to
study · a master's in India? · studying and working abroad), **money**, **the future** (will there be
jobs? · how AI affects this · can I start my own business or freelance?), and **worth knowing**. Each
short note about the career sits under the part it is about; all 438 were rewritten in plain words
(`nuances[i].student`). The report shows information, not where each fact came from (Round 13). None of
this is written by AI: it is worked out from the career data (`Report/reportPlan.js`, and "what to work on"
on the server from `baseline_rating.json`).

Inside **the road** you also find, where they apply: each **exam** with who runs it, its official site and
when it **usually** opens (`data/exam_calendar.json` — never this year's exact date; you always check the
official site); **where to study** (`data/study_places.json` — the official ranking and regulator lists,
and, once the owner has reviewed them, up to ten colleges, public and private, each saying why it is
there: an NIRF rank where there is one); and whether **studying abroad** helps for that career
(`data/abroad.json`) — never which university.

**Studying and working abroad** (inside the road) says whether studying abroad helps for that career
(`data/abroad.json`) and, if you said you might go abroad, how the career travels (`data/abroad_work.json`:
*travels well*, *a licence first*, or *India-based*). There are no foreign links. Help with studying
or working abroad comes in a future version, so this part has a **waitlist**: tick the box agreeing to be
contacted and press "Join the waitlist" (Round 19, owner — it replaced "we'll connect you with a
consultant", and the report-level "A master's abroad" card is gone). It never ranks careers and never
shows foreign pay.

**"What you said you wanted"** answers every career you named: one line for all ("every career you named
is on our list unless its demand is falling and the pay is weak"), then for each a **direct match** (it is
in your list, at #N, and why it sits there) or an **indirect match** (your words pointed to other careers).
A name that isn't a career — "long distance runner" — is read as an activity ("long distance running")
and still counts in your matches.

**Your report only changes when you do something.** If we improve how we score or match, your report
shows a banner, **"Update my report"** — it never rebuilds by itself. Updating (or resubmitting your
assessment) asks one question: are you still heading the same way, or looking for something new?

**Three filters** sit beside **"Sort your list"** on the matches page: *Leave out blue-collar careers\**
(with the note "\* Some of the most AI-proof careers are blue-collar"), *Core engineering only* and
*Studying abroad helps*. All are off until you turn them on, and the page always says how many
careers they hid, with one tap to show them again. "Sort your list" switches between **Best match** (our
ranking) and **Best fit, ignoring switching cost** (every career stays in its tier), and can then order
each group by pay, demand, speed, AI exposure (with its value shown) or **least switching cost** (Round 20). **"Compare careers →"** opens a page where you pick 2–3 of the careers recommended to
you (nothing is picked for you) and see them side by side, with the same plain questions, "what to work
on" and "worth knowing".

**Your profile** shows your psychometric results in six groups — the four fundamentals, personality ("how
you tend to react to the world"), cognitive abilities, areas you feel drawn to, **two traits that make you
different** (comfort with not knowing the outcome, and how firmly you hold a view you've thought through —
each a position, never high or low, because careers want different amounts of each; Round 20) and ways you
solve problems — each with what it means, every factor as a word
and "Partial · N%" where only part of it could be measured (`Backend/utils/factorGuide.js`). If you answer
the next-day story questions **after** pressing Submit, your profile is scored again with them and your
report rebuilt (Round 18) — before, long-term memory stayed missing and three factors said "Partial".
Long-term memory counts 12 points: 7 from the story's short questions and 5 from what you write in your own
words. If those written answers can't be marked (the marking call failed for good, or the answer was
off-topic), long-term memory stays partial — e.g. 58% is 7 of 12 — and since Round 19 the admin gets an
**Assessment issue** "Story answers couldn't be marked" with the reason, and sees it beside the student's
activity trace.

---

## 6. When things go wrong

| What happens | What the app does |
|---|---|
| Claude or Voyage is briefly down or busy | the worker waits and tries again (a busy Voyage reply is retried within the job, then the whole job up to 5 times, longer gaps each time). A report is never written while an activity could not be read — until then the student keeps their previous report (Round 23); if it still fails, "Try again" and an admin issue saying why |
| Every attempt fails | the student sees **"We hit a problem preparing your report — your answers are safe"** and a **Try again** button (`POST /reports/retryMyReport`) — never an endless spinner |
| The server restarts in the middle of a job | the job's hold runs out (5 minutes) and the next worker takes it over; one cut off more than 3 times is counted as failed |
| A job can't be put in the tray at all | the student sees the server's own reason; the admin gets an Assessment issue "Report could not be queued" with the error, and the Assessment issues tab shows "Job queue: working / not moving / not reachable" |
| You submit again while your report is being made | the newer answers win: when the first job finishes it sees the newer submit and builds again |
| A test broke on your device | the admin's **Assessment issues** list shows it (with an email for serious ones) and the admin can allow one retake |
| Nobody has visited for 15 minutes | on the free plan the server **falls asleep**; the next visitor waits about 50 seconds while it wakes. A job waiting in the tray is picked up as soon as it wakes. A free "pinger" (UptimeRobot) can keep it awake |
| Someone forgets their password | an emailed reset link (`/forgot-password`) |

---

## 6b. Jobs that run on a calendar

A third back-room helper (`workers/housekeepingWorker.js`) does jobs nobody clicks for. Nothing it
finds changes the website until the admin approves it. Each calendar job waits in the same `jobs` drawer
with its due time (India time); when it is done, the next one is put in. One that fell due while the free
server was asleep runs as soon as it wakes (Round 22 — before that the calendar lived in Redis).

| When | Job | What it does |
|---|---|---|
| The 1st of each month, 9:00 India time | **Follow-up** (`housekeeping/followUpScan.js`) | 6 and 12 months after your latest assessment, emails you a link (`/follow-up/…`) to five quick questions: what you're doing now, which career, did a match help. One reminder, then never again. You can opt out. This is how we'll learn, one day, whether our matches really work. The clock restarts only if you told us you're looking for something new |
| The 1st of each month | **Data refresh** (`housekeeping/dataRefresh.js`) | For up to 60 careers, checks job-board numbers (Adzuna) and asks Claude to search a few official sources (government labour survey, National Career Service, India Skills Report, Naukri, LinkedIn's published reports). Suggested changes to **demand and pay** go to the admin's **Data updates** tab. Approved ones show on the career page at once; the ranking itself is never changed by them |
| Every Monday | **Careers scout** (`housekeeping/careerScout.js`) | Collects new job titles from three places — the job board, careers students asked for that we don't have, and the roles the official reports call new or fast-growing. Drops any title that is already one of our ~1,860 job titles (by name or by meaning), keeps the ones far from all our careers or sitting between two, has Claude check pay, AI-safety and growth, and lists them in **Emerging careers**. If the admin approves one, Claude **drafts the whole career** the same careful way the 223 were built (`housekeeping/draftCareer.js`); the admin reads the draft and accepts it or sends it back. An accepted career reaches the site only through a commit |
| The 1st of each month — but only what's in season | **Study bot** (`housekeeping/studyRefresh.js`) | Checks things only when they can have changed (Round 13): an **exam** in the two months before its applications usually open (each on its own official site); **colleges** in September and October, after NIRF publishes (NIRF first, then other published rankings and the regulators); **master's and study-abroad answers** in January, April, July and October (government and university sites only); **closing ranks** August to October (official counselling results); **licences abroad** in January (the licensing body's own site). A month with nothing due makes no AI call. Suggested changes go to **Data updates**; nothing changes until the admin approves. The admin's **Run now** checks everything regardless of season |
| Every hour, at :17 | **Batch collector** (`housekeeping/researchBatch.js`) | The data refresh and the study bot don't wait for Claude's answers one by one. They hand Anthropic all their questions in **one bundle at half price**. Anthropic answers the bundle in the background — usually within the hour, at most a day. This small check asks every hour "is a bundle finished?"; if so it reads the answers, runs exactly the same checks the job would have, and files the suggestions in Data updates. Any answer that came back incomplete or unreadable is asked again the normal way. With no bundle waiting it does nothing and costs nothing |
| Only when the admin presses it | **Model comparison** (`housekeeping/modelCompare.js`) | Asks the same 20 careers of two Claude models (Opus 5.5 and Sonnet 5.5) and shows side by side what each would change, how many pages it cited and what it cost. Nothing is filed. The admin then chooses which model runs the monthly jobs |

**What the AI costs** is measured, not guessed: every Claude call writes down how many tokens it used
(`utils/aiUsage.js`), and the admin dashboard's **AI usage** card adds up the month, job by job.

---

## 7. The mentor part

- **Two pages** (Round 20, owner). `/mentorship` says where you stand first — "Choose the job role you'd
  like a mentor in", or "We're finding your mentor — you chose Founder (…) on 7 Oct; we'll confirm your
  mentor via WhatsApp by 4 Nov … Need to change your choice? Message us on WhatsApp" — then ends with **How
  it works**: the contribution-and-interest paragraph, who your mentor will be, the sessions and the
  20-business-day policy. **Everything you fill in** — the job role, the help you want, what you want to
  know, the abroad tick — is on `/mentorship/choose`; a choice already sent shows there read-only. The
  menu bar has just **Dashboard** (it was "Home"); mentorship is reached from the dashboard.
- **Contribution and interest** (Round 19, owner) open the "How it works" part: everything we help with serves one of
  two things — **contribution** (earning, supporting your family, standing on your own feet: the base of
  Maslow's hierarchy) and **interest**, with passion as its strongest form (what gives meaning whether or
  not it pays: the upper tiers). So the page asks, **for the role you choose, what help do you want?** —
  *career help* (making it my work), *interest / passion help* (pursuing it for meaning, alongside whatever
  pays) or *both* (`helpFocus`, shown to the admin in Mentor Matches).
- **Choosing your mentor's role** (students on a mentor plan): the job roles in each career are listed by
  how well they fit you, and "Suits you" marks the best fits (careers without distinct role types list
  their roles as one group). Under **"What do you want from your mentor?"** the page lists what the
  sessions cover — the day-to-day work, drawbacks and perks, the real picture and the mentor's own story,
  how to get in and the skills, and your questions — with a box for anything specific (600 characters)
  that the admin passes to the mentor, and a tick for help with a master's or settling abroad, which a
  later version will offer (Round 18, `PUT /mentorWaitlist/saveMyHelp`).

- Mentors sign up on their own page (`/mentor/register`, also linked from the home page's top bar and a
  band near the bottom, for visitors who aren't logged in) and fill a profile. Their profession, job
  role and industries are chosen from **our own lists**, so they can be matched exactly. The admin
  approves them, and can search every mentor in the admin's Mentors tab.
- **Mentors check our data.** An approved mentor sees "Check our data for {their profession}": the
  career exactly as students read it — path, exams, where to study, studying abroad, **working abroad
  (each country's licence route, drafts marked)**, **the degrees that already count towards it**,
  master's, pay, demand, AI, things worth knowing — and every quality we rated for it, in words (the eight that matter most open,
  the rest folded). They mark each part "looks
  right" or "needs a change" (with a note and a link), and each quality "about right / higher /
  lower". The sheet says plainly that these details come from our research and AI, improved by mentors.
  **Every answer is kept for good** (Round 17), stacked per profession and per topic: who wants a change,
  and who says it "looks right". A mentor can send again whenever they like; their new answer on a topic
  replaces only their own earlier answer on that topic.
- **Claude weighs the stack once a month.** On the 1st, after the career refresh, Claude looks at every
  topic that has **new** mentor input since last time. It reads the whole stack for that topic (how many
  mentors agree, how many years each has in the field, what we show today, and what was decided last
  month) and may search trusted sources. **Mentors' experience counts as evidence**, so a change can be
  proposed on their consensus alone; one opinion against several who disagree is not enough. A proposed
  change becomes a normal suggested change in the admin's **Data updates**, marked "Mentor + sources",
  with the whole stack beside it. The admin approves or rejects it. A topic Claude keeps as it is is
  listed there too, with its reason.
- **Nothing a mentor says is deleted**, except when the admin presses **"Remove as wrong"** on one
  opinion during that monthly review (logged). A rejected change comes back only when new mentor input
  arrives. There is **one queue**: mentors' changes and the monthly refresh's changes are decided in the
  same place, and a newer suggestion for the same thing replaces an older one, so they never clash.
- **What happens after approval.** A change of pay or demand shows on the site at once. A change of
  wording (what the work is, the path, a quality…) goes into **Export patch** as a "mentor note". Export
  patch is the download of approved changes, needed because the server can't change its own files
  (Render wipes its disk on every deploy). When the patch is committed, Claude Code writes each mentor
  note into the data files. Export patch also copies each profession's whole stack into its
  `mentor_suggestions` in ALL-professions.json. **Nothing changes on the site from a mentor's answer
  alone.**
- A student on the mentor plan opens their matched careers and picks **one job role** inside one of
  them (the roles that suit them best are listed first). That starts a
  **20-business-day** clock. The admin matches a mentor by hand in V1 and the student is told on
  WhatsApp. If no mentor can be found, the money rolls over — or, if you ask, you move back to
  Career Discovery and get **the difference between the two plans** refunded.
- A **Mentor Only** student does the same without a report: they search any of our 223 careers, pick a
  job role (or "something else"), add an industry if they have one in mind, or describe a career we
  don't list ("Other" — the admin finds a mentor for it separately). If no mentor can be found they
  can keep waiting or ask for a **full refund**.

---

## 8. Where everything lives on the internet

| Service | What it does for us |
|---|---|
| **Render** | runs the server, the website and both workers — all in one free "web service" (`render.yaml`) |
| **MongoDB Atlas** | the filing cabinet (database) — and, since Round 22, the in-tray too |
| **Cloudflare** | the address book that sends `www.freshmxn.com` to Render (DNS) |
| **Resend** | sends emails |
| **Google** | "Sign in with Google" |
| **Anthropic (Claude)** | marks written answers, rates new activities, writes the report, and runs the monthly and weekly checks (data refresh, scout, study bot, career drafts). It reads test screenshots only for older uploads |
| **Voyage AI** | turns activities, careers and new job titles into comparable numbers (embeddings) |
| **Adzuna** | a licensed job-board API: how many jobs and what they pay, for the monthly refresh and the scout |
| **Razorpay** | online payments (switched off until KYC) |
| **GitHub** | stores the code; every push to `main` makes Render rebuild the site |

---

## 9. Words you'll hear

- **Frontend / backend** — the part you see / the part that does the work behind it.
- **Request / response** — a question from the website / the server's answer.
- **Route** — the address of one kind of request, like `/reports/getMyReport`.
- **Database / collection** — the filing cabinet / one drawer in it (`users`, `reports`…).
- **Queue / job / worker** — the in-tray / one task in it / the helper who does the task.
- **Token (JWT)** — your visitor's pass after logging in.
- **Hashing (bcrypt)** — shredding a password so it can be checked but never read.
- **Fixture** — an automatic test with a known right answer (`Backend/*/fixtures/`). If a change
  breaks the maths, a fixture fails before any student sees it.
- **Deploy** — putting the new version live.
- **Switching cost** — how much of what you've already done you'd leave behind by changing to a
  career.
- **Tier** — a group in the ranking; there are 16, shown as 5 bands in "How this list is ordered".
- **Coverage** — how much of what a trait needs was actually measured for you. Under 100% it shows as
  "Partial · N%" on the assessment page and your profile (not on the careers).
- **Override** — an admin-approved new value for a career's demand or pay, shown on top of the data file.
