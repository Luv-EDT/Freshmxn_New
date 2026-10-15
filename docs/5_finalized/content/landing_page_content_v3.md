# Freshmxn's Lab — Landing Page Content (FINAL v3)

Design direction: **Kira-style structure & energy, light-mode, teal-navy identity, pink as a rare
highlight only.** All statistics verified to a citable source — cite inline on the live page.

**Design tokens (from TypographyAndColor.docx):**
- Typography: **Orelega One** (H1/H2/H3), **Lato** (H4/H5/H6, body, links)
- Colours: Primary `#1E2A38` (deep navy — used for text/headings on light bg, NOT the page
  background), Secondary `#BEBEBE`, Text `#D1D1D1` (light grey — for text on dark sections only),
  Accent `#007582` (teal — the star colour: CTAs, highlights, links)
- **Base = light** (near-white/off-white background, navy text, teal accents). Navy is the ink, not
  the canvas.
- **Pink** = one occasional highlighter-marker accent `#FFB3C7` (soft pastel, Kira-style), ~5%
  usage, behind navy text only, never structural.

---

## 1. HERO

**Brand line (a real title since Round 33):** Freshmxn's Lab
**Before the page (Round 33):** a visitor's first view is an invitation over the blurred page — logo, "Freshmxn's Lab", the body line below, **Try a Free Demo**, ✕ to close. Once per visit; never when logged in.
**Headline (Orelega One):** Explore. Get clarity. Take action.  *(the company tagline — owner, 2026-09-24)*
**Closing statement (end of the page, before About):** Careers that fit you. And the future. (no italics, Round 33)
**Body (as on the site, owner Round 10):** We match your story and strengths to careers that are
**in demand and AI-resilient**, then help you get there with mentors who've done it.
**Hero picture:** an illustration of a happy student (inline SVG, brand colours) — it replaced the
"Your ranked matches" preview card, which the owner found text-heavy.
**Primary CTA (teal):** Let's figure out your career →
**Secondary CTA (ghost):** Try a Free Demo → `/try-demo` (Round 33: "See how it works" removed — it is in the nav)

*(Kira move: consider a highlighter-pink swipe under "in demand and AI-resilient" — the one place
pink earns its keep.)*

---

## 2. WHAT STUDENTS ASK US  *(Round 33: replaces "You don't need more career gyaan" and "What a system does for you")*

Ten folded questions, the ones that hook school and college students first on top; each answer is a hidden fact
(source kept) and what Freshmxn does about it. The live wording is `QUESTIONS` in `Frontend/src/pages/Public/Landing.js`.

1. Will AI take my job? — India Skills Report 2026; every career shows how exposed it is to AI and how much India needs it.
2. Why do I only know a handful of careers? — 93% know only seven options (India Today survey); 1,000+ careers and job roles.
3. I don't know what I'm interested in — where do I start? — Virtual Career Counselling; the free 6-minute demo.
4. Will my degree make me job-ready? — about 44% not job-ready (India Skills Report 2026); counted from where you stand.
5. How do I explore without wasting years on a degree or random online courses? — matches from your story, the road, your next 12 months, a mentor.
6. Is that master's or expensive course worth it? — cost to qualify, pay ranges, whether a master's is needed.
7. How do I get job- or internship-ready fast? — first steps on each card; internships/jobs/starter kit on the waitlist (no resume service).
8. Can I talk to someone who's done it? — a mentor in the job role you choose, 1 hour + 20-minute follow-up, matched within 20 business days.
9. I've found something new I love — how do I make it real? — the path and next 12 months; a mentor for work or passion.
10. My past choices feel wrong — is it too late? — what carries over, years left behind, how long from now.

---

## 3. THE DEMAND-SIDE PROMISE

**Heading:** We don't just train you for a dead end.

Most career advice prepares students for jobs — often crowded or fading ones. That's the
education-to-employment mismatch, on repeat. We do it the other way round: we start from **where the
demand actually is and where it's heading** — careers that are AI-resilient, financially viable and
genuinely in demand — and help match you *toward* it. You're not being pointed at a road that ends.

---

## 4. HOW IT WORKS  *(Kira's four-card rhythm)*

