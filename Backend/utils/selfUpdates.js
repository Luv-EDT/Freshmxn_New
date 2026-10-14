// A STUDENT'S OWN UPDATES ARE LIMITED (owner, Round 28). Once a report exists, the student can rebuild
// it from their own changes — a resubmitted assessment, saved Virtual Career Counselling answers, a
// changed stage or detail — at most SELF_UPDATE_LIMIT times. An update because WE changed how scoring
// or matching works never counts: those are always free.
//
// RETAKES WE ASK FOR ARE FREE TOO (owner, Round 29). When the admin grants a retake, the system offers
// one, or a student takes a new short story, the student's NEXT update is free (`freeUpdates`, at most
// 1 — Round 30: several retakes before one update still need only one update, so the credit never
// stacks), spent before any of the three. Every update is written to `updateLog` — the admin's
// Students tab and the bottom of the student's report page read it.
const SELF_UPDATE_LIMIT = 3

const selfUpdatesLeft = (user) => Math.max(0, SELF_UPDATE_LIMIT - ((user && user.selfUpdatesUsed) || 0))

const freeUpdatesLeft = (user) => Math.min(1, Math.max(0, (user && user.freeUpdates) || 0))

const updatesLeft = (user) => selfUpdatesLeft(user) + freeUpdatesLeft(user)

const LIMIT_REACHED = `You've used all ${SELF_UPDATE_LIMIT} updates from your own changes. Your answers are saved — WhatsApp us on 8882756287 if you need another update.`

const logEntry = (kind, via) => ({ $each: [{ at: new Date(), kind, via }], $slice: -50 })

// The pieces of a user update for one more update: a free one first, else one of the three. `kind`
// "system" (our version changed) uses neither and is only logged.
const updateSpend = (user, via, kind = "own") => {
    if (kind === "system") return { $push: { updateLog: logEntry("system", via) } }
    if (freeUpdatesLeft(user) > 0) return { $set: { freeUpdates: 0 }, $push: { updateLog: logEntry("free", via) } }
    return { $inc: { selfUpdatesUsed: 1 }, $push: { updateLog: logEntry("own", via) } }
}

// one update document from several pieces ({ $set }, { $push }, { $inc }…), operators merged
const mergeUpdates = (...parts) => parts.filter(Boolean).reduce((merged, part) => {
    Object.entries(part).forEach(([operator, fields]) => {
        merged[operator] = { ...(merged[operator] || {}), ...fields }
    })
    return merged
}, {})

// a retake we asked for: one free update, logged
const grantFreeUpdate = (userId, via) => {
    const User = require("../model/userModel")
    return User.updateOne({ _id: userId }, { $max: { freeUpdates: 1 }, $push: { updateLog: logEntry("granted", via) } })
}

module.exports = { SELF_UPDATE_LIMIT, selfUpdatesLeft, freeUpdatesLeft, updatesLeft, LIMIT_REACHED, updateSpend, mergeUpdates, grantFreeUpdate }
