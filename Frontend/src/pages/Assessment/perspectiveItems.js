// The Perspective block — transcribed from Perspective_Section_FINAL.md.
//
// The biggest module in the assessment and the one that unlocks the release threshold. It feeds
// three banks, two factors directly, and the values profile:
//
//     P1–P7    belief_bank            = 0.60 × MCQ + 0.40 × P7
//     P8–P13   clm                    = 0.70 × MCQ + 0.30 × P13
//     P14–P22  emotion_bank           = 0.70 × MCQ + 0.30 × P22
//     P23–P30  values_profile         importance − fulfilment, never summed into a factor
//     P31–P32  narrative              report colour, plus the social-desirability flag
//     P33      intrapersonal          with P7's revisability
//     U1–U6    uncertainty_tolerance  U7 is a calibration check, deliberately NOT scored
//
// THE ANSWER KEYS LIVE IN perspectiveScoring.js, NOT HERE. Options are listed in their scored
// order by coincidence of drafting, never as a hint — several items score two options equally
// (U6 scores B above A on purpose), and a student must not be able to read the scale off the UI.
//
// U1–U7 MEASURE A POSITION, NOT A LEVEL. Low is suited to structured, defined-path work; high to
// ambiguous, self-directed work. Neither end is a deficit and the report must never present one as
// lacking something. Nothing in this file should imply an ideal answer.

const opts = (labels) => labels.map((label, index) => ({ value: "ABCDE"[index], label }))

