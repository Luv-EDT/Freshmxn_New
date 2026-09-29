# Item Bank — Part 1
## `instrument@1.0.0`

Everything needed to build the forms, except the stories (see `05_Story_Bank.md`).

> ### ✅ IPIP-50 and Rosenberg verified against source
> **IPIP-50:** all 50 items, factor assignments and `+`/`−` keys checked against Goldberg's official list. All correct. Scoring confirmed — `−` items map Very Inaccurate=5 … Very Accurate=1, identical to `6 − response`.
>
> **Rosenberg:** same ten items, same five reversed. **One correction applied** — the earlier draft used a non-standard item order. Now renumbered to the official order so that "reverse items 3, 5, 8, 9, 10" reads correctly against this file.

---

# MASTER INDEX

| Block | Items | Module ID | Attempts | Source |
|---|---|---|---|---|
| Intake + consent | 8 | `intake` | — | This file, §1 |
| **Story presentation** | 1 | `ltm_present` | 1 | `05_Story_Bank.md` |
| Big Five | 50 | `ipip50` | 2 | This file, §2 |
| Belief bank | 6 + 1 open | `belief` | 2 | `Perspective_Section_FINAL.md` |
| Cognitive load | 5 + 1 open | `clm` | 2 | `Perspective_Section_FINAL.md` |
| Emotion bank | 8 + 1 open | `emotion` | 2 | `Perspective_Section_FINAL.md` |
| Uncertainty | 6 + 1 check | `uncertainty` | 2 | `Perspective_Section_FINAL.md` |
| Intrapersonal | 1 open | `intra` | 2 | `Perspective_Section_FINAL.md` |
| Values | 8 | `values` | 2 | `Perspective_Section_FINAL.md` |
| Narrative | 2 | `narrative` | 2 | `Perspective_Section_FINAL.md` |
| Self-esteem | 10 | `rosenberg` | 2 | This file, §3 |
| Confidence | 6 | `confidence` | 2 | This file, §4 |
| Digit span | task | `digitspan` | 2 | This file, §5 |
| **SART** | task | `sart` | 2 | This file, §6 |
| External: Reasoning | screenshot | `ext_reasoning` | **1** | This file, §7 |
| External: Verbal memory | screenshot | `ext_verbal` | **1** | This file, §7 |
| Multiple intelligences | 35 | `mi` | 2 | This file, §4b |
| Persistence | 4 | `persistence` | 2 | This file, §4c |
| **Delayed recall** | 10 | `ltm_recall` | 1 | `05_Story_Bank.md` |

**Totals:** 149 questionnaire items · 2 built tasks · **2 external** (MI now in-house) · 1 story pair.

---

# §1 — INTAKE

| ID | Question | Type | Notes |
|---|---|---|---|
| `I1` | Full name | text | |
| `I2` | Date of birth | date | **Not a checkbox.** Drives the consent branch. |
| `I3` | Education stage | select | Class 9–10 · Class 11–12 · Undergraduate · Postgraduate · Working |
| `I4` | Stream / field | select | Science · Commerce · Arts/Humanities · Vocational · Not decided |
| `I5` | State | select | |
| `I6` | City / town | text | |
| `I7` | Preferred language | select | English · हिन्दी |
| `I8` | School / college name | text | Optional. Drives the school bulk-consent path. |

**If `I2` implies under 18:** collect parent name, email, phone → consent gate (D2).

---

# §2 — BIG FIVE (IPIP-50)

**Response scale, all 50 items:**

```
A) Very inaccurate      1
B) Moderately inaccurate 2
C) Neither              3
D) Moderately accurate  4
E) Very accurate        5
```

**Scoring:** `+` items score as answered. `−` items score `6 − response`. Sum the 10 items per factor. Range 10–50 → rescale to 0–10 as `(sum − 10) / 40 × 10`.

**Stem for all items:** *"I see myself as someone who…"*

### Extraversion — `E`

