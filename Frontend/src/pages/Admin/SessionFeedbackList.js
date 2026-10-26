import { useState, useEffect, useCallback } from "react"
import { Table, Button, Checkbox, Input, Modal, Radio, message } from "antd"
import dayjs from "dayjs"
import { getMentorFeedbackForAdmin, resolveMentorReportForAdmin } from "../../apiCall/mentorSessionsApi"
import StudentSearch, { matchesStudent } from "./StudentSearch"

// MENTOR SESSION FEEDBACK (owner, Rounds 28 and 34): students' reports about their mentor (open first) and
// their feedback after a session, with each mentor's average out of 10. A report changes the student's
// ticket the moment it's sent (a refund asked for, or a new mentor on the way); here the admin records
// the verdict:
//   Upheld        — a strike on the mentor, no payout for that session, no automatic Tier 2
//   Pause mentor  — they are not offered to anyone until un-paused (Mentors tab)
//   By mistake    — Round 35 (owner): closed with nothing against the mentor; the student's ticket goes back
//                   to how it was, if nothing has happened to it since (no refund sent, no new mentor matched)
// A refund the student asked for is sent from their ticket (Mentor matches → Close or change → Refund).
const REASON_NAMES = { inappropriate: "Behaved inappropriately", privacy: "Didn't respect privacy", no_show: "Didn't turn up / stopped replying", other: "Something else" }
const OUTCOME_NAMES = { new_mentor: "A new mentor", refund: "A refund", no_action: "No action", mistake: "Closed — by mistake" }
const COVERED_NAMES = { overview: "profession", journey: "journey", relate: "relating", success: "success needs", resources: "resources" }
const QUALITY_NAMES = { empathetic: "empathetic", knowledgeable: "knowledgeable", clear: "clear", clarity: "gave clarity", recommend: "recommend" }

