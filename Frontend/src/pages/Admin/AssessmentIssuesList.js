import { useState, useEffect, useCallback } from "react"
import { Table, Button, Popconfirm, Segmented, Tag, Modal, Select, Input, message } from "antd"
import dayjs from "dayjs"
import ReasonModal from "./ReasonModal"
import { getAllIssuesForAdmin, grantRetakeForAdmin, dismissIssueForAdmin, getSartRunForAdmin, offerRetakeToAllForAdmin } from "../../apiCall/assessmentIssuesApi"

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
    left_mid_test: "Left or refreshed mid-test",
    story_unmarked: "Story answers couldn't be marked",
    queue_unreachable: "Report could not be queued",
}

// The tests a retake can be offered for (Round 29: "Offer a retake to everyone who took it")
const OFFERABLE = [
    { value: "sartRaw", label: "Staying focused" },
    { value: "digitSpan", label: "Remembering numbers" },
    { value: "storyRecall", label: "A short story" },
    { value: "reasoning", label: "Reasoning" },
    { value: "wordRecall", label: "Word memory" },
]

// One focus run in plain lines (Round 29): pressing in a rhythm shows as many presses under 150 ms and
// most 3s pressed; a device fault shows as dropped trials, a low refresh rate or interruptions.
const runLines = (run) => [
    `${run.trials} trials · ${run.presses} presses · 3s pressed: ${run.threesPressed}`,
    `Average response: ${run.meanAllMs ?? "—"} ms counting every correct press · ${run.meanCleanMs ?? "—"} ms without those under 150 ms (the one the score uses)`,
    `Response times: under 150 ms ${run.rtSpread.under150} · 150–300 ${run.rtSpread.from150to300} · 300–600 ${run.rtSpread.from300to600} · over 600 ${run.rtSpread.over600}`,
    `Device: ${run.device || "not recorded"}${run.refreshHz ? ` · ${run.refreshHz} Hz` : ""} · dropped trials: ${run.droppedTrials ?? "not recorded"}`,
    `Presses from: ${run.input ? `keyboard ${run.input.keyboard || 0}, touch ${run.input.touch || 0}` : "not recorded (before Round 29)"}`,
    `Interruptions: ${run.interruptions ? `left the tab ${run.interruptions.hidden || 0}, window lost focus ${run.interruptions.blur || 0}, left full screen ${run.interruptions.fullscreenExits || 0}` : "none recorded"}`,
]

// THE JOB QUEUE IN ONE LINE (Round 22). A job due for over a minute that nothing has picked up means
// the workers are not running; anything failed this week is counted, and its reason is in the
// "Report failed" rows below.
const queueLine = (queues) => {
    if (!queues) return null
    if (queues.error) return `Job queue: not reachable — ${queues.error}`
    const stuck = queues.filter((row) => row.waiting > 0 && row.oldestWaitingSeconds > 60)
    const failed = queues.reduce((sum, row) => sum + row.failed, 0)
    const state = stuck.length > 0
        ? `not moving — ${stuck.map((row) => `${row.queue}: ${row.waiting} waiting, oldest ${Math.round(row.oldestWaitingSeconds / 60)} min`).join("; ")}`
        : "working"
    return `Job queue: ${state} · ${queues.reduce((sum, row) => sum + row.active, 0)} running · ${failed} failed this week`
}

