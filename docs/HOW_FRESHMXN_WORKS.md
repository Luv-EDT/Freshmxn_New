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

0. **"Let's figure out your career"** opens **Our programs** (`/programs`, Round 25): the three plans side
   by side, each listing what's inside in a few bullets, with one note under all three on how else we
   help (Round 26). Choosing one opens Register with the plan remembered, and after signing up the payment page
   has that plan already picked.
1. You type your name, email, **mobile number** (required since Round 25) and password on the
   **Register** page (`Frontend/src/pages/Register.js`), and where you are now: school students their
   class, college and working students their degree and **the year they finished Class 12**, working
   students also **what they work as now** (picked from our careers, or typed). The same questions are
   one shared piece (`pages/StageFields.js`), also used by Complete Profile, the profile's Edit and the
   admin's Edit. If you're under 18, you also give your parent's name, mobile and **email**.
2. The website sends that to the server: `POST /user/register` (`Backend/Routers/userRouter.js`).
3. The server **never stores your password as-is**. It scrambles it with *bcrypt* — like putting it
   through a paper shredder that always shreds the same way, so it can check a password later
   without ever keeping the real one.
4. It saves you in the filing cabinet (the `users` collection) and, for under-18s, saves the
   parent's permission with the time, your IP address and the policy version (`consents`).
5. It emails you a "verify your email" link (through **Resend**). The link opens a page with a
   **"Confirm my email"** button — nothing is confirmed until a person presses it, because inbox
   link-scanners open every link and used to confirm spam sign-ups by themselves (Round 25).
   **Keeping bots out (Round 25):** the email never prints the name someone typed (bots used the name
   box to push their own text into our email); a name has to look like a name (`utils/nameRules.js`);
   a hidden box only a bot fills gets a fake "done" and nothing is saved; one internet address can
   sign up at most 5 times an hour; and once the owner adds the keys, Cloudflare's **Turnstile**
   checks "are you a person?" quietly in the background. **The mentor sign-up has exactly the same
   shields since Round 27** (the bots of 6–10 Oct came through it), and a name made of random lowercase
   letters ("rjxkqwpzmfhv" — six consonants in a row, or almost no vowels) is turned away too.
5b. **Changing your details later (Round 25):** Profile → Account information → **Edit my details**
   (name, mobile, age, stage and its details). Changing the stage or its details means your switching
   costs change, so the report offers **"Update my report"** ("Your details have changed"). **Changing
   your email** sends a link to the new address; until you click it you keep logging in with the old
   one, and when you do, the same account (same everything) moves to the new email.
6. When you log in, the server gives the website a **token** (a *JWT*) — think of it as a
   **visitor's pass** with your name on it and a signature the office can check. The website keeps
   it in your browser and shows it with every request (`apiCall/axiosInstance.js`), so you don't
   log in again on every page.
6b. **One device at a time (Round 27).** Each login stamps a new number on your pass
   (`utils/sessionToken.js`), and the office only accepts the newest one. So if you log in on your
   laptop, your phone is signed out — its next click lands on the login page with "You were signed out
   because your account was opened on another device". This stops two devices quietly overwriting each
   other's answers. Resetting your password signs every device out.
7. **"Sign in with Google"** works the same way, except Google vouches for who you are
   (`/auth/google`).
8. **Under 18? Your parent says yes by email.** On `/parent-consent` you press a button and your
   parent gets a 6-digit code by email (`POST /consent/sendParentOtp`). You type it in
   (`/consent/verifyParentOtp`). The code is stored shredded (like a password), works for 10 minutes
   and allows 5 tries. Until it's done you can look around but not pay. (SMS comes later.)

---

## 2a. The home page (Rounds 36–37)

**Freshmxn's Lab — Explore. Get clarity. Take action.** "We match your story and strengths to careers that are in
demand and AI-resilient, then help you get there." Its main button, "Let's figure out your career", opens the **program finder** (Round 37).
Then **Who is it for** — three cards, names only: School students
(Class 9 to 12), College students (any year, any course), Early professionals (the first few years of work). Then
**What each of them ask us**: a visitor picks an audience (a tab, or tapping its card) and sees that audience's
questions first — school students also two for their parents — then the ones every audience asks, in the same
list (Round 37: no separate block, and no question twice), including how long it takes, financial aid and refunds,
who sees your answers, and that a learning difficulty never counts against you. Each audience sees only questions
that fit it, none twice. The home page shows each list's first five; **See all questions** opens the **FAQ page**
(`/faq`, also in the footer) at that audience. Since Round 39 the FAQ page has three tabs, one per audience: only
the chosen audience's questions show, another tab switches them, and the tab the visitor was on at home comes
pre-selected. A logged-in student sees only their own, with no tabs. The questions are set a size smaller there and
on the home page (owner, Round 39).
Each opens to a short answer with a sourced fact and what Freshmxn does about it (`Public/audienceQuestions.js`). A **logged-in student**
sees only their own set ("What college students ask us"), their card marked **You** — the category comes from their
journey. A number is shown only with its source (owner, Round 37: numbers without one are left out).
**Round 38 (owner):** a logged-in student doesn't see "Who is it for" at all — the page goes from the top straight to
their own questions. A small line under "Try a Free Demo", and one in the demo's front-door popup, says **no payment
details are needed at any step**. On a phone the links fold behind a **menu button (☰)** beside "Get started", the
top of the page is two columns (the tagline on the left; "Freshmxn's Lab" and the picture on the right) with the
promise and both buttons full width beneath, and the three "Who is it for" cards sit small and centred in one row.
Since Round 39 that first section fills the phone's whole screen under the header, its parts spread from top to
bottom.

