# Version 2 and Beyond
## What is deliberately NOT in V1

Everything here was considered and deferred. Each entry records why, and what triggers it.

**The point of this document:** stop good ideas being re-litigated, and stop them being forgotten.

---

# V1.1 — SOON AFTER LAUNCH

## Hindi language support
**Deferred because** story equivalence across languages needs native adaptation and back-translation checking, plus 8 human audio recordings per language. That is weeks of work by people who are not you, and it blocks nothing in English.

**Needs:** English master → LLM translation → bilingual human edit → back-translation → fact-list comparison → 2 reviewers agreeing on difficulty within 1 point → human audio recording at ~130 wpm.

**Trigger:** when a meaningful share of pilot students select Hindi as preferred language at intake. That field is collected from day one specifically to answer this.

**Note:** open-ended answers already accept English, Hindi, or a mix in V1. Only the *presented* material is English-only.

## Replace the reasoning instrument
**The single highest-priority upgrade in the whole product.** Reasoning feeds six downstream factors and currently rests on a 10-item free external sample that is copyrighted commercial practice material and offers one form only.

**Replacement:** ICAR (International Cognitive Ability Resource) — openly available, documented in Condon & Revelle (2014). Its four subtests map onto verbal, matrix, letter–number and 3D rotation.

**Gains:** removes a screenshot, removes the one-attempt limitation, removes the licensing question, and gives real per-item timing instead of a self-reported average.

**Trigger:** immediately after pilot.

## Displaying per-profession match confidence

**The number is computed and stored from V1.** What is deferred is only showing it to students.

```
match_confidence = 1 − (weight of missing factors in THIS profession ÷ total weight)
```

If reasoning is null, Software Engineer (reasoning at 0.25) scores 0.75 while Sales Manager (0.05) scores 0.95 — the same gap damaging one match and barely touching another.

**Deferred because** it puts an uncertainty mark on individual recommendations, which is a concept a student has to decode, and there is no evidence yet that low-confidence matches are actually worse.

**Trigger:** Stage 4b in the Learning From Data roadmap — at 150 recommendations containing a null, compare mentor override rates and 6-month outcomes between high and low confidence groups. Display it if the difference is real; drop the field if it is not.

## Mental rotation — one real domain ability

The battery currently measures **general reasoning ability plus felt affinity** for seven domains. It does not measure spatial, musical, bodily or naturalistic ability at all, because the MI block is self-report.

**If one real domain ability is added, make it spatial.** Mental rotation is buildable in a browser in about a week, it is the most career-relevant of the untested domains (engineering, design, surgery, architecture), and it is where self-rating and measured performance diverge most.

Musical, bodily and naturalistic ability are not practically testable in a browser and should stay as affinity measures.

**Free precursor, available from V1:** `MI_L` is self-rated logical ability while Reasoning is measured. **The gap between them is a domain-specific calibration signal** — a student rating themselves high on logical while scoring low on reasoning is over-confident in that area. Store both and compute the gap; it costs nothing and it previews what a spatial task would give you across a second domain.

## Second calibration item for uncertainty tolerance
U7 is currently a single item driving `risk_uncalibrated`. Two items is still thin but twice as reliable, and would let the flag move from qualifying a score to acting on it.

---

# V2 — AFTER 150+ RESPONSES

## Item analysis and the first instrument revision
The first MAJOR `instrument_version` bump. Expect to cut 4–6 questions with no information loss.

**Requires the instrument to have been frozen for the first 150 responses.** Batch all changes into one release — fixing one question in March and another in April splits the data into pools too small to analyse.

## Provisional norms
Raw scores become percentile bands. The "provisional" label stays visible until 500+ per age band.

**Needed first:** enough responses per age band, and a check for ceiling or floor effects above 20% on any factor.

## RIASEC interests
The evidenced replacement for using Multiple Intelligences as a proxy for interest. O\*NET Interest Profiler is public domain, and O\*NET already publishes RIASEC codes for occupations — meaning a large share of the 223 professions could inherit validated interest matching rather than being hand-rated.

**Would sit alongside MI, not replace it** — MI stays as a diversity layer in the profile.

## IPIP-NEO-120 for conscientiousness facets
IPIP-50 gives domain scores only. Self-discipline and achievement-striving — the two facets most relevant to consistency — are not separable. NEO-120 costs ~10 extra minutes and would matter if consistency becomes a headline output.

## Adaptive item selection
Stop asking questions whose answer is already predictable from earlier responses. Could cut 20–30% of assessment length at no cost to reliability.

