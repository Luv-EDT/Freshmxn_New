import { useState, useEffect, useCallback } from "react"
import { Table, Button, Select, Checkbox, Input, Modal, message } from "antd"
import dayjs from "dayjs"
import { getMentorFeedbackForAdmin, resolveMentorReportForAdmin } from "../../apiCall/mentorSessionsApi"
import StudentSearch, { matchesStudent } from "./StudentSearch"

// MENTOR SESSION FEEDBACK (owner, Round 28): students' reports about their mentor (open first) and
// their reviews after a session, with each mentor's average out of 10.
//   Another mentor — back to matching on a new clock, this mentor never offered to them again
//   Refund         — recorded here; issue the money from the student's payments
//   Pause mentor   — they are not offered to anyone until approved again (Mentors tab)
const REASON_NAMES = { inappropriate: "Behaved inappropriately", privacy: "Didn't respect privacy", no_show: "Didn't turn up / stopped replying", other: "Something else" }
const OUTCOME_NAMES = { new_mentor: "Another mentor", refund: "Refund", no_action: "No action" }

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
        let outcome = record.wants
        let pauseMentor = false
        let adminNote = ""
        Modal.confirm({
            title: `Resolve the report about ${record.mentorName || "this mentor"}`,
            content: (
                <div>
                    <p>The student asked for: <strong>{OUTCOME_NAMES[record.wants]}</strong></p>
                    <Select defaultValue={outcome} style={{ width: "100%" }} options={Object.entries(OUTCOME_NAMES).map(([value, label]) => ({ value, label }))} onChange={(value) => { outcome = value }} />
                    <p><Checkbox onChange={(event) => { pauseMentor = event.target.checked }}>Pause this mentor (no new students)</Checkbox></p>
                    <Input.TextArea rows={3} placeholder="A note for the student (emailed)" onChange={(event) => { adminNote = event.target.value }} />
                </div>
            ),
            okText: "Resolve",
            onOk: async () => {
                const response = await resolveMentorReportForAdmin(record._id, { outcome, pauseMentor, adminNote })
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
        { title: "Date", dataIndex: "createdAt", render: (value) => dayjs(value).format("DD MMM YYYY") },
        { title: "Student", render: (_, record) => `${record.user?.name || "—"} (${record.user?.email || "deleted"})` },
        { title: "Mentor", dataIndex: "mentorName", render: (value) => value || "—" },
        { title: "What happened", render: (_, record) => `${REASON_NAMES[record.reason]}${record.note ? ` — ${record.note}` : ""}` },
        { title: "Wants", dataIndex: "wants", render: (value) => OUTCOME_NAMES[value] },
        { title: "Status", render: (_, record) => (record.status === "open" ? "Open" : `Resolved: ${OUTCOME_NAMES[record.outcome] || "—"}${record.mentorPaused ? " · mentor paused" : ""}`) },
        { title: "Action", render: (_, record) => (record.status === "open" ? <Button type="primary" size="small" onClick={() => resolve(record)}>Resolve</Button> : null) },
    ]

    const reviewColumns = [
        { title: "Date", dataIndex: "createdAt", render: (value) => dayjs(value).format("DD MMM YYYY") },
        { title: "Student", render: (_, record) => record.user?.email || "deleted" },
        { title: "Mentor", dataIndex: "mentorName", render: (value) => value || "—" },
        { title: "Career — role", render: (_, record) => `${record.profession || "—"}${record.jobRole ? ` — ${record.jobRole}` : ""}` },
        { title: "Rating", dataIndex: "rating", render: (value) => `${value}/10` },
        { title: "Helped decide", dataIndex: "helpedDecide" },
        { title: "Would recommend", dataIndex: "wouldRecommend" },
        { title: "Comment", dataIndex: "comment", render: (value) => value || "—" },
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
