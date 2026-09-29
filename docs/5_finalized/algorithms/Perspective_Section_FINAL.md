# Perspective Section — FINAL SPECIFICATION

**Version:** `perspective@5.0.0`  ·  `sart@1.0.0`
**Status:** build this. Supersedes everything earlier — nothing here requires looking at an older version.

---

# PART A — WHAT THIS SECTION DOES

It measures **three things** from its own questions:

| Bank | What it is | Feeds |
|---|---|---|
| `belief_bank` | Crystallised knowledge of perspective and belief | Firmness of Belief |
| `emotion_bank` | Emotional experience bank | Emotional Intelligence |
| `clm` | Cognitive load management | Focus |

Everything else — Agreeableness, Emotional Stability, Conscientiousness, Openness, Reasoning, Short-Term Memory, Confidence — is **fetched** from the sections that already measure it. This section never re-measures a trait another section owns.

Each bank = **a multiple-choice block + one open-ended item scored by an LLM.** The MCQ block gives reliability; the open item gives depth. A bank meant to represent *crystallised knowledge* cannot be measured by tick-boxes alone.

## Important: emotional stability, not neuroticism

The input is **emotional stability** — already the reverse of neuroticism. It is used **directly**. There is no `(10 − x)` anywhere in the code. High value = calm and stable = raises EI and firmness.

---

# PART B — THE CONSISTENCY QUESTION

**You asked whether the repetition aspect is covered. It isn't — not properly.**

Under the previous formula (`consistency = 0.50 focus + 0.50 idm`, with Conscientiousness sitting inside focus at 0.15), here is what actually drove the score:

| Input | Share of consistency |
|---|---|
| Reasoning | 30.0% |
| CLM | 15.0% |
| Firmness | 15.0% |
| Openness | 15.0% |
| Short-term memory | 10.0% |
| **Conscientiousness** | **7.5%** |
| EI | 7.5% |

Reasoning ability contributed **four times more than Conscientiousness** to a score meant to represent hard work. Conscientiousness was diluted through two layers of nesting until it barely registered. It was technically present, which is why it looked covered — but a trait at 7.5% isn't driving anything.

## The fix

Conscientiousness was sitting in `focus_score` as a proxy for *"manages their own cognitive load."* **You now measure cognitive load management directly.** That proxy is redundant — the real measurement has replaced it.

So: **remove Conscientiousness from focus, make it the primary input to consistency.** It then appears exactly once in the entire model. No double counting, and the trait that actually predicts repeated execution now drives the factor that's about repeated execution.

| Input | Share of consistency (final) |
|---|---|
| **Conscientiousness** | **40.0%** |
| Reasoning | 17.0% |
| CLM | 12.2% |
| Short-term memory | 8.8% |
| Firmness | 7.5% |
| Openness | 7.5% |
| EI | 7.0% |

Conscientiousness now outweighs reasoning 2.4 : 1, reversed from 1 : 4.

**Verified in testing:** setting Conscientiousness to 0 drops consistency from 10 to 6. Setting reasoning to 0 drops it to 8.1. The factor now moves with the thing it's named after.

**One limitation worth knowing.** IPIP-50 gives you Conscientiousness at *domain* level only. The two facets that matter most here — self-discipline and achievement-striving — aren't separable. If consistency ever becomes a headline output you sell on, that's the argument for moving to IPIP-NEO-120, which gives facets. Not a V1 problem.

---

# PART C — WHAT STAYS, WHAT CHANGES, WHAT GOES

## Removed — 8 items

