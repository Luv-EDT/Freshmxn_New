# Story Bank — Long-Term Memory
## 8 stories · `story@1.0.0`

Every story fills **the same 12 slots**, runs **180–220 words**, and contains **exactly two numbers**. This is what makes scores comparable across students who saw different stories.

---

# EQUIVALENCE SPEC

| Slot | Content | Recall type |
|---|---|---|
| 1 | Year | Structured |
| 2 | Person A (the protagonist) | Structured |
| 3 | Person B | Structured |
| 4 | Person C | Structured |
| 5 | Profession 1 | Structured |
| 6 | Profession 2 | Structured |
| 7 | Number 1 (2–4 digits) | Structured |
| 8 | Number 2 (single / low double digit) | Structured |
| 9 | An unusual ability or skill | Structured |
| 10 | The problem | Free recall |
| 11 | The cause | Free recall |
| 12 | The resolution | Free recall |

**Scoring:** 7 structured questions auto-scored (some cover two slots) + 3 free-recall answers scored by LLM against the fact list. Total 12 points → `/12 × 10`.

**Sub-scores:** `numeric_recall` (slots 7–8) and `verbal_recall` (the rest) are stored separately. This gives a cross-check against digit span and short-term memory.

---

# LANGUAGE RULES

Every story is written at roughly a Class 7 reading level. **English vocabulary must never be what a student loses points for.** A student who remembers the story perfectly should not be penalised for not knowing a word in it.

- No word harder than a Class 7 student would read comfortably
- Short sentences, one idea each
- No bold, no italics, no highlighting anywhere — **formatting tells the student what to remember, which measures attention to formatting rather than memory**
- Names chosen to be recognisable across Indian regions without being commonplace
- Numbers written as digits, one convention across all eight stories

---

# S1 — THE LIGHTHOUSE

> In 1923, a lighthouse on the east coast stopped working for 12 nights. The keeper, Devraj Menon, said he had lit all 47 lamps every evening, just as he always did.
>
> The shipping company sent an engineer named Ilyas Qureshi to find the problem. He checked the lamps, the oil, and the machine. Everything worked when he tested it.
>
> A young schoolteacher from the village nearby, Saraswati Bhat, had an idea the engineer had brushed aside. She had an unusual skill. She could name birds just by hearing them, without seeing them at all. She had noticed a new sound at the lighthouse that season.
>
> A large group of birds had settled on the rocks below. Every night they rose together and flew in circles around the tower. Their bodies blocked the light from the sea for hours.
>
> Devraj had lit the lamps. The light had simply never reached the water.
>
> The company built a second light lower down on the rocks, below where the birds flew. The problem never came back, and Devraj kept his job.

| # | Slot | Fact |
|---|---|---|
| 1 | Year | 1923 |
| 2 | Person A | Devraj Menon |
| 3 | Person B | Ilyas Qureshi |
| 4 | Person C | Saraswati Bhat |
| 5 | Profession 1 | Engineer |
| 6 | Profession 2 | Schoolteacher |
| 7 | Number 1 | 47 lamps |
| 8 | Number 2 | 12 nights |
| 9 | Ability | Naming birds by their sound |
| 10 | Problem | The lighthouse gave no light for 12 nights |
| 11 | Cause | Birds circling the tower blocked the light |
| 12 | Resolution | A second light was built below where the birds flew |

---

# S2 — THE GRAIN STORE

> In 1961, a grain store began losing stock. Over one season, 340 sacks went missing from a building that served 9 villages.
>
> The storekeeper, Bhanumati Rao, kept careful records and could not explain it. The locks were fine and the register matched every evening.
>
> An accountant named Prithvi Sengupta was sent from the state office. He checked three months of entries and found no mistake in the numbers. The sacks had truly gone.
>
> A retired railway guard, Faizal Ahmad, lived next to the store. He had an unusual habit. He remembered the exact time of every train that passed, going back years. He mentioned that a goods train had started stopping behind the store, at a time when no train was meant to run.
>
> The stops were on no timetable. A crew had been loading sacks through the back wall during the halt and selling them two districts away.
>
> The stopping place was closed and the back wall was sealed. Bhanumati's records, it turned out, had been right all along.

