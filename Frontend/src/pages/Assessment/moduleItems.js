// Item text for the scale-based modules, transcribed from 04_Item_Bank.md.
//
// THE IDS ARE A CONTRACT. Backend/scoring/ reads these exact keys and decides scoring from them —
// which items reverse, which intelligence a block belongs to, which situational key applies.
// Rename one and that item silently stops counting: no error, just a slightly wrong score, or a
// nulled factor once enough of them drift. Backend/workers/fixtures/ reads THIS FILE and asserts
// every id matches what its sub-scorer expects.
//
// The scoring keys (+/−, point values) live in the sub-scorers, NOT here. Duplicating them in the
// UI would give us two copies to keep in step, and the copy the student sees is not the one that
// counts.

// ── Rosenberg Self-Esteem Scale ─────────────────────────────────────────────────────────────────
// Four points, NO neutral — that is the published design, and adding a midpoint would make the
// scores incomparable with every norm ever collected on it.
//
// ITEM ORDER IS THE PUBLISHED ORDER AND MUST NOT CHANGE. Every reference says "reverse items
// 3, 5, 8, 9, 10". Reorder these and someone will later apply that published key to the wrong
// items and silently invert half the scale.
export const ROSENBERG_SCALE = [
    { value: "A", label: "Strongly agree" },
    { value: "B", label: "Agree" },
    { value: "C", label: "Disagree" },
    { value: "D", label: "Strongly disagree" },
]

export const ROSENBERG_ITEMS = [
    { id: "RSE1", text: "I feel that I'm a person of worth, at least on an equal plane with others" },
    { id: "RSE2", text: "I feel that I have a number of good qualities" },
    { id: "RSE3", text: "All in all, I am inclined to feel that I am a failure" },
    { id: "RSE4", text: "I am able to do things as well as most other people" },
    { id: "RSE5", text: "I feel I do not have much to be proud of" },
    { id: "RSE6", text: "I take a positive attitude toward myself" },
    { id: "RSE7", text: "On the whole, I am satisfied with myself" },
    { id: "RSE8", text: "I wish I could have more respect for myself" },
    { id: "RSE9", text: "I certainly feel useless at times" },
    { id: "RSE10", text: "At times I think I am no good at all" },
]

// Required by the scale's licence. Rendered in the module, not buried in a footer.
export const ROSENBERG_ATTRIBUTION = "Rosenberg Self-Esteem Scale (Rosenberg, 1965)"

// ── Confidence — three situations (six until Round 13), each with its own answers ──────────────────────────────────────
// Deliberately situational rather than "rate your confidence 1-5". A trait rating asks someone to
// summarise themselves; a situation gives them something concrete to reason about, and the answer
// they pick reveals more than the number they would have chosen.
//
// Round 13 (owner): CF1, CF4 and CF5 are retired — each repeated a question in "How you think"
// (U6/P19, U3, P18). Three situations remain.
//
// Two items had TIED options (CF3 B/C both score 3, and the retired CF4 A/B both 4) — one is emotional
// resilience and the other motivational redirection, and neither is better. The scorer holds those
// keys; nothing here should hint that one answer is the "right" one.
const CF_OPTIONS = (options) => options.map((label, index) => ({ value: "ABCDE"[index], label }))

export const CONFIDENCE_ITEMS = [
    {
        id: "CF2",
        text: "You planned to finish five things this week. By Friday you have finished two. Looking back, this has happened more than once. What do you conclude?",
        options: CF_OPTIONS([
            "My plan was too ambitious. I'll plan three next week and see",
            "The week had things I couldn't predict. The plan was reasonable",
            "I need to work harder and stop making excuses",
            "I'm not good at finishing what I start",
            "There's no point planning — it never works out anyway",
        ]),
    },
    {
        id: "CF3",
        text: "Someone your age has already achieved something you have not — a place, a job, an income, a relationship. You see it on your phone. What is your honest reaction most of the time?",
        options: CF_OPTIONS([
            "Genuinely glad for them. Our timelines are different",
            "A short pang, then it passes",
            "It makes me want to move faster on my own things",
            "I feel behind, and it stays with me for a while",
            "I feel behind most of the time, comparing myself to people my age",
        ]),
    },
    {
        id: "CF6",
        text: "Someone you respect points out, in front of others, that you got something wrong. They are right. What happens next for you?",
        options: CF_OPTIONS([
            "I fix it and move on. Being wrong isn't a big event",
            "Uncomfortable in the moment, fine within the hour",
            "I fix it, but I'm careful about speaking up in that group afterwards",
            "It stays with me for days",
            "I'd rather stay quiet than risk that happening",
        ]),
    },
]