function SessionFeedbackList() {
    const [data, setData] = useState({ reviews: [], reports: [], averages: [] })
    const [search, setSearch] = useState("")   // Round 31: name or email
    const [loading, setLoading] = useState(false)

    const fetchAll = useCallback(async () => {
        setLoading(true)
        const response = await getMentorFeedbackForAdmin()
        setLoading(false)
        if (!response || response.data.success === false) {
            message.error("Failed to fetch mentor feedback")
            return
        }
        setData(response.data.data)
    }, [])

    useEffect(() => { fetchAll() }, [fetchAll])

    const resolve = (record) => {
        let verdict = "not_upheld"   // upheld | not_upheld | mistake
        let pauseMentor = false
        let adminNote = ""
        Modal.confirm({
            title: `Resolve the report about ${record.mentorName || "this mentor"}`,
            content: (
                <div>
                    <p>The student asked for: <strong>{OUTCOME_NAMES[record.wants]}</strong> — their ticket has already changed.{record.wants === "refund" ? " Send the refund from their ticket on Mentor matches." : ""}</p>
                    <Radio.Group className="report-verdict" defaultValue="not_upheld" onChange={(event) => { verdict = event.target.value }}>
                        <Radio value="upheld">Upheld — it's true (a strike, and no payout for that session)</Radio>
                        <Radio value="not_upheld">Not upheld — the student's ticket stays as it is now</Radio>
                        <Radio value="mistake">The report was by mistake — close it; the mentor stays as they are and the ticket goes back</Radio>
                    </Radio.Group>
                    <p><Checkbox onChange={(event) => { pauseMentor = event.target.checked }}>Pause this mentor (no new students) — not with "by mistake"</Checkbox></p>
                    <Input.TextArea rows={3} placeholder="A note for the student (emailed)" onChange={(event) => { adminNote = event.target.value }} />
                </div>
            ),
            okText: "Resolve",
            onOk: async () => {
                const response = await resolveMentorReportForAdmin(record._id, verdict === "mistake" ? { mistake: true, adminNote } : { upheld: verdict === "upheld", pauseMentor, adminNote })
                if (!response || response.data.success === false) {
                    message.error(response?.data?.message || "Could not resolve")
                    return
                }
                message.success(response.data.message)
                fetchAll()
            },
        })
    }

    const reportColumns = [
        { title: "Name", fixed: "left", width: 140, render: (_, record) => record.user?.name || "—" },
        { title: "Email", fixed: "left", width: 200, render: (_, record) => record.user?.email || "deleted" },
        { title: "Date", dataIndex: "createdAt", render: (value) => dayjs(value).format("DD MMM YYYY") },
        { title: "Mentor", dataIndex: "mentorName", render: (value) => value || "—" },
        { title: "What happened", render: (_, record) => `${REASON_NAMES[record.reason]}${record.note ? ` — ${record.note}` : ""}` },
        { title: "Wants", dataIndex: "wants", render: (value) => OUTCOME_NAMES[value] },
        { title: "Status", render: (_, record) => (record.status === "open" ? "Open" : record.outcome === "mistake" ? "Closed · by mistake" : `Resolved${record.upheld ? " · upheld" : " · not upheld"}${record.mentorPaused ? " · mentor paused" : ""}`) },
        { title: "Action", render: (_, record) => (record.status === "open" ? <Button type="primary" size="small" onClick={() => resolve(record)}>Resolve</Button> : null) },
    ]

    const reviewColumns = [
        { title: "Name", fixed: "left", width: 140, render: (_, record) => record.user?.name || "—" },
        { title: "Email", fixed: "left", width: 200, render: (_, record) => record.user?.email || "deleted" },
        { title: "Date", dataIndex: "createdAt", render: (value) => dayjs(value).format("DD MMM YYYY") },
        { title: "Mentor", dataIndex: "mentorName", render: (value) => value || "—" },
        { title: "Career — role", render: (_, record) => `${record.profession || "—"}${record.jobRole ? ` — ${record.jobRole}` : ""}` },
        { title: "Rating", dataIndex: "rating", render: (value) => `${value}/10` },
        { title: "Covered", render: (_, record) => (record.covered ? Object.entries(record.covered).map(([key, value]) => `${COVERED_NAMES[key] || key}: ${value}`).join(" · ") : "—") },
        { title: "Mentor was", render: (_, record) => (record.qualities ? Object.entries(record.qualities).map(([key, value]) => `${QUALITY_NAMES[key] || key}: ${value}`).join(" · ") : `helped decide: ${record.helpedDecide || "—"} · recommend: ${record.wouldRecommend || "—"}`) },
        { title: "Within limits", render: (_, record) => (record.withinLimits === "no" ? <strong>NO</strong> : record.withinLimits || "—") },
        { title: "Concern / comment", render: (_, record) => record.concern || record.comment || "—" },
    ]

    const averageColumns = [
        { title: "Mentor", dataIndex: "mentorName", render: (value) => value || "—" },
        { title: "Average", dataIndex: "average", render: (value) => `${value}/10` },
        { title: "Reviews", dataIndex: "count" },
        { title: "Would recommend", render: (_, record) => `${record.recommend} of ${record.count}` },
    ]

    return (
        <div>
            <StudentSearch value={search} onChange={setSearch} />
            <h3>Reports about mentors</h3>
            <Table rowKey="_id" loading={loading} columns={reportColumns} dataSource={data.reports.filter((row) => matchesStudent(row.user, search))} scroll={{ x: "max-content" }} />
            <h3>Each mentor's rating</h3>
            <Table rowKey={(record) => String(record.mentor)} loading={loading} columns={averageColumns} dataSource={data.averages} pagination={false} scroll={{ x: "max-content" }} />
            <h3>Reviews after sessions</h3>
            <Table rowKey="_id" loading={loading} columns={reviewColumns} dataSource={data.reviews.filter((row) => matchesStudent(row.user, search))} scroll={{ x: "max-content" }} />
        </div>
    )
}

export default SessionFeedbackList