| # | Item | Key |
|---|---|---|
| E1 | Am the life of the party | + |
| E2 | Don't talk a lot | − |
| E3 | Feel comfortable around people | + |
| E4 | Keep in the background | − |
| E5 | Start conversations | + |
| E6 | Have little to say | − |
| E7 | Talk to a lot of different people at parties | + |
| E8 | Don't like to draw attention to myself | − |
| E9 | Don't mind being the center of attention | + |
| E10 | Am quiet around strangers | − |

### Agreeableness — `A`

| # | Item | Key |
|---|---|---|
| A1 | Feel little concern for others | − |
| A2 | Am interested in people | + |
| A3 | Insult people | − |
| A4 | Sympathize with others' feelings | + |
| A5 | Am not interested in other people's problems | − |
| A6 | Have a soft heart | + |
| A7 | Am not really interested in others | − |
| A8 | Take time out for others | + |
| A9 | Feel others' emotions | + |
| A10 | Make people feel at ease | + |

### Conscientiousness — `C`

| # | Item | Key |
|---|---|---|
| C1 | Am always prepared | + |
| C2 | Leave my belongings around | − |
| C3 | Pay attention to details | + |
| C4 | Make a mess of things | − |
| C5 | Get chores done right away | + |
| C6 | Often forget to put things back in their proper place | − |
| C7 | Like order | + |
| C8 | Shirk my duties | − |
| C9 | Follow a schedule | + |
| C10 | Am exacting in my work | + |

### Emotional Stability — `ES`

> **The output is emotional stability, already reversed.** High = calm and stable. It is used **directly** everywhere in the model — there is no `(10 − x)` anywhere.

| # | Item | Key |
|---|---|---|
| ES1 | Get stressed out easily | − |
| ES2 | Am relaxed most of the time | + |
| ES3 | Worry about things | − |
| ES4 | Seldom feel blue | + |
| ES5 | Am easily disturbed | − |
| ES6 | Get upset easily | − |
| ES7 | Change my mood a lot | − |
| ES8 | Have frequent mood swings | − |
| ES9 | Get irritated easily | − |
| ES10 | Often feel blue | − |

### Openness / Intellect — `O`

| # | Item | Key |
|---|---|---|
| O1 | Have a rich vocabulary | + |
| O2 | Have difficulty understanding abstract ideas | − |
| O3 | Have a vivid imagination | + |
| O4 | Am not interested in abstract ideas | − |
| O5 | Have excellent ideas | + |
| O6 | Do not have a good imagination | − |
| O7 | Am quick to understand things | + |
| O8 | Use difficult words | + |
| O9 | Spend time reflecting on things | + |
| O10 | Am full of ideas | + |

### Embedded quality checks

Insert into the IPIP block, not scored into any factor:

| ID | Item | Expected |
|---|---|---|
| `QC1` | "I have never used a computer or phone" | Very inaccurate. Anything else → `infrequency` flag |
| `QC2` | "Please select 'Moderately accurate' for this item" | Exact match or → `attention_check` flag |

**Inconsistency pair:** E2 ("Don't talk a lot") and E6 ("Have little to say") should agree within 2 points. A gap of 3+ contributes to `careless_responding`.

---

# §3 — SELF-ESTEEM (ROSENBERG)

**Verified against the official scale.** Item order below is the standard published order — this matters, because every reference says "reverse items 3, 5, 8, 9, 10." Using a different order invites someone to apply the published key to the wrong items and silently invert the scores.

**Response scale — four points, no neutral:**

```
A) Strongly agree      SA
B) Agree               A
C) Disagree            D
D) Strongly disagree   SD
```

**Scoring**
- `+` items: SA=3, A=2, D=1, SD=0
- `−` items: SA=0, A=1, D=2, SD=3
- Sum all 10. Range 0–30 → `sum / 30 × 10`

| # | Item | Key |
|---|---|---|
| 1 | I feel that I'm a person of worth, at least on an equal plane with others | + |
| 2 | I feel that I have a number of good qualities | + |
| 3 | All in all, I am inclined to feel that I am a failure | **−** |
| 4 | I am able to do things as well as most other people | + |
| 5 | I feel I do not have much to be proud of | **−** |
| 6 | I take a positive attitude toward myself | + |
| 7 | On the whole, I am satisfied with myself | + |
| 8 | I wish I could have more respect for myself | **−** |
| 9 | I certainly feel useless at times | **−** |
| 10 | At times I think I am no good at all | **−** |