| # | Slot | Fact |
|---|---|---|
| 1 | Year | 1961 |
| 2 | Person A | Bhanumati Rao |
| 3 | Person B | Prithvi Sengupta |
| 4 | Person C | Faizal Ahmad |
| 5 | Profession 1 | Accountant |
| 6 | Profession 2 | Railway guard |
| 7 | Number 1 | 340 sacks |
| 8 | Number 2 | 9 villages |
| 9 | Ability | Remembering the exact time of every train |
| 10 | Problem | Grain sacks disappearing from a locked store |
| 11 | Cause | An unscheduled train halt; crew loading through the back wall |
| 12 | Resolution | Stopping place closed, back wall sealed |

---

# S3 — THE BRIDGE

> In 1978, a footbridge 62 metres long began sinking at one end. It had stood through 4 monsoons without any trouble.
>
> The village head, Chandrika Pillai, closed the bridge until the reason was found.
>
> A geologist named Tejinder Sodhi studied the riverbank. He said the soil was firm and could find no reason for the movement.
>
> An old potter, Zubeida Khan, dug clay from the riverbank every week for her work. She had an unusual sense. She could tell how deep the water was under the ground from the weight of the clay she pulled up. She said the ground on the sinking side had been getting lighter for months.
>
> A new tube well upstream had been pulling water all year. The water under the north end of the bridge had dropped, and the soil above it had shrunk as it dried.
>
> The tube well's hours were cut and the bridge end was given new support. The bridge stopped moving within a year. Zubeida was asked to check the clay every season after that.

| # | Slot | Fact |
|---|---|---|
| 1 | Year | 1978 |
| 2 | Person A | Chandrika Pillai |
| 3 | Person B | Tejinder Sodhi |
| 4 | Person C | Zubeida Khan |
| 5 | Profession 1 | Geologist |
| 6 | Profession 2 | Potter |
| 7 | Number 1 | 62 metres |
| 8 | Number 2 | 4 monsoons |
| 9 | Ability | Telling water depth from the weight of clay |
| 10 | Problem | A footbridge sinking at one end |
| 11 | Cause | A new tube well lowered the water; soil shrank |
| 12 | Resolution | Tube well hours cut, bridge end given new support |

---

# S4 — THE CLOCK TOWER

> In 1889, the clock in a market town's tower began running 7 minutes fast every day. There were 96 steps up to the machine at the top.
>
> The town's clock keeper, Ratanlal Vyas, set it right every morning. By evening it had gained the time again.
>
> A watchmaker named Oorja Kalita was brought from the city. She took the machine apart and rebuilt it twice. In her workshop it kept perfect time. In the tower it did not.
>
> A stone worker repairing the tower wall, Hemraj Barua, had an unusual skill. He could tell how warm a stone was just by touching it, almost exactly. He said the south wall of the clock room was much warmer in the afternoon than the north wall.
>
> A row of trees that had shaded the south wall for years had been cut down the winter before. The afternoon sun now heated the room. The metal rod inside the clock grew slightly longer in the heat, and the clock ran fast.
>
> A cover was fitted over the south window. The clock kept time again, and Ratanlal was no longer blamed.

| # | Slot | Fact |
|---|---|---|
| 1 | Year | 1889 |
| 2 | Person A | Ratanlal Vyas |
| 3 | Person B | Oorja Kalita |
| 4 | Person C | Hemraj Barua |
| 5 | Profession 1 | Watchmaker |
| 6 | Profession 2 | Stone worker |
| 7 | Number 1 | 96 steps |
| 8 | Number 2 | 7 minutes |
| 9 | Ability | Telling how warm a stone is by touch |
| 10 | Problem | The tower clock ran fast every day |
| 11 | Cause | Trees were cut down; sun heated the room and the metal rod grew longer |
| 12 | Resolution | A cover was fitted over the south window |

---

# S5 — THE SEED STORE

> In 2004, a seed store holding 1200 samples from 3 districts found that its seeds were no longer growing.
>
> The woman who started it, Malathi Iyer, had collected every sample herself over 11 years. She had stored them exactly as the manual said.
>
> A plant scientist named Kunal Dhariwal tested the seeds and the store room. The temperature, the air and the containers all met the standard. The seeds should have been fine.
>
> A night watchman at the building, Girish Tamang, had an unusual ability. He could feel a change in the air before any instrument showed it, and had used this to guess coming storms for years. He said the store room felt different every night at about the same hour.
>
> A new cooling machine switched itself off between 2 and 5 each morning to save power. The room warmed and cooled every single night. Three years of these small changes had killed the seeds.
>
> The machine was set to run without stopping. New samples were collected, and the room temperature is now written down every 15 minutes.