// ── MCQ items: belief, cognitive load, emotion, uncertainty ─────────────────────────────────────
export const PERSPECTIVE_MCQ = [
    {
        id: "P1",
        text: "Your classmates or colleagues plan a weekend activity that conflicts with one of your personal values — for example, skipping a volunteer event you care about. How do you usually respond?",
        options: opts([
            "I politely decline and explain why the value matters to me",
            "I suggest an alternative that keeps everyone comfortable",
            "I go along but feel uneasy later",
            "I ignore the conflict and join without thinking much",
        ]),
    },
    {
        id: "P2",
        text: "You strongly believe something is the right choice, based on your experience and intuition. Later you come across data or reports suggesting the opposite. What do you usually do?",
        options: opts([
            "I stick to my belief unless the data is extremely strong and repeated over time",
            "I consider the data, but my intuition usually carries more weight",
            "I feel conflicted and often delay the decision until I'm fully convinced",
            "I quickly change my belief to match the data, even if it feels wrong",
        ]),
    },
    {
        id: "P3",
        text: "When you face a complex problem or decision with no obvious answer, what do you usually do?",
        options: opts([
            "I gather relevant information, evaluate multiple options, then decide on what makes most sense",
            "I think it through using what I already know and choose what seems most reasonable",
            "I rely on advice from others, or follow an approach that worked for someone else",
            "I choose the safest or most commonly taken option to avoid risk",
            "I avoid the decision or postpone it until it becomes unavoidable",
        ]),
    },
    {
        id: "P4",
        text: "When making an important decision, how do you usually use other people's opinions?",
        options: opts([
            "I listen to others, but I ultimately decide based on my own judgment",
            "I treat others' opinions as inputs and balance them with my own view",
            "I rely on others' opinions when I feel unsure",
            "I usually need others' approval before deciding",
            "I avoid deciding unless someone else clearly guides me",
        ]),
    },
    {
        id: "P5",
        text: "Eight months ago you chose a direction after thinking it through carefully — a course, a skill, a career path. You've worked at it steadily. You still have nothing visible to show for it: no results, no recognition. When you check your original reasons, they still hold. What do you do?",
        options: opts([
            "I continue as planned — my reasons haven't changed, and results take time",
            "I continue, but set a specific date to review it seriously",
            "I keep going while quietly starting to look at other options",
            "I switch to something that shows results faster",
            "I stop and wait until I feel sure again",
        ]),
    },
    {
        id: "P6",
        text: "You've decided on a direction for yourself after genuine thought. A senior family member you respect tells you it's a mistake and pushes you towards their choice. What usually happens?",
        options: opts([
            "I hear them out fully, then go ahead with my own decision",
            "I go ahead with mine, but adjust parts of it to reduce the conflict",
            "I delay the decision until they come around",
            "I usually end up following their choice",
            "I avoid the conversation and don't decide at all",
        ]),
    },

    {
        id: "P8",
        text: "How often do you find yourself derailed from your long-term goals by distractions or short-term pleasures?",
        options: opts([
            "Very frequently (daily)",
            "Frequently (several times a week)",
            "Occasionally (a few times a month)",
            "Rarely (less than once a month)",
        ]),
    },
    {
        id: "P9",
        text: "You have three unrelated pieces of work to finish today. How do you usually move between them?",
        options: opts([
            "I finish one properly before opening the next",
            "I give each a fixed block of time and stick to the blocks",
            "I move to another whenever the current one gets difficult",
            "I keep all three open and switch between them as I feel like it",
            "I start whichever one someone reminds me about",
        ]),
    },
    {
        id: "P10",
        text: "You've just started a two-hour block of your hardest work. Within 20 minutes, three people message you asking for small favours. None are urgent. What do you usually do?",
        options: opts([
            "I don't see them — notifications are off while I do focused work",
            "I see them, don't reply, and deal with everything after the block",
            "I reply quickly to each one and go back to work",
            "I stop the block, handle them, and restart later",
            "I handle them and usually don't get back to the block that day",
        ]),
    },
    {
        id: "P11",
        text: "Most people are sharper at some hours than others. How do you actually use yours?",
        options: opts([
            "I deliberately protect them for my hardest work",
            "I use them for hard work when I can, but something else often takes them",
            "I've noticed when they are, but I don't plan around them",
            "I haven't paid attention to when I'm sharpest",
            "My hardest work usually happens late at night when I'm running out of time",
        ]),
    },
    {
        id: "P12",
        text: "You've been working on something demanding for about 90 minutes and your attention is clearly dropping. What do you usually do?",
        options: opts([
            "Take a short planned break away from screens, then return",
            "Switch to a lighter task for a while, then come back to the hard one",
            "Push through until it's done, however long it takes",
            "Pick up my phone and scroll until I feel like resuming",
            "Stop for the day and tell myself I'll do it tomorrow",
        ]),
    },

    {
        id: "P14",
        text: "Rahul prepared for two years for a competitive exam. He doesn't clear it, and he has no attempts left. In the weeks that follow, what is he most likely to feel most strongly?",
        options: opts(["Sadness", "Anger", "Anxiety", "Guilt", "Relief"]),
    },
    {
        id: "P15",
        text: "In a group project, a teammate presents your work to the class and does not mention your name. What are you most likely to feel first?",
        options: opts(["Anger", "Sadness", "Embarrassment", "Guilt", "Relief"]),
    },
    {
        id: "P16",
        text: "Meera's closest friend gets admission to the college Meera wanted and didn't get. Meera hugs her and means it — and also feels something uncomfortable she'd rather not admit. What is she most likely feeling?",
        options: opts([
            "Real happiness for her friend and envy, at the same time",
            "Sadness about her own result, nothing more",
            "Only happiness — the discomfort is about something else",
            "Anger at her friend",
            "Nothing much; she's imagining it",
        ]),
    },
    {
        id: "P17",
        text: "Arjun has spent three years trying to repair a difficult relationship with his father. Nothing he tries changes anything, and he has now stopped trying. What is he most likely to feel now?",
        options: opts(["Hopelessness", "Anger", "Guilt", "Relief", "Anxiety"]),
    },
    {
        id: "P18",
        text: "You have an important presentation tomorrow and you're very nervous. What is the most effective thing to do tonight?",
        options: opts([
            "Rehearse it once out loud, and treat the nerves as a sign it matters",
            "Go over everything that could go wrong so you're fully prepared",
            "Distract yourself so you stop thinking about it",
            "Keep telling yourself there's nothing to be nervous about",
            "Ask someone else to present instead",
        ]),
    },
    {
        id: "P19",
        text: "You keep replaying an argument from last week, and it's stopping you concentrating. What is the most effective thing to do?",
        options: opts([
            "Write down what's actually unresolved and decide one thing you'll do about it",
            "Talk it through with several friends until you feel better",
            "Wait — these things fade on their own",
            "Push the thought away every time it comes back",
            "Avoid anything that reminds you of it",
        ]),
    },
    {
        id: "P20",
        text: "You give a junior teammate honest critical feedback and they start crying. What is the most effective thing to do?",
        options: opts([
            "Pause, acknowledge it's hard to hear, then repeat the feedback with specific next steps",
            "End the conversation and send the feedback in writing later",
            "Take the feedback back and say it wasn't a big issue",
            "Change the subject and hope they're fine tomorrow",
            "Tell them they need to handle feedback professionally",
        ]),
    },
    {
        id: "P21",
        text: "A friend tells you: “I got the promotion I wanted, but I can't enjoy it. My closest colleague applied too and didn't get it.” What best describes what your friend is feeling?",
        options: opts([
            "Pleased about the promotion and uncomfortable that their friend lost out, both at once",
            "Guilt, and nothing else",
            "Regret about having applied",
            "Sadness",
            "Nothing unusual — that's a normal reaction",
        ]),
    },

    {
        id: "U1",
        text: "You finish your studies and have two offers. One is a stable job with a fixed salary and clear yearly increments. The other is with a small new company: lower pay now, no guarantee it survives two years, but if it works you'd be doing far more interesting work and earning much more. Which do you take?",
        options: opts([
            "The new company, without much hesitation",
            "The new company, after working out how long I could manage if it failed",
            "The stable job, but I'd keep exploring on the side",
            "The stable job — the certainty matters more to me",
            "The stable job, and I'd feel relieved to have chosen it",
        ]),
    },
    {
        id: "U2",
        text: "A field genuinely interests you, but there's no set route into it — no clear entrance exam, no standard degree, and nobody around you has done it. How do you respond?",
        options: opts([
            "That's part of the appeal — I'd start and work the path out as I go",
            "I'd go ahead, but first find two or three people who've done something similar",
            "I'd keep it as a side interest while following a defined path",
            "I'd choose a field with a clear path instead",
            "A field without a defined path isn't a realistic option for me",
        ]),
    },
    {
        id: "U3",
        text: "You have to make an important decision, and you can only get about 60% of the information you'd like. The rest genuinely can't be known in advance. What do you do?",
        options: opts([
            "Decide now — 60% is usually enough, and waiting rarely adds much",
            "Decide now, and plan for what I'd do if the unknown part goes badly",
            "Spend more time gathering, then decide even if I haven't got much further",
            "Delay until I'm substantially more certain",
            "Ask someone more experienced to decide for me",
        ]),
    },
    {
        id: "U4",
        text: "You have savings of ₹1,00,000. An opportunity comes up — a course, a venture, a move — that could meaningfully change your prospects, but it would use most of it, with no guarantee of return. What do you do?",
        options: opts([
            "Commit most of it — this is what savings are for",
            "Commit about half and keep the rest as a cushion",
            "Commit a small amount to test it first",
            "Keep the savings and look for a cheaper way in",
            "Keep the savings — anything needing most of them isn't for me",
        ]),
    },
    {
        id: "U5",
        text: "Two roles, same pay. In one, your responsibilities are clearly defined and you know what each week will look like. In the other, the role is still being shaped and will keep changing as the work develops. Which suits you better?",
        options: opts([
            "The evolving role, strongly",
            "The evolving role, though I'd want a few fixed anchor points",
            "Either — I'd adapt to whichever",
            "The defined role, though I could handle some change",
            "The defined role, strongly",
        ]),
    },
    {
        id: "U6",
        text: "You took a considered risk a year ago and it didn't work out — you lost time and money. A similar opportunity appears now, and your reasoning says it's sound. What do you do?",
        options: opts([
            "Take it — one bad outcome doesn't make the reasoning wrong",
            "Take it, but change what I'd do differently based on last time",
            "Take a smaller version of it",
            "Wait until I've fully recovered from the last one",
            "Avoid this kind of opportunity now",
        ]),
    },
    {
        id: "U7",
        text: "Someone you know offers you a chance to put money into something they say is guaranteed to double in six months. They can't explain clearly how it produces the returns. What do you do?",
        options: opts([
            "Ask for a full explanation, and don't put money in without one",
            "Put in a small amount to see what happens",
            "Put in what I could afford to lose",
            "Put in a significant amount — chances like this don't come often",
            "Decline immediately without asking",
        ]),
    },
]