Reverse-keyed: **3, 5, 8, 9, 10.**

**Attribution required.** Display "Rosenberg Self-Esteem Scale (Rosenberg, 1965)" in the flow or report footer.

# §4 — CONFIDENCE (6 situational items)

Your three original model questions — **past failure**, **capacity estimation**, **social timelines** — are preserved as constructs and rewritten as situations. Your intent is unchanged; the format now gives the respondent something concrete to reason about rather than a trait to rate.

**Scoring:** each 0–4. Mean → `× 2.5` → 0–10. Feeds `own_confidence_items` at 0.15 of `confidence`.

### CF1 — Past failure *(your Q: rumination vs learning)*

> Six months ago you tried something that mattered to you and it did not work out. Someone brings it up in conversation today. What actually happens in your head?

| A | I can talk about it normally — I took what was useful from it and moved on | 4 |
|---|---|---|
| B | It still stings a little, but I can discuss what went wrong | 3 |
| C | I change the subject; thinking about it isn't useful | 2 |
| D | I replay it for a while afterwards, wondering what I should have done | 1 |
| E | I still think about it often, and it affects what I attempt now | 0 |

### CF2 — Capacity estimation *(your Q: overestimating and losing confidence)*

> You planned to finish five things this week. By Friday you have finished two. Looking back, this has happened more than once. What do you conclude?

| A | My plan was too ambitious. I'll plan three next week and see | 4 |
|---|---|---|
| B | The week had things I couldn't predict. The plan was reasonable | 3 |
| C | I need to work harder and stop making excuses | 2 |
| D | I'm not good at finishing what I start | 1 |
| E | There's no point planning — it never works out anyway | 0 |

*A scores highest because adjusting the estimate is what stops the failure repeating. D and E are where repeated misestimation has begun to cost confidence — the exact mechanism you described.*

### CF3 — Social timelines *(your Q: feeling "late")*

> Someone your age has already achieved something you have not — a place, a job, an income, a relationship. You see it on your phone. What is your honest reaction most of the time?

| A | Genuinely glad for them. Our timelines are different | 4 |
|---|---|---|
| B | A short pang, then it passes | 3 |
| C | It makes me want to move faster on my own things | 3 |
| D | I feel behind, and it stays with me for a while | 1 |
| E | I feel behind most of the time, comparing myself to people my age | 0 |

*B and C both score 3 — one is emotional resilience, the other is motivational redirection. Neither is better.*

### CF4 — Attempting something unfamiliar

> You are offered a role or opportunity you have never done before. You meet perhaps 70% of what it seems to need. What do you do?

| A | Take it. The remaining 30% is what I'd learn by doing it | 4 |
|---|---|---|
| B | Take it, after finding out what the missing 30% actually involves | 4 |
| C | Ask whether I can start with a smaller version of it | 3 |
| D | Wait until I'm more prepared and hope it comes again | 1 |
| E | Let it go — someone better suited should have it | 0 |

### CF5 — Under observation

> You have to present or perform in front of people whose opinion you care about. How does it usually go?

| A | About as well as when nobody is watching | 4 |
|---|---|---|
| B | Slightly worse at the start, then I settle | 3 |
| C | Noticeably worse — I know the material better than I show | 2 |
| D | I get through it but avoid these situations when I can | 1 |
| E | I avoid them entirely if there's any way to | 0 |

### CF6 — After being corrected

> Someone you respect points out, in front of others, that you got something wrong. They are right. What happens next for you?

| A | I fix it and move on. Being wrong isn't a big event | 4 |
|---|---|---|
| B | Uncomfortable in the moment, fine within the hour | 3 |
| C | I fix it, but I'm careful about speaking up in that group afterwards | 2 |
| D | It stays with me for days | 1 |
| E | I'd rather stay quiet than risk that happening | 0 |

---

# §4b — MULTIPLE INTELLIGENCES (35 items, in-house)