| # | Slot | Fact |
|---|---|---|
| 1 | Year | 2004 |
| 2 | Person A | Malathi Iyer |
| 3 | Person B | Kunal Dhariwal |
| 4 | Person C | Girish Tamang |
| 5 | Profession 1 | Plant scientist |
| 6 | Profession 2 | Night watchman |
| 7 | Number 1 | 1200 samples |
| 8 | Number 2 | 3 districts |
| 9 | Ability | Feeling changes in the air before instruments do |
| 10 | Problem | Stored seeds stopped growing |
| 11 | Cause | Cooling machine switched off nightly; room warmed and cooled |
| 12 | Resolution | Machine set to run without stopping; temperature recorded every 15 minutes |

---

# S6 — THE RADIO STATION

> In 1947, a small radio station received 85 letters in one week. Listeners said the evening programme disappeared for 6 hours at a time.
>
> The announcer, Yashodhara Naik, was sure the programmes had gone out. The station records agreed with her.
>
> A radio technician named Ashwin Rebello tested the transmitter for three nights. Its power never dropped once.
>
> A fisherman called Nurul Haque listened while mending his nets on the shore. He had an unusual talent. He could find his way at night by the sound of waves hitting different parts of the coast, with no light at all. He noticed that the programme only vanished on nights when the sea was very still.
>
> On calm nights, a layer of warm air formed above the cool sea. The signal bent upward into this layer and passed right over the towns, coming down far inland where nobody was listening.
>
> The station lowered its aerial and changed the angle it sent from. The letters stopped, and Yashodhara read three of them out on air.

| # | Slot | Fact |
|---|---|---|
| 1 | Year | 1947 |
| 2 | Person A | Yashodhara Naik |
| 3 | Person B | Ashwin Rebello |
| 4 | Person C | Nurul Haque |
| 5 | Profession 1 | Radio technician |
| 6 | Profession 2 | Fisherman |
| 7 | Number 1 | 85 letters |
| 8 | Number 2 | 6 hours |
| 9 | Ability | Finding the way at night by the sound of waves |
| 10 | Problem | The evening programme disappeared for hours |
| 11 | Cause | Warm air over a calm sea bent the signal over the towns |
| 12 | Resolution | Aerial lowered and the sending angle changed |

---

# S7 — THE WATER TANK

> In 1995, a roof tank supplying 11 houses began running dry every afternoon, even though 400 litres were filled into it every morning.
>
> The caretaker, Sushila Kaur, checked every tap and pipe she could reach and found no leak.
>
> A plumber named Vikramaditya Ghosh tested the whole system over two days. The pipes were sound and no water was escaping under the ground.
>
> A tailor who worked on the top floor, Ramabai Solanki, had an unusual skill. She could hear the difference between water moving and water standing still through a wall. She had learned this from years of listening to her machine. She said she heard water running inside the roof at midday, when nobody was home.
>
> A small valve fitted the year before was sticking open in the afternoon heat. The tank was overflowing into a drain on the far side of the roof, where nobody could see it from the stairs.
>
> The valve was changed for one that could take the heat, and an alarm was added. The tank has stayed full since.

| # | Slot | Fact |
|---|---|---|
| 1 | Year | 1995 |
| 2 | Person A | Sushila Kaur |
| 3 | Person B | Vikramaditya Ghosh |
| 4 | Person C | Ramabai Solanki |
| 5 | Profession 1 | Plumber |
| 6 | Profession 2 | Tailor |
| 7 | Number 1 | 400 litres |
| 8 | Number 2 | 11 houses |
| 9 | Ability | Hearing moving water through a wall |
| 10 | Problem | The roof tank ran dry every afternoon |
| 11 | Cause | A valve stuck open in the heat; the tank overflowed into a drain |
| 12 | Resolution | Heat-proof valve fitted and an alarm added |

---

# S8 — THE PRINT SHOP

> In 1936, a print shop with 5 workers found that 250 copies of every run came out faint and blurred, while the rest were perfect.
>
> The owner, Kamalesh Barot, had used the same press and the same ink for 9 years without this happening.
>
> A press mechanic named Anisha Grewal took the rollers apart and set the pressure again twice. The machine was in good order and printed cleanly when she tested it.
>
> A book binder working in the back room, Sohrab Mistry, had an unusual ability. He could tell which mill a sheet of paper came from by the sound it made when he bent it. He pointed out that the latest delivery held two different papers stacked in the same bundle.
>
> The supplier had run short and filled the order with a cheaper paper that soaked up ink. Those sheets blurred, and they sat together in the middle of each stack.
>
> The shop began testing every delivery before use, and Sohrab checked the bundles himself.