| Old | Question | Why it's going |
|---|---|---|
| Q4 | How often do you feel anxious when deciding? | Neuroticism, already measured properly by IPIP. Duplicate. |
| Q5 | How often do you second-guess yourself? | Post-decision rumination is a Neuroticism facet, not belief knowledge. Duplicate. |
| Q22 | "I can resist temptations…" | Single socially-desirable Likert item. Overlaps Conscientiousness, now measured directly. |
| Q18 | What do you do after failing a goal? | Fed only the old consistency score, which is now derived. Contributes nothing. |
| Q19 | How quickly do you adjust to obstacles? | Same. |
| Q20 | How often do you prioritise long-term goals? | Same. (Also the item whose scoring sign was inverted in the old code.) |
| Q21 | $700 now or $1,000 in a month? | Same. A nice classic item, but a single delay-discounting question with nothing to feed. |
| Q25 (mine) | MCQ: "could you explain your belief?" | **Cutting my own item.** P7 asks the student to actually *do* this. A self-rating of the same thing is strictly worse. |
| Q37 (mine) | Grief scenario | **Cutting my own item.** P20 already covers managing another person's distress, and this is the item most likely to distress a student who has recently lost a parent. Not worth the redundancy. |

## Kept exactly as written — 6 of your originals, unedited

**P1, P2, P3, P4** (your Q1, Q2, Q6, Q7) and the values block **P23–P30** (your Q8–Q15) and **P31, P32** (your Q3, Q16). Wording unchanged. Only the scoring keys and the numbering change.

Your Q17 becomes **P8** — kept, and it earns its place: every other cognitive-load item asks what the student *knows* to do, while Q17 asks how often it actually happens. Behavioural frequency and situational knowledge are different signals and you want at least one of each.

## Final count

| Block | Items |
|---|---|
| Belief bank | 6 MCQ + 1 open |
| Cognitive load | 5 MCQ + 1 open |
| Emotion bank | 8 MCQ + 1 open |
| Intrapersonal | 1 open |
| Uncertainty tolerance | 6 MCQ + 1 calibration check |
| Values profile | 8 Likert |
| Narrative only | 2 |
| **Total** | **40 items, ~14–16 minutes** |
| SART | separate timed task, ~5 minutes |

---

# PART D — THE COMPLETE QUESTION SET

> **Build note:** options are listed best-first so you can see the gradient. **Shuffle the order for every question when you build the form** — students spot the pattern within three questions. Then update only the `KEY` maps in the code. Every option must be prefixed `A) `, `B) `, `C) ` etc.

---

## BLOCK 1 — BELIEF BANK (P1–P7)

Three facets: how **examined** the belief is, how far it's genuinely **the student's own**, and whether it **holds up** under time and pressure.

### P1 — Values conflict with a group plan *(was Q1, unchanged)*

> Imagine your classmates or colleagues plan a weekend activity that conflicts with one of your personal values — for example, skipping a volunteer event you care about. How do you usually respond?

| A | I politely decline and explain why the value matters to me | 4 |
|---|---|---|
| B | I suggest an alternative that keeps everyone comfortable | 3 |
| C | I go along but feel uneasy later | 2 |
| D | I ignore the conflict and join without thinking much | 0 |

### P2 — Belief meets contradicting data *(was Q2, unchanged)*

> You strongly believe something is the right choice, based on your experience and intuition. Later you come across data or reports suggesting the opposite. What do you usually do?

| A | I stick to my belief unless the data is extremely strong and repeated over time | 4 |
|---|---|---|
| B | I consider the data, but my intuition usually carries more weight | 3 |
| C | I feel conflicted and often delay the decision until I'm fully convinced | 1 |
| D | I quickly change my belief to match the data, even if it feels wrong | 0 |

### P3 — Approach to a complex problem *(was Q6, unchanged)*

> When you face a complex problem or decision with no obvious answer, what do you usually do?

| A | I gather relevant information, evaluate multiple options, then decide on what makes most sense | 4 |
|---|---|---|
| B | I think it through using what I already know and choose what seems most reasonable | 3 |
| C | I rely on advice from others, or follow an approach that worked for someone else | 2 |
| D | I choose the safest or most commonly taken option to avoid risk | 1 |
| E | I avoid the decision or postpone it until it becomes unavoidable | 0 |

### P4 — Use of other people's opinions *(was Q7, unchanged)*

> When making an important decision, how do you usually use other people's opinions?