// ── Multiple Intelligences — 35 items, seven blocks of five ─────────────────────────────────────
// IDS ARE PREFIXED `MI_` FOR A REASON: MI Existential runs E1–E5 while IPIP Extraversion runs
// E1–E10. Unprefixed they would overwrite each other and personality scores would come back wrong
// with nothing to flag it.
//
// This measures felt competence in a domain — affinity, not tested ability. The report must never
// present it as a measurement of how good someone is at something.
export const MI_SCALE = [
    { value: "A", label: "Not like me at all" },
    { value: "B", label: "A little like me" },
    { value: "C", label: "Somewhat like me" },
    { value: "D", label: "Mostly like me" },
    { value: "E", label: "Very much like me" },
]

export const MI_ITEMS = [
    { id: "MI_V1", text: "I enjoy playing with words — puns, rhymes, or finding the exact right word" },
    { id: "MI_V2", text: "When I can see someone is not following me, I change how I am explaining it on the spot" },
    { id: "MI_V3", text: "I can organise a long piece of writing so that each part leads into the next" },
    { id: "MI_V4", text: "I work out what a new word means from how it is used, without looking it up" },
    { id: "MI_V5", text: "Lines or phrases I have read or heard stay with me long afterwards" },

    { id: "MI_S1", text: "I can picture how a room would look with the furniture moved, before moving it" },
    { id: "MI_S2", text: "I can find my way back through a place I have walked once" },
    { id: "MI_S3", text: "I can imagine what an object looks like from the other side" },
    { id: "MI_S4", text: "I enjoy drawing, designing, or arranging how things look" },
    { id: "MI_S5", text: "I understand a diagram or map faster than the same thing written out" },

    { id: "MI_M1", text: "I notice when a note or a voice is slightly off-key" },
    { id: "MI_M2", text: "I often have a rhythm or tune running in my head" },
    { id: "MI_M3", text: "I can tell which instruments are playing in a song" },
    { id: "MI_M4", text: "I can repeat a tune correctly after hearing it two or three times" },
    { id: "MI_M5", text: "I notice background sounds — a fan, a hum, traffic — while doing something else" },

    { id: "MI_B1", text: "I can usually do a new physical movement correctly within a few tries" },
    { id: "MI_B2", text: "I am good at tasks needing careful hand control — threading, fine drawing, delicate repairs" },
    { id: "MI_B3", text: "I understand how something works better by handling it than by reading about it" },
    { id: "MI_B4", text: "I have good balance and coordination" },
    { id: "MI_B5", text: "I notice small changes in how my body feels — tension, tiredness, posture" },

    { id: "MI_N1", text: "I notice small changes in the weather, the sky, or the seasons" },
    { id: "MI_N2", text: "I can tell different plants, birds, or animals apart" },
    { id: "MI_N4", text: "I group living things by their features without being taught to" },
    { id: "MI_N5", text: "I notice when an animal's or bird's behaviour signals a change coming" },

    { id: "MI_E1", text: "I think about why things are the way they are, not just how they work" },
    { id: "MI_E2", text: "I enjoy conversations about meaning, purpose, or right and wrong" },
    { id: "MI_E3", text: "I find myself wondering about questions that may have no answer" },
    { id: "MI_E4", text: "I think about how my choices affect people I will never meet" },

    { id: "MI_L1", text: "I enjoy puzzles that have to be worked out step by step" },
    { id: "MI_L2", text: "I notice when an argument does not follow from what came before" },
    { id: "MI_L3", text: "I look for the rule or pattern behind a set of numbers or events" },
    { id: "MI_L4", text: "I am comfortable working with numbers and quantities in everyday situations" },
]
