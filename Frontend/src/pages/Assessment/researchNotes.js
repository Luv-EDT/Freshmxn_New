// THE RESEARCH BEHIND THE ASSESSMENT (owner, Round 10, items 4 and 18): the "Why we do this" box at
// the top of the assessment page, and the "?" beside each section.
//
// No imports, so the pipeline fixtures can load it in Node.
//
// HONEST WORDING, ON PURPOSE. Every section is BUILT ON published research — that is what the
// references say. Our own versions are not yet validated on Indian students (that needs the norms V2
// collects), so nothing here says "validated" about our version of a test, and the reasoning test
// says plainly that its scores are provisional.

export const WHY_WE_DO_THIS = [
    "Most career advice looks at marks and at what is popular. Neither tells you how you think, what you are drawn to, or how you work — and those are what decide whether a career fits you for years, not months.",
    "So this assessment measures you on factors that research links to how people learn, decide and work. It is not an exam: there is nothing to revise for, and no factor is good or bad on its own — it describes the kind of work that suits you.",
    "Your answers are matched against what 223 Indian careers actually ask of people, together with what you told us in the interest form.",
]

export const FACTOR_COUNT = 31

// The 22 major factors and 9 minor ones the profile is built from (Backend/scoring/scoreProfile.js).
export const MAJOR_FACTORS = [
    "Openness", "Conscientiousness", "Agreeableness", "Extraversion", "Emotional stability",
    "Short-term memory", "Reasoning", "Long-term memory",
    "Verbal", "Spatial", "Musical", "Bodily", "Naturalistic", "Existential", "Logical",
    "Confidence", "Emotional intelligence", "Focus", "Firmness of belief", "Self-understanding (intrapersonal)",
    "Processing speed", "Comfort with uncertainty",
]

export const MINOR_FACTORS = [
    "Consistency and grit", "Learning capacity", "Informed decision-making",
    "Practical intelligence", "Divergent thinking", "Convergent thinking",
    "Collaboration", "Understanding others (interpersonal)", "Going deep",
]

// The ideas the whole design rests on — from the owner's REFERENCES_AND_SOURCES document, plus the
// two books on it.
export const FOUNDATIONS = [
    "Gardner, H. (1983). Frames of Mind: The Theory of Multiple Intelligences. Basic Books.",
    "Sternberg, R. J. (1985). Beyond IQ: A Triarchic Theory of Human Intelligence. Cambridge University Press.",
    "Spearman, C. (1904). \"General intelligence,\" objectively determined and measured. The American Journal of Psychology, 15(2), 201–292.",
    "Piaget, J. (1952). The Origins of Intelligence in Children. International Universities Press.",
    "National Research Council (2000). How People Learn: Brain, Mind, Experience, and School. National Academies Press.",
    "Kahneman, D. (2011). Thinking, Fast and Slow. Farrar, Straus and Giroux.",
    "Ritchie, S. (2015). Intelligence: All That Matters. John Murray.",
]

// Why a test is taken once. Shown in the box and behind the "?" of every one-attempt section.
export const ONE_ATTEMPT_REASON = "Tests like this are taken once. A second try scores higher from practice alone — about a quarter of a standard deviation on average (Hausknecht et al., 2007) — so a retake would make results unequal between students. If something goes wrong with the test itself, tell us and we will open it again for you."

export const RETEST_REFERENCE = "Hausknecht, J. P., Halpert, J. A., Di Paolo, N. T., & Moriarty Gerrard, M. O. (2007). Retesting in selection: A meta-analysis of coaching and practice effects for tests of cognitive ability. Journal of Applied Psychology, 92(2), 373–385."