| A | I listen to others, but I ultimately decide based on my own judgment | 4 |
|---|---|---|
| B | I treat others' opinions as inputs and balance them with my own view | 3 |
| C | I rely on others' opinions when I feel unsure | 2 |
| D | I usually need others' approval before deciding | 1 |
| E | I avoid deciding unless someone else clearly guides me | 0 |

### P5 — Staying with a decision that isn't paying off *(new)*

> Eight months ago you chose a direction after thinking it through carefully — a course, a skill, a career path. You've worked at it steadily. You still have nothing visible to show for it: no results, no recognition. When you check your original reasons, they still hold. What do you do?

| A | I continue as planned — my reasons haven't changed, and results take time | 4 |
|---|---|---|
| B | I continue, but set a specific date to review it seriously | 3 |
| C | I keep going while quietly starting to look at other options | 2 |
| D | I switch to something that shows results faster | 1 |
| E | I stop and wait until I feel sure again | 0 |

### P6 — Holding a decision against family pressure *(new)*

> You've decided on a direction for yourself after genuine thought. A senior family member you respect tells you it's a mistake and pushes you towards their choice. What usually happens?

| A | I hear them out fully, then go ahead with my own decision | 4 |
|---|---|---|
| B | I go ahead with mine, but adjust parts of it to reduce the conflict | 3 |
| C | I delay the decision until they come around | 2 |
| D | I usually end up following their choice | 1 |
| E | I avoid the conversation and don't decide at all | 0 |

### P7 — Belief statement *(new, open text, LLM-scored 0–9)*

> Write down one belief you hold strongly about your career or your life.
>
> It can be anything you hold firmly — a religious belief, a cultural value, a theory you think is true, a view about how people work, or something about your own future.
>
> **(a)** Why do you hold it?
> **(b)** What experience or evidence supports it?
> **(c)** What would make you change your mind?

```
belief_bank = 0.60 × (P1–P6 average) + 0.40 × P7
```

P7 carries the heavier per-item weight because it's the only item that *demonstrates* the reasoning rather than asking the student to rate it.

---

## BLOCK 2 — COGNITIVE LOAD MANAGEMENT (P8–P13)

### P8 — How often derailed by distractions *(was Q17, unchanged)* — reversed scoring

> How often do you find yourself derailed from your long-term goals by distractions or short-term pleasures?

| A | Very frequently (daily) | 0 |
|---|---|---|
| B | Frequently (several times a week) | 1 |
| C | Occasionally (a few times a month) | 3 |
| D | Rarely (less than once a month) | 4 |

### P9 — Moving between tasks *(new)*

> You have three unrelated pieces of work to finish today. How do you usually move between them?

| A | I finish one properly before opening the next | 4 |
|---|---|---|
| B | I give each a fixed block of time and stick to the blocks | 3 |
| C | I move to another whenever the current one gets difficult | 2 |
| D | I keep all three open and switch between them as I feel like it | 1 |
| E | I start whichever one someone reminds me about | 0 |

### P10 — Protecting a deep-work block *(new)*

> You've just started a two-hour block of your hardest work. Within 20 minutes, three people message you asking for small favours. None are urgent. What do you usually do?

| A | I don't see them — notifications are off while I do focused work | 4 |
|---|---|---|
| B | I see them, don't reply, and deal with everything after the block | 3 |
| C | I reply quickly to each one and go back to work | 2 |
| D | I stop the block, handle them, and restart later | 1 |
| E | I handle them and usually don't get back to the block that day | 0 |

### P11 — Using your sharpest hours *(new)*

> Most people are sharper at some hours than others. How do you actually use yours?

| A | I deliberately protect them for my hardest work | 4 |
|---|---|---|
| B | I use them for hard work when I can, but something else often takes them | 3 |
| C | I've noticed when they are, but I don't plan around them | 2 |
| D | I haven't paid attention to when I'm sharpest | 1 |
| E | My hardest work usually happens late at night when I'm running out of time | 0 |

### P12 — Recognising and recovering from load *(new)*

> You've been working on something demanding for about 90 minutes and your attention is clearly dropping. What do you usually do?

