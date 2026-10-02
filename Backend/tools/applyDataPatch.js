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
// Approved new careers in the patch are listed, not written. They need building by hand.

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

;(patch.newCareerDrafts || []).forEach((draft) => console.log(`to build by hand (${draft.as}): ${draft.title}`))

if (write && changed > 0) {
    fs.writeFileSync(FILE, `${JSON.stringify(taxonomy, null, 2)}\n`)
    console.log(`\n${changed} careers written to ALL-professions.json — run the fixtures, then commit`)
} else {
    console.log(`\n${changed} careers would change${write ? "" : " — add --write to apply"}`)
}
