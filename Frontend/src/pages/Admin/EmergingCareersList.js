import { useState, useEffect, useCallback } from "react"
import { Table, Button, Segmented, Tag, message } from "antd"
import dayjs from "dayjs"
import { getScoutForAdmin, decideScoutForAdmin } from "../../apiCall/dataUpdatesApi"
import { runHousekeepingForAdmin } from "../../apiCall/followUpsApi"

// The weekly scout's watchlist (Round 10): job titles that match none of our careers, from the job
// board, from what students said they wanted, or both. Approving records the decision only — a
// combined career still needs its two sides in combined_careers.json, a new one a full record. Both
// are listed in the Data updates tab's "Export patch".
const SOURCE_TAGS = {
    job_board: <Tag color="blue">Job board</Tag>,
    student_aspirations: <Tag color="magenta">Students</Tag>,
    both: <Tag color="purple">Both</Tag>,
}
const KIND = { new: "Nothing close", between: "Between two careers" }

function EmergingCareersList() {
    const [status, setStatus] = useState("watch")
    const [candidates, setCandidates] = useState([])
    const [loading, setLoading] = useState(false)

    const fetchAll = useCallback(async () => {
        try {
            setLoading(true)
            const response = await getScoutForAdmin(status)
            setCandidates(response.data.data.candidates)
        } catch (error) {
            message.error("Failed to fetch the watchlist")
        } finally {
            setLoading(false)
        }
    }, [status])

    useEffect(() => { fetchAll() }, [fetchAll])

    const decide = async (id, decision) => {
        try {
            await decideScoutForAdmin(id, decision)
            message.success("Saved")
            fetchAll()
        } catch (error) {
            message.error(error.response?.data?.message || "Could not save")
        }
    }

    const runScout = async () => {
        try {
            const response = await runHousekeepingForAdmin("career_scout")
            message.success(response.data.message)
        } catch (error) {
            message.error(error.response?.data?.message || "Could not start the scout")
        }
    }

    const latest = (record) => {
        const counts = record.postingCounts || []
        return counts.length ? counts.map((row) => row.count).join(" → ") : "—"
    }

    const columns = [
        { title: "Title", dataIndex: "title", render: (value, record) => <span>{value}<br />{SOURCE_TAGS[record.source]}</span> },
        { title: "Kind", dataIndex: "kind", render: (value) => KIND[value] || value },
        { title: "Nearest careers", render: (_, record) => (record.nearest || []).map((near) => <div key={near.id}>{near.name} ({near.similarity})</div>) },
        { title: "Students", dataIndex: "aspirationCount" },
        { title: "Postings by week", render: (_, record) => latest(record) },
        { title: "What it is", render: (_, record) => record.assessment?.oneLiner || "—" },
        { title: "Pay (LPA)", render: (_, record) => record.assessment?.payLpa || "—" },
        { title: "AI-proof", render: (_, record) => record.assessment?.aiResilience || "—" },
        { title: "Growth", render: (_, record) => record.assessment?.growth || "—" },
        {
            title: "Sources",
            render: (_, record) => (record.assessment?.sources || []).slice(0, 3).map((source) => (
                <div key={source.url}><a href={source.url} target="_blank" rel="noreferrer">{source.title || source.url}</a></div>
            )),
        },
        { title: "Last seen", dataIndex: "lastSeenAt", render: (value) => (value ? dayjs(value).format("DD MMM YYYY") : "—") },
        {
            title: "Decide",
            render: (_, record) => (
                <span>
                    {record.status !== "approved_combined" && <Button size="small" onClick={() => decide(record._id, "approved_combined")}>Combined career</Button>}{" "}
                    {record.status !== "approved_new" && <Button size="small" onClick={() => decide(record._id, "approved_new")}>New career</Button>}{" "}
                    {record.status !== "dismissed" && <Button size="small" onClick={() => decide(record._id, "dismissed")}>Dismiss</Button>}{" "}
                    {record.status !== "watch" && <Button size="small" onClick={() => decide(record._id, "watch")}>Back to watch</Button>}
                </span>
            ),
        },
    ]

    return (
        <div>
            <p>
                <Button onClick={runScout}>Run the scout now</Button> <Button onClick={fetchAll}>Refresh</Button>
            </p>
            <Segmented
                value={status}
                onChange={setStatus}
                options={[{ label: "Watching", value: "watch" }, { label: "Combined", value: "approved_combined" }, { label: "New", value: "approved_new" }, { label: "Dismissed", value: "dismissed" }]}
            />
            <Table rowKey="_id" loading={loading} columns={columns} dataSource={candidates} scroll={{ x: "max-content" }} />
        </div>
    )
}

export default EmergingCareersList
