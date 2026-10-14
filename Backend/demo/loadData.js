// The taxonomy the matching engine reads, loaded once — the same four files, read the same way, as
// workers/generateReportWorker.js (its loadData is not exported, and requiring the worker would start its
// queue; the demo must not change it).
const fs = require("fs")
const path = require("path")

const DATA = path.join(__dirname, "..", "data")
const readData = (name) => JSON.parse(fs.readFileSync(path.join(DATA, name), "utf8"))

let cachedData = null

const loadData = () => {
    if (!cachedData) {
        cachedData = {
            professions: readData("ALL-professions.json"),
            baseline: readData("baseline_rating.json"),
            anchors: readData("factor_anchors.json"),
            professionEmbeddings: readData("profession_embeddings.json"),
        }
    }
    return cachedData
}

module.exports = { loadData }
