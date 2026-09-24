// Read a profession's Baseline_Rating in a form a human can actually check.
//
//     node Backend/tools/showRatings.js software-developer fine-artist actuary
//     node Backend/tools/showRatings.js --review            only the ones needing a human
//     node Backend/tools/showRatings.js --spread            the widest disagreements, factor by factor
//
// Matches on any part of the id or the profession name, so "artist" finds Fine Artist.
//
// Each row shows the score, the weight and, for the newly rated factors, the three samples behind
// the average. A low spread means the anchors were unambiguous — NOT that the answer is right.
// Three passes by one model are correlated, so agreement is weaker evidence than it looks.

const fs = require("fs")
const path = require("path")

const DATA = path.join(__dirname, "..", "data")

const baseline = JSON.parse(fs.readFileSync(path.join(DATA, "baseline_rating.json"), "utf8"))
const factorsFile = JSON.parse(fs.readFileSync(path.join(DATA, "psychometric_factors.json"), "utf8"))

const args = process.argv.slice(2)
const queries = args.filter((arg) => !arg.startsWith("--"))

const printRating = (rating) => {
    console.log(`\n${"═".repeat(78)}`)
    console.log(`${rating.profession}   (${rating.id})`)
    console.log(`sector ${rating.professional_sector}  ·  drivingReasons: ${rating.drivingReasons.join(", ")}`)
    console.log(`review_status ${rating.review_status}${rating.admin_review.required ? `  ·  NEEDS REVIEW (${rating.admin_review.priority})` : ""}`)
    console.log("═".repeat(78))

    factorsFile.groups.forEach((group) => {
        console.log(`\n  ${group.group}`)

        group.factors.forEach((factor) => {
            const score = rating.factors[factor.slug]
            const weight = rating.weights[factor.slug]
            const variance = rating.sample_variance[factor.slug] || {}
            const samples = variance.origin && variance.origin.startsWith("rated")
                ? `  samples ${JSON.stringify(variance.samples)}${variance.spread > 2 ? "  ← WIDE" : ""}`
                : ""

            // A bar rather than a bare number: twenty-eight numbers in a column are unreadable and
            // the point of this script is that someone actually reads them.
            const bar = "█".repeat(Math.round(score)) + "·".repeat(10 - Math.round(score))

            console.log(`    ${factor.slug.padEnd(28)} ${String(score).padStart(5)}  ${bar}  w ${String(weight).padEnd(4)}${samples}`)
        })
    })

    if (rating.admin_review.required) console.log(`\n  ! ${rating.admin_review.reason}`)
}

if (args.includes("--spread")) {
    const rows = []

    baseline.ratings.forEach((rating) => {
        Object.entries(rating.sample_variance).forEach(([slug, variance]) => {
            if (variance.origin && variance.origin.startsWith("rated")) {
                rows.push({ profession: rating.profession, slug, spread: variance.spread, samples: variance.samples })
            }
        })
    })

    rows.sort((left, right) => right.spread - left.spread || left.profession.localeCompare(right.profession))

    console.log(`the 25 widest disagreements of ${rows.length} newly rated factor scores\n`)
    rows.slice(0, 25).forEach((row) => {
        console.log(`  ${String(row.spread).padStart(2)}  ${row.profession.padEnd(44)} ${row.slug.padEnd(28)} ${JSON.stringify(row.samples)}`)
    })

    const byFactor = {}
    rows.forEach((row) => {
        byFactor[row.slug] = byFactor[row.slug] || { total: 0, count: 0, wide: 0 }
        byFactor[row.slug].total += row.spread
        byFactor[row.slug].count += 1
        if (row.spread > 2) byFactor[row.slug].wide += 1
    })

    console.log("\nmean spread per factor — which anchors settle the question and which do not\n")
    Object.entries(byFactor)
        .sort((left, right) => right[1].total / right[1].count - left[1].total / left[1].count)
        .forEach(([slug, stats]) => {
            console.log(`  ${slug.padEnd(28)} mean ${(stats.total / stats.count).toFixed(2)}   over 2: ${stats.wide}`)
        })

    process.exit(0)
}

if (args.includes("--review")) {
    const flagged = baseline.ratings.filter((rating) => rating.admin_review.required)
    console.log(`${flagged.length} of ${baseline.ratings.length} professions need a human\n`)
    flagged.forEach((rating) => console.log(`  ${rating.admin_review.priority.padEnd(7)} ${rating.profession.padEnd(46)} ${rating.admin_review.reason.slice(0, 90)}`))
    process.exit(0)
}

if (queries.length === 0) {
    console.log("usage: node Backend/tools/showRatings.js <name or id> [...]   |   --review   |   --spread")
    process.exit(1)
}

queries.forEach((query) => {
    const needle = query.toLowerCase()
    const matches = baseline.ratings.filter((rating) => rating.id.includes(needle) || rating.profession.toLowerCase().includes(needle))

    if (matches.length === 0) {
        console.log(`\nno profession matches "${query}"`)
        return
    }

    matches.slice(0, 3).forEach(printRating)
    if (matches.length > 3) console.log(`\n… and ${matches.length - 3} more matching "${query}"`)
})