## 2b. The demo — trying before signing up (Rounds 32–33, 36)

**The front door (Round 33).** The first time a visitor opens the home page in a visit, an invitation covers it:
the logo, "Freshmxn's Lab", the one-line promise, a big **Try a Free Demo** button and "It takes just 5 minutes.",
with the landing page blurred behind. **✕** (top right) or "explore the home page first" closes it; it doesn't come back in that visit, and a
logged-in student never sees it.

The demo (`/try-demo`, no account to start) takes about 5 minutes, in three stages shown at the top —
**Virtual career counselling › Assessments › Report**:

1. **A first name and where you are now** — school (Class 9–10 or 11–12), college, or working (and for how many
   years). Where you are now stays in the browser and reaches us only at the sign-up at the end. (The spam check,
   "3 starts an hour from one place" and a daily cap, `DEMO_DAILY_CAP`, keep the AI cost in check.)
2. **Your story** — one question: what have you enjoyed, been curious about or felt good at, grown through, been
   noticed for, solved a problem with, or that simply felt good? Asked across three timelines: school or college,
   now, and what you aspire to (in their own words). The "Stuck?" list stays pinned at the top; tap an activity to add
   it to a box, or drag it there (Round 37). Just before this, on a page of its own right after the first name
   (Round 37), they can **attach a résumé** — a PDF, Word file or photo; the AI lists its activities into the first two
   boxes, they change or remove any, and the file is deleted once read. Then
   **what they've stuck with for a long time, and why** (Round 37: only what they did or do — not what they aspire to) — the four reasons the real form uses, plus "it helps me deal with a problem in my life"
   (inside me / with people / around me), which matching counts just like the real form's problems.
3. **Three quick tasks** — "A taste of 10 of our 31 factors":
   - **7 statements**, one real "what you're drawn to" statement per intelligence;
   - **a 90-second focus game** — the real SART's own clock, 78 digits instead of 225, no practice round;
   - **4 puzzles** (1 easy, 2 medium, 1 hard) drawn from the demo's own bank of 12 — never the real test's.
   Everything is worked out on the server and only a small result is kept — never the answers, the puzzle choices
   or the focus game's timings.
4. **An account (Round 36, owner).** The result needs one: a proper sign-up (the same details as the sign-up page;
   under 18, a parent or guardian's details) and a 6-digit code emailed to them — the account is made only when they
   type it. An email that already has an account logs in instead. Either way they see the result already logged in.
   Someone who stops here gets no result and no account. The email is checked as it is typed (Round 33c): a badly
   formed one can't go on, and a common slip like `gmail.con` gets a one-tap **Use it** fix. "Reading your answers — this takes about 30
   seconds": the **real engines** read the story first (the activity step and the same matching the full report
   uses), and the tasks only check the careers it points to against the fundamentals they need.

**The report** keeps it clean (on a darker page, no footer until here; headings centred in the display font):
the **two careers** straight away, each the real career card with everything inside — the road from where you
stand, exams, money, the future. Then, in this order (Round 36, owner): "Tap a career to open everything about it",
**The demo result is limited to two careers.**, "Not happy with the 2 recommendations?", a one-line "That took about
5 minutes — the full journey takes 3+ hours", and the **psychometric fold** with "Just N of 31 factors, and even
those only partly measured" under it — inside, first the factors we did touch as a word level with how much of each
was measured (about 20–35%), then the other factors listed but blurred. A fold on what we did differently; **what you
missed — and what the full program gives you** as four cards to tap open (detailed counselling, all 31 factors, the
whole list of careers, a mentor in one of these two or more careers first); then "How can we help you in our
program?" and **Check out our programs →**, which opens the **program finder** (`/find-your-program`): "I'm
completely lost" or "I know the field I want to enter" shows Career Discovery and Discovery + Mentor; "a very specific
need" shows Mentor Only — each in a line or two, with prices from the server, and "For more details" to /programs.

**The demo is kept apart from everything else.** It has its own door (`/demo`) and drawer (`demo_sessions`), never
touches a student's record, a payment or a score, and deletes itself after 30 days. The one exception is the account
step (`/demoAccount`, Round 36), which makes the account once the code is right and links the demo to it. What visitors type helps our
data without their name or email: their activities build the shared activity cache, and careers they name that we
don't have go to the monthly careers scout (`demo_signals`).

