// THE JOB QUEUE, kept in MongoDB (Round 22). It replaced BullMQ on Redis, and the reason is worth
// keeping: a BullMQ queue with a schedule always holds a delayed "next run", and while one exists an
// idle worker re-asks Redis every 10 seconds instead of once a minute. That one worker used up
// Upstash's free 500k commands a month before a single student had arrived, and every Submit, "Try
// again" and "Update my report" then failed. Atlas, which we already use, has no command quota.
//
// WHAT IT KEEPS DOING, which is why there is a queue at all:
//   1. the request returns at once; the minute or two of grading and matching happens in the background
//   2. a failed attempt is retried after a pause that doubles each time
//   3. a job a worker was holding when the server restarted (every redeploy) is picked up again
//   4. ONE JOB PER STUDENT at a time — a double-tap on Submit queues one job, not two racing writes.
//      A job that has FINISHED does not block the next one: the guard is `activeKey`, which is the key
//      only while a job is waiting or active and "<key>#<id>" once it is done (the BullMQ version once
//      silently swallowed every resubmit for 24 hours because a finished job's id still counted)
//   5. the calendar jobs — a waiting row per schedule with its due time; when it finishes the next is
//      queued. One that fell due while the free server slept runs as soon as it wakes.
//
// A job STARTS AT ONCE when it is queued in this process (the workers run inside the web service): the
// queue nudges its worker directly. The poll every POLL_MS is only for retries, calendar jobs and a
// job another process queued.
//
// The handler gets BullMQ's job shape — { id, name, data, attemptsMade, opts: { attempts } } — and the
// worker emits "completed" (job, result) and "failed" (job, error) on every failed attempt, as BullMQ
// did, so the workers' own logic did not change.

const { EventEmitter } = require("events")
const { Types: { ObjectId } } = require("mongoose")

const POLL_MS = Number(process.env.JOB_POLL_MS) || 10000
const LOCK_MS = 5 * 60 * 1000        // a worker holds a job this long, renewed every half while it runs
const MAX_STALLS = 3                 // restarted mid-run this many times → given up, like a failed final attempt

// ── pure, for the fixtures ───────────────────────────────────────────────────────────────────────

// the pause before retry n (1, 2, 3…): the first pause, doubled each time
const backoffFor = (backoffMs, attemptsMade) => (backoffMs > 0 ? backoffMs * 2 ** Math.max(0, attemptsMade - 1) : 0)

// the guard a job carries once it no longer holds its student's place — unique, so it never collides
const releasedKey = (row) => `${row.key || "none"}#${row._id}`

// What a failed attempt writes. `final` forces it to be the last (a job stalled too often).
const failureUpdate = (row, error, now = new Date(), final = false) => {
    const attemptsMade = final ? Math.max(row.attempts || 1, (row.attemptsMade || 0) + 1) : (row.attemptsMade || 0) + 1
    const lastError = String((error && error.message) || error).slice(0, 1000)
    if (attemptsMade < (row.attempts || 1)) {
        return { attemptsMade, retry: true, update: { $set: { status: "waiting", attemptsMade, lastError, lockedUntil: null, runAt: new Date(now.getTime() + backoffFor(row.backoffMs || 0, attemptsMade)) } } }
    }
    return { attemptsMade, retry: false, update: { $set: { status: "failed", attemptsMade, lastError, lockedUntil: null, finishedAt: now, activeKey: releasedKey(row) } } }
}

const asJob = (row, attemptsMade = row.attemptsMade || 0) => ({
    id: String(row._id),
    name: row.name,
    data: row.data || {},
    attemptsMade,
    opts: { attempts: row.attempts || 1 },
})

// ── the calendar: five-field cron patterns, read in IST ──────────────────────────────────────────
//
// Only what the schedules use: "*", "*/n", "n", "a-b" and "a,b". India has no daylight saving, so IST
// is UTC + 5:30 all year and needs no time-zone library.
const IST_OFFSET_MS = 330 * 60 * 1000

