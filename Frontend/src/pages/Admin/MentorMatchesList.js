import { useState, useEffect } from "react"
import { Table, Button, Popconfirm, Segmented, Select, Modal, Input, message } from "antd"
import dayjs from "dayjs"
import { getWaitlistForAdmin, matchForAdmin, resolveForAdmin, resetChoiceForAdmin } from "../../apiCall/mentorWaitlistApi"
import { getAllMentorsForAdmin } from "../../apiCall/mentorsApi"

// Every Tier-2 student and where their mentor match stands. The 15-business-day clock runs from the
// student's CHOICE, not their payment. Actions are keyed on the student's user id.
//   Match   — pick an approved mentor (manual in V1)
//   Resolve — no mentor found: rollover first, refund on request. Recording only: the money itself
//             still moves through the Refund Requests tab.
//   Reset   — the student asked (on WhatsApp) to change their career choice

// weekdays left until the promised date; negative once it has passed
const businessDaysLeft = (dueBy) => {
    if (!dueBy) return null
    const today = dayjs().startOf("day")
    const due = dayjs(dueBy).startOf("day")
    const step = due.isAfter(today) ? 1 : -1
    let count = 0
    for (let day = today; !day.isSame(due, "day"); day = day.add(step, "day")) {
        const next = day.add(step, "day")
        if (next.day() !== 0 && next.day() !== 6) count += step
    }
    return count
}

function MentorMatchesList({ dataVersion, onDataChanged }) {
    const [rows, setRows] = useState([])
    const [mentors, setMentors] = useState([])
    const [loading, setLoading] = useState(false)
    const [statusFilter, setStatusFilter] = useState("matching") // awaiting_choice | matching | matched | unmatchable | all
    const [chosenMentor, setChosenMentor] = useState({}) // studentId → mentor user id

    useEffect(() => {
        fetchAll()
    }, [dataVersion])

    const fetchAll = async () => {
        try {
            setLoading(true)
            const [waitlistResponse, mentorsResponse] = await Promise.all([getWaitlistForAdmin(), getAllMentorsForAdmin()])
            setRows(waitlistResponse.data.data)
            setMentors(mentorsResponse.data.data.filter((mentor) => mentor.status === "onboarded"))
        } catch (error) {
            message.error("Failed to fetch the mentor waitlist")
        } finally {
            setLoading(false)
        }
    }

    const handleMatch = async (studentId) => {
        try {
            const response = await matchForAdmin(studentId, { mentorUserId: chosenMentor[studentId] })
            message.success(response.data.message)
            fetchAll()
            onDataChanged()
        } catch (error) {
            message.error(error.response?.data?.message || "Failed to match")
        }
    }

    const handleResolve = (studentId, resolution) => {
        let note = ""
        Modal.confirm({
            title: resolution === "refunded" ? "Record a refund?" : "Record a rollover?",
            content: (
                <>
                    <p>
                        {resolution === "refunded"
                            ? "This records the outcome only — issue the refund itself from the Refund Requests tab."
                            : "The payment rolls over: keep searching, or redirect it to another career from their matches."}
                    </p>
                    <Input.TextArea placeholder="Note (optional)" onChange={(e) => { note = e.target.value }} />
                </>
            ),
            onOk: async () => {
                try {
                    await resolveForAdmin(studentId, { resolution, adminNote: note })
                    message.success("Resolution recorded")
                    fetchAll()
                    onDataChanged()
                } catch (error) {
                    message.error(error.response?.data?.message || "Failed to record the resolution")
                }
            },
        })
    }

    const handleReset = async (studentId) => {
        try {
            await resetChoiceForAdmin(studentId, { adminNote: "Student asked to change their choice" })
            message.success("Choice reset — the student can choose again")
            fetchAll()
            onDataChanged()
        } catch (error) {
            message.error(error.response?.data?.message || "Failed to reset the choice")
        }
    }

    const columns = [
        { title: "Student", render: (_, record) => `${record.student?.name} (${record.student?.email})` },
        { title: "Phone", render: (_, record) => record.student?.phone || "—" },
        { title: "Chosen career", render: (_, record) => record.chosenProfessionName || "—" },
        { title: "Chosen on", render: (_, record) => (record.choiceSentAt ? dayjs(record.choiceSentAt).format("DD MMM YYYY") : "—") },
        {
            title: "Due by",
            render: (_, record) => {
                if (!record.dueBy) return "—"
                const left = businessDaysLeft(record.dueBy)
                const label = left >= 0 ? `${left} business days left` : `${-left} business days overdue`
                return `${dayjs(record.dueBy).format("DD MMM YYYY")} (${record.matchStatus === "matching" ? label : "—"})`
            },
        },
        { title: "Status", dataIndex: "matchStatus" },
        { title: "Mentor", render: (_, record) => record.assignedMentor?.name || "—" },
        { title: "Note", render: (_, record) => record.adminNote || "—" },
        {
            title: "Action",
            render: (_, record) => {
                const studentId = record.student?._id
                return (
                    <>
                        {record.matchStatus === "matching" && (
                            <>
                                <Select
                                    placeholder="Pick a mentor"
                                    style={{ minWidth: 180 }}
                                    options={mentors.map((mentor) => ({ value: mentor.user, label: `${mentor.name} — ${mentor.discipline}` }))}
                                    value={chosenMentor[studentId]}
                                    onChange={(value) => setChosenMentor((prev) => ({ ...prev, [studentId]: value }))}
                                />{" "}
                                <Popconfirm title="Match this student with the selected mentor?" onConfirm={() => handleMatch(studentId)} disabled={!chosenMentor[studentId]}>
                                    <Button type="primary" size="small" disabled={!chosenMentor[studentId]}>Match</Button>
                                </Popconfirm>{" "}
                                <Button size="small" onClick={() => handleResolve(studentId, "rolled_over")}>Roll over</Button>{" "}
                                <Button size="small" danger onClick={() => handleResolve(studentId, "refunded")}>Refunded</Button>{" "}
                            </>
                        )}
                        {record.choiceSentAt && (
                            <Popconfirm
                                title="Reset this student's choice? Their clock and any match are cleared, and they choose again."
                                okText="Reset"
                                onConfirm={() => handleReset(studentId)}
                            >
                                <Button size="small">Reset choice</Button>
                            </Popconfirm>
                        )}
                    </>
                )
            },
        },
    ]

    const visibleRows = statusFilter === "all" ? rows : rows.filter((row) => row.matchStatus === statusFilter)

    return (
        <div>
            <Segmented
                options={["awaiting_choice", "matching", "matched", "unmatchable", "all"]}
                value={statusFilter}
                onChange={setStatusFilter}
            />{" "}
            <Button onClick={fetchAll}>Refresh</Button>

            <Table rowKey={(record) => record.student?._id} loading={loading} columns={columns} dataSource={visibleRows} scroll={{ x: "max-content" }} />
        </div>
    )
}

export default MentorMatchesList