| A | Take a short planned break away from screens, then return | 4 |
|---|---|---|
| B | Switch to a lighter task for a while, then come back to the hard one | 3 |
| C | Push through until it's done, however long it takes | 2 |
| D | Pick up my phone and scroll until I feel like resuming | 1 |
| E | Stop for the day and tell myself I'll do it tomorrow | 0 |

### P13 — Day plan *(new, open text, LLM-scored 0–5)*

> Tomorrow is free, 9 am to 9 pm. You have five things to do:
> 1. A 1500-word assignment due in 2 days — needs deep focus, about 3 hours
> 2. Reply to 12 pending messages and emails — about 30 minutes
> 3. An online class at 4 pm you must attend — fixed, 1 hour
> 4. Groceries and errands — about 1 hour
> 5. Revision for a test 8 days away — about 2 hours
>
> Write the order you would actually do them in, with rough timings.

```
clm = 0.70 × (P8–P12 average) + 0.30 × P13
```

---

## BLOCK 3 — EMOTION BANK (P14–P22)

Four items on **understanding** emotions, four on **managing** them, plus one open item on **granularity**.

### P14 — Irreversible loss of a long-held goal

> Rahul prepared for two years for a competitive exam. He doesn't clear it, and he has no attempts left. In the weeks that follow, what is he most likely to feel most strongly?

| A | Sadness | 4 | | B | Anger | 2 | | C | Anxiety | 2 | | D | Guilt | 1 | | E | Relief | 0 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|

### P15 — Being wronged

> In a group project, a teammate presents your work to the class and does not mention your name. What are you most likely to feel first?

| A | Anger | 4 | | B | Sadness | 2 | | C | Embarrassment | 1 | | D | Guilt | 0 | | E | Relief | 0 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|

### P16 — Two emotions at once

> Meera's closest friend gets admission to the college Meera wanted and didn't get. Meera hugs her and means it — and also feels something uncomfortable she'd rather not admit. What is she most likely feeling?

| A | Real happiness for her friend and envy, at the same time | 4 |
|---|---|---|
| B | Sadness about her own result, nothing more | 2 |
| C | Only happiness — the discomfort is about something else | 2 |
| D | Anger at her friend | 1 |
| E | Nothing much; she's imagining it | 0 |

### P17 — How an emotion changes over time

> Arjun has spent three years trying to repair a difficult relationship with his father. Nothing he tries changes anything, and he has now stopped trying. What is he most likely to feel now?

| A | Hopelessness | 4 | | B | Anger | 2 | | C | Guilt | 2 | | D | Relief | 1 | | E | Anxiety | 1 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|

### P18 — Managing your own anxiety before performing

> You have an important presentation tomorrow and you're very nervous. What is the most effective thing to do tonight?

| A | Rehearse it once out loud, and treat the nerves as a sign it matters | 4 |
|---|---|---|
| B | Go over everything that could go wrong so you're fully prepared | 2 |
| C | Distract yourself so you stop thinking about it | 2 |
| D | Keep telling yourself there's nothing to be nervous about | 1 |
| E | Ask someone else to present instead | 0 |

### P19 — Managing rumination

> You keep replaying an argument from last week, and it's stopping you concentrating. What is the most effective thing to do?

| A | Write down what's actually unresolved and decide one thing you'll do about it | 4 |
|---|---|---|
| B | Talk it through with several friends until you feel better | 2 |
| C | Wait — these things fade on their own | 2 |
| D | Push the thought away every time it comes back | 1 |
| E | Avoid anything that reminds you of it | 0 |

### P20 — Managing someone else's distress

> You give a junior teammate honest critical feedback and they start crying. What is the most effective thing to do?

| A | Pause, acknowledge it's hard to hear, then repeat the feedback with specific next steps | 4 |
|---|---|---|
| B | End the conversation and send the feedback in writing later | 2 |
| C | Take the feedback back and say it wasn't a big issue | 1 |
| D | Change the subject and hope they're fine tomorrow | 1 |
| E | Tell them they need to handle feedback professionally | 0 |