**Needs:** item-level response data from 300+ students. Genuinely cannot be built earlier.

## Longitudinal delay comparison
The 24-hour vs same-session question, settled with data rather than argument. `delay_minutes` is stored on every record from V1 precisely so this is possible later.

## Mentor / counsellor portal
Currently `mentor_overrides` is a schema field with no interface. Fifty logged overrides will teach you more about Baseline_Rating errors than a thousand assessments will.

---

# V3 — AFTER OUTCOME DATA (18–24 MONTHS)

## Fitted weights
Every weight in the model is currently expert judgement. Replacing them needs 220–440 students who completed **and** returned 6–12 months later.

Ridge regression, 80/20 split. **If fitted weights do not beat equal weights on the held-out set, keep equal weights** — a common result and not a failure.

## Learned ranking for Part 2
Target = outcome satisfaction. **Never clicks.** Tuning on engagement would learn to surface pilot, actor and entrepreneur, and would look like it was improving the entire time it got worse.

## Professional benchmarking at scale
15–20 professions × 20–30 professionals, compared on **ipsatised profile shape**, never absolute levels — because a professional's profile is an endpoint shaped by years in the role, not an entry requirement, and they are older than students in ways that affect processing speed directly.

## Correcting effective-weight leakage
The effective-weight table shows emotional stability stated at 0.20 in firmness but running at 0.270 across all paths. Left uncorrected in V1 by decision. Worth revisiting once weights are fitted rather than judged.

---

# CONSIDERED AND REJECTED

Not "later" — decided against.

| Idea | Why not |
|---|---|
| **Fine-tuning an LLM on responses** | Wrong tool. Rubric scoring and report writing are both controlled better by prompts, and fine-tuning freezes the rubric into weights so every revision means retraining. Rubric tightening plus worked examples gets you there. |
| **Lateral thinking as a factor** | Built from four of the same inputs as divergent thinking. Would correlate ~0.8 and add a dimension without adding discrimination. |
| **Introversion as a separate factor** | The low pole of Extraversion, already measured. What was actually wanted was self-knowledge, now Factor 20. |
| **Grit as its own scale** | Credé et al. (2017): grit is largely conscientiousness relabelled. Conscientiousness at 0.35 in consistency is the honest version. |
| **Optimising recommendations on clicks** | Would systematically degrade advice while every dashboard metric improved. |
| **Phone OTP for student login** | SMS pumping fraud. Parent consent OTP is different — one per account, after signup, rate-limited. |
| **Imputing averages for invalid modules** | Records a measurement that was not taken and becomes invisible downstream. |
| **Values gap in the Part 1 report** | Directional rather than developmental, and a difference score compounds the error of both measures it is built from. Stays as Part 2 input. |

---

# THE ONE THING THAT CANNOT WAIT

**The 6- and 12-month follow-up must ship in V1.**

It is a scheduled job and an email template. But a follow-up added in month 12 produces no usable data until month 18, and every V3 item above depends on it.

Nothing else in this document is time-sensitive in the same way. Everything else can be added when it is needed; this one has to exist before it is needed.

---

# ADDENDUM — PRODUCT & PLATFORM DEFERRALS (added during the V1 build)

The sections above cover the *psychometric instrument*. This addendum records everything
deferred on the *product/platform* side (auth, payments, mentor tier, public site, ops) so it
isn't re-litigated or lost.

## Mentor tier — full automation (V2)
V1 ships mentor **onboarding + a paid waitlist + manual admin matching within 20 business days**.
Deferred to V2:
- Automated mentor↔student matching (keyed on the student's chosen profession)
- In-app scheduling / calendar for the two sessions (1-hr clarity + 20-min follow-up)
- In-app session delivery and mentor payouts
- **The mentor-override → Baseline_Rating refresh loop** — re-scoring profession factors using
  mentor-override data. Deferred not because it's hard but because it has no fuel in V1 (no
  mentor sessions exist yet). Switches on once mentor session/override data accumulates.
  **Trigger:** ~50 logged mentor overrides.

## Payments — Razorpay live + upgrade automation (V2/go-live)
V1 launches in **`manual` payment mode** (student requests access → admin collects offline →
admin Grants via `grantAccess`). Razorpay is fully built but **dormant** behind `PAYMENT_MODE`.
Deferred:
- Flipping `PAYMENT_MODE=razorpay` with live keys — blocked on **Razorpay KYC**, which needs the
  **Pvt Ltd company registration + business bank account** (CA-led, real timeline). Same
  `grantAccess` seam, so the switch is zero-rework.