**Carrying it forward.** After signing up with **the same email**, verifying it and paying (any plan), the dashboard
shows "You tried the demo" — **Carry them forward** or **Start fresh**. Carrying puts their story into Virtual
Career Counselling (Career Discovery plans, only if still empty) and keeps the demo's two careers on their account,
offered first when they choose their mentor — the mentor page also shows the linked demo's two careers before
they press Carry (Round 33c). Nothing the three tasks measured is carried. Either way the demo is
then deleted.

**Coupons for one plan (Round 33).** A coupon can work on every plan, or only on some (Career Discovery, Mentor
Only, Discovery + Mentor) — the admin ticks them. An upgrade counts as the plan it ends on, so a Discovery + Mentor
coupon also discounts the upgrade into it.

---

## 3. Paying

Payments can run in **manual mode**: you ask for access (`POST /payments/requestAccess`), our
team calls you, collects the money, and the admin presses **Grant** in the admin dashboard. That one
button (`grantAccess` in `paymentsRouter.js`) unlocks your plan. When online payments (Razorpay) are
switched on, Razorpay will press the same button automatically after you pay — nothing else changes. Since
Round 26 the mode is set on Render (`PAYMENT_MODE`), and the steps to go live are in DEPLOY.md.

**Giving a plan for free (Round 26):** the admin presses **Give free access** on the student's row and
picks a plan. It is recorded as a ₹0 payment marked "free, by admin", so the plan and the history read the
normal way and there is nothing to refund. Since Round 35 it is on **every** student's row and offers
what fits: any plan for someone who hasn't paid, **mentorship (one session)** on top of Career Discovery,
Career Discovery on top of Mentor Only, and **another mentor session, free**, once the current one is done.

**₹0 plans are given at once (Round 35, owner).** There is no "Request access" any more and no Access
requests tab: every payment goes through Razorpay. When the server's own quote is ₹0 — a 100% coupon, or
financial aid approved at ₹0 — the student presses **Get it free** and the plan unlocks straight away
(`POST /payments/claimFree`, recorded as a ₹0 payment with the coupon, so it counts as a use). If online
payments are ever switched off, the paywall says to message us on WhatsApp.

**Refunds say what they cover (Round 35).** A Discovery + Mentor student chooses **only the mentor part**
(they keep Career Discovery) or **the whole plan**, and sees what they paid beside what each gives back —
both amounts from the server. The mentor part can be asked for **at any time**; the whole plan only once the
assessment and report are done (Round 35b). A refund never deletes anything: the student's answers, scores and report
stay, so if they buy again later everything is still there.

**Deleting an account (Round 26):** the admin presses **Delete account** and types the email. The account
and everything stored for it — answers, scores, report, payments, requests, consent, mentor place — are
removed from every collection (`utils/deleteAccount.js`); admin accounts can't be deleted this way.

**Every money step is emailed and shown (Round 28, owner).** `utils/statusEmails.js` holds one wording for
each: a payment that went through (with Razorpay's payment id), a payment that **failed** (the bank's
reason, "no money was taken"), a refund started (**processing**, with its refund id), sent (with the bank
reference, the **ARN**, to quote to your bank — Razorpay doesn't tell anyone when the bank actually credits
it), failed (we retry) or **declined** (the admin must write a reason, which you see), and financial aid
approved, declined (with a reason) or **closed because you paid** for that plan anyway. Profile → Payment
history shows the same words and ids, and every refund request you made. A coupon's uses are the paid
purchases that carry it (Round 29) — typing it, a quote or an unpaid order never counts, and one person may
use a code again.

**Notifications** (Round 29): every email we send you about something that changed also appears as a
notification — a bell with a count in the menu bar, a line on your dashboard, and a list at the top of your
Profile. The bell counts only what's **new** (Round 35): opening your notifications marks them seen, so the
count starts again from the next one, and new ones carry a "New" tag. Clear one with ✕, or **Clear all
notifications**; cleared ones are deleted. Emails show as from "Freshmxn". We can
send about 90 a day on our email plan; above that only reminders wait for the next day (their notification
still appears) — anything you are waiting on always goes.

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

- **Virtual Career Counselling** (the interest form's name for students since Round 28, owner) is where you
  tell us what you love, what you've actually done, problems you care about and what you want to be.
  Each life stage asks you to write down **everything** — even things done once or stopped — and
  "What still feels like you" then asks which still resonate. **A résumé (Rounds 36–37, owner):** "Start" on
  the welcome page opens a page of its own to attach one (PDF, Word or a photo); the AI lists its activities by stage
  of life, and each stage's "Stuck?" list then shows them first — "The activity list includes all activities from
  your résumé, plus others you can choose." **The résumé's activities go into a question with a tap (pick the
  question) or by dragging them onto one** — since Round 38 (owner) they are light-blue chips at the top of the list,
  and our other examples are plain words to read (in the demo, every item can still be added). The list is kept in this
  browser for this student; nothing reaches the answers until the student adds it; the file is deleted once read. **Editing it after you've finished** saves
  only when you press **Save changes**: moving between sections saves nothing, no copy is kept in the
  browser, and a refresh, going offline or any link away (the menu bar included) warns first and offers
  Save and go / Leave without saving / Stay. At the top of each section are two small round arrows, ← and →
  (Round 38): ← goes back a section; → does exactly what the section's own Next does, checks included. Saved changes after a
  report exists offer "Update my report". Each stage of your life is a set of cards with a plain question,
  a "See examples" fold, and your answers as little chips. Every step is saved as you go
  (`POST /submissions/saveInterest`), so closing the tab loses nothing. College students also tell us
  their degree and subject, working people their degree and field — so the report can say "your
  B.Com already counts".
