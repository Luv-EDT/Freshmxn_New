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
| **The in-tray** — a tray where "jobs to do" wait their turn | the **job queue** | Redis on Upstash (BullMQ) |
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
                                            │  (Redis)      │    │  mark tests, write report │
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
- **The assessment** has these parts: a short story you're asked about the next day, personality
  questions, what you're drawn to, a checklist of 60 everyday activities you'd enjoy (from the US
  government's free O\*NET list), how you rate yourself, confidence, how you think (with short written
  answers), a number-memory game, **our own word-memory game** (two lists of 15 words, shown one at a time,
  then you type the ones you remember), a focus game (SART), and **our own 16 reasoning puzzles** — picture
  patterns, letter-number series, word problems and 3D shapes (`Assessment/assessmentModules.js`).
- **The puzzles' answers never reach your phone.** The server makes each puzzle from a secret seed,
  sends it without the answer, and marks your pick itself (`/submissions/reasoningNext`,
  `/submissions/reasoningAnswer`). The number-memory and word-memory games work the same way — the
  server marks your words itself, forgiving plurals and one-letter typos in longer words.
- Answers are saved as you go (`POST /submissions/savePsychometric`). The server only accepts the
  parts the page is allowed to write — it never lets the page send its own marks.
- Some parts time you in milliseconds, so they're built very carefully (for example the focus
  game checks your screen is fast enough before it starts, and refuses rather than guesses if it
  isn't).
