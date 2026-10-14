import { useState, useEffect } from "react"
import { Table, Button, Popconfirm, Segmented, Select, Modal, Input, message } from "antd"
import dayjs from "dayjs"
import { getWaitlistForAdmin, matchForAdmin, resolveForAdmin, resetChoiceForAdmin, completeSessionForAdmin, mainSessionDoneForAdmin } from "../../apiCall/mentorWaitlistApi"
import { grantMentorSessionForAdmin } from "../../apiCall/paymentsApi"
import { getAllMentorsForAdmin } from "../../apiCall/mentorsApi"
import { markWhatsappInviteForAdmin } from "../../apiCall/mentorSessionsApi"
import StudentSearch, { matchesStudent } from "./StudentSearch"

// Every Tier-2 student and where their mentor match stands. The 20-business-day clock runs from the
// student's CHOICE, not their payment. Actions are keyed on the student's user id.
//   Match   — pick an approved mentor (manual in V1)
//   Resolve — no mentor found: rollover first, refund on request. Recording only: the money itself
//             still moves through the Refund Requests tab.
//   Reset   — the student asked (on WhatsApp) to change their career choice
//   Done    — Round 28: the session happened; it is logged and the student can book another (paid)
//   Another — Round 28: record another session the student paid for by hand, or give one free
//   WhatsApp — Round 28: a match emails the mentor the invite; this opens WhatsApp with the same
//             invite typed in (the mentor's number from their profile) — press send there
// A student must have chosen WhatsApp or email and agreed to it before they can be matched.

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
    const [search, setSearch] = useState("")   // Round 31: name or email
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

    const handleMainDone = async (studentId) => {
        try {
            const response = await mainSessionDoneForAdmin(studentId)
            message.success(response.data.message)
            fetchAll()
        } catch (error) {
            message.error(error.response?.data?.message || "Failed to mark the main session")
        }
    }

    // closes the session, with or without the follow-up (the follow-up is up to the student)
    const handleDone = async (studentId, followUp) => {
        try {
            const response = await completeSessionForAdmin(studentId, { followUp })
            message.success(response.data.message)
            fetchAll()
        } catch (error) {
            message.error(error.response?.data?.message || "Failed to log the session")
        }
    }

    // opens WhatsApp with the invite typed in, and notes that it was sent
    const sendWhatsapp = async (record) => {
        window.open(record.whatsappInvite, "_blank", "noopener")
        const response = await markWhatsappInviteForAdmin(record.student?._id)
        if (response && response.data.success) fetchAll()
    }

    const handleAnother = async (studentId, free) => {
        try {
            const response = await grantMentorSessionForAdmin(studentId, { free })
            message.success(response.data.message)
            fetchAll()
        } catch (error) {
            message.error(error.response?.data?.message || "Could not add the session")
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
        { title: "Plan", dataIndex: "plan" },
        {
            title: "Chosen career — job role",
            render: (_, record) => (record.otherRequest
                // Mentor Only, not in our list (Round 12): find this mentor separately
                ? <span><strong>Other — find separately:</strong> {record.otherRequest}</span>
                : record.chosenProfessionName
                    ? `${record.chosenProfessionName}${record.chosenJobRole ? ` — ${record.chosenJobRole}${record.jobRoleIsOther ? " (their words)" : ""}` : ""}`
                    : "—"),
        },
        { title: "Industry", dataIndex: "chosenIndustry", render: (value) => value || "—" },
        // shared only when the student ticked "my mentor can know" on the assessment page
        // Round 18: what the student wants from the sessions, for the mentor, and the abroad-help waitlist
        { title: "Wants to know", dataIndex: "helpWanted", render: (value) => value || "—" },
        // Round 19: the help the student wants for that role — as a career, as an interest/passion, or both
        { title: "Help with", dataIndex: "helpFocus", render: (value) => ({ career: "Career", passion: "Interest / passion", both: "Both" }[value] || "—") },
        { title: "Abroad help waitlist", dataIndex: "abroadHelpWaitlist", render: (value) => (value ? "Yes" : "—") },
        { title: "Support needs (shared)", render: (_, record) => ((record.sharedSupportNeeds || []).length > 0 ? record.sharedSupportNeeds.join(", ") : "—") },
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
        { title: "Status", dataIndex: "matchStatus", render: (value, record) => `${value}${(record.sessions || []).length ? ` · ${record.sessions.length} done` : ""}${record.sameFieldNewMentor ? " · different mentor wanted" : ""}` },
        { title: "Mentor", render: (_, record) => record.assignedMentor?.name || "—" },
        // Round 28: how the mentor may reach the student, and where this match's steps stand
        { title: "Contact", render: (_, record) => (record.contactConsented ? (record.contactVia === "email" ? "Email" : "WhatsApp") : "Waiting for consent") },
        {
            title: "Invite steps",
            render: (_, record) => (record.matchStatus === "matched"
                ? [
                    record.whatsappInviteAt ? "✓ WhatsApp sent" : "WhatsApp not sent",
                    record.mentorPrivacyAcceptedAt ? "✓ privacy accepted" : "privacy not accepted",
                    record.bookingLinkSentAt ? "✓ booking link sent" : "no booking link yet",
                ].join(" · ")
                : "—"),
        },
        // rows written before Round 13 carry the old, unclear wording
        { title: "Note", render: (_, record) => (record.adminNote === "Re-opened on a new Tier 2 place" ? "Re-joined the mentor plan after leaving it — waiting for a new choice" : record.adminNote) || "—" },
        {
            title: "Action",
            render: (_, record) => {
                const studentId = record.student?._id
                return (
                    <>
                        {record.matchStatus === "matching" && (
                            <>
                                {record.contactConsented ? (
                                    <>
                                        <Select
                                            placeholder="Pick a mentor"
                                            style={{ minWidth: 180 }}
                                            options={mentors
                                                .filter((mentor) => !(record.excludedMentors || []).some((excluded) => String(excluded) === String(mentor.user)))
                                                .map((mentor) => ({ value: mentor.user, label: `${mentor.name} — ${mentor.discipline}` }))}
                                            value={chosenMentor[studentId]}
                                            onChange={(value) => setChosenMentor((prev) => ({ ...prev, [studentId]: value }))}
                                        />{" "}
                                        <Popconfirm title="Match this student with the selected mentor? The mentor is emailed the invite." onConfirm={() => handleMatch(studentId)} disabled={!chosenMentor[studentId]}>
                                            <Button type="primary" size="small" disabled={!chosenMentor[studentId]}>Match</Button>
                                        </Popconfirm>{" "}
                                    </>
                                ) : <span>Waiting for the student's contact consent </span>}
                                <Button size="small" onClick={() => handleResolve(studentId, "rolled_over")}>Roll over</Button>{" "}
                                <Button size="small" danger onClick={() => handleResolve(studentId, "refunded")}>Refunded</Button>{" "}
                            </>
                        )}
                        {record.matchStatus === "matched" && record.whatsappInvite && (
                            <><Button size="small" onClick={() => sendWhatsapp(record)}>{record.whatsappInviteAt ? "Send invite on WhatsApp again" : "Send invite on WhatsApp"}</Button>{" "}</>
                        )}
                        {record.matchStatus === "matched" && !record.mainSessionAt && (
                            <Popconfirm title="Mark the main (1-hour) session held?" onConfirm={() => handleMainDone(studentId)}>
                                <Button type="primary" size="small">Main session done</Button>
                            </Popconfirm>
                        )}
                        {record.matchStatus === "matched" && record.mainSessionAt && (
                            <>
                                <Popconfirm title="Follow-up held? The session is logged and the student is asked for a review." onConfirm={() => handleDone(studentId, true)}>
                                    <Button type="primary" size="small">Follow-up done</Button>
                                </Popconfirm>{" "}
                                <Popconfirm title="Close without a follow-up? The session is logged and the student is asked for a review." onConfirm={() => handleDone(studentId, false)}>
                                    <Button size="small">Close without follow-up</Button>
                                </Popconfirm>
                            </>
                        )}{" "}
                        {record.matchStatus === "completed" && (record.extraSessionsPaid || 0) <= (record.extraSessionsUsed || 0) && (
                            <>
                                <Popconfirm title="Record another session the student paid for by hand?" onConfirm={() => handleAnother(studentId, false)}>
                                    <Button size="small">Another session (paid)</Button>
                                </Popconfirm>{" "}
                                <Popconfirm title="Give the student another session free?" onConfirm={() => handleAnother(studentId, true)}>
                                    <Button size="small">Another session (free)</Button>
                                </Popconfirm>{" "}
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
                options={["awaiting_choice", "matching", "matched", "completed", "unmatchable", "all"]}
                value={statusFilter}
                onChange={setStatusFilter}
            />{" "}
            <Button onClick={fetchAll}>Refresh</Button>

            <StudentSearch value={search} onChange={setSearch} />
            <Table rowKey={(record) => record.student?._id} loading={loading} columns={columns} dataSource={visibleRows.filter((row) => matchesStudent(row.student, search))} scroll={{ x: "max-content" }} />
        </div>
    )
}

export default MentorMatchesList
