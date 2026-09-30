// The report's plan layer (Round 9): "why it fits you", "your next steps", and the per-journey
// headline. PURE — no imports, no React, no network — so the pipeline fixtures can load it the same
// way they load reportFilters.js and check it against the engine.
//
// EVERY LINE IS BUILT FROM DATA THE PAGE ALREADY HOLDS: the ranked entry (supporting factors, the
// activity that led there) and the profession's own record. Nothing is written by a model, and a
// step that cannot be derived is simply not shown — an empty list is better than filler advice.
//
// Owner decisions this encodes (2026-09-29): steps both per card and for the whole report, all of it
// collapsible; money as ranges only (no payback); a stream map for class 9-10.

// ── why it fits you ─────────────────────────────────────────────────────────────────────────────
//
// Supporting factors arrive already labelled by reportsRouter (`factor` is the plain label, `slug`
// the engine key). Two are never named as a strength: confidence is never a score, and uncertainty
// tolerance is a position, not a level (house rules).
const NOT_A_STRENGTH = ["confidence", "uncertainty_tolerance"]

export const whyFits = (entry) => {
    const usable = (list) => (Array.isArray(list) ? list : [])
        .filter((row) => row && row.factor && !NOT_A_STRENGTH.includes(row.slug))

    const strengths = usable(entry.supportingFactors)
        .slice()
        .sort((left, right) => (right.held || 0) - (left.held || 0))
        .slice(0, 3)
        .map((row) => row.factor)

    const via = Array.isArray(entry.matchedBy) && entry.matchedBy.length > 0 && entry.matchedBy[0].activity
        ? String(entry.matchedBy[0].activity)
        : null

    // One thing it would stretch — a preference or an untrained skill, never a weakness.
    const stretch = usable(entry.divergingFactors).map((row) => row.factor)[0] || null

    return { strengths, via, stretch }
}

// ── the stream map (class 9-10) ─────────────────────────────────────────────────────────────────
//
// class12_prerequisite only ever names physics, chemistry, maths and biology (checked across all
// 223), so a stream is simply the set of those four it includes. The rule is the ENGINE's —
// journey.js class12Satisfied: every required subject must be in the stream, and "any" fits all.
// A fixture pins that the two agree.
export const STREAMS = [
    { key: "pcm", label: "Science with Maths (PCM)", subjects: ["physics", "chemistry", "maths"] },
    { key: "pcb", label: "Science with Biology (PCB)", subjects: ["physics", "chemistry", "biology"] },
    { key: "pcmb", label: "Science with both (PCMB)", subjects: ["physics", "chemistry", "maths", "biology"] },
    { key: "commerceMaths", label: "Commerce with Maths", subjects: ["maths"] },
    { key: "other", label: "Commerce or Humanities without Maths", subjects: [] },
]

export const streamKeepsOpen = (required, subjects) => {
    if (!Array.isArray(required) || required.length === 0 || required.includes("any")) return true
    return required.every((subject) => subjects.includes(subject))
}

export const streamMap = (ranked, details = {}, topN = 20) => {
    const top = (ranked || []).slice(0, topN)
        .map((entry) => ({ entry, required: (details[entry.professionId] || {}).class12Prerequisite }))
        .filter((row) => Array.isArray(row.required))

    if (top.length === 0) return null

    const topFive = top.slice(0, 5)

    return {
        of: top.length,
        rows: STREAMS.map((stream) => ({
            key: stream.key,
            label: stream.label,
            open: top.filter((row) => streamKeepsOpen(row.required, stream.subjects)).length,
            // Which of the strongest five this stream would close — the part a student acts on.
            closes: topFive
                .filter((row) => !streamKeepsOpen(row.required, stream.subjects))
                .map((row) => row.entry.profession),
        })),
    }
}

// ── next steps for one career ───────────────────────────────────────────────────────────────────

const SUBJECT_NAMES = { physics: "Physics", chemistry: "Chemistry", maths: "Maths", biology: "Biology" }

const andList = (items) => {
    if (items.length <= 1) return items.join("")
    return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`
}

const subjectsLine = (required) => {
    if (!Array.isArray(required) || required.length === 0 || required.includes("any")) {
        return "Any stream in Class 11 keeps this open."
    }
    return `Take ${andList(required.map((subject) => SUBJECT_NAMES[subject] || subject))} in Class 11 — this needs them.`
}

const examLine = (detail) => {
    const gate = detail.entryGate
    const exam = gate ? gate.name : ((detail.entranceExams && detail.entranceExams.publicRoutes[0]) || null)
    if (!exam) return null

    const odds = gate && typeof gate.applicantsPerSeat === "number"
        ? ` — about ${Math.round(gate.applicantsPerSeat)} applicants per seat${gate.preparationYears ? `, usually ${gate.preparationYears} years of preparation` : ""}`
        : ""

    return `The exam to aim for: ${exam}${odds}.`
}

const planBLine = (detail) => {
    const window = detail.entryWindow
    if (window && window.constrainedRoute) {
        const bypass = (window.bypass || [])[0]
        return `Watch the deadline: ${window.constrainedRoute}.${bypass ? ` If you miss it: ${bypass}.` : ""}`
    }

    const fallback = detail.entryGate && (detail.entryGate.ifUnsuccessful || []).slice(0, 2)
    if (fallback && fallback.length > 0) return `If the exam doesn't work out: ${fallback.join(" or ")}.`

    return null
}

