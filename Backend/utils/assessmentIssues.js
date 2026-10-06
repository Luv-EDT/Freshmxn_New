const AssessmentIssue = require("../model/assessmentIssuesModel")
const User = require("../model/userModel")
const { notifyAdmin, escapeHtml } = require("./mailer")

// Records a problem with a student's test. ONE OPEN ROW per student, module and kind: a worker that
// retries five times, or a student who presses the button twice, does not fill the admin's list
// with copies. Never throws — noticing a problem must never become a second problem.
//
// `notify` emails ADMIN_EMAIL too. Used for what needs a person soon: a report that failed for good,
// and anything a student raised themselves.
const raiseIssue = async ({ user, module, kind, detail = "", raisedBy = "system", status = "open", notify = false }) => {
    try {
        const existing = await AssessmentIssue.findOne({ user, module, kind, status: { $in: ["open", status] } })
        if (existing) {
            if (detail && !existing.detail.includes(detail)) {
                existing.detail = `${existing.detail}${existing.detail ? " · " : ""}${detail}`.slice(0, 2000)
                await existing.save()
            }
            return existing
        }

        const issue = await AssessmentIssue.create({ user, module, kind, detail: String(detail).slice(0, 2000), raisedBy, status })

        if (notify) {
            // the name and email beside the id, so the admin knows who it is without a lookup (Round 18)
            const student = await User.findById(user).select("name email").lean()
            const who = student ? `${escapeHtml(student.name || "—")} (${escapeHtml(student.email || "no email")}) · ` : ""
            await notifyAdmin(
                `Assessment issue: ${kind.replace(/_/g, " ")}${student && student.name ? ` — ${student.name}` : ""}`,
                `<p>Student ${who}<strong>${escapeHtml(String(user))}</strong>, module <strong>${escapeHtml(module)}</strong>.</p>
                 <p>${escapeHtml(detail) || "No detail given."}</p>
                 <p>Open the admin dashboard → Assessment issues to allow a retake or dismiss it.</p>`
            )
        }

        return issue
    } catch (error) {
        console.error(`Could not record assessment issue ${kind} for ${user}: ${error.message}`)
        return null
    }
}

module.exports = { raiseIssue }
