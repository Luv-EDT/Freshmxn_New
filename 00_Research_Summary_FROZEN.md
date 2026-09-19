# Psychometric Model — Research Summary (FROZEN)

**Status:** research phase complete. This is the specification the platform gets built against.
**Versions:** `perspective@5.0.0` · `sart@1.0.0`

This document is the single reference for what is measured, how, and why. Nothing here requires reading an earlier version.

---

# PART 1 — ARCHITECTURAL PRINCIPLES

These govern everything below. They came out of auditing the current Gumloop model, where every one of them was being broken.

### 1. No circular derivation
A factor is never rebuilt from its supporting traits when its directly-measured component is missing. If the cognitive-load items are absent, `focus_score` returns **null** — it is not reconstructed from memory + reasoning, because that would produce a general-ability number wearing the label "focus."

### 2. Every input appears exactly once
In the old model, Neuroticism entered `firmness` three times (directly, via Confidence, via EQ). Reasoning entered three times. Nineteen factors carried about seven independent measurements. Every formula below is checked so each input has one path.

### 3. Measured beats derived, always
If a construct can be measured directly, it is — even if a formula exists. This is why EI, cognitive load, belief depth, uncertainty tolerance and intrapersonal intelligence all got their own items instead of being computed from the Big Five.

### 4. Validity gates before scores
A fluent-looking number from an invalid session is worse than no number. Two of six reference sessions supplied were invalid and the current pipeline could not detect either.

### 5. Confidence propagates
No factor may report higher confidence than its weakest input.

### 6. Versioned and recomputable
Every profile stores `scoring_version` and `norm_set_id`, so a formula change is a recompute, not a retake.

---

# PART 2 — THE 22 MAJOR FACTORS

| # | Factor | Source | Type |
|---|---|---|---|
| 1 | Openness | IPIP-50 | Self-report |
| 2 | Conscientiousness | IPIP-50 | Self-report |
| 3 | Agreeableness | IPIP-50 | Self-report |
| 4 | Extraversion | IPIP-50 | Self-report |
| 5 | **Emotional Stability** | IPIP-50 | Self-report |
| 6 | Short-Term Memory | Verbal + numeric memory tasks | Performance |
| 7 | Reasoning | Logical reasoning test | Performance |
| 8 | Long-Term Memory | Delayed story recall | Performance |
| 9 | Verbal Intelligence | MI, 35 items (self-hosted) | Self-report |
| 10 | Spatial Intelligence | MI, 35 items (self-hosted) | Self-report |
| 11 | Musical Intelligence | MI, 35 items (self-hosted) | Self-report |
| 12 | Bodily Intelligence | MI, 35 items (self-hosted) | Self-report |
| 13 | Naturalistic Intelligence | MI, 35 items (self-hosted) | Self-report |
| 14 | Existential Intelligence | MI, 35 items (self-hosted) | Self-report |
| 15 | Logical Intelligence | MI, 35 items (self-hosted) | Self-report |
| 16 | Confidence | Rosenberg + own items + traits | Composite |
| 17 | Emotional Intelligence | Emotion bank + traits | Composite |
| 18 | Focus / Attention Span | SART + CLM + traits | Composite |
| 19 | Firmness of Belief | Belief bank + traits | Composite |
| 20 | **Intrapersonal Intelligence** | P33 + P7 + traits | Composite |
| 21 | **Processing Speed** | SART reaction time | Performance |
| 22 | **Uncertainty Tolerance** | U1–U6 | Self-report |

**Emotional Stability, not Neuroticism.** The IPIP output is already reversed. It is used **directly** — there is no `(10 − x)` anywhere in the model.

---

# PART 3 — THE THREE BANKS

Directly measured from the perspective questionnaire. Each is a multiple-choice block plus one open item scored by an LLM against a fixed rubric. The MCQ block gives reliability; the open item gives depth, because "crystallised knowledge" cannot be measured by tick-boxes alone.

| Bank | Items | Formula |
|---|---|---|
| `belief_bank` | P1–P6 + P7 (open) | `0.60 × MCQ + 0.40 × P7` |
| `clm` | P8–P12 + P13 (open) | `0.70 × MCQ + 0.30 × P13` |
| `emotion_bank` | P14–P21 + P22 (open) | `0.70 × MCQ + 0.30 × P22` |
| `self_awareness_bank` | P33 (open) + P7 revisability | `0.60 × P33 + 0.40 × P7_revisability` |

Belief is weighted 60/40 rather than 70/30 because P7 *demonstrates* the reasoning rather than asking the student to rate it.

---

# PART 4 — ALL FORMULAS

### Composite majors