### P21 — Naming a mixed feeling

> A friend tells you: *"I got the promotion I wanted, but I can't enjoy it. My closest colleague applied too and didn't get it."* What best describes what your friend is feeling?

| A | Pleased about the promotion and uncomfortable that their friend lost out, both at once | 4 |
|---|---|---|
| B | Guilt, and nothing else | 2 |
| C | Regret about having applied | 1 |
| D | Sadness | 1 |
| E | Nothing unusual — that's a normal reaction | 0 |

### P22 — Emotional narrative *(open text, LLM-scored 0–4)*

> Think of a time you had to make a difficult choice that affected someone close to you. In 3–4 sentences, describe what you felt. Name your feelings as precisely as you can.

```
emotion_bank = 0.70 × (P14–P21 average) + 0.30 × P22
```

Emotional granularity — how finely someone distinguishes their own feelings — is the closest practical measure of an accumulated experience bank. Someone with a wide bank separates *guilty* from *ashamed* from *regretful*. Someone without one has a single word: *bad*.

---

## BLOCK 4 — VALUES PROFILE (P23–P30) *(your Q8–Q15, unchanged)*

**P23–P26 — How fulfilled do you currently feel?** (1 = not at all, 5 = extremely)
Safety/Physiological · Social · Esteem · Self-Actualisation

**P27–P30 — How important is each to you?** (1 = not important, 5 = extremely)
Safety/Physiological · Social · Esteem · Self-Actualisation

Reported as `importance − fulfilment` per area. The **largest gap** is what's currently pulling the student. Reported as a profile, never summed into a score, never mixed into any factor.

This is the only part of the assessment that speaks to "the why," which is why all eight items survive despite feeding no factor.

---

## BLOCK 5 — NARRATIVE ONLY (P31–P32)

**P31 — What do you believe in?** *(your Q3, unchanged)* — categorical, report colour only.

**P32 — What most often causes you to lose momentum?** *(your Q16, unchanged)* — returned as a label for the report. Also drives the `social_desirability` flag: a student selecting *"I never lose momentum"* is telling you something about their response style.

---

## BLOCK 6 — INTRAPERSONAL INTELLIGENCE (P33) — Factor 20

### P33 — Changed self-belief *(open text, LLM-scored 0–6)*

> Describe something you believed about yourself two years ago that you no longer believe.
>
> **(a)** What did you believe?
> **(b)** What changed your mind?
> **(c)** What do you believe about yourself now instead?

| Sub-scale | 0 | 1 | 2 |
|---|---|---|---|
| `specificity` | No belief named, or a generic trait ("I was shy") | A belief named but vague | A concrete belief about their own capability or nature |
| `causal_insight` | No cause, or "I just grew up" | A vague cause ("experience") | A specific event, piece of feedback, or accumulated evidence |
| `integration` | Doesn't say what replaced it | Names a replacement belief | Names the replacement *and* what it changed about how they act |

```
self_awareness_bank        = 0.60 · P33 + 0.40 · P7_revisability

intrapersonal_intelligence = 0.55 · self_awareness_bank
                           + 0.25 · emotion_bank
                           + 0.20 · openness
```

**Why not take this from the MI test.** Those intrapersonal items are self-ratings — "I understand myself well." Self-report of self-awareness is invalid by construction: people who lack it don't know they lack it, so they rate themselves high. P33 and P7 make the student *demonstrate* self-knowledge instead, which sidesteps the paradox.

P7's revisability sub-score appears in both firmness and intrapersonal on purpose. Knowing what would change your own mind genuinely belongs to both. `emotion_bank` is in there deliberately too — emotional self-knowledge is a real component of intrapersonal intelligence, not an accidental overlap.

---

## BLOCK 7 — UNCERTAINTY TOLERANCE (U1–U7) — Factor 22

**Read this before scoring it: the result is a POSITION, not a LEVEL.** Every other factor in the battery runs low-to-high as worse-to-better. This one does not. A low score means the student is suited to structured, defined-path professions. A high score means they're suited to ambiguous, self-directed ones. Neither end is a deficit, and the report must never describe a low scorer as lacking something.