Replaces the third external screenshot. MI as used here is self-report of felt competence in a domain — there is no answer key to license and no norms to borrow, which made it the easiest of the three externals to replace and no less valid than the instrument it replaced.

## ⚠ What this block measures, and what measures ability

**These 35 items measure affinity, not ability.** That is not a weakness to apologise for — it is a different and, for career guidance, arguably more useful thing. But it means the ability question is answered elsewhere.

| Ability | Measured by | How |
|---|---|---|
| General reasoning | Reasoning test | Performance, right/wrong |
| Short-term memory | Digit span + verbal memory | Performance |
| Long-term memory | Story recall | Performance |
| Processing speed | SART reaction time | Performance |
| Sustained attention | SART errors + variability | Performance |

| Affinity | Measured by |
|---|---|
| Verbal · Spatial · Musical · Bodily · Naturalistic · Existential · Logical | These 35 items — self-report |

**Stated plainly: the battery does not measure spatial ability, musical ability, bodily ability or naturalistic ability.** It measures general reasoning ability plus felt affinity for those domains. Anyone who asks deserves that answer directly.

**If one real domain ability is ever added, make it spatial.** Mental rotation is buildable in a browser in about a week, it is the most career-relevant of the untested domains (engineering, design, surgery, architecture), and it is the one where self-rating and measured performance diverge most. Musical, bodily and naturalistic ability are not practically testable this way. Logged in `06_V2_and_Beyond.md`.

**A free signal worth capturing.** `MI_L` is self-rated logical ability; Reasoning is measured. The **gap between them is a calibration measure** — a student rating themselves high on logical while scoring low on reasoning is over-confident in that specific domain. Store both, compute the gap, and it costs nothing.

**Report language constraint.** Every line must read *"areas you feel drawn to"*, never *"your spatial ability is 7/10."* The evidence base does not support an ability claim from self-report.

## Item design rules

**No social comparison.** No item may ask a student to rate themselves against other people — *"more than most", "than the people around me", "that others miss"*. Three reasons:

1. **The reference group varies wildly.** A student in a selective urban school and one in a rural school compare themselves to completely different peers, so the same behaviour produces different answers.
2. **It measures perceived standing, not the trait.**
3. **Modesty norms are cultural**, and strong in much of India. You would be measuring willingness to claim superiority.

Every item below describes a behaviour in absolute terms.

**Behaviour, not self-assessment.** *"I notice when a note is slightly off-key"* is answerable. *"I am musically intelligent"* is not.

**Cover the whole construct, not one corner of it.** Each block's five items are spread across distinct facets, listed in the tables below. Verbal in particular must span reading, writing, speaking and listening — a block of five vocabulary items would measure word knowledge, not language ability.

*Known and accepted:* the Musical block is perception-weighted (pitch, timbre, rhythm, attention) with only `MI_M4` approaching production. A true production item — *"I can sing or play in tune"* — would penalise students who have never had an instrument or lessons, so this imbalance is deliberate.

**Response scale, all 35 items:**

```
A) Not at all like me      1
B) A little like me        2
C) Somewhat like me        3
D) Mostly like me          4
E) Very much like me       5
```

**Scoring:** mean of the 5 items per intelligence → `(mean − 1) / 4 × 10`.

**Item IDs are prefixed `MI_`** — MI Existential runs E1–E5 while IPIP Extraversion runs E1–E10. Unprefixed they would overwrite each other in the item bank, and personality scores would come back wrong with nothing to flag it.

### Verbal / Linguistic — `MI_V`

| # | Item | Facet |
|---|---|---|
| MI_V1 | I enjoy playing with words — puns, rhymes, or finding the exact right word | Word-level |
| MI_V2 | When I can see someone is not following me, I change how I am explaining it on the spot | **Speaking — live adaptation** |
| MI_V3 | I can organise a long piece of writing so that each part leads into the next | **Writing — structure** |
| MI_V4 | I work out what a new word means from how it is used, without looking it up | **Reading / listening** |
| MI_V5 | Lines or phrases I have read or heard stay with me long afterwards | Retention, both modalities |

