import { useState, useEffect, useCallback } from "react"
import { Table, Button, Popconfirm, Segmented, Tag, message } from "antd"
import dayjs from "dayjs"
import { getAllIssuesForAdmin, grantRetakeForAdmin, dismissIssueForAdmin } from "../../apiCall/assessmentIssuesApi"

// Technical problems with a student's test (owner, Round 10). Written by the code that noticed them —
// a focus test that did not record, a number test abandoned part-way, a report that failed — or by
// the student pressing "Something went wrong with this test".
//
// "Allow one retake" moves the earlier attempt to the student's history (kept, never scored), opens
// the test again and emails the student. For a failed report it runs the report again instead.
// Retakes exist only for things that broke: a second attempt for a better score would make results
// unequal (practice effects), so "Dismiss" is the answer to anything else.
const KIND_LABELS = {
    sart_invalid: "Focus test did not record",
    digit_span_unfinished: "Number test abandoned",
    word_recall_unfinished: "Word test abandoned",
    reasoning_timeouts: "Reasoning items timed out",
    grading_failed: "Written answers not graded",
    report_failed: "Report failed",
    report_prose_failed: "Report saved without its summary",
    result_disputed: "Student disputes a test score",
    student_reported: "Student reported a problem",
}

function AssessmentIssuesList({ dataVersion, onDataChanged, onOpenCount }) {
    const [issues, setIssues] = useState([])
    const [loading, setLoading] = useState(false)
    const [statusFilter, setStatusFilter] = useState("open")   // open | retake_granted | dismissed | all

    const fetchIssues = useCallback(async () => {
        try {
            setLoading(true)
            const response = await getAllIssuesForAdmin()
            setIssues(response.data.data.issues)
            if (onOpenCount) onOpenCount(response.data.data.openCount)
        } catch (error) {
            message.error("Failed to fetch assessment issues")
        } finally {
            setLoading(false)
        }
    }, [onOpenCount])

    useEffect(() => {
        fetchIssues()
    }, [dataVersion, fetchIssues])

    const handleRetake = async (id) => {
        try {
            const response = await grantRetakeForAdmin(id)
            message.success(response.data.message)
            fetchIssues()
            onDataChanged()
        } catch (error) {
            message.error(error.response?.data?.message || "Failed to grant the retake")
        }
    }

    const handleDismiss = async (id) => {
        try {
            await dismissIssueForAdmin(id)
            message.success("Dismissed")
            fetchIssues()
        } catch (error) {
            message.error(error.response?.data?.message || "Failed to dismiss")
        }
    }

    const columns = [
        { title: "When", dataIndex: "createdAt", render: (value) => dayjs(value).format("DD MMM YYYY, HH:mm") },
        { title: "Student", render: (_, record) => (record.user ? `${record.user.name} (${record.user.email})` : "—") },
        { title: "Test", dataIndex: "moduleName" },
        { title: "What happened", render: (_, record) => KIND_LABELS[record.kind] || record.kind },
        { title: "Detail", dataIndex: "detail" },
        { title: "Raised by", dataIndex: "raisedBy" },
        { title: "Status", render: (_, record) => <Tag color={record.status === "open" ? "orange" : "default"}>{record.status}</Tag> },
        {
            title: "Action",
            render: (_, record) => record.status === "open" && (
                <>
                    {(record.retakeable || record.module === "report") && (
                        <Popconfirm
                            title={record.module === "report" ? "Run this student's report again?" : "Open this test again for one more attempt? The earlier attempt is kept but no longer counts."}
                            onConfirm={() => handleRetake(record._id)}
                        >
                            <Button type="primary" size="small">{record.module === "report" ? "Run report again" : "Allow one retake"}</Button>
                        </Popconfirm>
                    )}{" "}
                    <Popconfirm title="Dismiss — nothing to fix?" onConfirm={() => handleDismiss(record._id)}>
                        <Button size="small">Dismiss</Button>
                    </Popconfirm>
                </>
            ),
        },
    ]

    const visible = statusFilter === "all" ? issues : issues.filter((issue) => issue.status === statusFilter)

    return (
        <div>
            <Segmented options={["open", "retake_granted", "dismissed", "all"]} value={statusFilter} onChange={setStatusFilter} />{" "}
            <Button onClick={fetchIssues}>Refresh</Button>

            <Table rowKey="_id" loading={loading} columns={columns} dataSource={visible} scroll={{ x: "max-content" }} />
        </div>
    )
}

export default AssessmentIssuesList
