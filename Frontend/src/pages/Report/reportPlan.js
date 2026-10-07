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

    // a combined career carries both sides' factors, so the same one can come twice — named once
    // ("reasoning, reasoning" on a combined career, Round 19)
    const strengths = [...new Set(usable(entry.supportingFactors)
        .slice()
        .sort((left, right) => (right.held || 0) - (left.held || 0))
        .map((row) => row.factor))]
        .slice(0, 3)

    const via = Array.isArray(entry.matchedBy) && entry.matchedBy.length > 0 && entry.matchedBy[0].activity
        ? String(entry.matchedBy[0].activity)
        : null

    // One thing it would stretch — a preference or an untrained skill, never a weakness.
    const stretch = usable(entry.divergingFactors).map((row) => row.factor)[0] || null

    return { strengths, via, stretch }
}

// ── why we chose it for you (Round 19, owner: "a very crisp reason") ─────────────────────────────
//
// One sentence from what PUT the career in the list — the engine's own evidence, in the order it
// weighs it (tiers.js): you named it; an activity you've kept up for years (list A) or do now (B);
// love, achievement, confidence; and whether it fits how you work. No factor names, no numbers.
export const whyChosen = (entry) => {
    if (!entry) return null
    const activity = Array.isArray(entry.matchedBy) && entry.matchedBy.length > 0 && entry.matchedBy[0].activity
        ? String(entry.matchedBy[0].activity)
        : null
    const fits = entry.comfort === true
    const fitWords = fits ? "it fits how you think and work" : "it is a stretch from how you work now, but within reach"

    if (entry.namedDirectly || entry.fromAspiration) return `You named it yourself, and ${fitWords}.`
    if (!activity) return fits ? "It reached you on your profile alone: it fits how you think and work." : null

    const how = entry.list === "A" ? `Something you've kept up for years — ${activity} — leads here` : `Something you do now — ${activity} — leads here`
    const feeling = entry.passion ? ", and you love it" : entry.achievement ? ", and you've achieved something in it" : String(entry.confidenceExp).toLowerCase() === "high" ? ", and you feel sure of it" : ""
    return `${how}${feeling}; ${fitWords}.`
}

// ── the road from where the student stands ──────────────────────────────────────────────────────
//
// A COLLEGE OR WORKING STUDENT IS PAST SCHOOL AND IN (OR PAST) A DEGREE (owner, Round 19: "I am
// already in college, and it still recommends bachelor's degrees"). Their road leaves out the school
// steps, and their next step is the one AFTER the first degree — unless this career needs its own
// degree from the start (restart_undergrad), which is then honestly their next step.
//
// `allSteps` is the career's path already levelled by the card's levelPath (0 school … 2 degree …);
// `studentLevel` is where the journey puts the student. Returns the steps to show and the index of the
// next one (-1 when there is none).
const DEGREE_STAGES = ["entrance_exam", "entrance", "degree", "undergrad", "diploma"]