| # | Slot | Fact |
|---|---|---|
| 1 | Year | 1936 |
| 2 | Person A | Kamalesh Barot |
| 3 | Person B | Anisha Grewal |
| 4 | Person C | Sohrab Mistry |
| 5 | Profession 1 | Press mechanic |
| 6 | Profession 2 | Book binder |
| 7 | Number 1 | 250 copies |
| 8 | Number 2 | 5 workers |
| 9 | Ability | Telling which mill paper came from by its sound |
| 10 | Problem | Some copies printed faint and blurred |
| 11 | Cause | Supplier mixed in a cheaper paper that soaked up ink |
| 12 | Resolution | Every delivery tested before use |

---

# RECALL QUESTIONS

**Order is fixed and matters: free recall FIRST.** The structured questions contain cues — asking "who was the engineer?" tells the student there was an engineer. Running them first would inflate free recall and destroy the measure.

## Part A — Free recall (3 items, voice or text, LLM-scored)

| ID | Question | Scores slot |
|---|---|---|
| `LR1` | In your own words, what was the problem in the story? | 10 |
| `LR2` | What turned out to be causing it? | 11 |
| `LR3` | What was done about it in the end? | 12 |

**Narrating a story back is how delayed recall is properly administered.** Voice is the recommended input here, not merely a convenience.

## Part B — Structured (7 items, auto-scored)

| ID | Question | Type | Slots |
|---|---|---|---|
| `LR4` | In which year did this take place? | Numeric, ±0 | 1 |
| `LR5` | What was the name of the main person? | Text, fuzzy match | 2 |
| `LR6` | Name either of the other two people mentioned | Text, fuzzy match | 3 or 4 |
| `LR7` | What was the profession of the person brought in to investigate? | Select, 5 options | 5 |
| `LR8` | What was the profession of the person who worked out the cause? | Select, 5 options | 6 |
| `LR9` | Two numbers appeared in the story. What were they? | Two numeric fields | 7, 8 |
| `LR10` | What was the unusual ability the third person had? | Select, 5 options | 9 |

**Fuzzy matching for names:** accept first name or surname alone; accept a Levenshtein distance of 2 to allow for spelling and transliteration. `Devraj` / `Menon` / `Devraaj` all score.

**Distractors for `LR7`, `LR8`, `LR10`:** draw from the *other seven stories*' slots. A student who read S3 sees "potter" as a distractor in S1's options. This keeps difficulty even and prevents guessing from plausibility.

---

# LLM SCORING PROMPT — FREE RECALL

Uses the shared system prompt from `llm_scoring_prompts.md`.

```
Score this delayed free recall against the fact list. The student read
the story {DELAY_HOURS} hours ago and is recalling from memory.

FACT LIST — the three facts being tested:
  PROBLEM:    {slot_10}
  CAUSE:      {slot_11}
  RESOLUTION: {slot_12}

Score each 0-2:
  0 = absent, or contradicts the story
  1 = partially recalled — the gist is right but a key element is
      missing or wrong
  2 = accurately recalled — the substance is correct

SCORE FACTS, NOT LANGUAGE. This is the most important rule here.
Ignore spelling, grammar, sentence construction and vocabulary
completely. Answers may be in English, Hindi, or a mix of both --
score them identically. A student who writes "bird light block kar
rahe the" has recalled the cause correctly and scores full marks.

Score MEANING, not wording. A student who writes "birds were blocking
the light" for a cause recorded as "migratory birds circling the tower
blocked the light" has recalled it accurately — score 2.

Do NOT reward length or detail beyond the fact.
Do NOT penalise spelling, grammar, vocabulary, or English fluency under
any circumstances. Do NOT penalise mixing English and Hindi.
Do NOT penalise a student for recalling extra correct detail.

<response>
{STUDENT_TEXT}
</response>

Return exactly:
{
  "problem": <0-2>, "cause": <0-2>, "resolution": <0-2>,
  "evidence": { "problem": "<max 12 words>", "cause": "<max 12 words>",
                "resolution": "<max 12 words>" },
  "reasoning": "<one sentence per fact>",
  "unscoreable_reason": null
}
```

**The code sums these**, as everywhere else. Structured (7 slots) + free recall (3 items × 2 = 6 points, mapped to 5 slots) = 12 total.

---

# HINDI ADAPTATION

