// SUPPORT FOR A STUDENT WHOSE DIFFICULTY WOULD DISTORT A TEST (owner, Round 10). Self-declared,
// in the interest form since Round 13. For each declared difficulty, the tests it affects are set aside —
// and a skipped test is recorded as NOT MEASURED, never as a low score: the scorer drops it and
// renormalises, exactly as for any section not taken. Nothing here is ever used to rank or remove a
// career.
//
// The server's copy is Backend/assessment/accommodations.js — a fixture checks AFFECTS agrees.

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