export const roadFrom = (allSteps, journey, studentLevel, midStreamEntry) => {
    const pastSchool = journey === "college" || journey === "early_professional"
    const restart = midStreamEntry === "restart_undergrad"
    const steps = pastSchool ? allSteps.filter((step) => step.level >= 2) : allSteps
    const lastDegree = steps.reduce((found, step, index) => (DEGREE_STAGES.includes(step.stage) ? index : found), -1)

    // The first step at or beyond where the student is — what they do next.
    const nextIndex = studentLevel === undefined
        ? -1
        : pastSchool && !restart && lastDegree >= 0
            ? (lastDegree + 1 < steps.length ? lastDegree + 1 : -1)
            // A class 11-12 student is already IN the school step: their next step is the first after it
            : journey === "class11_12"
                ? steps.findIndex((step) => step.level > studentLevel)
                : steps.findIndex((step) => step.level >= Math.min(studentLevel, 2))

    return { steps, nextIndex }
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

// A career that takes any stream but whose usual routes need particular subjects names them per
// route (owner, Round 18) — "any stream" alone would hide that B.Tech needs Physics, Chemistry, Maths
const subjectsLine = (required, routes) => {
    if (Array.isArray(routes) && routes.length > 0) {
        return `Subjects depend on the route: ${routes.slice(0, 2).map((row) => `${row.route} — ${row.subjects}`).join("; ")}.`
    }
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
        ? ` — about ${Math.round(gate.applicantsPerSeat)} applicants per seat${gate.preparationYears ? `, usually ${gate.preparationYears} ${gate.preparationYears === 1 ? "year" : "years"} of preparation` : ""}`
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
    work_first: "After your degree, start working — a master's usually isn't needed.",
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
            subjectsLine(detail.class12Prerequisite, detail.subjectRoutes),
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

// CAN YOU GET IN WITHOUT A DEGREE? (owner, Round 10) — one line, from the two fields the data already
// has: degree_dependency (what stops you getting the first job — DECISIONS §3) and mid_stream_entry
// (the door from where you stand — §4). No third field: a career the owner thinks is skills-based
// but the data marks "undergrad" is fixed in the data, so the two can never disagree.
export const entryRoute = (detail) => {
    if (!detail) return null
    const degree = detail.degreeDependency
    const door = detail.midStreamEntry
    if (degree === "none") return "No degree needed — you're hired on what you can show"
    if (degree === "certificate") return "No degree needed — a short course or certificate"
    if (degree === "undergrad" && door === "open") return "A degree is common, not required — many employers filter on one, but you can start building now"
    if (degree === "undergrad" && door === "after_any_degree") return "Any bachelor's degree opens this"
    if (degree === "undergrad" && door === "restart_undergrad") return "Needs this specific degree"
    if (degree === "undergrad") return "A bachelor's degree"
    if (degree === "professional") return "A licence is required — this degree is the only way in"
    return null
}

// YOUR MASTER'S OPTIONS (owner, Round 11) — college and working students only. The top matches
// grouped by what the data says about a master's (after_undergrad), each with the step that names
// the degree and the postgraduate exams from THAT career's own exam list (the exam calendar's
// level "pg"). Nothing is added that the career's record does not say.
const MASTERS_GROUPS = [
    { key: "masters_is_the_entry", title: "The master's is the way in" },
    { key: "masters_required", title: "You need a master's to practise" },
    { key: "masters_advantage", title: "A master's helps later" },
]
const MASTERS_STAGES = ["masters", "post_graduate", "specialisation", "professional_qualification"]
const MASTERS_WORDS = /\bM\.?\s?(Sc|A|Tech|Des|Pharm|Phil|Stat|Math|Ed|Lib|SW|PP|Arch|Plan|Com|B\.?A|D|S|Ch)\b|\bmaster'?s\b|\bMBA\b|\bPGD(M|BA)?\b|\bPG diploma\b|\bLL\.?M\b/i

export const mastersOptions = (ranked, details = {}, topN = 20) => {
    const groups = MASTERS_GROUPS.map((group) => ({ ...group, careers: [] }))
    let notNeeded = 0
    let unknown = 0

    ;(ranked || []).slice(0, topN).forEach((entry) => {
        const detail = details[entry.professionId]
        if (!detail) {
            unknown += 1
            return
        }
        const group = groups.find((candidate) => candidate.key === detail.afterUndergrad)
        if (!group) {
            notNeeded += 1
            return
        }
        const step = (detail.pathToEntry || []).find((row) => MASTERS_STAGES.includes(row.stage))
            || (detail.pathToEntry || []).find((row) => MASTERS_WORDS.test(row.requirement || ""))
        group.careers.push({
            professionId: entry.professionId,
            profession: entry.profession,
            step: step && step.requirement ? step.requirement.trim().replace(/\.$/, "") : null,
            exams: (detail.exams || []).filter((exam) => exam.level === "pg").map((exam) => exam.name),
        })
    })

    return { groups: groups.filter((group) => group.careers.length > 0), notNeeded, unknown }
}

// STUDYING ABROAD (owner, Round 11): the student's top-ten matches for which the data says study
// abroad helps or is often part of the route. The report offers the partner connection only when
// this is non-empty — the same rule the server checks (studyAbroadRouter).
export const abroadCareers = (ranked, details = {}, topN = 10) => (ranked || [])
    .slice(0, topN)
    .filter((entry) => details[entry.professionId] && details[entry.professionId].abroad)
    .map((entry) => ({ professionId: entry.professionId, profession: entry.profession, need: details[entry.professionId].abroad.need }))

// STUDYING AND WORKING ABROAD ACROSS YOUR MATCHES (Round 19, owner): two plain lines from the top
// ten — where studying abroad helps (data/abroad.json) and which careers travel well for work
// (data/abroad_work.json). A line is shown only when it names something.
export const abroadLines = (ranked, details = {}, topN = 10) => {
    const top = (ranked || []).slice(0, topN).filter((entry) => details[entry.professionId])
    const study = abroadCareers(ranked, details, topN).map((career) => career.profession)
    const work = top.filter((entry) => {
        const going = details[entry.professionId].goingAbroad
        return going && going.portability === "travels_well"
    }).map((entry) => entry.profession)
    return { study, work }
}