**Do not machine-translate these.** For a memory test, translation changes recall difficulty in ways that stay invisible until your data is already corrupted:

- **Name familiarity.** These names were chosen to be recognisable but not commonplace across Indian regions. That balance must survive.
- **Number format.** 1,200 vs १२०० vs "बारह सौ" are three different memory loads. **Fix one convention and use it in every story.**
- **Sentence length.** Hindi runs longer for the same content. Keep sentences short or cognitive load rises.
- **Idiom.** Machine translation flattens the phrasing that made a fact memorable.

**Protocol**

```
English master
  → LLM translation (not Google Translate)
  → bilingual human edit
  → back-translation by a different translator or model
  → compare fact lists: all 12 must survive intact
  → 2 bilingual reviewers rate difficulty 1–5, must agree within 1
  → word count within 10% of the English master
```

**Audio: record humans, not TTS.** Sixteen files is about two hours of work. Prosody carries meaning, and synthetic Hindi prosody is not yet reliable enough for a memory test. One speaker per language, ~130 words per minute, identical recording conditions across all eight.

---

# PRESENTATION AND DELIVERY

The story is **the first thing in the assessment**, before any other module.

## Two clocks start the moment the student opens it

```
t = 0        Story opens. Both timers start.
t + 60 min   Story disappears. It cannot be seen again.
t + 24 h     Recall questions unlock.
t + 72 h     Recall window closes.
```

The rest of the assessment runs at the student's own pace, across as many sittings as they like. **Recall is on its own clock, not a step in the sequence.** If it simply followed the form, a student finishing in one sitting would face a 1-hour delay and one taking four days would face a 4-day delay — and those two scores would not be comparable.

## Screen the student sees

> ### Read this first
>
> You are about to read a short story. You will be asked about it **tomorrow**, not today.
>
> The story stays on your screen for **one hour**. After that it disappears and you cannot get it back.
>
> **The best way to remember it:** read it now, then come back and read it once more before the hour is up. Research shows that reading something a second time, after a gap, helps it stay in your memory far better than reading it many times in a row.
>
> Tomorrow, 24 hours from now, we will ask you what you remember. You will have two days to answer.
>
> **You will not be marked on your English.** We only check whether you remember what happened. Write in English, Hindi, or a mix — whatever is easiest for you.

Then a second screen:

> Ready to start the one-hour clock?
> Once you open the story, the timer begins and cannot be paused.

## The one-hour window — a knowing trade-off

Two students with identical memory: one reads the story once, the other reads it twice within the hour. The second scores higher tomorrow — not because their memory is better, but because they used the hour.

So this measures **memory plus how diligently the hour was used.**

That is accepted deliberately. With a two-minute window you would instead be measuring **reading speed** — a slow reader gets one pass while a fast reader gets three. An hour is long enough for everyone to read it properly, which removes that confound, and the advice to re-read is genuinely good for the student.

**One consequence to expect:** scores will run higher and cluster more tightly than a standard delayed-recall test. That matters when norms are built — do not compare these numbers to published logical-memory norms.

## Requirements

| Requirement | Detail |
|---|---|
| Assignment | Random from stories not in `users.stories_seen` |
| Read or listen | Audio option removes reading speed as a confound |
| Audio | Play as often as they like within the hour, same as the text |
| After 60 minutes | Text and audio removed client-side. `story_id` kept forever |
| Recall unlock | `t + 24h` exactly, independent of form progress |
| Recall window | Closes at `t + 72h` |
| Beyond 72h | Module → `admin_review`, email to luvgoel@freshmxn.com, **not scored**. `long_term_memory` = null; everything else releases normally |
| Language | Answers accepted in English, Hindi, or a mix |

## Accepted risk

Within the hour, and in the 24 hours after, a student could write the story down or discuss it. Client-side deletion and the integrity statement are partial measures only. This is a knowing trade for measuring real overnight consolidation and letting students work at their own pace.

# EQUIVALENCE VALIDATION

At **150 completed recalls** (~19 per story), check:

| Test | Threshold |
|---|---|
| Mean recall score per story | No story more than 1.0 point from the overall mean |
| Per-slot recall rate | No individual fact below 20% or above 95% across all stories |
| Numeric vs verbal sub-scores | Comparable ratios across stories |
| Read vs listen | No significant difference within a story |
| English vs Hindi | No significant difference within a story |

Any story failing the first test gets rewritten or retired. **A retired story does not invalidate the students who saw it** — `story_id` on every record means you can control for it in analysis.
