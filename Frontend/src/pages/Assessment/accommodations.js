// SUPPORT FOR A STUDENT WHOSE DIFFICULTY WOULD DISTORT A TEST (owner, Round 10). Self-declared,
// before the timed tasks. For each declared difficulty, the tests it would affect can be skipped —
// and a skipped test is recorded as NOT MEASURED, never as a low score: the scorer drops it and
// renormalises, exactly as for any section not taken. Nothing here is ever used to rank or remove a
// career.
//
// No imports, so the pipeline fixtures can load it in Node.

export const NEEDS = [
    { id: "vision", label: "Seeing the screen clearly (low vision, colour blindness)" },
    { id: "hearing", label: "Hearing" },
    { id: "motor", label: "Movement or fine motor control (typing, tapping quickly)" },
    { id: "reading", label: "Reading (for example dyslexia)" },
    { id: "attention", label: "Attention (for example ADHD)" },
]

// which tests each difficulty can affect — the timed and on-screen ones
export const AFFECTS = {
    vision: ["sartRaw", "digitSpan", "reasoning"],
    hearing: [],
    motor: ["sartRaw", "digitSpan"],
    reading: ["storyRecall", "reasoning", "wordRecall", "extVerbal"],
    attention: ["sartRaw", "wordRecall"],
}

export const affectedModules = (needs) => [...new Set((needs || []).flatMap((need) => AFFECTS[need] || []))]

// a test the student chose to skip because of a declared difficulty
export const isSkipped = (psychometric, key) => Boolean(psychometric && psychometric.accommodations && psychometric.accommodations.skipped && psychometric.accommodations.skipped[key])