// ── Values profile: 1–5, numeric (the scorer reads these as numbers, not letters) ────────────────
export const VALUES_SCALE_FULFILMENT = [
    { value: 1, label: "Not at all" },
    { value: 2, label: "Slightly" },
    { value: 3, label: "Moderately" },
    { value: 4, label: "Very" },
    { value: 5, label: "Extremely" },
]

export const VALUES_SCALE_IMPORTANCE = [
    { value: 1, label: "Not important" },
    { value: 2, label: "Slightly important" },
    { value: 3, label: "Moderately important" },
    { value: 4, label: "Very important" },
    { value: 5, label: "Extremely important" },
]

const AREAS = [
    { key: "Safety and security — money, health, stability", },
    { key: "Social — belonging, friendship, family, love" },
    { key: "Esteem — respect, recognition, achievement" },
    { key: "Self-actualisation — growth, meaning, becoming who you could be" },
]

export const VALUES_FULFILMENT = AREAS.map((area, index) => ({ id: `P${23 + index}`, text: area.key }))
export const VALUES_IMPORTANCE = AREAS.map((area, index) => ({ id: `P${27 + index}`, text: area.key }))

// ── Narrative: report colour only, and one flag ─────────────────────────────────────────────────
//
// INVENTED OPTIONS. Perspective_Section_FINAL.md gives the prompts for P31 and P32 but marks them
// "your Q3/Q16, unchanged" without listing the choices. Neither feeds a factor — P31 is a label and
// P32 is a label plus one flag — so inventing plausible options costs nothing measurable. The one
// thing that had to be exact is P32's last option: the scorer substring-matches
// "never lose momentum" to raise `social_desirability`, and losing that phrase silently disables
// the only response-style check in the section.
export const PERSPECTIVE_NARRATIVE = [
    {
        id: "P31",
        text: "What do you believe in most?",
        options: [
            "Hard work and effort over time",
            "Talent and natural ability",
            "Luck and timing",
            "Faith, or something larger than myself",
            "People — the relationships around me",
            "Knowledge and understanding",
        ].map((label) => ({ value: label, label })),
    },
    {
        id: "P32",
        text: "What most often causes you to lose momentum?",
        options: [
            "Losing interest once the novelty wears off",
            "Not seeing results quickly enough",
            "Other people's expectations or criticism",
            "Too many things at once",
            "Self-doubt",
            "Circumstances outside my control",
            "I never lose momentum",
        ].map((label) => ({ value: label, label })),
    },
]