- **"← Dashboard"** (Round 19) is always in sight on the assessment, the report, the
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
        first; within a tier, the careers that fit you best come first. The **switching cost** no
        longer reorders anything — the report uses it to group (below). Since Round 25 (owner) each
        career carries **two numbers**:
        - **Years left behind** (the switch cost): every year that wouldn't count towards it, or
          that you'd repeat. Degree years the career won't count — your years so far at college,
          or **your whole degree** if you're working (B.Arch 5, B.Tech 4…) — count 1 each for the
          first two years and ½ after that. A Class 12 subject you didn't take, added later
          through open school (NIOS), counts **1 year**. Work years count 0.3 each (at most 3) —
          **but not** when the experience carries over: into your own career, a career your degree
          leads to (`data/degree_families.json`), or a close one on the reviewed list
          `data/related_careers.json` (an architect moving into interior design keeps her years).
          Your own career is 0.
        - **Time to get there from now**: the road ahead — 0 for your own career or an open door,
          a short course after any degree, the full degree for a restart, plus a year for an
          open-school subject. Shown only; it sorts "Quickest to qualify" but never ranks.
        If an entrance has closed for you (JEE takes students only 3 years after Class 12), the
        career stays and says "This route has closed for you" beside the other ways in. A career with very different
        roles inside it (a game developer can build VR worlds or write game logic) is also checked
        role by role, and the report names **the roles that suit you best**;
     4. **careers that join two of yours** (`data/combined_careers.json`, 42 hand-checked ones such as
        Sports Journalist or Wildlife Photographer): since Round 28 (owner) each joins **two exact
        professions**, and it is shown only when **both** are among the careers on show in your list
        (the top fifteen, after your filters);
   - **no AI writes anything for the report** (Round 19, owner: "remove the AI summary entirely").
     The report is the ranking plus the data behind each career, so building it costs no AI call
     (`report@4.0.0`). `reportComposer.js` stays in the repo as reference, unused;
   - **files it** in the cabinet (`reports`, `recommendations`).
5. **Meanwhile your report page checks every 5 seconds** (`GET /reports/getMyReport`) and shows
   "preparing" until the report is there — then shows it.

**Updating your report (Round 28, owner).** An update because *we* improved scoring or matching is always
free. An update from **your own changes** — resubmitting the assessment, saved Virtual Career Counselling
answers, a changed stage or details — is limited to **3**; the update box says which one this is, and after
the third your changes are still saved but the report stays as it is (WhatsApp us if you need another).

**Your result on a finished test (Round 28, owner).** Reopening the reasoning puzzles, word memory, number
memory or the focus test shows your own result — "11 of 16 puzzles right", "19 of 30 words remembered",
"longest sequence 7 digits", "average response 0.34 s · 2 wrong presses on a 3" — with the same High /
Medium / Low word as your profile (`GET /submissions/getMyTestResults`, worked out by the profile's own
scorers; never an answer key). Every test page, the short story included, has **"Something went wrong
with this test?"**; a request the admin turns down needs a reason, which is emailed to you, and a retake
granted or a report re-run is emailed too.

