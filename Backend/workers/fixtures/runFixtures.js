const fixtures = require("./fixtures")

// Runs every pipeline fixture and reports pass/fail per case.
//   node Backend/workers/fixtures/runFixtures.js
//
// Offline — no database, no network, no API key. The report fixtures inject a stubbed client, so
// the one part of this pipeline that talks to a model is never actually called. CI-ready.

const readPath = (object, path) =>
    path.split(".").reduce((value, key) => (value === undefined || value === null ? undefined : value[key]), object)

const describe = (value) => (value === undefined ? "undefined" : JSON.stringify(value))

let passed = 0
const failures = []

// Async-aware: the cache fixtures have to await the resolver, which is the one part of the
// pipeline whose whole job is to NOT make a network call. Testing that it doesn't requires
// actually running it.
const run = async () => {
for (const fixture of fixtures) {
    const problems = []
    let result

    try {
        result = await fixture.run()
    } catch (error) {
        problems.push(`threw: ${error.message}`)
    }

    if (problems.length === 0) {
        const expected = fixture.expect

        if (expected !== undefined) {
            // A plain expected value compares whole; an object of paths compares field by field,
            // so a fixture can pin three numbers without restating a hundred-key result.
            const isPathMap = expected !== null && typeof expected === "object" && !Array.isArray(expected)

            if (isPathMap) {
                Object.entries(expected).forEach(([path, value]) => {
                    const actual = readPath(result, path)
                    if (JSON.stringify(actual) !== JSON.stringify(value)) {
                        problems.push(`${path}: expected ${describe(value)}, got ${describe(actual)}`)
                    }
                })
            } else if (JSON.stringify(result) !== JSON.stringify(expected)) {
                problems.push(`expected ${describe(expected)}, got ${describe(result)}`)
            }
        }

        if (fixture.assert) {
            const message = await fixture.assert(result)
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
}

console.log(`\n${passed}/${fixtures.length} fixtures passed.`)

if (failures.length > 0) process.exitCode = 1
}

run()