const fieldMatches = (field, value) => field.split(",").some((part) => {
    if (part === "*") return true
    if (part.startsWith("*/")) return value % Number(part.slice(2)) === 0
    if (part.includes("-")) {
        const [low, high] = part.split("-").map(Number)
        return value >= low && value <= high
    }
    return Number(part) === value
})

// the first minute strictly after `after` that the pattern names
const nextRun = (pattern, after = new Date()) => {
    const [minute, hour, dayOfMonth, month, dayOfWeek] = pattern.trim().split(/\s+/)
    let time = Math.floor(after.getTime() / 60000) * 60000 + 60000
    const limit = time + 400 * 24 * 3600 * 1000
    for (; time < limit; time += 60000) {
        const ist = new Date(time + IST_OFFSET_MS)
        if (!fieldMatches(minute, ist.getUTCMinutes()) || !fieldMatches(hour, ist.getUTCHours()) || !fieldMatches(month, ist.getUTCMonth() + 1)) continue
        // cron's own rule: when both day fields are set, either one is enough
        const domOk = fieldMatches(dayOfMonth, ist.getUTCDate())
        const dowOk = fieldMatches(dayOfWeek, ist.getUTCDay())
        const dayOk = dayOfMonth !== "*" && dayOfWeek !== "*" ? domOk || dowOk : domOk && dowOk
        if (dayOk) return new Date(time)
    }
    throw new Error(`the pattern "${pattern}" names no time in the next 400 days`)
}

// ── the queue, over a Job model (injected so the fixtures can pass a stand-in) ───────────────────