**Verbal covers all four modalities — reading, writing, speaking, listening — in both reception and production.** The five items above are spread deliberately so the block does not collapse into a vocabulary test.

**V2 and V3 measure different skills, not one skill in two channels.** Speech is real-time and adaptive: you read the listener and adjust mid-sentence, with no chance to revise. Writing is structural and iterative: you shape and reorder across a longer piece. Someone can be fluent live and disorganised on paper, or the reverse. An earlier draft had both as "express an idea clearly", which made modality the only difference between them — effectively one item asked twice.

An earlier draft had three of five items at word level and **no writing item at all**, which would have measured word knowledge rather than language ability, and would have missed the most career-relevant of the four modalities.

### Spatial — `MI_S`

| # | Item | Facet |
|---|---|---|
| MI_S1 | I can picture how a room would look with the furniture moved, before moving it | Layout imagery |
| MI_S2 | I can find my way back through a place I have walked once | Navigation |
| MI_S3 | I can imagine what an object looks like from the other side | Rotation |
| MI_S4 | I enjoy drawing, designing, or arranging how things look | Creation |
| MI_S5 | I understand a diagram or map faster than the same thing written out | Diagram comprehension |

### Musical — `MI_M`

| # | Item | Facet |
|---|---|---|
| MI_M1 | I notice when a note or a voice is slightly off-key | Pitch |
| MI_M2 | I often have a rhythm or tune running in my head | Internal rhythm |
| MI_M3 | I can tell which instruments are playing in a song | Timbre |
| MI_M4 | I can repeat a tune correctly after hearing it two or three times | Reproduction |
| MI_M5 | I notice background sounds — a fan, a hum, traffic — while doing something else | Auditory attention |

### Bodily / Kinesthetic — `MI_B`

| # | Item | Facet |
|---|---|---|
| MI_B1 | I can usually do a new physical movement correctly within a few tries | Motor learning |
| MI_B2 | I am good at tasks needing careful hand control — threading, fine drawing, delicate repairs | Fine motor precision |
| MI_B3 | I understand how something works better by handling it than by reading about it | Hands-on learning |
| MI_B4 | I have good balance and coordination | Balance |
| MI_B5 | I notice small changes in how my body feels — tension, tiredness, posture | Body awareness |

### Naturalistic — `MI_N`

| # | Item | Facet |
|---|---|---|
| MI_N1 | I notice small changes in the weather, the sky, or the seasons | Perception |
| MI_N2 | I can tell different plants, birds, or animals apart | Identification |
| MI_N3 | I remember trees, paths, or landmarks in places I have visited | Spatial memory in nature |
| MI_N4 | I group living things by their features without being taught to | Classification |
| MI_N5 | I notice when an animal's or bird's behaviour signals a change coming | Inference |

### Existential — `MI_E`

| # | Item | Facet |
|---|---|---|
| MI_E1 | I think about why things are the way they are, not just how they work | Causal / metaphysical |
| MI_E2 | I enjoy conversations about meaning, purpose, or right and wrong | Discussion |
| MI_E3 | I find myself wondering about questions that may have no answer | Unanswerable questions |
| MI_E4 | I think about how my choices affect people I will never meet | Moral scope |
| MI_E5 | I keep asking why even after I have been given an answer | Persistence of inquiry |

### Logical / Mathematical — `MI_L`

| # | Item | Facet |
|---|---|---|
| MI_L1 | I enjoy puzzles that have to be worked out step by step | Enjoyment |
| MI_L2 | I notice when an argument does not follow from what came before | Logical error detection |
| MI_L3 | I look for the rule or pattern behind a set of numbers or events | Pattern |
| MI_L4 | I am comfortable working with numbers and quantities in everyday situations | Numeracy |
| MI_L5 | I work through a problem in order rather than jumping to the answer | Systematic method |

### What changed from the first draft, and why

