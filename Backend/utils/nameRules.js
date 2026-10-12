// WHAT COUNTS AS A NAME (owner, Round 25). Spam sign-ups arrive with names like
// "fciROfrXyMzFhEZHVTjKuROZ": a random string, sometimes carrying a link, put there to push text
// through our "confirm your email" message. A real name here is letters (any script), spaces and
// . ' - only, 2 to 60 characters, and no word looks like a random string. Returns an error message,
// or null when the name is fine.

const NAME_CHARS = /^[\p{L}\p{M} .'-]+$/u

// a word that keeps switching case mid-way ("ROfrXy") or runs past 20 letters is not a name.
// Round 27: nor is a Latin word with 6 consonants in a row ("rjxkqwpzmfhv"), or one of 8+ letters
// that is almost all consonants ("bvhfjdkslaqp") — y counts as a vowel. Real names checked against
// the NAMES fixture (Krishna, Bhagyashree, Brahmbhatt, Schwarzschild…) all pass.
const CONSONANT_RUN = /[b-df-hj-np-tv-xz]{6}/i
const looksRandom = (word) => {
    const letters = word.replace(/[.'-]/g, "")
    if (letters.length > 20) return true
    const afterFirstLower = letters.slice(letters.search(/\p{Ll}/u) + 1)
    if (/\p{Ll}/u.test(letters) && (afterFirstLower.match(/\p{Lu}/gu) || []).length >= 3) return true
    if (!/^[a-z]+$/i.test(letters)) return false
    const vowels = (letters.match(/[aeiouy]/gi) || []).length
    return CONSONANT_RUN.test(letters) || (letters.length >= 8 && vowels / letters.length < 0.15)
}

const checkName = (raw) => {
    const name = typeof raw === "string" ? raw.trim().replace(/\s+/g, " ") : ""
    if (name.length < 2 || name.length > 60) return "Please enter your name (2 to 60 letters)"
    if (!NAME_CHARS.test(name)) return "Please use only letters, spaces, dots, apostrophes and hyphens in your name"
    if (name.split(" ").some(looksRandom)) return "Please enter your real name"
    return null
}

module.exports = { checkName }