// One entry per section: what it measures, why it is in, and where the method comes from.
export const MODULE_RESEARCH = {
    storyRecall: {
        measures: "Long-term memory — how much of a story you can still recall a day later.",
        why: "Remembering what you learned yesterday is what most study and work rely on. Recalling a short story after a delay is one of the most widely used ways to measure it.",
        references: [
            "Wechsler, D. (2009). Wechsler Memory Scale — Fourth Edition (Logical Memory). Pearson.",
        ],
        oneAttempt: true,
    },
    ipip50: {
        measures: "The Big Five personality traits: openness, conscientiousness, extraversion, agreeableness and emotional stability.",
        why: "The Big Five are the most studied model of personality, and they relate to which kinds of work people stay in and do well at.",
        references: [
            "Goldberg, L. R. (1992). The development of markers for the Big-Five factor structure. Psychological Assessment, 4(1), 26–42.",
            "Goldberg, L. R., et al. (2006). The International Personality Item Pool and the future of public-domain personality measures. Journal of Research in Personality, 40(1), 84–96.",
        ],
    },
    mi: {
        measures: "Seven kinds of intelligence you feel drawn to — verbal, logical, spatial, musical, bodily, naturalistic and existential.",
        why: "Intelligence is not one thing. What you are drawn to points at the kinds of problems you will enjoy working on. These are your own ratings, so they show a pull, not a measured ability.",
        references: [
            "Gardner, H. (1983). Frames of Mind: The Theory of Multiple Intelligences. Basic Books.",
        ],
    },
    rosenberg: {
        measures: "Self-esteem — how you see your own worth overall.",
        why: "How you rate yourself shapes which careers you even consider. It is one of the inputs to confidence, which is never shown to you as a score.",
        references: [
            "Rosenberg, M. (1965). Society and the Adolescent Self-Image. Princeton University Press.",
        ],
    },
    confidence: {
        measures: "Confidence in three real situations.",
        why: "Believing you can do a specific thing (self-efficacy) predicts whether people attempt it at all — more than general confidence does.",
        references: [
            "Bandura, A. (1977). Self-efficacy: Toward a unifying theory of behavioral change. Psychological Review, 84(2), 191–215.",
        ],
    },
    perspective: {
        measures: "How you think: firmness of belief, emotional intelligence, how you manage your day, persistence, comfort with uncertainty, and how well you know yourself.",
        why: "These describe how you work rather than what you know. Several of them you show us in short written answers, because rating yourself on them is unreliable.",
        references: [
            "Salovey, P., & Mayer, J. D. (1990). Emotional intelligence. Imagination, Cognition and Personality, 9(3), 185–211.",
            "Duckworth, A. L., Peterson, C., Matthews, M. D., & Kelly, D. R. (2007). Grit: Perseverance and passion for long-term goals. Journal of Personality and Social Psychology, 92(6), 1087–1101.",
            "Budner, S. (1962). Intolerance of ambiguity as a personality variable. Journal of Personality, 30(1), 29–50.",
        ],
    },
    digitSpan: {
        measures: "Short-term memory — the longest string of numbers you can hold and repeat.",
        why: "Holding several things in mind at once underlies reasoning, following instructions and learning anything new. Digit span is one of the oldest and most widely used tests of it.",
        references: [
            "Miller, G. A. (1956). The magical number seven, plus or minus two. Psychological Review, 63(2), 81–97.",
            "Wechsler, D. (2008). Wechsler Adult Intelligence Scale — Fourth Edition (Digit Span). Pearson.",
        ],
        oneAttempt: true,
    },
    reasoning: {
        measures: "Reasoning — matrix puzzles, letter and number series, word problems and turning 3D shapes in your head.",
        why: "Reasoning ability is the single strongest predictor of how quickly people learn new work. The four kinds of puzzle follow the open International Cognitive Ability Resource, with a clock on each puzzle (ICAR itself is untimed). Our scores are provisional until we have enough Indian students to compare with.",
        references: [
            "Condon, D. M., & Revelle, W. (2014). The International Cognitive Ability Resource: Development and initial validation of a public-domain measure. Intelligence, 43, 52–64.",
            "Shepard, R. N., & Metzler, J. (1971). Mental rotation of three-dimensional objects. Science, 171(3972), 701–703.",
            "Vandenberg, S. G., & Kuse, A. R. (1978). Mental rotations, a group test of three-dimensional spatial visualization. Perceptual and Motor Skills, 47(2), 599–604.",
        ],
        oneAttempt: true,
    },
    extReasoning: {
        measures: "Reasoning, on a test from another website.",
        why: "Reasoning ability is the single strongest predictor of how quickly people learn new work.",
        references: [
            "Spearman, C. (1904). \"General intelligence,\" objectively determined and measured. The American Journal of Psychology, 15(2), 201–292.",
        ],
        oneAttempt: true,
    },
    wordRecall: {
        measures: "Verbal memory — how many words you can recall from two lists of fifteen, each shown once.",
        why: "Remembering words is the half of short-term memory that numbers do not cover. The format follows the word-list tests psychologists have used for decades. Our scores are provisional until we have enough Indian students to compare with.",
        references: [
            "Rey, A. (1964). L'examen clinique en psychologie. Presses Universitaires de France.",
            "Schmidt, M. (1996). Rey Auditory Verbal Learning Test: A handbook. Western Psychological Services.",
        ],
        oneAttempt: true,
    },
    extVerbal: {
        measures: "Verbal memory — how many words you can recall from a list.",
        why: "Remembering words is the half of short-term memory that numbers do not cover.",
        references: [
            "Rey, A. (1964). L'examen clinique en psychologie. Presses Universitaires de France.",
        ],
        oneAttempt: true,
    },
    sartRaw: {
        measures: "Focus and processing speed — staying on a simple task without your attention drifting.",
        why: "Sustained attention is one of the few things this assessment can measure directly rather than ask you about, and it matters in almost every kind of work.",
        references: [
            "Robertson, I. H., Manly, T., Andrade, J., Baddeley, B. T., & Yiend, J. (1997). 'Oops!': Performance correlates of everyday attentional failures in traumatic brain injured and normal subjects. Neuropsychologia, 35(6), 747–758.",
        ],
        oneAttempt: true,
    },
}
