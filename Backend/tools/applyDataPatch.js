// Write the admin's approved data updates into ALL-professions.json, so they can be committed.
//
//     node Backend/tools/applyDataPatch.js path/to/patch.json          show what would change
//     node Backend/tools/applyDataPatch.js path/to/patch.json --write  change the file
//
// The patch is the "Export patch" download from the admin's Data updates tab (dataUpdatesRouter).
// Only demand and the two pay ranges are touched, the pay is marked checked with its sources, and
// mid_career_midpoint is recomputed — the same merge the career pages already show
// (utils/professionOverrides.applyOverride). After committing, the DB overrides can stay: they now
// say the same thing as the file.
//
// Accepted career drafts (Round 11) are written too: a new career into ALL-professions.json,
// baseline_rating.json and profession_embeddings.json; a combined one into combined_careers.json.
// And the study bot's approved exam and college changes, into exam_calendar.json and study_places.json,
// and its master's / study-abroad facts into ALL-professions.json, abroad.json and study_sources.json.

const fs = require("fs")
const path = require("path")
const { applyOverride } = require("../utils/professionOverrides")

const FILE = path.join(__dirname, "..", "data", "ALL-professions.json")

const [patchPath] = process.argv.slice(2).filter((arg) => !arg.startsWith("--"))
const write = process.argv.includes("--write")

if (!patchPath) {
    console.error("usage: node Backend/tools/applyDataPatch.js <patch.json> [--write]")
    process.exit(1)
}

const raw = JSON.parse(fs.readFileSync(patchPath, "utf8"))
const patch = raw.data && raw.data.patch ? raw.data.patch : raw
if (patch.kind !== "freshmxn-data-patch") {
    console.error("not a Freshmxn data patch")
    process.exit(1)
}

const taxonomy = JSON.parse(fs.readFileSync(FILE, "utf8"))
const index = new Map(taxonomy.professions.map((profession, position) => [profession.id, position]))

let changed = 0
patch.careers.forEach((career) => {
    const position = index.get(career.id)
    if (position === undefined) {
        console.log(`skip  ${career.id} — not in ALL-professions.json`)
        return
    }

    const before = taxonomy.professions[position]
    const after = applyOverride(before, {
        values: career.values,
        approvedAt: career.checkedOn,
        sources: (career.sources || []).map((url) => ({ url })),
    })

    const show = (record) => JSON.stringify({
        demand: record.demand_signal && record.demand_signal.india_demand,
        early: record.economics && record.economics.early_earnings_lpa,
        mid: record.economics && record.economics.mid_career_lpa,
    })
    if (show(before) === show(after)) return

    console.log(`${career.id}\n  was ${show(before)}\n  now ${show(after)}`)
    taxonomy.professions[position] = after
    changed += 1
})

// ── accepted career drafts (Round 11) ───────────────────────────────────────────────────────────
// A new career touches four files, each kept in its own formatting so the commit diff is only the
// new entry: ALL-professions.json (whole file, 2-space — it round-trips exactly), and an insertion
// at the end of baseline_rating.json, profession_embeddings.json and combined_careers.json.
const { sourceTextOf, contentHash } = require("../housekeeping/draftCareer")
const DATA = path.join(__dirname, "..", "data")
const readText = (name) => fs.readFileSync(path.join(DATA, name), "utf8")

// json.dumps style — `{"k": v, ...}`, `[a, b]` — the way profession_embeddings.json was written
const pyDumps = (value) => {
    if (Array.isArray(value)) return `[${value.map(pyDumps).join(", ")}]`
    if (value && typeof value === "object") return `{${Object.entries(value).map(([key, item]) => `${JSON.stringify(key)}: ${pyDumps(item)}`).join(", ")}}`
    return JSON.stringify(value)
}

const indent = (text, spaces) => text.split("\n").map((line) => " ".repeat(spaces) + line).join("\n")

const insertBefore = (text, closing, entry) => {
    const at = text.lastIndexOf(closing)
    if (at === -1) throw new Error(`could not find where to insert (${JSON.stringify(closing)})`)
    return `${text.slice(0, at)},\n${entry}${text.slice(at)}`
}

const newCareers = (patch.newCareers || []).filter((career) => !index.has(career.record.id))
const newCombined = patch.newCombined || []
;(patch.newCareers || []).filter((career) => index.has(career.record.id)).forEach((career) => console.log(`skip  ${career.record.id} — already in ALL-professions.json`))

