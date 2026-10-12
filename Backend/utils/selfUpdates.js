// A STUDENT'S OWN UPDATES ARE LIMITED (owner, Round 28). Once a report exists, the student can rebuild
// it from their own changes — a resubmitted assessment, saved Virtual Career Counselling answers, a
// changed stage or detail — at most SELF_UPDATE_LIMIT times. An update because WE changed how scoring
// or matching works never counts: those are always free.
const SELF_UPDATE_LIMIT = 3

const selfUpdatesLeft = (user) => Math.max(0, SELF_UPDATE_LIMIT - ((user && user.selfUpdatesUsed) || 0))

const LIMIT_REACHED = `You've used all ${SELF_UPDATE_LIMIT} updates from your own changes. Your answers are saved — WhatsApp us on 8882756287 if you need another update.`

module.exports = { SELF_UPDATE_LIMIT, selfUpdatesLeft, LIMIT_REACHED }