const createJobQueue = (Job) => {
    const nudges = new EventEmitter()
    nudges.setMaxListeners(0)

    // { key } makes it one at a time: while a job with that key is waiting or active, it is handed back
    // instead of a second one being queued
    const enqueue = async (queue, name, data = {}, { key = null, repeat = null, attempts = 1, backoffMs = 0, runAt = new Date() } = {}) => {
        if (key) {
            const existing = await Job.findOne({ queue, activeKey: key }).lean()
            if (existing) return existing
        }
        try {
            const _id = new ObjectId()
            const created = await Job.create({ _id, queue, name, data, key, repeat, activeKey: key || releasedKey({ _id }), attempts, backoffMs, runAt })
            nudges.emit(queue)
            return typeof created.toObject === "function" ? created.toObject() : created
        } catch (error) {
            // two requests raced past the check above; the one that got in is the job
            if (key && error && error.code === 11000) return Job.findOne({ queue, activeKey: key }).lean()
            throw error
        }
    }

    // A calendar job: one waiting row per schedule, due at the pattern's next time. An overdue row is
    // left alone — it runs now (the server slept through it). A row due later than the pattern now says
    // (the pattern changed) is moved.
    const schedule = async (queue, { name, pattern }, options = {}) => {
        const key = `schedule:${name}`
        const due = nextRun(pattern)
        const row = await enqueue(queue, name, {}, { ...options, key, repeat: pattern, runAt: due })
        if (row.status === "waiting" && row.repeat !== pattern && new Date(row.runAt).getTime() > Date.now()) {
            await Job.updateOne({ _id: row._id, status: "waiting" }, { $set: { runAt: due, repeat: pattern } })
        }
        return row
    }

    const createWorker = (queue, handler, { concurrency = 1, pollMs = POLL_MS, lockMs = LOCK_MS } = {}) => {
        const events = new EventEmitter()
        const inFlight = new Set()
        let running = 0
        let polling = false
        let closing = false

        // a waiting job that is due, or an active one whose worker stopped renewing it (a restart)
        const claim = async () => {
            const now = new Date()
            const lockedUntil = new Date(now.getTime() + lockMs)
            const due = await Job.findOneAndUpdate(
                { queue, status: "waiting", runAt: { $lte: now } },
                { $set: { status: "active", lockedUntil } },
                { sort: { runAt: 1 }, returnDocument: "after" }
            ).lean()
            if (due) return due
            return Job.findOneAndUpdate(
                { queue, status: "active", lockedUntil: { $lt: now } },
                { $set: { lockedUntil }, $inc: { stalls: 1 } },
                { sort: { lockedUntil: 1 }, returnDocument: "after" }
            ).lean()
        }

        // a calendar job queues its next run however this one ended
        const queueNext = async (row) => {
            if (!row.repeat) return
            try {
                await enqueue(queue, row.name, {}, { key: row.key, repeat: row.repeat, attempts: row.attempts, backoffMs: row.backoffMs, runAt: nextRun(row.repeat) })
            } catch (error) {
                console.error(`${queue} ${row.name}: could not queue its next run — ${error.message}`)
            }
        }

        const fail = async (row, error, final = false) => {
            const outcome = failureUpdate(row, error, new Date(), final)
            await Job.updateOne({ _id: row._id }, outcome.update)
            if (!outcome.retry) await queueNext(row)
            events.emit("failed", asJob(row, outcome.attemptsMade), error)
        }

        const run = async (row) => {
            if ((row.stalls || 0) > MAX_STALLS) {
                return fail(row, new Error(`stopped ${row.stalls} times mid-run (a restart each time) — giving up`), true)
            }
            const renew = setInterval(() => {
                Job.updateOne({ _id: row._id, status: "active" }, { $set: { lockedUntil: new Date(Date.now() + lockMs) } }).catch(() => null)
            }, Math.max(1000, lockMs / 2))
            try {
                const result = await handler(asJob(row))
                await Job.updateOne(
                    { _id: row._id },
                    { $set: { status: "completed", result: result === undefined ? null : result, finishedAt: new Date(), lockedUntil: null, activeKey: releasedKey(row) } }
                )
                await queueNext(row)
                events.emit("completed", asJob(row), result)
            } catch (error) {
                await fail(row, error)
            } finally {
                clearInterval(renew)
            }
        }

        const tick = async () => {
            if (polling || closing) return
            polling = true
            try {
                while (!closing && running < concurrency) {
                    const row = await claim()
                    if (!row) break
                    running += 1
                    const work = run(row)
                        .catch((error) => console.error(`${queue} ${row.name}: ${error.message}`))
                        .finally(() => {
                            running -= 1
                            inFlight.delete(work)
                            if (!closing) setImmediate(tick)
                        })
                    inFlight.add(work)
                }
            } catch (error) {
                console.warn(`${queue}: could not check for jobs — ${error.message}`)
            }
            polling = false
        }

        const onNudge = () => { tick() }
        nudges.on(queue, onNudge)
        const timer = setInterval(tick, pollMs)
        tick()

        return {
            on: (event, listener) => { events.on(event, listener); return undefined },
            // stop taking jobs and let the ones in hand finish (server.js awaits this on SIGTERM)
            close: async () => {
                closing = true
                clearInterval(timer)
                nudges.off(queue, onNudge)
                await Promise.all([...inFlight])
            },
        }
    }

    // the admin's queue line: per queue, how many wait, run and failed this week, and how long the
    // oldest due job has waited (a worker that is not running shows up here as a growing number)
    const health = async (queues) => {
        const now = Date.now()
        const weekAgo = new Date(now - 7 * 24 * 3600 * 1000)
        return Promise.all(queues.map(async (queue) => {
            const [waiting, active, failed, oldest] = await Promise.all([
                Job.countDocuments({ queue, status: "waiting", runAt: { $lte: new Date(now) } }),
                Job.countDocuments({ queue, status: "active" }),
                Job.countDocuments({ queue, status: "failed", finishedAt: { $gte: weekAgo } }),
                Job.findOne({ queue, status: "waiting", runAt: { $lte: new Date(now) } }).sort({ runAt: 1 }).select("runAt").lean(),
            ])
            return { queue, waiting, active, failed, oldestWaitingSeconds: oldest ? Math.round((now - new Date(oldest.runAt).getTime()) / 1000) : 0 }
        }))
    }

    return { enqueue, schedule, createWorker, health }
}

// The real queue, built on first use so requiring this file never needs a database.
let real = null
const jobQueue = () => {
    if (!real) real = createJobQueue(require("../model/jobsModel"))
    return real
}

module.exports = { jobQueue, createJobQueue, backoffFor, failureUpdate, releasedKey, asJob, nextRun, fieldMatches, POLL_MS, LOCK_MS, MAX_STALLS }
