// Delete accounts and everything stored for them (owner, Round 26) — the same deletion as the admin's
// "Delete account", for a list at once, plus the bot sign-ups.
//
//   node Backend/tools/deleteAccounts.js --emails a@x.com,b@y.com [--bots] [--write]
//
// --bots   adds every account that never paid and whose name fails the name rule (utils/nameRules.js:
//          random strings like "fciROfrXyMzFhEZHVTjKuROZ"), student or mentor sign-up alike — except a
//          mentor with a profile
// --write  actually deletes. Without it, a dry run: who would go, and how many rows each.
// Admin accounts are never deleted. Reads DB_URI from Backend/.env (or the environment).
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") })
const mongoose = require("mongoose")
const dns = require("dns")
const User = require("../model/userModel")
const Mentors = require("../model/mentorsModel")
const { deleteAccountData } = require("../utils/deleteAccount")
const { checkName } = require("../utils/nameRules")

// the same fallback as config/MongoDBCon.js: a dead 127.0.0.1 DNS server on Windows fails the
// mongodb+srv:// lookup with "querySrv ECONNREFUSED"
if (process.platform === "win32" && dns.getServers().every((server) => server.startsWith("127.") || server === "::1")) {
    dns.setServers(["1.1.1.1", "8.8.8.8"])
}

const argValue = (flag) => {
    const index = process.argv.indexOf(flag)
    return index > -1 ? process.argv[index + 1] || "" : null
}

const main = async () => {
    const emails = (argValue("--emails") || "").split(",").map((email) => email.trim().toLowerCase()).filter(Boolean)
    const bots = process.argv.includes("--bots")
    const write = process.argv.includes("--write")
    if (!process.env.DB_URI) throw new Error("DB_URI is not set")
    if (emails.length === 0 && !bots) throw new Error("Give --emails a,b,c and/or --bots")

    await mongoose.connect(process.env.DB_URI)
    const targets = new Map()

    for (const email of emails) {
        const user = await User.findOne({ email }).select("email name role paid").lean()
        if (!user) console.log(`not found: ${email}`)
        else targets.set(String(user._id), { user, why: "listed" })
    }
    if (bots) {
        // any role but admin — the bots sign up through the mentor form as well as the student one
        const unpaid = await User.find({ paid: { $ne: true }, role: { $ne: "admin" } }).select("email name role paid").lean()
        // a mentor who filled in a profile is a person, whatever their name looks like ("Luv_ad")
        const withProfile = new Set((await Mentors.find({}).select("user").lean()).map((row) => String(row.user)))
        unpaid.filter((user) => checkName(user.name) && !withProfile.has(String(user._id))).forEach((user) => {
            if (!targets.has(String(user._id))) targets.set(String(user._id), { user, why: "bot name" })
        })
    }

    console.log(`\n${write ? "DELETING" : "DRY RUN — nothing is deleted"}: ${targets.size} account(s)\n`)
    for (const { user, why } of targets.values()) {
        const result = await deleteAccountData(user._id, { dryRun: !write })
        if (result.error) { console.log(`skip ${user.email}: ${result.error}`); continue }
        const rows = Object.entries(result.counts).filter(([, count]) => count > 0).map(([name, count]) => `${name} ${count}`).join(", ")
        console.log(`${write ? "deleted" : "would delete"} ${user.email} (${user.name}, ${why}) — ${rows}`)
    }
    if (!write) console.log("\nRun again with --write to delete.")
    await mongoose.disconnect()
}

main().catch((error) => {
    console.error(error.message)
    process.exit(1)
})
