// THE INDUSTRY LIST a student or mentor chooses from (Round 12) — the 38 NSDC sector skill councils
// and our 8 extension tags in data/industrial_sectors.json, with names a person would say. The file
// names councils ("Agriculture Skill Council of India"); a dropdown should say "Agriculture".

const sectors = require("../data/industrial_sectors.json")

// where stripping the council words is not enough
const READABLE = {
    BFSI: "Banking, Financial Services & Insurance",
    FICSI: "Food Processing",
    "IT-ITES": "IT & IT-enabled Services",
    IASC: "Instrumentation, Automation & Communication",
    MEPSC: "Management & Professional Services",
    SCMS: "Mining",
    SCGJ: "Green Jobs & Renewable Energy",
    SCPWD: "Disability Inclusion",
    RASCI: "Retail",
    IPSC: "Plumbing",
    IISSSC: "Iron & Steel",
    DWSSC: "Domestic Work",
    LSSSDC: "Life Sciences & Pharma",
}

const COUNCIL_WORDS = /\s*(Sector\s+)?Skills?\s+(Development\s+)?Council(\s+of\s+India)?(\s*\(.*\))?$|\s+Skills?\s+Initiative$/i

const readableName = (row) => READABLE[row.code] || String(row.name).replace(COUNCIL_WORDS, "").trim()

const INDUSTRIES = [
    ...(sectors.nsdc_sector_skill_councils || []),
    ...(sectors.extension_tags || []),
]
    .map((row) => ({ code: row.code, name: readableName(row) }))
    .sort((left, right) => left.name.localeCompare(right.name))

const industryByCode = new Map(INDUSTRIES.map((row) => [row.code, row]))

module.exports = { INDUSTRIES, industryByCode, readableName }
