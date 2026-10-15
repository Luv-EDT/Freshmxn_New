// THE DEMO'S OWN PUZZLES (owner, Round 33). Four per visitor — one easy, two medium, one hard — drawn at
// random from twelve (3 · 6 · 3). They are NOT items from the real reasoning test: a visitor who later buys
// meets sixteen puzzles they have never seen, and nothing from these four is kept or carried forward —
// only how many were right, inside the demo's own result.
//
// The answers stay on the server. The page gets the four without them, keeps each one's clock (30 s
// easy, 45 s medium, 60 s hard), and sends back the choices; they are marked here.
const TIME_LIMIT_S = { easy: 30, medium: 45, hard: 60 }
const GRACE_MS = 5000   // a slow phone's last tap still counts

const BANK = [
    { id: "DP_E1", level: "easy", prompt: "What comes next?  3, 6, 12, 24, …", options: ["30", "36", "48", "42"], answer: 2 },
    { id: "DP_E2", level: "easy", prompt: "A pen is to a writer as a brush is to a …", options: ["painter", "canvas", "colour", "wall"], answer: 0 },
    { id: "DP_E3", level: "easy", prompt: "Which one doesn't belong?", options: ["Mango", "Apple", "Carrot", "Banana"], answer: 2 },

    { id: "DP_M1", level: "medium", prompt: "What comes next?  2, 5, 11, 23, 47, …", options: ["94", "95", "96", "71"], answer: 1 },
    { id: "DP_M2", level: "medium", prompt: "What comes next?  A, C, F, J, O, …", options: ["T", "U", "V", "S"], answer: 1 },
    { id: "DP_M3", level: "medium", prompt: "All the coders in a club are students. Some students in the club play chess. Which must be true?", options: ["Every chess player in the club codes", "Some coders play chess", "No coder plays chess", "None of these must be true"], answer: 3 },
    { id: "DP_M4", level: "medium", prompt: "Rahul is taller than Meera. Meera is taller than Ali. Ali is taller than Sana. Who is the second shortest?", options: ["Meera", "Ali", "Sana", "Rahul"], answer: 1 },
    { id: "DP_M5", level: "medium", prompt: "In a code, CAT is written DBU. How is DOG written?", options: ["EPH", "DPG", "FQI", "EOH"], answer: 0 },
    { id: "DP_M6", level: "medium", prompt: "A train leaves at 9:40 and the trip takes 2 hours 35 minutes. When does it arrive?", options: ["12:05", "12:15", "11:15", "12:25"], answer: 1 },

    { id: "DP_H1", level: "hard", prompt: "What comes next?  1, 1, 2, 6, 24, 120, …", options: ["600", "720", "240", "840"], answer: 1 },
    { id: "DP_H2", level: "hard", prompt: "Five friends sit in a row. Neha is at the right end. Priya sits left of Arjun but right of Kabir, and Dev sits between Kabir and Priya. Who is in the middle?", options: ["Dev", "Priya", "Arjun", "Kabir"], answer: 1 },
    { id: "DP_H3", level: "hard", prompt: "A shop takes 20% off, then a further 10% off the reduced price. What is the total discount?", options: ["30%", "28%", "25%", "32%"], answer: 1 },
]

const byId = new Map(BANK.map((item) => [item.id, item]))

const pickOne = (items, random) => items[Math.floor(random() * items.length)]

// 1 easy · 2 different medium · 1 hard, in that order (easy first, hard last)
const pickPuzzles = (random = Math.random) => {
    const level = (name) => BANK.filter((item) => item.level === name)
    const easy = pickOne(level("easy"), random)
    const firstMedium = pickOne(level("medium"), random)
    const secondMedium = pickOne(level("medium").filter((item) => item.id !== firstMedium.id), random)
    const hard = pickOne(level("hard"), random)
    return [easy, firstMedium, secondMedium, hard].map((item) => item.id)
}

// what the page sees — never the answer
const publicPuzzle = (id) => {
    const item = byId.get(id)
    return item ? { id: item.id, level: item.level, prompt: item.prompt, options: item.options, timeLimitS: TIME_LIMIT_S[item.level] } : null
}

// right only when chosen, and chosen in time
const markPuzzle = (id, choice, ms) => {
    const item = byId.get(id)
    if (!item) return false
    const inTime = typeof ms === "number" && ms >= 0 && ms <= TIME_LIMIT_S[item.level] * 1000 + GRACE_MS
    return inTime && choice === item.answer
}

module.exports = { BANK, TIME_LIMIT_S, pickPuzzles, publicPuzzle, markPuzzle }