const MID_STREAM = {
    open: "You can move into this without restarting your studies.",
    after_any_degree: "Finish the degree you're in — this takes graduates of any subject.",
}

const midStreamLine = (detail) => {
    if (MID_STREAM[detail.midStreamEntry]) return MID_STREAM[detail.midStreamEntry]
    if (detail.midStreamEntry === "restart_undergrad") {
        return typeof detail.yearsToQualify === "number"
            ? `This needs its own degree — about ${detail.yearsToQualify} years from the start.`
            : "This needs its own degree from the start."
    }
    return null
}

const AFTER_UNDERGRAD = {
    work_first: "After your degree, start working — a master's isn't needed.",
    masters_advantage: "A master's helps later, but you can start working first.",
    masters_required: "You'll need a master's degree to practise.",
    masters_is_the_entry: "The master's degree is the way in.",
}

// At most three, each derived from the record for THIS student's stage. `nextStep` is the path step
// the card has already worked out with levelPath (passed in so this file needs no imports).
export const cardSteps = (entry, detail, journey, nextStep) => {
    if (!detail) return []

    const next = nextStep && nextStep.requirement ? `Your next step: ${nextStep.requirement}` : null
    let steps = []

    if (journey === "class9_10") {
        steps = [
            subjectsLine(detail.class12Prerequisite),
            detail.degreeDependency === "none" || detail.degreeDependency === "certificate"
                ? "No degree needed — training or a certificate is the way in."
                : examLine(detail),
            planBLine(detail),
        ]
    } else if (journey === "class11_12") {
        steps = [next, examLine(detail), planBLine(detail)]
    } else if (journey === "college") {
        steps = [midStreamLine(detail), AFTER_UNDERGRAD[detail.afterUndergrad] || null, next]
    } else if (journey === "early_professional") {
        const own = detail.selfEmployment && detail.selfEmployment.likelihood === "common" && detail.selfEmployment.route
            ? `Many people do this for themselves: ${detail.selfEmployment.route}`
            : null
        steps = [midStreamLine(detail), next, own]
    } else {
        steps = [next, examLine(detail)]
    }

    return steps.filter((step) => typeof step === "string" && step.trim() !== "").slice(0, 3)
}

// ── the headline for the whole report, by journey ───────────────────────────────────────────────

// Class 11-12: the exams across the top ten, grouped. The gate's own name is used where the career
// has one ("JEE Main"), because the free-text routes spell the same exam several ways.
const examMap = (ranked, details, topN = 10) => {
    const exams = new Map()

    ;(ranked || []).slice(0, topN).forEach((entry) => {
        const detail = details[entry.professionId]
        if (!detail) return

        const name = detail.entryGate ? detail.entryGate.name : ((detail.entranceExams && detail.entranceExams.publicRoutes[0]) || null)
        if (!name) return

        const row = exams.get(name) || { exam: name, careers: [], applicantsPerSeat: null }
        row.careers.push(entry.profession)
        if (detail.entryGate && typeof detail.entryGate.applicantsPerSeat === "number") {
            row.applicantsPerSeat = Math.round(detail.entryGate.applicantsPerSeat)
        }
        exams.set(name, row)
    })

    const rows = [...exams.values()].sort((left, right) => right.careers.length - left.careers.length).slice(0, 5)
    return rows.length > 0 ? { rows } : null
}

// College and early career: which of the top ten you can move into from where you are.
const switchSplit = (ranked, details, topN = 10) => {
    const split = { open: [], after_any_degree: [], restart_undergrad: [] }

    ;(ranked || []).slice(0, topN).forEach((entry) => {
        const detail = details[entry.professionId]
        if (detail && split[detail.midStreamEntry]) split[detail.midStreamEntry].push(entry.profession)
    })

    const total = split.open.length + split.after_any_degree.length + split.restart_undergrad.length
    return total > 0 ? split : null
}

// The strengths most shared across the top ten — for a working person, what carries over.
const sharedStrengths = (ranked, topN = 10) => {
    const counts = new Map()

    ;(ranked || []).slice(0, topN).forEach((entry) => {
        whyFits(entry).strengths.forEach((label) => counts.set(label, (counts.get(label) || 0) + 1))
    })

    return [...counts.entries()].sort((left, right) => right[1] - left[1]).slice(0, 3).map(([label]) => label)
}

export const journeyHeadline = (journey, ranked, details = {}) => {
    if (journey === "class9_10") {
        const map = streamMap(ranked, details)
        return map ? { kind: "stream", ...map } : null
    }
    if (journey === "class11_12") {
        const map = examMap(ranked, details)
        return map ? { kind: "exams", ...map } : null
    }
    if (journey === "college" || journey === "early_professional") {
        const split = switchSplit(ranked, details)
        if (!split) return null
        return {
            kind: "switch",
            split,
            strengths: journey === "early_professional" ? sharedStrengths(ranked) : [],
        }
    }
    return null
}