```
ei_score      = 0.40 · emotion_bank
              + 0.20 · agreeableness
              + 0.20 · emotional_stability
              + 0.20 · reasoning

firmness      = 0.40 · belief_bank
              + 0.20 · confidence
              + 0.20 · emotional_stability
              + 0.20 · ei_score

focus         = 0.30 · sart_attention
              + 0.20 · clm
              + 0.20 · short_term_memory
              + 0.15 · reasoning
              + 0.15 · ei_score
              (no SART → its weight moves to clm, which becomes primary)

intrapersonal = 0.55 · self_awareness_bank
              + 0.25 · emotion_bank
              + 0.20 · openness

confidence    = 0.40·rosenberg + 0.15·own_confidence_items
              + 0.15·conscientiousness + 0.15·emotional_stability
              + 0.15·reasoning
```

### Measured majors

```
uncertainty_tolerance = mean(U1–U6), rescaled 0–10
processing_speed      = from SART clean mean RT (220 ms → 10, 520 ms → 0)
sart_attention        = 0.60 · commission component + 0.40 · variability component
```

### Minor factors — universal (readiness layer)

```
consistency / grit = 0.35·conscientiousness + 0.20·persistence_items
                   + 0.30·focus + 0.15·idm
idm                = 0.40 · reasoning + 0.30 · firmness + 0.30 · openness
learning_capacity  = 0.25·reasoning + 0.25·focus + 0.20·openness
                   + 0.15·long_term_memory + 0.15·processing_speed
```

**Conscientiousness appears exactly once in the whole model — here.** It was removed from `focus` because cognitive load management is now measured directly, so the proxy became redundant. Under the old nesting, Conscientiousness contributed **7.5%** to a score meant to represent hard work, while Reasoning contributed **30%**. It is now 40% vs 17%.

### Minor factors — differentiating (drive matching)

| Factor | Built from |
|---|---|
| Practical Intelligence | Agreeableness + Extraversion + STM + Reasoning + Confidence |
| Divergent Thinking / Creativity | Openness + Reasoning + STM + Emotional Stability |
| Convergent Thinking | 0.20 Conscientiousness + 0.20 Reasoning + 0.15 STM + 0.15 LTM + 0.15 Logical + **0.15 Processing Speed** |
| Collaboration | Openness + Agreeableness + Extraversion + Verbal + Conscientiousness + Confidence |
| Interpersonal Intelligence | Verbal + Agreeableness + Extraversion + STM + EQ |
| Propensity to Go Deep | Existential + Conscientiousness + Reasoning + LTM |

### Computation order (strict DAG, no cycles)

```
emotion_bank ──► ei ──┬──► firmness ──► idm ──┐
belief_bank ──────────┘                       │
clm + sart ───► focus ────────────────────────┤
conscientiousness ────────────────────────────┤
                                              ▼
                                        consistency
self_awareness_bank + emotion_bank + openness ──► intrapersonal
```

---

# PART 5 — UNIVERSAL vs DIFFERENTIATING

**A factor every profession needs cannot tell you which profession to choose.** Universals are correlated with each other and with everything else; leaving them in the matching vector adds weight without adding discrimination, so professions bunch together and recommendations get mushier.

**Universal — readiness layer, EXCLUDED from matching maths (4)**

| Factor | |
|---|---|
| Confidence | major |
| Consistency / Grit | minor |
| Learning Capacity | minor |
| Informed Decision Making | minor |

These become the report's **readiness and development section**: "here's what you'll need whatever you choose, and here's where you stand." That's the part a mentor actually works on.

**Differentiating — drive profession matching:** all remaining majors (Big Five, memory, reasoning, the seven intelligences, EI, focus, firmness, intrapersonal, processing speed, uncertainty tolerance) plus the six differentiating minors.

**Borderline, keep in matching at low weight:** Collaboration, EI. Near-universal now, but genuinely solitary and genuinely people-saturated professions still sit far apart.

---

# PART 6 — VALIDITY GATES

### SART

| Rule | Threshold |
|---|---|
| Anticipatory responses (< 150 ms) | > 15% → invalid |
| Commission errors | > 60% → invalid |
| Omission errors | > 40% → invalid |
| Usable go-trials | < 100 → invalid |

Anticipatory presses are excluded from the RT mean even in valid sessions, so responding fast can never buy a high speed score — it invalidates the session first.

**`exceptional_speed`** — clean mean RT < 240 ms **and** commission < 25% **and** anticipatory < 5%. Genuine speed shows as a tight distribution around 220–260 ms, not as sub-150 ms presses. Store the full RT distribution (P10/P25/P50/P75/P90) so nothing is lost to clamping.

**`impulsive_responding`** — mean RT < 260 ms with commission > 45%. A speed-accuracy trade-off, not faster processing. The report must say so rather than praising the speed.

### Response quality