- **If a timed task would be unfair to you** (you said vision, hearing, movement, reading or attention
  makes it harder), you can skip it. It is then marked **"not measured"** — never a low score — and the
  maths simply works with what it has. It is never used to rank careers.
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
   "your report is being prepared". *(The job's name is your student id, so pressing Submit twice
   doesn't create two jobs.)*
3. **A back-room worker picks it up** (`workers/scoreProfileWorker.js`) and:
   - **marks your written answers** by asking Claude, with a strict marking scheme
     (`gradeOpenItems.js`, rubrics in `docs/5_finalized/algorithms/llm_scoring_prompts.md`). The
     marks are saved so they're never paid for twice;
   - if Claude is busy or broken, it **tries again later** (up to 5 times, waiting longer each
     time) instead of giving you a zero;
   - **scores your whole profile** (`Backend/scoring/scoreProfile.js`): 22 main traits and 9 extra
     ones, each on a 0–10 scale. This part is pure maths — same answers, same result, every time.
     The "ways of being smart" are built from up to three parts: how you rate yourself, the O\*NET
     activities you ticked, and — for spatial, logical and verbal — your reasoning puzzles. It also
     records **how much of each trait was actually measured** (`factor_coverage`);
   - then **drops a second job in the tray**: `generate_report`.
4. **Another worker picks that up** (`workers/generateReportWorker.js`) and:
   - **reads your activities** (`matching/activityResolver.js`) — Voyage turns each thing you've done
     into numbers so it can be compared with careers, and Claude rates any activity it hasn't seen
     before on the same 27-trait scale the careers were rated on (saved, so it's rated only once).
     That's how "running the school fest stage design" can be compared with "Product Designer";
   - **matches you against 223 Indian careers** (`Backend/matching/`), in three steps:
     1. what you've done → which careers it points to;
     2. how well each career fits how you think and work;
     3. **16 tiers**: careers you love *and* have achieved something in *and* that fit you come
        first; within a tier, careers that waste less of what you've already done come first
        (this is the **switching cost**). If your degree already counts for a career
        (`data/degree_families.json`), it isn't counted as wasted. A career with very different
        roles inside it (a game developer can build VR worlds or write game logic) is also checked
        role by role, and the report names **the roles that suit you best**;
     4. **careers that join two of yours** (`data/combined_careers.json`, 42 hand-checked ones such as
        Sports Journalist or Wildlife Photographer): each has two sides, and if your list or your own
        activities touch both, it is shown in its own short section;
   - **writes your report** in plain words with Claude (`reportComposer.js`), with rules about
     what it must never say. If the reply breaks a rule it is asked once more, then the job stops
     instead of paying again and again;
   - **files it** in the cabinet (`reports`, `recommendations`).
5. **Meanwhile your report page checks every 5 seconds** (`GET /reports/getMyReport`) and shows
   "preparing" until the report is there — then shows it.

On the report you see **one list of careers** — just the names, with your top 3 coloured, a
**Blue-collar** label on hands-on trade careers, and **"Partial · N% measured"** when part of what that
career needs wasn't measured yet. Tap one to open it: first *what it is*, *why it fits
you* (your strongest traits it uses, and the activity that led you there) and *your next steps* for
your stage; then four folded sections you can open — **the road** (subjects, degree, exams, how hard
they are, deadlines and the other ways in), **money** (pay ranges, marked "estimate" or "checked"),
**the future** (demand, how AI affects it, working for yourself) and **more about the work**. None of
those steps are written by AI: they are worked out from the career data (`Report/reportPlan.js`).

Inside **the road** you also find, where they apply: each **exam** with who runs it, its official site and
when it **usually** opens (`data/exam_calendar.json` — never this year's exact date; you always check the
official site); **where to study** (`data/study_places.json` — the official ranking and regulator lists,
and, once the owner has reviewed them, up to ten colleges, public and private, each saying why it is
there: an NIRF rank, or "our suggestion — check it yourself"); and whether **studying abroad** helps for
that career (`data/abroad.json`) — never which university.

**"What to do next — your next 12 months"** starts with one picture for your stage: which Class 11
stream keeps most of your careers open (Class 9–10), which exams matter (Class 11–12), or what you
can move into from where you are (college and working). College and working students also get
**"Your master's options"**: their top careers grouped by whether a master's is the way in, needed, or
just helpful, with the master's step and the postgraduate exams for each.

If studying abroad helps for one of your top ten careers, a small **"Studying abroad"** section offers to
connect you with a study-abroad partner. Nothing is shared unless you tick the box agreeing to it and
press "Connect me".

**Your report only changes when you do something.** If we improve how we score or match, your report
shows a banner, **"Update my report"** — it never rebuilds by itself. Updating (or resubmitting your
assessment) asks one question: are you still heading the same way, or looking for something new?

**"Sort your list"** switches between **Best match** (our ranking) and **Best fit, ignoring switching
cost**, can then order by pay, demand, speed or AI exposure (with its value shown), can move **core engineering** careers to the
top, and has one filter — **leave out blue-collar careers** — which is off unless you turn it on and
always tells you how many it hid. **"Compare careers →"** opens a page where you pick 2–3 careers and see
them side by side. The AI writes only three short lines about you at the end.

---

## 6. When things go wrong

| What happens | What the app does |
|---|---|
| Claude or Voyage is briefly down | the worker waits and tries again (5 attempts, longer gaps each time) |
| Every attempt fails | the student sees **"We hit a problem preparing your report — your answers are safe"** and a **Try again** button (`POST /reports/retryMyReport`) — never an endless spinner |
| The server restarts in the middle of a job | the job is found "stuck" and put back in the tray automatically |
| You submit again while your report is being made | the newer answers win: when the first job finishes it sees the newer submit and builds again |
| A test broke on your device | the admin's **Assessment issues** list shows it (with an email for serious ones) and the admin can allow one retake |
| Nobody has visited for 15 minutes | on the free plan the server **falls asleep**; the next visitor waits about 50 seconds while it wakes. A job waiting in the tray is picked up as soon as it wakes. A free "pinger" (UptimeRobot) can keep it awake |
| Someone forgets their password | an emailed reset link (`/forgot-password`) |

---

## 6b. Jobs that run on a calendar

A third back-room helper (`workers/housekeepingWorker.js`) does jobs nobody clicks for. Nothing it
finds changes the website until the admin approves it.

| When | Job | What it does |
|---|---|---|
| The 1st of each month, 9:00 India time | **Follow-up** (`housekeeping/followUpScan.js`) | 6 and 12 months after your latest assessment, emails you a link (`/follow-up/…`) to five quick questions: what you're doing now, which career, did a match help. One reminder, then never again. You can opt out. This is how we'll learn, one day, whether our matches really work. The clock restarts only if you told us you're looking for something new |
| The 1st of each month | **Data refresh** (`housekeeping/dataRefresh.js`) | For up to 60 careers, checks job-board numbers (Adzuna) and asks Claude to search a few official sources (government labour survey, National Career Service, India Skills Report, Naukri, LinkedIn's published reports). Suggested changes to **demand and pay** go to the admin's **Data updates** tab. Approved ones show on the career page at once; the ranking itself is never changed by them |
| Every Monday | **Careers scout** (`housekeeping/careerScout.js`) | Collects new job titles from three places — the job board, careers students asked for that we don't have, and the roles the official reports call new or fast-growing. Drops any title that is already one of our ~1,860 job titles (by name or by meaning), keeps the ones far from all our careers or sitting between two, has Claude check pay, AI-safety and growth, and lists them in **Emerging careers**. If the admin approves one, Claude **drafts the whole career** the same careful way the 223 were built (`housekeeping/draftCareer.js`); the admin reads the draft and accepts it or sends it back. An accepted career reaches the site only through a commit |
| The 1st of each month | **Study bot** (`housekeeping/studyRefresh.js`) | Re-checks 6 study disciplines (NIRF rankings first, then other published rankings and the regulators), 15 exams (each on its own official site only) and 10 careers' master's and study-abroad answers (on government and university sites only). From August to October it also reads last year's **closing ranks** off the official counselling results (JoSAA and others). Suggested changes go to **Data updates**; nothing changes until the admin approves |
| Every hour, at :17 | **Batch collector** (`housekeeping/researchBatch.js`) | The data refresh and the study bot don't wait for Claude's answers one by one. They hand Anthropic all their questions in **one bundle at half price**. Anthropic answers the bundle in the background — usually within the hour, at most a day. This small check asks every hour "is a bundle finished?"; if so it reads the answers, runs exactly the same checks the job would have, and files the suggestions in Data updates. Any answer that came back incomplete or unreadable is asked again the normal way. With no bundle waiting it does nothing and costs nothing |
| Only when the admin presses it | **Model comparison** (`housekeeping/modelCompare.js`) | Asks the same 20 careers of two Claude models (Opus 5.5 and Sonnet 5.5) and shows side by side what each would change, how many pages it cited and what it cost. Nothing is filed. The admin then chooses which model runs the monthly jobs |

**What the AI costs** is measured, not guessed: every Claude call writes down how many tokens it used
(`utils/aiUsage.js`), and the admin dashboard's **AI usage** card adds up the month, job by job.

---

## 7. The mentor part

- Mentors sign up on their own page (`/mentor/register`, also linked from the home page's top bar and a
  band near the bottom, for visitors who aren't logged in) and fill a profile. Their profession, job
  role and industries are chosen from **our own lists**, so they can be matched exactly. The admin
  approves them, and can search every mentor in the admin's Mentors tab.
- **Mentors check our data.** An approved mentor sees "Check our data for {their profession}": the
  career exactly as students read it — path, exams, where to study, abroad, master's, pay, demand, AI,
  things worth knowing — and the eight qualities it needs most, in words. They mark each part "looks
  right" or "needs a change" (with a note and a link), and each quality "about right / higher /
  lower". The admin decides every item; accepted ones go into the data through a reviewed commit.
  **Nothing changes on the site from a mentor's answer alone.**
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
| **MongoDB Atlas** | the filing cabinet (database) |
| **Upstash** | the in-tray (Redis) |
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
- **Coverage** — how much of what a trait or a career needs was actually measured for you. Under 100%
  shows as "Partial".
- **Override** — an admin-approved new value for a career's demand or pay, shown on top of the data file.