let baselineText = readText("baseline_rating.json")
let embeddingsText = readText("profession_embeddings.json")
let combinedText = readText("combined_careers.json")

newCareers.forEach(({ record, rating, embedding }) => {
    if (!rating || !Array.isArray(embedding) || embedding.length === 0) {
        console.log(`skip  ${record.id} — the draft has no rating or no embedding yet`)
        return
    }
    const { profession_test, driving_reasons, ...clean } = record
    taxonomy.professions.push(clean)
    const sector = taxonomy.sectors.find((entry) => entry.professional_sector_id === clean.professional_sector_id)
    if (sector) sector.profession_count += 1

    baselineText = insertBefore(baselineText, "\n  ]\n}", indent(JSON.stringify(rating, null, 2), 4))
    const text = sourceTextOf(clean)
    const stored = JSON.parse(embeddingsText)
    embeddingsText = insertBefore(embeddingsText, "]}", pyDumps({
        id: clean.id,
        profession: clean.profession,
        professional_sector_id: clean.professional_sector_id,
        professional_sector: clean.professional_sector,
        model: stored.model,
        input_type: "document",
        dimensions: stored.dimensions,
        embedded_from: text,
        content_hash: contentHash(text),
        generated_on: new Date().toISOString().slice(0, 10),
        embedding,
    })).replace(",\n{", ", {")
    console.log(`new   ${clean.id} — ${clean.profession}`)
    changed += 1
})

newCombined.forEach((row) => {
    if (combinedText.includes(`"id": "${row.id}"`)) {
        console.log(`skip  ${row.id} — already in combined_careers.json`)
        return
    }
    combinedText = insertBefore(combinedText, "\n ]\n}", indent(JSON.stringify(row, null, 1), 2))
    console.log(`new   ${row.id} — ${row.name} (combined)`)
    changed += 1
})

// ── the study bot's approved changes (Round 11) ─────────────────────────────────────────────────
// Both files were written whole with JSON.stringify(…, null, 2), so they round-trip exactly and the
// commit diff is only what changed. An approved exam value marks the row checked on its approval day.
const examCalendar = JSON.parse(readText("exam_calendar.json"))
const studyPlaces = JSON.parse(readText("study_places.json"))
let studyChanged = 0

;(patch.exams || []).forEach((change) => {
    const exam = examCalendar.exams.find((row) => row.id === change.id)
    if (!exam) return console.log(`skip  exam ${change.id} — not in exam_calendar.json`)
    ;["usual_application_window", "usual_exam_month", "eligibility"].forEach((field) => {
        if (change.values && change.values[field] && change.values[field] !== exam[field]) {
            console.log(`exam  ${exam.id}.${field}\n  was ${JSON.stringify(exam[field])}\n  now ${JSON.stringify(change.values[field])}`)
            exam[field] = change.values[field]
            studyChanged += 1
        }
    })
    if (exam.usual_application_window && exam.usual_exam_month) {
        exam.status = "checked"
        exam.checked_on = change.checkedOn
        exam.checked_via = "admin-approved study bot proposal"
    }
})

;(patch.newExams || []).forEach((exam) => {
    if (examCalendar.exams.some((row) => row.id === exam.id)) return console.log(`skip  exam ${exam.id} — already in the calendar`)
    examCalendar.exams.push({
        id: exam.id, name: exam.name, conducting_body: exam.conducting_body, official_url: exam.official_url, level: exam.level,
        usual_application_window: null, usual_exam_month: null, eligibility: null, status: "draft", checked_on: null, checked_via: null,
    })
    console.log(`new   exam ${exam.id} — ${exam.name} (draft; map a career's spelling to it in "aliases" to show it)`)
    studyChanged += 1
})