// ── Open text: graded by llmScorer AFTER submission, never scored raw ────────────────────────────
export const PERSPECTIVE_OPEN = [
    {
        id: "P7",
        title: "One belief you hold strongly",
        text: "Write down one belief you hold strongly about your career or your life. It can be anything you hold firmly — a religious belief, a cultural value, a theory you think is true, a view about how people work, or something about your own future.",
        parts: [
            "Why do you hold it?",
            "What experience or evidence supports it?",
            "What would make you change your mind?",
        ],
    },
    {
        id: "P13",
        title: "How you would plan a free day",
        text: "Tomorrow is free, 9 am to 9 pm. You have five things to do:\n1. A 1500-word assignment due in 2 days — needs deep focus, about 3 hours\n2. Reply to 12 pending messages and emails — about 30 minutes\n3. An online class at 4 pm you must attend — fixed, 1 hour\n4. Groceries and errands — about 1 hour\n5. Revision for a test 8 days away — about 2 hours",
        parts: ["Write the order you would actually do them in, with rough timings."],
    },
    {
        id: "P22",
        title: "A difficult choice",
        text: "Think of a time you had to make a difficult choice that affected someone close to you. In 3–4 sentences, describe what you felt. Name your feelings as precisely as you can.",
        parts: [],
    },
    {
        id: "P33",
        title: "Something you no longer believe about yourself",
        text: "Describe something you believed about yourself two years ago that you no longer believe.",
        parts: [
            "What did you believe?",
            "What changed your mind?",
            "What do you believe about yourself now instead?",
        ],
    },
]

// Not scored for accuracy, and never marked. Written answers are graded on reasoning structure and
// specificity, never on spelling, grammar or fluency — and answers in English, Hindi or a mix score
// identically. Told to the student because being told changes what they write.
export const OPEN_ITEM_NOTE = "Write in English, Hindi, or a mix — whatever is easiest. Spelling and grammar are never marked. There are no right answers; we are looking at how you think, not how you write."