- Razorpay Offers/coupons wired natively (V1 computes discounts server-side + records them).

## Auth — richer flows (V1.1)
V1 has email+password+JWT+bcrypt, Google OAuth, forgot-password. Deferred: magic-link login,
and hardening (Redis-backed rate limiting — only needed once running >1 server instance).

## Parental consent — verified OTP (V2)
V1 is a **self-declared checkbox** with a parent's name + mobile; nobody is age-blocked.
`Consent.isTemporary: true` on every row so V2 can find everyone to re-consent. V2 replaces it
with a **verified parent-OTP flow** — gated on the **DPDP legal sign-off** (a lawyer's hour on
parental consent + minor behavioural-tracking).

## ⚠ DPDP under-18 behavioural tracking (DEFERRED to V2 — Day 4 §2.1)
Contrary to an earlier plan, this was **deferred, not built in V1**. Today there is **no events
collection, no counters, no `dwell_ms` anywhere** — which is the *safe* state (no per-child trail
exists). What's lost until V2: the "is this profession never expanded?" content-quality signal.
**⚠ THE TRAP:** the aggregate-vs-per-user split must be in place the **first time a single event
is ever written**. If V2 ships events, it ships BOTH halves in the same release — otherwise every
event in the gap is an un-collectable per-child behavioural record that shouldn't exist.

## ⚠ 6- and 12-month follow-up (DEFERRED to V2 — Day 4 §2.2)
Contrary to the Part-1 brief's "must ship in V1" and my earlier plan, the owner **deferred this to
V2** on 2026-09-24. Consequence stated plainly: first outcome data now arrives 6 months after *V2*
ships, not V1 — so every weight in `constants.js` / `baseline_rating.json` stays an approved guess
until then. **The cheap mitigation, already done:** `report.generatedAt` + a contactable email are
captured on every V1 record, so V2 can retrospectively mail the whole V1 cohort. **DO NOT delete or
overwrite `reports.generatedAt`** — it's the anchor the deferred job will use. This remains the
single highest-value thing to build early in V2.

## match_confidence display (V1.1)
Computed + stored per profession from V1; **never displayed, never an input**. Shown to students
only after Stage-4b validation proves low-confidence matches are actually worse (mentor-override
rates / 6-month outcomes at ~150 null-containing recommendations).

## Aspiration coverage gaps (ongoing admin)
Unmatched aspirations (`professionId: null`) are kept, not discarded — they are exactly the
careers the 223-profession taxonomy doesn't yet cover. Review them **as a set** periodically;
they're the demand-driven signal for what to add to the taxonomy next.

## Design — the full visual system (V1.1 polish)
V1 gets one design pass (Kira-style, light-mode, teal-navy, pastel-pink `#FFB3C7` accent,
Orelega One + Lato). Deeper motion/illustration/brand system is post-launch polish.

## Content review debts (pre-real-launch, not V2)
- `problemPrompts.js` — 132 interest-form prompts, some sensitive (discrimination, illness,
  family money) — need a human read-through before real students.
- **The report prompt** (`reportComposer.js`, now `report@2.0.0`) — owner must approve before it
  runs on a real (mostly-minor) student.
- **90 withheld nuances** — excluded from students for builder-phrasing/raw identifiers; several
  are genuinely useful and a copy pass would recover them. Plus nuances still saying "taxonomy"/
  "Sector 5" (meaningless to a student) need a copy review.
- **`profession.filter` is unused** — 12 professions marked `filter: false` (Anganwadi Educator,
  Sanitation Worker, Commercial Driver, Housekeeping…) are ranked and shown today. Owner decides:
  wire the flag on, or keep them shown (their own nuances argue listing them is the point).
- Pre-email-verification legacy accounts can't pay until `isEmailVerified` is set.

## Never validated on real hardware (pre-real-launch)
- **SART's 20ms timing gate has never run on a low-end Android.** The refusal path is proven safe,
  but if most cheap Androids fail the gate, that's a product decision (loosen the gate, or ship
  without processing speed) — not a code fix.
- **The external tests have never hit the live vision API** — every gate is fixture-proven with a
  stubbed Haiku client; no real screenshot has been through Haiku 4.5. Validate before real use.

## THE STANDING V1 TASK
**Get everything into git.** Across every day's handover the note has been "nothing committed."
This is the single most overdue housekeeping item — do it before/around Day 5, so all the work
is versioned and safe, not just living on one machine.