**Heading (Orelega One):** 4 steps. 0 gyaan.

**01 · We get to know you. Properly.**
Your interests, the problems you've faced, what you believe about yourself. Career gyanis guess. We ask.

**02 · We measure what you're wired for.**
An X-ray of how your brain works — minus the radiation. Personality, thinking style, strengths.

**03 · Find out where you fit, and what lasts.**
1,000+ Indian careers and job roles that are in demand, pay well, and won't get eaten by AI — kept up to
date with AI-assisted checks. Ranked for *you*, not for
"log kya kahenge."

**04 · Meet someone who's been there. (Mentor tier)**
A 1-on-1 with a working professional in your matched field — someone who was once exactly where you are.

> **How we rank — read this, it matters.** We do **not** shut you out of a career because of your
> "intelligence" scores. We match *first* on what you've already done and discovered — your interests,
> activities, problems, beliefs — and *then* add a psychometric layer only to **sort** the best fit.
> Your story goes first. Your marks never get a veto.

---

## 5. THE INVITATION-ONLY BONUS

**Heading:** 🔒 We help you get there. (By invitation only)

The report is the beginning, not the end. For select students, we go further — turning a
recommendation into real momentum.

---

## 6. WHY WE'RE DIFFERENT

**vs. Career Counsellors**
- **Affordable** — versus ₹5,000–₹25,000 a session.
- **Explore, don't just decide** — try on multiple paths, not one forced pick.
- **Structured, evidence-based matching** — data-driven, not one person's opinion.

**vs. Mentorship Platforms**
- **Mainstream + alternative paths** — including careers you've never heard of.
- **Smarter matching based on your story** — not a generic list.
- **Deep cognitive + personal-development focus** — the whole picture.

**vs. AI Tools (LLMs)**
- **Human connection — via our mentorship tier.** Real people in the field, not generic chat. →
  [Join the mentor waitlist](/mentor-waitlist)
- **Personalized tracking** — guidance built on your profile.

---

## 7. PRICING

- **Career Discovery — ₹2,499.** The complete experience, your detailed profile, and
  your ranked career matches with a readiness guide.
- **Discovery + Mentor — ₹5,499.** Everything above plus two sessions with a working professional in
  your matched field (1-hour clarity + 20-min follow-up). → [Join the waitlist](/mentor-waitlist)
- *Did Career Discovery first? Add a mentor for just **₹3,000 more** after you see your matches — no paying twice.*
- **Mentor Only — ₹2,999.** Already know the field you want? Skip the assessment — choose a career and job role, and we match you with a mentor (the same two sessions). *(Round 12; prices on the site always come from the server.)*
  matches — no paying twice.*

---

## 8. ABOUT
Built by **Luv Goel** ([LinkedIn](https://www.linkedin.com/in/luv-goel/)) and the Freshmxn Labs team —
because choosing a career in India shouldn't come down to a short list of options and someone else's
expectations. *(2–3 lines in your own voice on why you started this.)*

## 9. CONTACT
- **WhatsApp:** [Message us](https://wa.me/918882756287) — 8882756287
- **Call:** 8882756287 · **Email:** luvgoel@freshmxn.com

---

## DESIGN NOTES FOR THE BUILD
- **Structure:** follow Kira — light hero with headline + two CTAs, a strikethrough "system" beat, a
  4-card "how it works," a differentiator grid, a clean pricing block, friendly footer.
- **Energy:** playful but trustworthy (students + parents both read this). Rounded cards, generous
  whitespace, one friendly illustrative motif — not corporate-flat, not moody-atmospheric.
- **Colour discipline:** off-white base · navy `#1E2A38` headings/text · teal `#007582` for every
  CTA, link, and highlight · pink as a single highlighter accent on ONE key phrase per section max ·
  `#BEBEBE`/`#D1D1D1` only for muted text and dark-section text.
- **Type:** Orelega One for H1–H3 (the display personality), Lato everywhere else (readability).
- **Borrow from Cofounder:** just the *warmth* — soft edges, a gentle gradient or two — so it doesn't
  read as generic SaaS. Structure stays Kira.
