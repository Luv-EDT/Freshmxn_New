const Submission = require("../model/submissionsModel")
const User = require("../model/userModel")
const { notifyStudent } = require("../utils/statusEmails")

// THE SHORT STORY'S CLOCK, TOLD TO THE STUDENT (owner, Round 29) — an email and a notification each:
//     on opening        the story is open and disappears in an hour            (sent at once)
//     at 55 minutes     5 minutes left — read it once more
//     at 24 hours       the questions are open, until …
//     at 66 hours       the questions close in 6 hours
// Each later one is a job for its moment (housekeepingWorker.runLater), keyed by student, kind and
// the story's opening time, so it can never be sent twice — and a job whose story has since been
// answered or replaced by a new one does nothing.
const NOTICES = [
    { kind: "storyFiveMinutes", afterMs: 55 * 60 * 1000 },
    { kind: "storyRecallOpen", afterMs: 24 * 3600 * 1000 },
    { kind: "storyRecallClosing", afterMs: 66 * 3600 * 1000 },
]
const RECALL_CLOSES_MS = 72 * 3600 * 1000

const untilText = (openedAt) => new Date(new Date(openedAt).getTime() + RECALL_CLOSES_MS)
    .toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })

const scheduleStoryNotices = async (user, openedAt) => {
    const { runLater } = require("../workers/housekeepingWorker")
    notifyStudent(user, "storyOpened")
    const at = new Date(openedAt).getTime()
    for (const notice of NOTICES) {
        await runLater("story_notice", { userId: String(user._id), kind: notice.kind, openedAt: new Date(at).toISOString() }, {
            runAt: new Date(at + notice.afterMs),
            key: `story:${user._id}:${notice.kind}:${at}`,
        })
    }
}

// is this notice still worth sending? (pure — the fixtures drive it)
const stillDue = (block, kind, openedAt) => {
    if (!block || !block.storyOpenedAt) return false
    if (new Date(block.storyOpenedAt).getTime() !== new Date(openedAt).getTime()) return false   // a new story since
    if (block.submittedAt || block.expired) return false
    return NOTICES.some((notice) => notice.kind === kind)
}

const runStoryNotice = async ({ userId, kind, openedAt } = {}) => {
    const submission = await Submission.findOne({ user: userId }).select("psychometric.storyRecall").lean()
    const block = submission && submission.psychometric && submission.psychometric.storyRecall
    if (!stillDue(block, kind, openedAt)) return { skipped: "answered, replaced or unknown" }
    const user = await User.findById(userId).select("email").lean()
    await notifyStudent(user, kind, { until: untilText(openedAt) })
    return { sent: kind }
}

module.exports = { NOTICES, scheduleStoryNotices, runStoryNotice, stillDue, untilText }