function AssessmentIssuesList({ dataVersion, onDataChanged, onOpenCount }) {
    const [issues, setIssues] = useState([])
    const [queues, setQueues] = useState(null)
    const [loading, setLoading] = useState(false)
    const [statusFilter, setStatusFilter] = useState("open")   // open | retake_granted | dismissed | all
    const [dismissing, setDismissing] = useState(null)
    const [runs, setRuns] = useState(null)   // { student, list } for the "Run details" window
    const [offer, setOffer] = useState({ module: undefined, reason: "" })

    const fetchIssues = useCallback(async () => {
        try {
            setLoading(true)
            const response = await getAllIssuesForAdmin()
            setIssues(response.data.data.issues)
            setQueues(response.data.data.queues || null)
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

    // a student's own request needs a reason (it is emailed to them); a system-raised issue doesn't
    const handleDismiss = async (id, reason) => {
        try {
            const response = await dismissIssueForAdmin(id, { adminNote: reason })
            message.success(response.data.message)
            setDismissing(null)
            fetchIssues()
        } catch (error) {
            message.error(error.response?.data?.message || "Failed to dismiss")
        }
    }

    const showRuns = async (record) => {
        try {
            const response = await getSartRunForAdmin(record.user._id)
            setRuns({ student: record.user.name, list: response.data.data })
        } catch (error) {
            message.error(error.response?.data?.message || "Could not read the run")
        }
    }

    const handleOffer = async () => {
        try {
            const response = await offerRetakeToAllForAdmin(offer)
            message.success(response.data.message)
            setOffer({ module: undefined, reason: "" })
        } catch (error) {
            message.error(error.response?.data?.message || "Could not offer the retake")
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
            render: (_, record) => (
                <>
                    {record.module === "sartRaw" && record.user && <Button size="small" onClick={() => showRuns(record)}>Run details</Button>}{" "}
                    {record.status === "open" && (record.retakeable || record.module === "report") && (
                        <Popconfirm
                            title={record.module === "report" ? "Run this student's report again?" : "Open this test again for one more attempt? The earlier attempt is kept but no longer counts."}
                            onConfirm={() => handleRetake(record._id)}
                        >
                            <Button type="primary" size="small">{record.module === "report" ? "Run report again" : "Allow one retake"}</Button>
                        </Popconfirm>
                    )}{" "}
                    {record.status === "open" && (record.raisedBy === "student"
                        ? <Button size="small" onClick={() => setDismissing(record)}>Decline</Button>
                        : (
                            <Popconfirm title="Dismiss — nothing to fix?" onConfirm={() => handleDismiss(record._id)}>
                                <Button size="small">Dismiss</Button>
                            </Popconfirm>
                        ))}
                </>
            ),
        },
    ]

    const visible = statusFilter === "all" ? issues : issues.filter((issue) => issue.status === statusFilter)

    return (
        <div>
            {queues && <p><strong>{queueLine(queues)}</strong></p>}
            <Segmented options={["open", "retake_granted", "dismissed", "all"]} value={statusFilter} onChange={setStatusFilter} />{" "}
            <Button onClick={fetchIssues}>Refresh</Button>

            <Table rowKey="_id" loading={loading} columns={columns} dataSource={visible} scroll={{ x: "max-content" }} />

            <div className="admin-offer">
                <h3>Offer a retake to everyone who took a test</h3>
                <p>For when we've improved a test. Everyone who took it is told by email and a notification; retaking is their choice and their report update is free.</p>
                <Select placeholder="Test" style={{ minWidth: 200 }} options={OFFERABLE} value={offer.module} onChange={(module) => setOffer({ ...offer, module })} />{" "}
                <Input placeholder="What improved (the students see this)" style={{ maxWidth: 420 }} maxLength={300} value={offer.reason} onChange={(event) => setOffer({ ...offer, reason: event.target.value })} />{" "}
                <Popconfirm title="Tell everyone who took this test that they can take it again?" onConfirm={handleOffer} disabled={!offer.module || offer.reason.trim().length < 5}>
                    <Button disabled={!offer.module || offer.reason.trim().length < 5}>Offer the retake</Button>
                </Popconfirm>
            </div>

            <Modal open={runs !== null} title={runs ? `Focus test runs — ${runs.student}` : ""} footer={null} onCancel={() => setRuns(null)}>
                {runs && runs.list.length === 0 && <p>No run stored.</p>}
                {runs && runs.list.map((run, index) => (
                    <div key={index} className="admin-run">
                        <strong>{run.current ? "Current run" : `Earlier run ${index + 1}`}{run.when ? ` · ${dayjs(run.when).format("DD MMM YYYY, HH:mm")}` : ""}</strong>
                        <ul>{runLines(run).map((line) => <li key={line}>{line}</li>)}</ul>
                    </div>
                ))}
            </Modal>

            <ReasonModal
                open={dismissing !== null}
                title="Why can't this test be reopened?"
                onCancel={() => setDismissing(null)}
                onSubmit={(reason) => handleDismiss(dismissing._id, reason)}
            />
        </div>
    )
}

export default AssessmentIssuesList