It's measured directly rather than derived, because deriving it from Openness + Emotional Stability would just relabel Openness + Emotional Stability.

### U1 — Two offers

> You finish your studies and have two offers. One is a stable job with a fixed salary and clear yearly increments. The other is with a small new company: lower pay now, no guarantee it survives two years, but if it works you'd be doing far more interesting work and earning much more. Which do you take?

| A | The new company, without much hesitation | 4 |
|---|---|---|
| B | The new company, after working out how long I could manage if it failed | 3 |
| C | The stable job, but I'd keep exploring on the side | 2 |
| D | The stable job — the certainty matters more to me | 1 |
| E | The stable job, and I'd feel relieved to have chosen it | 0 |

### U2 — A field with no defined path

> A field genuinely interests you, but there's no set route into it — no clear entrance exam, no standard degree, and nobody around you has done it. How do you respond?

| A | That's part of the appeal — I'd start and work the path out as I go | 4 |
|---|---|---|
| B | I'd go ahead, but first find two or three people who've done something similar | 3 |
| C | I'd keep it as a side interest while following a defined path | 2 |
| D | I'd choose a field with a clear path instead | 1 |
| E | A field without a defined path isn't a realistic option for me | 0 |

### U3 — Deciding on incomplete information

> You have to make an important decision, and you can only get about 60% of the information you'd like. The rest genuinely can't be known in advance. What do you do?

| A | Decide now — 60% is usually enough, and waiting rarely adds much | 4 |
|---|---|---|
| B | Decide now, and plan for what I'd do if the unknown part goes badly | 3 |
| C | Spend more time gathering, then decide even if I haven't got much further | 2 |
| D | Delay until I'm substantially more certain | 1 |
| E | Ask someone more experienced to decide for me | 0 |

### U4 — Committing savings

> You have savings of ₹1,00,000. An opportunity comes up — a course, a venture, a move — that could meaningfully change your prospects, but it would use most of it, with no guarantee of return. What do you do?

| A | Commit most of it — this is what savings are for | 4 |
|---|---|---|
| B | Commit about half and keep the rest as a cushion | 3 |
| C | Commit a small amount to test it first | 2 |
| D | Keep the savings and look for a cheaper way in | 1 |
| E | Keep the savings — anything needing most of them isn't for me | 0 |

### U5 — Defined vs evolving role

> Two roles, same pay. In one, your responsibilities are clearly defined and you know what each week will look like. In the other, the role is still being shaped and will keep changing as the work develops. Which suits you better?

| A | The evolving role, strongly | 4 |
|---|---|---|
| B | The evolving role, though I'd want a few fixed anchor points | 3 |
| C | Either — I'd adapt to whichever | 2 |
| D | The defined role, though I could handle some change | 1 |
| E | The defined role, strongly | 0 |

### U6 — Returning to risk after a loss

> You took a considered risk a year ago and it didn't work out — you lost time and money. A similar opportunity appears now, and your reasoning says it's sound. What do you do?

| A | Take it — one bad outcome doesn't make the reasoning wrong | 3 |
|---|---|---|
| B | Take it, but change what I'd do differently based on last time | 4 |
| C | Take a smaller version of it | 3 |
| D | Wait until I've fully recovered from the last one | 1 |
| E | Avoid this kind of opportunity now | 0 |

*B scores above A deliberately. Continuing **and** learning is the strongest profile; continuing while learning nothing is tolerance without adaptation.*

### U7 — Calibration check *(NOT scored into the scale)*

> Someone you know offers you a chance to put money into something they say is guaranteed to double in six months. They can't explain clearly how it produces the returns. What do you do?

| A | Ask for a full explanation, and don't put money in without one |
|---|---|
| B | Put in a small amount to see what happens |
| C | Put in what I could afford to lose |
| D | Put in a significant amount — chances like this don't come often |
| E | Decline immediately without asking |

**Deliberately excluded from the scale.** C and D accept an unexplained "guaranteed" return — that's poor judgement, not high tolerance. Folding it in would let recklessness raise the score.