**The report (`/report`) is a short overview** (Round 19, owner), in this order: **"Your report"** at the
top centre; **Your matches** — your top three, with three buttons: "See all N matches", "Combined careers
(N)" (careers that mix two professions, often from different sectors) and "Compare careers"; **What seems
to drive you**; (since Round 28 a **Your psychometric analysis →** card opens `/report/psychometric`: the
four **core** fundamentals first (Round 30) — they help in every career, so higher is better — then every other group, which
only make you different, never better or worse; the Profile links to your report instead of repeating it);
before Round 28, **The five fundamentals** — confidence, sticking with things, picking up new material and
deciding with good information, each as a word (High / Medium / Low) with what it means and why it
matters, and a fifth: **the rest of your qualities**, with a link to your Profile and why they aren't here
(they matter once you've chosen a profession, and then we work on the ones it needs); and **What you said
you wanted**. The last three share one medium heading size; Your matches is only slightly larger (Round 20).

**"See all" opens `/report/matches`**, the whole list: the first **three** of the order you've chosen,
each with its **rank number** (1, 2, 3…) on the left, then **"Show 12 more careers"** up to fifteen, and
the rest folded under **"Some other careers you can consider"** — still under their tier headings (Round 28,
owner; renamed Round 31; choosing a new order starts again at three). It only appears when you have more than
fifteen careers. The cut is made after the filters and sorts. Above
the list sit two highlighted buttons, **Sort your list** and **Filter your list** (Round 29), each with one
line saying what opening it does; inside, every choice has an ⓘ. A **"then order by"** sort orders your
**whole** list — the best-paid first, say, whatever group it was in — under one heading; with Best match,
careers that would leave 2+ years behind still come last. **Every career in the list was pointed to by
something you told us** — an activity, a reason, a career you named; none reaches you on psychometric fit
alone (Round 31, owner: the 30 "other careers" from fit alone are gone). At the very bottom, **"How your list
is ordered"**. Opened, the list is
shown **under its tier headings**
— two or three words each since Round 24: "Proven long-time passion", "Confident current passion",
"Long-time activity", "Current, your reasons", "Something you do now"… each with one line saying which of
your activities pointed there (Round 30) (*proven* = you achieved at it, *confident* = you said you're sure,
*passion* = you love it). The careers that ask for more than your profile shows today sit under one band,
**"Build fundamentals/factors first"** (Round 30; "/factors" since Round 31 — *fundamentals* means every
factor in your psychometric analysis: personality, intelligences, thinking abilities and the habits under them). Inside a group,
**Best match** counts what you'd leave behind (fit × switching cost); **Best fit, ignoring switching
cost** orders by fit alone, so the two lists differ whenever any career has a cost (Round 30). Only the groups you have are shown, numbers
running on across them (Round 20). The **filters** fold away behind one **"Filter your list"** button, like
the sort, and the page still says how many careers they hide; the **studying / working abroad** lines are
the last thing on the page; and **how the list is ordered** is explained on the overview, in a fold beside
the five fundamentals (Round 24). Under **Best match**, careers that would leave
**2 or more years** behind (the switch cost only) move into a last fold, "Would leave 2+ years behind",
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
what it asks — names only, never a number), and **your next 12 months**. **Everything is counted from where
you stand** (Round 31, owner): each step of the path is either behind you (ticked), where you are now, or
still ahead (**bold**), and "your next step" is the first one ahead. If your own degree leads to the career
(a B.Tech Civil student looking at Civil Engineer), the entrance and the degree are yours — "finish your
degree first", then what comes after. If the career takes any graduate, the first-degree entrance isn't for
you, and a step asking only for "any bachelor's" is covered — but a named degree you don't have (the LLB)
is still ahead. If the career needs its own degree from the start (medicine for an engineering student),
the card says plainly that this is a **switch** — "To move into this you'd start its own degree — about N
years from now", and the entrance for that degree — never "your next step: NEET" as if it were routine;
if that entrance has closed for you (JEE, 3 years after Class 12), it says so and gives the other way in.
"How long, and the path" opens with **"For you: about N years from now"** and why, then the plain length
from Class 12. A student about to start college is sent to the entrance and the degree, honestly next.
The road leaves out the school steps and the Class 11–12 subjects for anyone past school (Round 19). A master's that isn't
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

**The filters** sit beside **"Sort your list"** on the matches page: *Leave out blue-collar careers\**
(with the note "\* Some of the most AI-proof careers are blue-collar"), *Core engineering only*,
*Studying abroad helps*, and (Round 36, owner) **Filter by professional sectors**, which opens the 18 sectors,
each with how many of your careers are in it; pick any and only careers in those sectors stay. All are off until you turn them on, and the page always says how many
careers they hid, with one tap to show them again. "Sort your list" switches between **Best match** (our
ranking) and **Best fit, ignoring switching cost** (every career stays in its tier), and can then order
the whole list by pay, demand, speed, AI exposure (with its value shown) or **least switching cost** (Rounds 20 and 29). **"Compare careers →"** opens a page where you pick 2–3 of the careers recommended to
you (nothing is picked for you) and see them side by side, with the same plain questions, "what to work
on" and "worth knowing".