| Item | Was | Problem |
|---|---|---|
| `MI_V4` | *"I would rather write my thoughts down than talk them through"* | Measures the **direction** of a modality preference, not the **level** of ability. A highly verbal person may prefer either. It also partly duplicates Extraversion, already measured. |
| `MI_V3` | *"I notice when a word is used wrongly"* | A third word-level item in a five-item block, while **writing was not covered at all**. Replaced with a writing item; V1 and V4 already cover word-level ground. |
| `MI_V2` · `MI_V3` | *"explain so someone understands"* / *"shape it until it says what I mean"* | Both were **expressive clarity with modality as the only difference** — one skill asked twice. Now split by what actually differs: live adaptation vs structural organisation. |
| `MI_B2` | *"I can copy a physical action after watching it once or twice"* | Too close to `MI_B1` — both were motor learning, one by practice and one by observation. Replaced with fine motor precision, which `MI_B4` (gross motor balance) does not cover. |
| `MI_B2` | *"I find it hard to sit still for long"* | Restlessness, not bodily skill. Would correlate with low conscientiousness and attention difficulty — the opposite of what the block is for. |
| `MI_B5` | *"I use my hands a lot when explaining"* | Gesturing is cultural and personality-driven, not a bodily ability. |
| `MI_N3` | *"I feel noticeably better after time outdoors"* | Almost everyone agrees. No discrimination. |
| `MI_N4` | *"I like sorting and organising things into groups"* | Too general — overlaps Conscientiousness orderliness. Narrowed to living things. |
| `MI_M5` · `MI_N5` · `MI_E5` | *"…that other people ignore / walk past"*, *"more often than the people around me"* | **Social comparison.** See the design rules above. |
| `MI_L4` | *"I like knowing exactly why something happened"* | Overlapped `MI_E1`, and the block had no numeracy item at all despite being called Logical-**Mathematical**. |

### Quality check

`straightline_mi` — the same option on 30+ of 35 items, **or** all seven means within 0.5 of each other. The reference screenshot from the instrument this replaces showed seven of nine scores at exactly 50%; that pattern is what this catches.

---

# §4c — PERSISTENCE (4 items, direct input to consistency)

**Why these exist.** Consistency was previously 100% derived — computed entirely from conscientiousness, focus and IDM with nothing measured directly. That violated the model's own rule that a factor should not be built purely from other factors, and consistency is one of the four universals shown in the report.

**Situational, not self-rating.** Self-rated persistence is where social desirability does the most damage.

**Scoring:** each 0–4, mean → `× 2.5` → 0–10. Enters `consistency` at 0.20.

### PS1 — When it stops being interesting

> You started something two months ago that you were excited about. The excitement has gone. The reasons you started still hold. What usually happens?

| A | I keep going — the excitement was never the reason | 4 |
|---|---|---|
| B | I keep going, but I look for a way to make it interesting again | 4 |
| C | I slow down and come back to it in bursts | 2 |
| D | I move to something new and tell myself I'll return | 1 |
| E | It quietly stops | 0 |

### PS2 — The unglamorous middle

> A project you care about reaches the boring part — the repetitive work that has to be done before anything visible happens. What do you do?

| A | Work through it in fixed daily chunks until it's done | 4 |
|---|---|---|
| B | Push through in one long stretch to get past it | 3 |
| C | Do it when I feel like it; it eventually gets finished | 2 |
| D | Look for a shortcut, or someone else to do it | 1 |
| E | This is usually where I stop | 0 |

### PS3 — After an interruption

> Something outside your control — illness, exams, a family situation — stops you for three weeks. How do you come back?

| A | Pick up where I left off within a few days | 4 |
|---|---|---|
| B | Restart, though it takes a week or two to get going | 3 |
| C | Restart, at lower intensity than before | 2 |
| D | I mean to restart, and often don't | 1 |
| E | A three-week gap usually ends it | 0 |

### PS4 — Long horizons

> Something you want is four years away, with no visible progress for the first two. Which is closest to how you would handle it?

| A | Break it into smaller markers so I can see movement | 4 |
|---|---|---|
| B | Just work at it and check progress occasionally | 3 |
| C | Work at it while keeping other options open | 2 |
| D | I'd want a shorter path to the same place | 1 |
| E | Four years with nothing to show isn't something I'd start | 0 |