;(patch.studyPlaces || []).forEach((change) => {
    const discipline = studyPlaces.disciplines.find((row) => row.id === change.discipline)
    if (!discipline) return console.log(`skip  study places ${change.discipline} — unknown discipline`)
    const { applyStudyOverride } = require("../utils/studyPlaces")
    const before = JSON.stringify(discipline.institutions)
    discipline.institutions = applyStudyOverride(discipline.institutions, change)
    if (JSON.stringify(discipline.institutions) !== before) {
        console.log(`study ${discipline.id} — ${discipline.institutions.length} institutions after the approved changes`)
        studyChanged += 1
    }
})
// master's need and studying abroad (Round 12): the value into its file, and what backed it into
// study_sources.json as "checked" on the approval date
const abroadFile = JSON.parse(readText("abroad.json"))
const sourcesFile = JSON.parse(readText("study_sources.json"))
let factsChanged = 0
;(patch.studyFacts || []).forEach((fact) => {
    const position = index.get(fact.id)
    if (position === undefined) return console.log(`skip  study fact ${fact.id} — not in ALL-professions.json`)
    const keys = (fact.sources || []).map((source, number) => {
        const key = `${fact.id}-${fact.checkedOn}-${number + 1}`
        sourcesFile.sources[key] = { url: source.url, title: source.title || source.url }
        return key
    })
    const row = sourcesFile.careers[fact.id] || {}
    const values = fact.values || {}
    if (values.after_undergrad && values.after_undergrad !== taxonomy.professions[position].after_undergrad) {
        console.log(`fact  ${fact.id}.after_undergrad\n  was ${taxonomy.professions[position].after_undergrad}\n  now ${values.after_undergrad}`)
        taxonomy.professions[position].after_undergrad = values.after_undergrad
        row.after_undergrad = { status: "checked", sources: keys, note: "Admin-approved study bot proposal", checkedOn: fact.checkedOn }
        factsChanged += 1
    }
    if (values.abroad && JSON.stringify(values.abroad) !== JSON.stringify(abroadFile.careers[fact.id])) {
        console.log(`fact  ${fact.id}.abroad\n  was ${JSON.stringify(abroadFile.careers[fact.id])}\n  now ${JSON.stringify(values.abroad)}`)
        abroadFile.careers[fact.id] = values.abroad
        row.abroad = { status: "checked", sources: keys, note: "Admin-approved study bot proposal", checkedOn: fact.checkedOn }
        factsChanged += 1
    }
    sourcesFile.careers[fact.id] = row
})
changed += studyChanged + factsChanged

// the counts each file carries about itself
const recount = () => {
    const professions = taxonomy.professions
    taxonomy.counts.professions = professions.length
    taxonomy.counts.job_roles = professions.reduce((sum, profession) => sum + (profession.job_roles || []).length, 0)
    taxonomy.counts.nuances = professions.reduce((sum, profession) => sum + (profession.nuances || []).length, 0)
    taxonomy.counts.ships = professions.filter((profession) => profession.filter !== false).length
    taxonomy.counts.fails_compensation_filter = professions.filter((profession) => profession.filter === false).length
    taxonomy.counts.admin_review_required = professions.filter((profession) => profession.admin_review && profession.admin_review.required).length
    const baseline = JSON.parse(baselineText)
    baselineText = baselineText
        .replace(/"rated": \d+/, `"rated": ${baseline.ratings.length}`)
        .replace(/"of_total": \d+/, `"of_total": ${professions.length}`)
    const stored = JSON.parse(embeddingsText)
    embeddingsText = embeddingsText.replace(/"count": \d+/, `"count": ${stored.embeddings.length}`)
}

;(patch.newCareerDrafts || []).forEach((draft) => console.log(`not finished yet (${draft.as}): ${draft.title} — accept its draft in Emerging careers first`))

if (write && changed > 0) {
    recount()
    // every file is parsed back before anything is written — a broken insertion writes nothing
    ;[baselineText, embeddingsText, combinedText].forEach((text) => JSON.parse(text))
    fs.writeFileSync(FILE, `${JSON.stringify(taxonomy, null, 2)}\n`)
    fs.writeFileSync(path.join(DATA, "baseline_rating.json"), baselineText)
    fs.writeFileSync(path.join(DATA, "profession_embeddings.json"), embeddingsText)
    fs.writeFileSync(path.join(DATA, "combined_careers.json"), combinedText)
    if (factsChanged > 0) {
        fs.writeFileSync(path.join(DATA, "abroad.json"), `${JSON.stringify(abroadFile, null, 2)}\n`)
        fs.writeFileSync(path.join(DATA, "study_sources.json"), `${JSON.stringify(sourcesFile, null, 2)}\n`)
    }
    if (studyChanged > 0) {
        fs.writeFileSync(path.join(DATA, "exam_calendar.json"), `${JSON.stringify(examCalendar, null, 2)}\n`)
        fs.writeFileSync(path.join(DATA, "study_places.json"), `${JSON.stringify(studyPlaces, null, 2)}\n`)
    }
    console.log(`\n${changed} changes written — run the fixtures and node Backend/tools/verifyEmbeddings.js, then commit`)
} else {
    console.log(`\n${changed} changes${write ? "" : " would be made — add --write to apply"}`)
}