**Your profile** shows your psychometric results in six groups — the four core fundamentals, personality ("how
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

**"Something went wrong with this test?"** sits only on the assessment start page, on the card of a test
you have finished (Round 30) — not inside a test, and not before you've taken it. **The focus test** turns
the cross after each digit **green** when you press correctly and **red** when you press on a 3, in both
rounds; reaction times are measured from the moment the digit is actually on screen and the moment your
key or tap happened (Round 30). Its average leaves out presses under 0.15 s (before a digit can be read),
which other SART sites usually count — so ours reads a little slower. A retake we ask for makes your
**next** report update free (one at a time, Round 30).

**When a test needs taking again** (Round 29): if a timed test didn't count, you're told why in plain words
(for the focus test: pressing before the number appeared, or pressing on the 3s). When the admin allows a
retake, or we improve a test and offer it to everyone who took it, you get an email and a notification — and
updating your report afterwards is **free**: it doesn't use one of your 3 updates.

**When we change a test, you hear about it automatically** (Round 31, owner). Each one-attempt test has a
version (`Backend/assessment/testVersions.js`); any change to how it is shown, timed or marked moves it. When
the server starts and a test's version has moved, everyone who took the older version gets a notification
and an email, their **next update is free straight away**, and that test comes **first on their assessment
page**, marked "Improved — you can take this again". It's their choice: the earlier result stays unless they
finish the new attempt, and until then a **"Keep my earlier result"** button puts it back exactly as it was.
(The first: the focus test's timing and green feedback from Round 30.) When we improve the matching or the
scoring, students are told the same way, and the admin's Students tab shows "free update waiting — our
improvement". A short story whose
questions closed before you answered can be taken again with a **new** story, up to 3 times; you're reminded
when you open it, 5 minutes before it disappears, when the questions open and 6 hours before they close.

## 6b. Jobs that run on a calendar

A third back-room helper (`workers/housekeepingWorker.js`) does jobs nobody clicks for. Nothing it
finds changes the website until the admin approves it. Each calendar job waits in the same `jobs` drawer
with its due time (India time); when it is done, the next one is put in. One that fell due while the free
server was asleep runs as soon as it wakes (Round 22 — before that the calendar lived in Redis).

| When | Job | What it does |
|---|---|---|
| The 1st of each month, 9:00 India time | **Follow-up** (`housekeeping/followUpScan.js`) | 6 and 12 months after your latest assessment, emails you a link (`/follow-up/…`) to five quick questions: what you're doing now, which career, did a match help. One reminder, then never again. You can opt out. This is how we'll learn, one day, whether our matches really work. The clock restarts only if you told us you're looking for something new |
| The 1st of each month | **Data refresh** (`housekeeping/dataRefresh.js`) | For up to 60 careers, checks job-board numbers (Adzuna) and asks Claude to search a few official sources (government labour survey, National Career Service, India Skills Report, Naukri, LinkedIn's published reports). Suggested changes to **demand and pay** go to the admin's **Data updates** tab. Approved ones show on the career page at once; the ranking itself is never changed by them |
| The 1st of each month, right after the data refresh (Round 29: was weekly) | **Careers scout** (`housekeeping/careerScout.js`) | (Round 28: a title is compared with our careers' **names and job titles**, short text with short text — comparing it with whole career descriptions made everything look "Nothing close"; every run also re-sorts the watch list and sets aside rows that turn out to be covered.) Collects new job titles from three places — the job board, careers students (and demo visitors, Round 32) asked for that we don't have, and the roles the official reports call new or fast-growing. Drops any title that is already one of our ~1,860 job titles (by name or by meaning), keeps the ones far from all our careers or sitting between two, has Claude check pay, AI-safety and growth, and lists them in **Emerging careers**. If the admin approves one, Claude **drafts the whole career** the same careful way the 223 were built (`housekeeping/draftCareer.js`); the admin reads the draft and accepts it or sends it back. An accepted career reaches the site only through a commit. *The monthly refresh never picks these up — only the admin does* (Round 27): read the row → **New career** or **Combined career** (a draft is written) → **View draft → Accept** (or send back with a note) → Data updates → **Export patch** → Claude Code applies, re-embeds, runs the fixtures and commits → live with that deploy |
| The 1st of each month — but only what's in season | **Study bot** (`housekeeping/studyRefresh.js`) | Checks things only when they can have changed (Round 13): an **exam** in the two months before its applications usually open (each on its own official site); **colleges** in September and October, after NIRF publishes (NIRF first, then other published rankings and the regulators); **master's and study-abroad answers** in January, April, July and October (government and university sites only); **closing ranks** August to October (official counselling results); **licences abroad** in January (the licensing body's own site). A month with nothing due makes no AI call. Suggested changes go to **Data updates**; nothing changes until the admin approves. The admin's **Run now** checks everything regardless of season |
| Every hour, at :17 | **Batch collector** (`housekeeping/researchBatch.js`) | The data refresh and the study bot don't wait for Claude's answers one by one. They hand Anthropic all their questions in **one bundle at half price**. Anthropic answers the bundle in the background — usually within the hour, at most a day. This small check asks every hour "is a bundle finished?"; if so it reads the answers, runs exactly the same checks the job would have, and files the suggestions in Data updates. Any answer that came back incomplete or unreadable is asked again the normal way. With no bundle waiting it does nothing and costs nothing |
| Only when the admin presses it | **Model comparison** (`housekeeping/modelCompare.js`) | Asks the same 20 careers of two Claude models (Opus 5.5 and Sonnet 5.5) and shows side by side what each would change, how many pages it cited and what it cost. Nothing is filed. The admin then chooses which model runs the monthly jobs |

**What the AI costs** is measured, not guessed: every Claude call writes down how many tokens it used
(`utils/aiUsage.js`), and the admin dashboard's **AI usage** card adds up the month, job by job.

---

## 7. The mentor part

**Choosing, matching and the session, step by step (Round 34, owner — replaces Round 28's steps):**
1. **One page, sent once.** On `/mentorship/choose` the student fills everything — the job role, what help
   they want (career / interest / both), what they want to know, the languages they're comfortable in, and
   how we may reach them (WhatsApp or email, with consent) — then presses one **Send my choice** at the end
   and confirms. After that it is read-only ("What you sent us"). To change it they message us on WhatsApp
   **within 7 days**; the admin's **Reset choice** works only inside that week and emails the student.
2. **20 business days.** The admin first asks the mentor on WhatsApp to open slots on their two **Calendly
   links** (stored in the mentor's profile), then presses **Match**. A mentor with no Calendly link can't be
   matched. The mentor is emailed a "new student" note (read the brief within 2.5 days, keep the slots free);
   the student is emailed that their mentor is confirmed, and `/mentorship` shows the two booking buttons.
3. **The student books.** Within 2.5 days, with a **countdown** on `/mentorship`: the 1-hour main session in
   the next 4 days, the 20-minute follow-up on day 3, 4, 5 or 6 — after the main one (not booking it means
   they don't want it; the mentor also asks at the end of the main session). **One slot per link** — more than
   one counts as no session chosen, the mentor reports it, and it can cost the whole mentorship. Can't find a
   slot? WhatsApp +91 8882756287. Our team sends a reminder an hour before. Rescheduling goes through us on
   WhatsApp. Students and mentors never message each other on the platform.
   **Booked (Round 35).** The mentor tells us on WhatsApp — three times: slots opened, the student's booking
   (with both dates and times), session done. The admin presses **Sessions booked…** on Mentor matches and
   enters the times; the booking buttons give way to "Your sessions are booked" with the times, the mentor's
   dashboard shows them too, and the student is emailed. **Not booked after 3 days** (the student is shown 2.5;
   the half day is grace): the student's page says the chance is lost and it's recorded as a no-show — message
   us to arrange it again — and the admin's row says "booking time missed". The admin checks with the mentor
   and presses **Student no-show**; nothing closes by itself.
4. **The mentor's brief.** On their dashboard the mentor sees the student's first name, the career and role,
   what they want to know, their languages and a few Virtual Career Counselling highlights (education,
   interests, achievements, challenges — never family or beliefs; support needs only if the student chose to
   share them). The contact shows only after the mentor agrees to the privacy rules.
5. **Session done.** The mentor tells us on WhatsApp; the admin presses **Session done** (one step — the old
   "main session / follow-up" pair is gone). The student's **feedback form** opens on `/mentorship/review`,
   as a notification and by email. It asks, once, after both sessions: did the mentor cover the five parts
   (the profession, their journey, how it relates to you, what success needs, resources), how the mentor was
   (empathetic, knowledgeable, clear, gave clarity, would recommend), a rating out of 10, and whether they
   stayed within limits. The mentor never sees it. Feedback in = the ticket closes and the **mentor's payout
   is due**. A "no" on limits, or a concern, emails the admin.
6. **Student no-show** (didn't book in time, or 10+ minutes late): the admin presses **Student no-show** —
   the ticket closes, no refund, the mentor is paid. A no-show **doesn't count towards the mentor's tier**
   (tiers count sessions with feedback) and the mentor's Payouts show it as "Student no-show". If it was the
   mentor's first student, the "keep this mentor?" question waits for their next held session. If the student
   still wants the session and the mentor agrees, the admin's ticket menu has **Re-arrange with the same
   mentor** (a fresh 2.5 days to book); the admin can also give another session free.
7. **Report a problem with my mentor** (a small link on `/mentorship`): what happened, then **a refund** of
   the mentor part (the amount comes from the server) or **a new mentor** (back to matching for **15 business
   days**, that mentor kept away). It acts the moment it is sent; the admin then records whether it was
   **upheld** (a strike on the mentor, no payout for that session, no automatic Tier 2) and can pause the
   mentor. The refund itself is sent from the ticket (Mentor matches → Close or change this ticket → Refund
   the mentor part). A report sent **by mistake** (Round 35) is closed with nothing against the mentor, and the
   student's ticket is put back as it was — unless a refund was sent or a new mentor matched meanwhile.
8. **Another session** (paid, at the Mentor Only price) can be booked once a session is done, as before.

**The mentor's page (Rounds 35c–d, owner)** has one tab bar. Until the test is sent: 1. Training, 2. Tell us about
yourself, 3. Test (locked until the profile is in). After it: Home (the test's status, or once approved the tier and
the current student), **Tier up: data check & roadmap** (it opens by saying the data check counts towards Tier 2 and
the roadmap towards Tier 3, with what each mentor still needs) and Payouts. The round profile icon opens the profile, the **Calendly links**
(asked first in the test — sending it makes them the booking links — and changed here later), the training documents
to refer back to — each a folded card — and **Log out**.

**Mentors, step by step (Round 34; Round 35: the training comes first).** Sign up → three short **training
documents**, folded, with their reading times (about 10, 20 and 15 minutes) → **the Mentor Agreement** (Round 38, owner):
at the top of step 2 they download it (`/mentor-training/Freshmxn_Mentor_Agreement.pdf`, the owner's agreement with
the company's PAN taken out of its footer), print it, sign it, scan it (a phone photo is fine) and upload it — a
PDF, JPG or PNG up to 5 MB, kept in the database (`mentoragreements`), opened only by the mentor and the admin
(Admin → Mentors → "Agreement"). The profile can't be sent without it; the server checks too. A mentor from before
Round 38 sees a reminder on their dashboard and uploads it from their profile → the profile (including where they live — India or abroad,
which sets their pay — and how we pay them: UPI or bank and PAN in India, bank or
another method abroad; only our team sees these) → a **test**, every part compulsory (the questions, the five
steps put in order, both Calendly links and the video) — it can be saved and finished later, and **Send**
appears only when nothing is missing: 7 multiple-choice questions drawn from 32,
the five steps in order, their two Calendly links, and a 5–10 minute video mentoring a sample student
(uploaded privately to Cloudflare R2, or a link pasted when R2 isn't set up). The admin reviews it (Admin →
Mentors section → Mentors → **Review test**), approves or rejects with a reason, and the **video is deleted**
then (and after 30 days at most, by a nightly job). Only then can they be matched.

**Mentor pay (Round 34).** Paid per main session, when the student's feedback arrives; the first follow-up
is included, a later one pays 30% of the main rate. Since Round 38 the rates and these rules also have their own
card in the mentor's profile, **How you're paid**, right below the training documents; the logo on the mentor pages
goes to the home page. The revised agreement (Round 38b) leaves payout timing, cancellations and rates to the website,
so that card also says a student no-show still counts and is paid, and a session the mentor misses without telling us
isn't. **About us** (Round 38b; Round 39 order) opens with "Proof behind every step" — how each of the four
steps is built, and what only Freshmxn gives — then the founder's story as a fold, "My (founder's) story".
**The mentor dashboard** (Round 39 redesign): a greeting with the status under it; on Home, four tiles (tier,
sessions with feedback, average rating, what a main session pays); the tabs as pills over a white panel; the
profile opens on a card with the mentor's name, role and tier, then the folded cards. Privacy (`v2.0`) says a mentor's signed agreement is kept.

| Tier | Indian | International |
|---|---|---|
| Tier 1 (approved) | ₹1,000 | ₹1,500 ($15) |
| Tier 2 (automatic: 7 sessions with feedback, average 8/10+, no upheld report, and — Round 35 — the data check sent) | ₹1,300 | ₹1,900 ($19) |
| Tier 3 (the admin's call: 10+ sessions, average 8+, a skills roadmap and a review of their profession's data) | ₹1,500+ | ₹2,200+ ($22) |

A mentor's **first** payout waits for the admin's "Keep" (or "Remove" — they're taken off). Payouts are
**recorded, not sent**: the admin pays by UPI or bank and presses **Mark paid** with the reference; the mentor
is emailed. The **skills roadmap** sits on the mentor's "My profession" tab: steps from the basics (skill,
resource, link, cost, time).

**The admin's Mentors section** (`/admin/mentors`, Round 34): its own page with tabs — Mentor matches,
Mentors, Payouts, Session feedback, Profession data. The main admin page links to it.

Mentors can also sign up and log in **with Google** (Round 28); a new Google account started from the
mentor page becomes a mentor, an existing account keeps what it is.

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
  that goes to the mentor (since Round 34 it is sent with the choice, once).
- **The mentorship page** (Round 26) shows where things stand, then a **How it works** button that opens
  its own page (`/mentorship/how-it-works`: who your mentor will be, the sessions, the 20-business-day
  policy), then a folded **How else can we help you?**.
- **"How else can we help you?"** (Round 25, owner) — once a career is chosen, a short box asks what
  else would help: a getting-started skill kit (the 80-20 rule), internships / jobs / fellowships, a
  master's or settling abroad, or anything else. It is folded on `/mentorship` for the mentor plans (it
  replaced the old abroad tick) and on the dashboard for Career Discovery once the report is ready. It is
  a **waitlist**: with the consent box ticked it is saved (`/careerHelp`, `careerHelpModel`), our team
  calls the student, and — only if they ask — recommends a partner affiliate or a new product. The admin
  works through it in the **Help waitlist** tab.

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
  **20-business-day** clock. The admin matches a mentor by hand in V1 and the student is told by email and on
  their dashboard. If no mentor can be found, the money rolls over — or, if you ask, you move back to
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
- **Switching cost** — the years you'd lose or repeat by changing to a career (degree years that
  wouldn't count, an open-school subject, work that doesn't carry over). Shown beside **time to get
  there**, the years ahead.
- **Tier** — a group in the ranking; there are 16, each with a two-or-three-word label, the last five
  under "Build skills first" (Round 24); explained in "How your list is ordered" on the overview.
- **Coverage** — how much of what a trait needs was actually measured for you. Under 100% it shows as
  "Partial · N%" on the assessment page and your profile (not on the careers).
- **Override** — an admin-approved new value for a career's demand or pay, shown on top of the data file.