---

# §5 — DIGIT SPAN (numeric short-term memory)

Replaces the TotalBrain external test. Roughly one day to build.

| Parameter | Value |
|---|---|
| Direction | Forward |
| Starting length | 3 digits |
| Maximum length | 9 digits |
| Digits | 1–9, no immediate repeats |
| Presentation | One digit at a time, centre screen, large font |
| Digit duration | 1000 ms |
| Inter-digit gap | 0 ms (continuous) |
| Trials per length | 2 (different sequences) |
| Advance rule | Either trial correct → next length |
| Discontinue | Both trials wrong at the same length |
| Response | Type the sequence, submit |
| Practice | One 2-digit trial with feedback, unscored |

**Score:** longest length with at least one correct trial. Range 3–9 → `(span − 3) / 6 × 10`.

**Combined short-term memory:** `0.5 × digit_span + 0.5 × verbal_memory (external)`. If the external screenshot is missing, digit span carries it alone and STM is marked `partial`.

**Rules:** sequences generated server-side and never sent ahead of presentation · no back button · no pause · page-blur logged · response field disabled until the sequence finishes.

**Validity — fast *and* wrong only.** Submission under 300 ms **and** incorrect → flag. Submission under 300 ms **and** correct → valid, flag `exceptional_speed`. Same digit repeated across the whole answer → flag regardless of speed.

---

# §6 — SART (sustained attention + processing speed)

Scoring is implemented in `sart_scoring.js`. This is the presentation spec.

| Parameter | Value |
|---|---|
| Stimuli | Digits 1–9 |
| **No-go target** | **3** — withhold response |
| Go trials | All other digits — respond |
| Target frequency | ~11% (25 of 225) |
| Digit duration | **250 ms** |
| Mask duration | **900 ms** (encircled X, or equivalent) |
| Trial length | 1150 ms |
| Practice block | **18 trials**, with feedback, discarded |
| Test block | **225 trials** |
| Font sizes | 5 levels, randomised per trial (48 / 72 / 94 / 100 / 120 pt) |
| Response | Spacebar (desktop) · full-screen tap area (mobile) |
| Total duration | ~4.5 minutes |

**Font-size variation is part of the paradigm**, not decoration — it prevents responding to a visual pattern rather than the digit.

**Technical requirements — non-negotiable**

- `performance.now()` for all timestamps. **Never `Date.now()`.**
- `requestAnimationFrame` for presentation. **Never `setTimeout`.**
- Preload and pre-render all digit frames before the block begins.
- Record device type, screen refresh rate, browser.
- Listen for `visibilitychange` and `blur` — any tab switch flags the session.
- Block the task if refresh rate reports below 50 Hz.
- Request full screen; log any exit.

**Validation before you trust a single score:** run the task 20 times on your own devices and compare measured trial duration against the intended 1150 ms. Median error above 20 ms means the implementation is wrong. **Test on a low-end Android specifically** — that is what most students will use.

**Instruction screen:**

> Digits will appear one at a time, quickly.
> **Press SPACE for every digit — except 3.**
> When you see **3**, do nothing.
> Go as fast as you can while still being accurate. This takes about 5 minutes.

---

# §7 — EXTERNAL TESTS (screenshot upload)

**Both are one attempt only.** See D1. *(Multiple Intelligences was the third; it is now built in-house — see §4b.)*

### Pre-test warning — shown before every external link

> ### One attempt only. You cannot retake this test.
> Find a quiet place and take your time. Most people need about 10 minutes.
> Rushing produces a score that does not reflect you, and we cannot undo it.

### 7.1 Reasoning — AssessmentDay

`https://www.assessmentday.co.uk/logic/free/LogicalReasoningTest1/`

**Also collect, as a typed field:** *"What was your average time per question?"* (shown on the results page).

**This is your only validity gate on this instrument.** A reference session showed **6 seconds per question at chance accuracy** — the questions were not read. A screenshot alone cannot detect that.