| Flag | Trigger |
|---|---|
| `straightline_emotion` | Same option 6+ times across P14–P21 with low emotion_bank |
| `social_desirability` | P32 = "I never lose momentum" |
| `strong_but_unexamined` | `belief_bank` ≥ 8 with P7 revisability ≤ 1 |
| `risk_uncalibrated` | `uncertainty_tolerance` ≥ 7 and U7 ∈ {C, D} |
| `llm_unscoreable` / `llm_problems` | Open items that failed or broke their rubric |
| `unmatched_items` | Answers that failed to parse |

### New gates needed for third-party tests

| Test | Gate |
|---|---|
| Reasoning | Time per question below ~20 s → invalid. *(A supplied session showed 6 s/question at near-chance accuracy.)* |
| Multiple Intelligences | 5+ of 9 scores at exactly 50% → flag for review |
| All screenshots | Extracted value out of the instrument's valid range → reject |

---

# PART 7 — HANDLING `risk_uncalibrated` IN MATCHING

**U7 never removes a profession from a student's list.** It is a single item, and single items qualify — they do not gate. Encoding "poorly-calibrated people may not found companies" is both unreliable and not the platform's decision to make.

```
uncertainty_tolerance_matching = flagged
    ? 0.70 × raw + 0.30 × 5.0
    : raw
```

Store both. Raw for the record, adjusted for matching. High-uncertainty professions still rank well, just less overwhelmingly.

Also: a development line in the report, and a human-review trigger when the flag fires alongside high-risk top recommendations.

---

# PART 8 — WHAT WAS CUT AND WHY

| Removed | Reason |
|---|---|
| Q4 (anxiety when deciding) | Neuroticism, already measured by IPIP |
| Q5 (second-guessing) | Neuroticism facet, not belief knowledge |
| Q22 (resist temptations) | Socially desirable single item, overlaps Conscientiousness |
| Q18–Q21 | Fed only the old consistency score, which is now derived |
| Q25 (MCQ belief rating) | P7 makes the student demonstrate what Q25 asked them to rate |
| Q37 (grief scenario) | P20 covers the same construct; risks distressing a recently bereaved student |
| Lateral Thinking | ~0.8 correlation with Divergent — a dimension that doesn't discriminate |
| Adaptability / Coachability | Folded into Learning Capacity |
| Introversion as a factor | The low pole of Extraversion, already measured. Replaced by Intrapersonal. |
| Maslow block from `belief_score` | Was **40%** of firmness. It is a values measure with no relation to belief firmness. Now a standalone values profile. |

### Bugs found in the current Gumloop code

| Bug | Effect |
|---|---|
| `else if("I choose the safest...")` — no `ans7 ==` | Always truthy. Option E scores 1 instead of 0, every time. |
| Q20 sign inverted | "Always prioritise long-term" scored **1**, "Never" scored **4**. Most disciplined respondents penalised. |
| Maslow block 40% of belief score | Range 0.8–20 out of 50, floor not at zero |
| Unmatched strings fall to `else → 0` | One curly apostrophe silently zeroes an item with no signal |
| Uneven spacing (4/3/1/0) | Skips 2 |

**Fix applied:** every option is prefixed `A) `, `B) ` and only the leading letter is matched. Unparseable answers return null and are listed in `unmatched_items`.

---

# PART 9 — THE VALUES PROFILE

Eight Likert items (P23–P30): fulfilment and importance across safety, social, esteem, self-actualisation.

Reported as `importance − fulfilment` per area. The **largest gap** is what's currently pulling the student. **Never summed into a score, never mixed into any factor.** This is the only part of the assessment that speaks to "the why," which is why all eight items survive despite feeding no factor.

---

# PART 10 — KNOWN LIMITATIONS

1. **Firmness has no direct behavioural measure.** How likely someone is to stick with a decision is inferred, not observed. P5 and P6 are a partial anchor. The real fix is longitudinal.

2. **Conscientiousness is domain-level only.** IPIP-50 doesn't separate self-discipline and achievement-striving, the two facets that matter most for consistency. IPIP-NEO-120 would. Not a V1 problem.

3. **Reasoning is measured by a 10-item free sample.** It feeds six downstream factors and is the highest-priority instrument to replace.

4. **The seven intelligences are self-report — they measure affinity, not ability.** Ability in this battery comes from the performance tests only: reasoning, short-term memory, long-term memory, processing speed and sustained attention. **Spatial, musical, bodily and naturalistic ability are not measured at all.** Report language must say "areas you feel drawn to", never "your spatial ability is 7/10". If one real domain ability is ever added, mental rotation is the one worth building.

5. **Hierarchical models leak.** Stated weights are not effective weights — emotional stability is stated at 0.20 in firmness but is effectively 0.270 across all paths. See the effective-weight table in the Master Spec (A4a). Left uncorrected in V1 by decision; regenerate the table whenever a weight changes.

6. **All weights are unit-ish judgements, not fitted.** Replace them once outcome data exists — which requires a 6- and 12-month follow-up built into the product from day one. Cheap now, expensive to retrofit.