Instead it drives a flag: `uncertainty_tolerance ≥ 7` **and** U7 ∈ {C, D} → `risk_uncalibrated`. This is the one pattern in the section that should be named plainly rather than framed as a strength.

```
uncertainty_tolerance = average of U1–U6, rescaled to 0–10
```

---

# PART E — THE COMPLETE FLOW

```
STEP 1  Parse each MCQ answer by its leading letter → 0-4
        Unparseable → null (never 0) and logged

STEP 2  Average each block, rescale to 0-10
        Needs 80% of the block answered, else null

STEP 3  Parse the three LLM JSON outputs
        Read the SUB-SCORES. The code sums them, not the model.

STEP 4  Build the three banks
        belief_bank  = 0.60 MCQ + 0.40 open
        emotion_bank = 0.70 MCQ + 0.30 open
        clm          = 0.70 MCQ + 0.30 open

STEP 5  Fetch external scores (all 0-10)
        agreeableness, emotional_stability, conscientiousness,
        openness, reasoning, short_term_memory, confidence

STEP 6  Compute factors in DAG order
```

```
ei_score      = 0.40·emotion_bank + 0.20·agreeableness
              + 0.20·emotional_stability + 0.20·reasoning

firmness      = 0.40·belief_bank + 0.20·confidence
              + 0.20·emotional_stability + 0.20·ei_score

focus         = 0.30·sart_attention + 0.20·clm + 0.20·short_term_memory
              + 0.15·reasoning + 0.15·ei_score
              (no SART yet → its weight moves to clm, which becomes primary)

idm           = 0.40·reasoning + 0.30·firmness + 0.30·openness

consistency   = 0.35·conscientiousness + 0.20·persistence_items + 0.30·focus + 0.15·idm

intrapersonal = 0.55·self_awareness_bank + 0.25·emotion_bank + 0.20·openness

uncertainty_tolerance = average of U1–U6        (measured, not derived)
processing_speed      = from SART mean RT       (measured, not derived)
```

```
STEP 7  Propagate confidence down the chain
STEP 8  Build values profile and quality flags
STEP 9  Return
```

The dependency graph, with no cycles anywhere:

```
emotion_bank ──► ei ──┬──► firmness ──► idm ──┐
belief_bank ──────────┘                       │
clm ──────────► focus ────────────────────────┤
conscientiousness ────────────────────────────┤
                                              ▼
                                        consistency
```

---

# PART E2 — SART: THE TIMED ATTENTION TASK

Run via `sart_scoring.js`, which takes the raw PsyToolkit SART2 export and returns two numbers.

## Column format (verified against a real 243-row export)

| Col | Meaning |
|---|---|
| 1 | Block: `training` (18 trials, discarded) or `realtest` (225 trials) |
| 2 | Block number |
| 3 | **1 = GO** (digit is not 3) · **0 = NO-GO** (digit is 3) |
| 4 | Digit shown, 1–9 |
| 5 | Font size 1–5 (SART varies stimulus size; not used in scoring) |
| 6 | 1 = correct · 0 = error |
| 7 | Reaction time in ms. **900 = no response** within the window |

The parser checks that column 3 is 0 if and only if column 4 is 3. If that ever fails, the export format has changed and it returns null rather than scoring garbage.

## The four metrics

| Metric | What it is |
|---|---|
| **Commission errors** | Pressed on a 3. The classic attention-lapse measure. |
| **Omission errors** | Missed a go trial. |
| **Mean RT** | Average response time on correct go trials — **excluding anticipatory presses.** |
| **RT variability (CV)** | SD ÷ mean. Often the *more* sensitive measure: someone swinging between 180 ms and 600 ms is drifting in and out even when the error count looks fine. |

```
sart_attention   = 0.60 · commission component + 0.40 · variability component
processing_speed = from clean mean RT   (220 ms → 10,  520 ms → 0)
```

## Why the validity gate exists — a real example

