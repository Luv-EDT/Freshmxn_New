const scoreProfile = require("../scoreProfile")
const fixtures = require("./fixtures")

// Runs every golden fixture and reports pass/fail per case.
//   node Backend/scoring/fixtures/runFixtures.js
//
// Pure and offline — no database, no network, no API key. The engine does no I/O, so there is
// nothing to stub and nothing to clean up afterwards.

const readPath = (object, path) =>
    path.split(".").reduce((value, key) => (value === undefined || value === null ? undefined : value[key]), object)

const describe = (value) => (value === undefined ? "undefined" : JSON.stringify(value))

let passed = 0
const failures = []

fixtures.forEach((fixture) => {
    const problems = []
    let profile = null

    try {
        profile = scoreProfile(fixture.input)
    } catch (error) {
        problems.push(`threw: ${error.message}`)
    }

    if (profile) {
        Object.entries(fixture.expect || {}).forEach(([path, expected]) => {
            const actual = readPath(profile, path)

            if (JSON.stringify(actual) !== JSON.stringify(expected)) {
                problems.push(`${path}: expected ${describe(expected)}, got ${describe(actual)}`)
            }
        })

        if (fixture.assert) {
            const message = fixture.assert(profile)
            if (message) problems.push(message)
        }
    }

    if (problems.length === 0) {
        passed += 1
        console.log(`PASS  ${fixture.name}`)
    } else {
        failures.push({ name: fixture.name, problems })
        console.log(`FAIL  ${fixture.name}`)
        problems.forEach((problem) => console.log(`        ${problem}`))
    }
})

// determinism: temperature 0 upstream only means anything if this half is reproducible too
const first = JSON.stringify(scoreProfile(fixtures[0].input))
const second = JSON.stringify(scoreProfile(fixtures[0].input))
const deterministic = first === second

console.log(`\n${deterministic ? "PASS" : "FAIL"}  determinism — same input scores identically twice`)
console.log(`\n${passed}/${fixtures.length} fixtures passed${deterministic ? "" : ", DETERMINISM BROKEN"}.`)

if (failures.length > 0 || !deterministic) {
    process.exitCode = 1
}