```json
{
  "instrument": "assessmentday_logical_v1",
  "percentile":        { "type": "integer", "min": 0, "max": 100 },
  "score_raw":         { "type": "integer", "min": 0, "max": 10 },
  "questions_total":   { "type": "integer", "const": 10 },
  "seconds_per_question": { "type": "number", "min": 0 },
  "test_date":         { "type": "string" },
  "extraction_confidence": { "type": "number", "min": 0, "max": 1 }
}
```

**Time alone is never the gate. Time combined with accuracy is.** Someone genuinely fast is fast *and* right; only fast *and* wrong is disqualifying. The same principle runs in SART (`exceptional_speed` vs `impulsive_responding`).

| Time/question | Score | Action |
|---|---|---|
| < 10 s | ≤ 3/10 | **Invalid** → `admin_review`, reasoning = null |
| < 10 s | ≥ 7/10 | **Valid**, flag `exceptional_speed` |
| < 10 s | 4–6/10 | Review queue |
| ≥ 10 s | any | Normal |

| Other gate | Action |
|---|---|
| `percentile` outside 0–100 | Reject extraction, request re-upload |
| `extraction_confidence < 0.8` | Human verification queue |

**Score:** `percentile / 100 × 10`.

### 7.2 Verbal memory — MindCrowd

`https://mindcrowd.org/`

```json
{
  "instrument": "mindcrowd_verbal_v1",
  "your_score":        { "type": "integer", "min": 0, "max": 36 },
  "peer_average":      { "type": "integer", "min": 0, "max": 36 },
  "overall_average":   { "type": "integer", "min": 0, "max": 36 },
  "extraction_confidence": { "type": "number" }
}
```

**Score:** `your_score / 36 × 10`. Flag if `your_score > peer_average + 15` — implausible, verify.

### Extraction prompt (Haiku 4.5, temperature 0)

```
Read the numeric results from this test result screenshot.
Return ONLY a JSON object matching the schema below. No commentary,
no markdown fences.

If a value is unreadable, obscured, or absent, return null for that
field. Do NOT guess or infer a plausible number.

Set extraction_confidence between 0 and 1: how clearly the numbers
were legible.

If the image is not a results page from {INSTRUMENT_NAME}, return:
{"error": "wrong_instrument"}

Schema:
{SCHEMA}
```

**Never accept an extracted value that fails its range check.** A hallucinated number that lands in range is the failure mode to guard against — hence the cross-checks above.

---

# §8 — ITEM BANK SCHEMA

```js
item_bank {
  _id, item_id,                    // "IPIP_E1", "CF3", "P14", "U7"
  instrument_version,              // "1.0.0"
  module_id,                       // "ipip50", "confidence", "emotion"
  factor,                          // "extraversion" | null for QC items
  sequence,                        // order within module
  stem,                            // { en, hi }
  options: [ { letter, text: {en,hi}, score } ],
  reverse_keyed,                   // bool
  scored,                          // false for QC and narrative items
  max_attempts,                    // 1 external, 2 in-house
  input_method,                    // select | text | voice_or_text | task
  active                           // soft delete; never hard-delete an item
}
```

**Never hard-delete an item.** Old responses point at it. Set `active: false`.

**Every option must carry its letter prefix in the rendered form** — `A) `, `B) ` — because the scoring code reads only that first character. This is what stops a re-worded option silently zeroing a score.

**Shuffle option order per question when you build the form.** The tables above list best-first so the gradient is readable. Students spot that pattern within three questions. After shuffling, update only the `score` values in the `options` array.

---

# §9 — BUILD ORDER

| # | Task | Blocks |
|---|---|---|
| 1 | Download and diff IPIP-50 + Rosenberg against §2 and §3 | Everything |
| 2 | Load item bank with EN text, `hi` null | Sprint 2 |
| 3 | Shuffle option order, update scores | Sprint 2 |
| 4 | Hindi translation + back-translation check | Sprint 2 |
| 5 | Build digit span (§5) | Sprint 4 |
| 6 | Build SART (§6) **+ 20-run timing validation** | Sprint 5 |
| 7 | Extraction prompts + range gates (§7) | Sprint 6 |
| 8 | Stories — see `05_Story_Bank.md` | Sprint 4 |
