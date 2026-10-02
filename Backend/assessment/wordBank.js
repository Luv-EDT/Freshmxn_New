// THE WORD-MEMORY TEST (owner, Round 11) — our own, replacing the screenshot upload of an outside
// test (extVerbal). Modelled on the Rey Auditory Verbal Learning Test tradition (Rey 1964): a list of
// unrelated everyday words, shown once, then written down from memory, in any order.
//
//     two lists of 15 words, drawn without overlap from the bank by a seed stored on the block
//     each word shown for WORD_MS, no replay; then the student types every word they remember
//     marked HERE, never in the browser
//
// THE BANK. Common, concrete nouns any reader of Indian English knows by Class 9: 4–8 letters, one
// meaning each, no two that sound alike, nothing upsetting, no brand or place names. Concrete nouns
// because abstract ones are recalled differently, which would make one list harder than the other.
//
// MARKING forgives what is not memory: case, spaces and punctuation; a plural or singular form
// ("tiger" for "tigers"); and, for words of five letters or more, one wrong, missing, extra or
// swapped letter — a typo is not forgetting. Each target is credited at most once, and each typed
// word can credit at most one target. Anything typed that matches no target is an intrusion, kept
// for review and never subtracted.
//
// The answer key is the list itself, so it can only be hidden by time: the page receives a list
// once, at the moment it is shown, and a refresh during the showing goes straight to the writing.

const { rng, shuffle } = require("./reasoningBank")

const LIST_COUNT = 2
const LIST_LENGTH = 15
const WORD_MS = 1500

const WORDS = [
    "apple", "basket", "bottle", "bridge", "bucket", "button", "camel", "candle", "carpet", "castle",
    "chair", "cloud", "coconut", "comb", "cotton", "crayon", "curtain", "desk", "diamond", "pebble",
    "drum", "eagle", "engine", "feather", "fence", "finger", "flute", "forest", "garden", "glass",
    "goat", "guitar", "hammer", "helmet", "honey", "horse", "island", "jacket", "jungle", "kettle",
    "kite", "ladder", "lamp", "lemon", "letter", "jasmine", "magnet", "mango", "market", "mirror",
    "monkey", "needle", "ocean", "onion", "orange", "parrot", "pencil", "pepper", "pillow", "planet",
    "bangle", "potato", "pumpkin", "rabbit", "radio", "river", "rocket", "saddle", "school", "scooter",
    "shell", "shirt", "sugar", "table", "teacher", "temple", "thread", "tiger", "tomato", "tractor",
    "train", "turtle", "umbrella", "valley", "violin", "wallet", "window", "wheel", "whistle", "wizard",
    "barrel", "blanket", "brush", "cabbage", "cricket", "spoon", "farmer", "rope", "puzzle", "ribbon",
]

// two lists of fifteen, no word in both, the same for the same seed
const listsFor = (seed) => {
    const drawn = shuffle(rng(seed), WORDS).slice(0, LIST_COUNT * LIST_LENGTH)
    return Array.from({ length: LIST_COUNT }, (_, index) => drawn.slice(index * LIST_LENGTH, (index + 1) * LIST_LENGTH))
}

const tokens = (text) => String(text || "")
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((token) => token.length >= 2)

// at most one edit (insert, delete, replace, or swap of neighbours) — Damerau, restricted
const withinOneEdit = (left, right) => {
    if (left === right) return true
    if (Math.abs(left.length - right.length) > 1) return false
    if (left.length === right.length) {
        const diffs = []
        for (let index = 0; index < left.length; index += 1) if (left[index] !== right[index]) diffs.push(index)
        if (diffs.length === 1) return true
        return diffs.length === 2 && diffs[1] === diffs[0] + 1 && left[diffs[0]] === right[diffs[1]] && left[diffs[1]] === right[diffs[0]]
    }
    const [short, long] = left.length < right.length ? [left, right] : [right, left]
    for (let index = 0; index < long.length; index += 1) {
        if (long.slice(0, index) + long.slice(index + 1) === short) return true
    }
    return false
}

const singular = (word) => (word.endsWith("es") && word.length > 4 ? [word.slice(0, -2), word.slice(0, -1)] : word.endsWith("s") ? [word.slice(0, -1)] : [])

const matches = (typed, target) => {
    if (typed === target) return true
    if (singular(typed).includes(target) || singular(target).includes(typed)) return true
    return target.length >= 5 && withinOneEdit(typed, target)
}

// { correct, recalled: [target words credited], intrusions: [typed words that matched nothing] }
const markRecall = (text, list) => {
    const remaining = [...list]
    const recalled = []
    const intrusions = []

    ;[...new Set(tokens(text))].forEach((typed) => {
        const exact = remaining.indexOf(typed)
        const index = exact !== -1 ? exact : remaining.findIndex((target) => matches(typed, target))
        if (index === -1) {
            if (!recalled.some((target) => matches(typed, target))) intrusions.push(typed)
            return
        }
        recalled.push(remaining[index])
        remaining.splice(index, 1)
    })

    return { correct: recalled.length, recalled, intrusions: intrusions.slice(0, 30) }
}

module.exports = { WORDS, LIST_COUNT, LIST_LENGTH, WORD_MS, listsFor, markRecall, withinOneEdit }
