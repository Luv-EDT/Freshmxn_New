import { useState, useEffect, useCallback } from "react"
import { Table, Button, message } from "antd"
import dayjs from "dayjs"
import { getAllFollowUpsForAdmin, runHousekeepingForAdmin } from "../../apiCall/followUpsApi"

// The 6- and 12-month follow-ups (Round 10): who was asked, who answered, and what they said. The
// daily scan runs by itself; "Run the scan now" is for checking it after a deploy.
const DOING = { studying: "Studying", working: "Working", preparing_for_exam: "Preparing for an exam", between_things: "Between things", other: "Something else" }

function FollowUpsList({ dataVersion }) {
    const [data, setData] = useState({ followUps: [], summary: { sent: 0, answered: 0 } })
    const [loading, setLoading] = useState(false)

    const fetchAll = useCallback(async () => {
        try {
            setLoading(true)
            const response = await getAllFollowUpsForAdmin()
            setData(response.data.data)
        } catch (error) {
            message.error("Failed to fetch follow-ups")
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { fetchAll() }, [dataVersion, fetchAll])

    const runScan = async () => {
        try {
            const response = await runHousekeepingForAdmin("followup_scan")
            message.success(response.data.message)
        } catch (error) {
            message.error(error.response?.data?.message || "Could not start the scan")
        }
    }

    const columns = [
        { title: "Sent", dataIndex: "sentAt", render: (value) => (value ? dayjs(value).format("DD MMM YYYY") : "—") },
        { title: "Student", render: (_, record) => (record.user ? `${record.user.name} (${record.user.email})` : "—") },
        { title: "Wave", render: (_, record) => `${record.wave} months` },
        { title: "Answered", render: (_, record) => (record.respondedAt ? dayjs(record.respondedAt).format("DD MMM YYYY") : "Not yet") },
        { title: "Doing now", render: (_, record) => DOING[record.answers?.doingNow] || "—" },
        { title: "Career", render: (_, record) => record.answers?.careerId || record.answers?.careerText || "—" },
        { title: "Followed a match", render: (_, record) => record.answers?.followedMatch || "—" },
        { title: "Satisfaction", render: (_, record) => record.answers?.satisfaction || "—" },
        { title: "Note", render: (_, record) => record.answers?.note || "—" },
    ]

    return (
        <div>
            <p>
                {data.summary.sent} asked · {data.summary.answered} answered{" "}
                <Button onClick={runScan}>Run the scan now</Button> <Button onClick={fetchAll}>Refresh</Button>
            </p>
            <Table rowKey="_id" loading={loading} columns={columns} dataSource={data.followUps} scroll={{ x: "max-content" }} />
        </div>
    )
}

export default FollowUpsList
