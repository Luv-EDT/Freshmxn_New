// IPIP-50 — the item text, transcribed from 04_Item_Bank.md §2. Goldberg's official list.
//
// THE IDS ARE A CONTRACT, NOT A NAMING CHOICE. Backend/scoring/ipip50.js reads
// `psychometric.ipip50.answers.IPIP_O1` and so on, and it decides which items to reverse from that
// id. Rename one here and that item silently stops being scored — coverage drops below the gate and
// the whole trait nulls, with no error anywhere. Backend/workers/fixtures/ reads THIS FILE and
// asserts the id set matches what the scorer expects, which is the only thing standing between a
// typo and a student's missing personality score.
//
// The `+` / `−` keys are shown here for reference only. THE SCORER OWNS THE REVERSALS — duplicating
// that logic in the UI would give us two copies to keep in step, and the copy the student sees is
// not the one that counts.
//
// The two quality checks are deliberately NOT marked in the UI. QC1 is an infrequency item ("I have
// never used a computer or phone") and QC2 an instructed-response check; both only work if they
// read as ordinary items. They are placed among the others rather than at the end for the same
// reason.

export const IPIP_STEM = "I see myself as someone who…"

// A–E, 1–5. The letters are what gets stored; the scorer maps them.
export const IPIP_SCALE = [
    { value: "A", label: "Very inaccurate" },
    { value: "B", label: "Moderately inaccurate" },
    { value: "C", label: "Neither accurate nor inaccurate" },
    { value: "D", label: "Moderately accurate" },
    { value: "E", label: "Very accurate" },
]

// trait order here is presentation order only — the scorer groups by id prefix, not by position
export const IPIP_ITEMS = [
    { id: "IPIP_E1", text: "Am the life of the party", key: "+" },
    { id: "IPIP_A1", text: "Feel little concern for others", key: "−" },
    { id: "IPIP_C1", text: "Am always prepared", key: "+" },
    { id: "IPIP_ES1", text: "Get stressed out easily", key: "−" },
    { id: "IPIP_O1", text: "Have a rich vocabulary", key: "+" },

    { id: "IPIP_E2", text: "Don't talk a lot", key: "−" },
    { id: "IPIP_A2", text: "Am interested in people", key: "+" },
    { id: "IPIP_C2", text: "Leave my belongings around", key: "−" },
    { id: "IPIP_ES2", text: "Am relaxed most of the time", key: "+" },
    { id: "IPIP_O2", text: "Have difficulty understanding abstract ideas", key: "−" },

    { id: "IPIP_E3", text: "Feel comfortable around people", key: "+" },
    { id: "IPIP_A3", text: "Insult people", key: "−" },
    { id: "IPIP_C3", text: "Pay attention to details", key: "+" },
    { id: "IPIP_ES3", text: "Worry about things", key: "−" },
    { id: "IPIP_O3", text: "Have a vivid imagination", key: "+" },

    // QC1 — infrequency. Anything but "Very inaccurate" is not credible.
    { id: "IPIP_QC1", text: "Have never used a computer or phone", key: "qc" },

    { id: "IPIP_E4", text: "Keep in the background", key: "−" },
    { id: "IPIP_A4", text: "Sympathize with others' feelings", key: "+" },
    { id: "IPIP_C4", text: "Make a mess of things", key: "−" },
    { id: "IPIP_ES4", text: "Seldom feel blue", key: "+" },
    { id: "IPIP_O4", text: "Am not interested in abstract ideas", key: "−" },

    { id: "IPIP_E5", text: "Start conversations", key: "+" },
    { id: "IPIP_A5", text: "Am not interested in other people's problems", key: "−" },
    { id: "IPIP_C5", text: "Get chores done right away", key: "+" },
    { id: "IPIP_ES5", text: "Am easily disturbed", key: "−" },
    { id: "IPIP_O5", text: "Have excellent ideas", key: "+" },

    { id: "IPIP_E6", text: "Have little to say", key: "−" },
    { id: "IPIP_A6", text: "Have a soft heart", key: "+" },
    { id: "IPIP_C6", text: "Often forget to put things back in their proper place", key: "−" },
    { id: "IPIP_ES6", text: "Get upset easily", key: "−" },
    { id: "IPIP_O6", text: "Do not have a good imagination", key: "−" },

    { id: "IPIP_E7", text: "Talk to a lot of different people at parties", key: "+" },
    { id: "IPIP_A7", text: "Am not really interested in others", key: "−" },
    { id: "IPIP_C7", text: "Like order", key: "+" },
    { id: "IPIP_ES7", text: "Change my mood a lot", key: "−" },
    { id: "IPIP_O7", text: "Am quick to understand things", key: "+" },

    // QC2 — instructed response. The item text IS the instruction.
    { id: "IPIP_QC2", text: "Please select “Moderately accurate” for this item", key: "qc" },

    { id: "IPIP_E8", text: "Don't like to draw attention to myself", key: "−" },
    { id: "IPIP_A8", text: "Take time out for others", key: "+" },
    { id: "IPIP_C8", text: "Shirk my duties", key: "−" },
    { id: "IPIP_ES8", text: "Have frequent mood swings", key: "−" },
    { id: "IPIP_O8", text: "Use difficult words", key: "+" },

    { id: "IPIP_E9", text: "Don't mind being the center of attention", key: "+" },
    { id: "IPIP_A9", text: "Feel others' emotions", key: "+" },
    { id: "IPIP_C9", text: "Follow a schedule", key: "+" },
    { id: "IPIP_ES9", text: "Get irritated easily", key: "−" },
    { id: "IPIP_O9", text: "Spend time reflecting on things", key: "+" },

    { id: "IPIP_E10", text: "Am quiet around strangers", key: "−" },
    { id: "IPIP_A10", text: "Make people feel at ease", key: "+" },
    { id: "IPIP_C10", text: "Am exacting in my work", key: "+" },
    { id: "IPIP_ES10", text: "Often feel blue", key: "−" },
    { id: "IPIP_O10", text: "Am full of ideas", key: "+" },
]

// Shown one page at a time rather than as one 52-item wall — a scroll that long is abandoned.
export const IPIP_PAGE_SIZE = 10

export const IPIP_TOTAL = IPIP_ITEMS.length
