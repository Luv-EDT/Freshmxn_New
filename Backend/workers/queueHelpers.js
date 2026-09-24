// Shared by both workers, because getting this wrong is silent in both.
//
// THE BUG THIS EXISTS TO FIX. Both queues use the student's id as the job id, so that a double-tap
// on Submit produces one job instead of two racing writes to the same profile. That much is right.
// What was missed: BullMQ treats a job id as unique FOREVER, not just while the job is in flight —
// and `removeOnComplete` keeps finished jobs for 24 hours. So the second submission of the day was
// silently discarded. No error, no new job, nothing in any terminal, and the student's page still
// said "your report is being prepared" while their old report sat there unchanged.
//
// It cost real debugging time to find, because every individual piece looked healthy: the workers
// were alive, the queues were empty, the API returned 200, and a report existed.
//
// The fix keeps the guard and drops the accident. A job that is genuinely IN FLIGHT is still not
// duplicated — that was the whole point. A job that has FINISHED or FAILED is cleared out of the
// way first, so resubmitting actually re-runs. Redoing a module and asking for a fresh report is
// an ordinary thing a student will do, and it has to work more than once a day.

const dns = require("dns")

// ── the Windows loopback-DNS fault, again — but ioredis needs a different fix ────────────────────
//
// Some Windows machines hand Node a single DNS server of 127.0.0.1 that answers unreliably. Every
// few lookups fails with ENOTFOUND, so a hosted Redis appears to vanish and come back. config/
// MongoDBCon.js already works around this with dns.setServers(["1.1.1.1", "8.8.8.8"]).
//
// THAT WORKAROUND CANNOT HELP IOREDIS, and the reason is easy to miss. dns.setServers() only
// affects the dns.resolve*() family. It does NOT affect dns.lookup(), which delegates to the
// operating system's getaddrinfo — and dns.lookup() is what net.connect(), and therefore ioredis,
// actually uses. So Mongo was fixed (mongodb+srv:// goes through dns.resolveSrv) while Redis kept
// failing through the same broken resolver, which is exactly the split we were seeing: the database
// connected every time and Redis dropped every few minutes.
//
// The fix is to give ioredis its own lookup that goes through a Resolver pointed at public DNS,
// bypassing the faulty local one entirely. Applied ONLY on Windows machines showing the fault, so
// a correctly configured machine and every deployment target keep using the system resolver.
const publicResolver = new dns.Resolver()
publicResolver.setServers(["1.1.1.1", "8.8.8.8"])

const hasLoopbackOnlyDns = () => dns.getServers().every((server) => server.startsWith("127.") || server === "::1")

// net.connect calls lookup(hostname, options, callback); the callback wants (err, address, family).
const publicLookup = (hostname, options, callback) => {
    const done = typeof options === "function" ? options : callback

    publicResolver.resolve4(hostname, (error, addresses) => {
        if (error || !addresses || addresses.length === 0) {
            // Fall back to the system resolver rather than failing outright — a machine that cannot
            // reach 1.1.1.1 might still resolve locally, and half a chance beats none.
            return dns.lookup(hostname, { family: 4 }, done)
        }
        done(null, addresses[0], 4)
    })
}

// Merge into the options every Queue and Worker is built with.
const withDnsWorkaround = (options) => {
    if (process.platform !== "win32" || !hasLoopbackOnlyDns()) return options
    return { ...options, lookup: publicLookup }
}

const IN_FLIGHT = ["active", "waiting", "waiting-children", "delayed", "prioritized"]

const addOnce = async (queue, queueName, userId, options) => {
    const jobId = `${queueName}-${userId}`
    const existing = await queue.getJob(jobId)

    if (existing) {
        const state = await existing.getState()

        // Still running or still queued — this is the double-tap case the id was chosen for.
        // Hand back the job already in progress rather than starting a second one.
        if (IN_FLIGHT.includes(state)) return existing

        // Finished, failed, or otherwise done with. Clear it so the id is free to be reused.
        // A remove can still lose a race against a worker picking the job up in the same instant;
        // if it does, the job we wanted is running anyway, which is the outcome we were after.
        try {
            await existing.remove()
        } catch (error) {
            return existing
        }
    }

    return queue.add(queueName, { userId: String(userId) }, { jobId, ...options })
}

// ── connection noise ────────────────────────────────────────────────────────────────────────────
//
// ioredis reconnects by itself when the network drops, which is the behaviour we want — a worker
// should ride out a flaky connection rather than dying. What it also does is emit a fully
// stack-traced error on EVERY failed attempt, and against a hosted Redis on a patchy line that is
// several screens a minute.
//
// That noise is not harmless. A real line — "score_profile <id> — scored profile@1.0.0" — sat in
// the middle of forty ENOTFOUND traces and was invisible, and the conclusion drawn was that the
// worker had stopped working when in fact it had just succeeded. Logs that bury their own signal
// are worse than quiet ones.
//
// So: one compact line per connection problem, repeats collapsed, and an explicit note when the
// connection comes back. The error is still reported — it is just reported once.
const attachConnectionLogging = (emitter, label) => {
    let lastMessage = null
    let repeats = 0
    let down = false

    emitter.on("error", (error) => {
        const message = `${error.code || error.name || "error"}${error.hostname ? ` ${error.hostname}` : ""}`

        if (message === lastMessage) {
            repeats += 1
            // Only mark the milestones. A count on every single retry is the same flood in
            // shorter sentences.
            if (repeats === 5 || repeats % 25 === 0) {
                console.warn(`${label}: still cannot reach Redis (${message}) — ${repeats} attempts, retrying`)
            }
            return
        }

        lastMessage = message
        repeats = 1
        down = true
        console.warn(`${label}: Redis connection problem (${message}) — retrying automatically, jobs are not lost`)
    })

    emitter.on("ready", () => {
        if (down) console.log(`${label}: Redis connection restored`)
        down = false
        lastMessage = null
        repeats = 0
    })
}

module.exports = { addOnce, IN_FLIGHT, attachConnectionLogging, withDnsWorkaround }