SART is trivially easy to fake in a way that *looks* excellent: tap the key rhythmically without reading the digits, and mean RT collapses. Naive scoring reads that as outstanding processing speed.

From the live session used to build this parser:

| | |
|---|---|
| Mean RT, all responses | **183 ms** — would read as exceptional |
| Responses under 150 ms | **49%** — faster than human reaction time allows |
| Fastest "response" | **4 ms** — pressed before the digit could be seen |
| Commission errors | **68%** (typical adult: 30–45%) |
| Mean RT, impossible responses removed | **302 ms** — perfectly average |

That session is invalid. Scored naively it would have produced a glowing processing-speed number for someone who never read a single digit. The 68% commission rate follows directly — you cannot withhold on a 3 you never saw.

## The gate

| Rule | Threshold |
|---|---|
| Anticipatory responses (< 150 ms) | > 15% → invalid |
| Commission errors | > 60% → invalid |
| Omission errors | > 40% → invalid |
| Usable go-trials remaining | < 100 → invalid |

Invalid returns `null` for **both** scores and `action: "offer_retake"`. Anticipatory presses are excluded from the RT mean even in valid sessions, so tapping fast can never buy a high speed score — it invalidates the session first.

One more guard: mean RT under 260 ms combined with commission errors over 45% sets `impulsive_responding`. That's a speed–accuracy trade-off, not faster processing, and the report must say so rather than praising the speed.

**Offer one retake.** A second invalid session is itself information — it usually means the student won't engage with a timed task, not that the task is broken.

## Using PsyToolkit right now

`https://www.psytoolkit.org/experiment-library/sart2.html` gives you a working SART today, and its output pastes straight into this parser — a usable bridge while you're still on Google Forms. But it's an external, ad-supported dependency licensed for research and teaching rather than commercial products, and the student controls their own retakes. Treat it as a stopgap; build the jsPsych version for the real platform.

---

# PART F — CODE BEHAVIOUR

**A missing bank returns `null`, not a reduced score.** If the load-management items are missing, `focus_score` is null — it is *not* rebuilt from memory and reasoning. That reconstruction would produce a number about general ability wearing the label "focus."

**Confidence travels downstream.** If `belief_bank` is `"partial"` because P7 couldn't be scored, then `firmness` is `"partial"`, and so is `idm` and `consistency` after it. No factor can claim more confidence than its weakest input.

**The code sums the LLM's sub-scores, not the model's own total.** A model that miscounts its own arithmetic cannot put a wrong number into a profile.

**Malformed LLM output degrades gracefully.** Markdown fences are stripped. Out-of-range sub-scores are clamped and logged. A day-plan response returning only 2 of 5 criteria is rejected rather than scored as 2/5.

## Flags returned

| Flag | Meaning |
|---|---|
| `straightline_emotion` | Same option 6+ times across P14–P21 with a low emotion_bank |
| `social_desirability` | P32 = "I never lose momentum" |
| `strong_but_unexamined` | `belief_bank` ≥ 8 but P7 revisability ≤ 1 |
| `llm_unscoreable` | Which open items came back null |
| `llm_problems` | Specific LLM failures, with the offending value |
| `unmatched_items` | Which questions failed to parse |
| `missing_data` | Any bank could not be computed |

`strong_but_unexamined` means the student commits hard but can't say what would change their mind. Worth naming gently in the report — reporting only the high firmness score would amount to praising stubbornness.

---

# PART G — THE ONE HONEST LIMITATION

Defining `belief_bank` as knowledge depth means firmness has **no direct behavioural measurement**. How likely someone actually is to stick with a decision is inferred from belief depth, confidence, emotional stability and EI — not observed.

P5 and P6 are the partial answer: both ask about behaviour under real pressure, and both sit inside the bank. That's a deliberate stretch of "crystallised knowledge of belief" to keep some behavioural anchor in the measure.

The only real fix is longitudinal — asking at 6 and 12 months whether the student is still on the path they named. That same follow-up is what would eventually let you replace every weight in this document with a fitted one. Cheap to build into the product now; expensive to retrofit later.
