import { useState, useEffect } from "react"
import { Table, Button, Popconfirm, Segmented, Select, Modal, Input, Checkbox, Dropdown, DatePicker, message } from "antd"
import dayjs from "dayjs"
import { getWaitlistForAdmin, matchForAdmin, resetChoiceForAdmin, completeSessionForAdmin, newMentorForAdmin, studentNoShowForAdmin, sessionsBookedForAdmin, reopenSameMentorForAdmin } from "../../apiCall/mentorWaitlistApi"
import { grantMentorSessionForAdmin, refundMentorPartForAdmin } from "../../apiCall/paymentsApi"
import { getAllMentorsForAdmin } from "../../apiCall/mentorsApi"
import { markWhatsappInviteForAdmin } from "../../apiCall/mentorSessionsApi"
import StudentSearch, { matchesStudent } from "./StudentSearch"

// Every student on a mentor plan and where their mentor ticket stands (owner, Round 34). The clock runs
// from the student's CHOICE — 20 business days, or 15 for a new mentor. Actions are keyed on the student's
// user id.
//   Match         — after asking the mentor on WhatsApp to open Calendly slots; the student then sees the
//                   links and books. A mentor without Calendly links can't be matched.
//   WhatsApp      — opens WhatsApp with the mentor's "new student" message typed in
//   Sessions booked — Round 35: the mentor tells us on WhatsApp the student booked, with the times; both
//                   dashboards then say so and the student is emailed. 3 days after the match with nothing
//                   logged, the row says "booking time missed" (the student's page says so too) — then
//                   check with the mentor and press Student no-show
//   Session done  — after the mentor tells us on WhatsApp; the student's feedback form opens
//   Student no-show — closes the ticket with no refund; the mentor is still paid
//   Close or change this ticket — one menu, each choice doing the whole job and telling the student:
//       find another mentor (a strike when the mentor was at fault) · reset the career choice (within 7
//       days of it) · refund the mentor part (the money and the ticket in one step)
//   Another       — Round 28: record another session the student paid for by hand, or give one free
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

const STATUS_WORDS = {
    awaiting_choice: "Waiting for choice",
    matching: "Finding mentor",
    matched: "Matched",
    completed: "Session done",
    closed: "Closed",
    unmatchable: "Closed (before Round 34)",
}

function MentorMatchesList({ dataVersion, onDataChanged }) {
    const [rows, setRows] = useState([])
    const [search, setSearch] = useState("")   // Round 31: name or email
    const [mentors, setMentors] = useState([])
    const [loading, setLoading] = useState(false)
    const [statusFilter, setStatusFilter] = useState("matching") // awaiting_choice | matching | matched | unmatchable | all
    const [chosenMentor, setChosenMentor] = useState({}) // studentId → mentor user id
    const [booking, setBooking] = useState(null)         // { record, mainAt, followUpAt } while the booking box is open

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

    // "Session done": the session is logged and the student's feedback form opens
    const handleDone = async (studentId) => {
        try {
            const response = await completeSessionForAdmin(studentId, {})
            message.success(response.data.message)
            fetchAll()
        } catch (error) {
            message.error(error.response?.data?.message || "Failed to mark the session done")
        }
    }

    const openBooking = (record) => setBooking({
        record,
        mainAt: record.bookedMainAt ? dayjs(record.bookedMainAt) : null,
        followUpAt: record.bookedFollowUpAt ? dayjs(record.bookedFollowUpAt) : null,
    })

    const saveBooking = async (clear) => {
        try {
            const payload = clear ? { clear: true } : { mainAt: booking.mainAt ? booking.mainAt.toISOString() : null, followUpAt: booking.followUpAt ? booking.followUpAt.toISOString() : null }
            const response = await sessionsBookedForAdmin(booking.record.student?._id, payload)
            message.success(response.data.message)
            setBooking(null)
            fetchAll()
        } catch (error) {
            message.error(error.response?.data?.message || "Could not save the booking")
        }
    }

    const handleNoShow = async (studentId) => {
        try {
            const response = await studentNoShowForAdmin(studentId, {})
            message.success(response.data.message)
            fetchAll()
        } catch (error) {
            message.error(error.response?.data?.message || "Failed to mark the no-show")
        }
    }

    // CLOSE OR CHANGE THIS TICKET — one menu, three choices (owner, Round 34)
    const changeTicket = (record, action) => {
        const studentId = record.student?._id
        let note = ""
        let strike = false
        const config = {
            new_mentor: {
                title: "Find another mentor?",
                text: "Same career and role. The current mentor is kept away from this student. The student is told: a new mentor within 15 business days.",
                strikeBox: Boolean(record.assignedMentor),
                run: () => newMentorForAdmin(studentId, { adminNote: note, strike }),
            },
            reset: {
                title: "Reset the career choice?",
                text: "The choice, the clock and any match are cleared; the student chooses again and is emailed. Kept in the ticket's history.",
                run: () => resetChoiceForAdmin(studentId, { adminNote: note }),
            },
            same_mentor: {
                title: "Re-arrange with the same mentor?",
                text: "After a no-show: the student asked on WhatsApp and the mentor agreed. The ticket is matched again with that mentor, the student gets a new 2.5 days to book, and both are emailed. The no-show stays paid; this session is paid in its turn.",
                run: () => reopenSameMentorForAdmin(studentId, { adminNote: note }),
            },
            refund: {
                title: "Refund the mentor part?",
                text: "The refund is sent now — the difference on Discovery + Mentor, everything on Mentor Only, or the extra session's price — and the ticket closes. The student is emailed.",
                run: () => refundMentorPartForAdmin(studentId, { adminNote: note }),
            },
        }[action]
        Modal.confirm({
            title: config.title,
            content: (
                <>
                    <p>{config.text}</p>
                    {config.strikeBox && <p><Checkbox onChange={(event) => { strike = event.target.checked }}>The mentor was at fault (didn't prepare, respond or turn up) — give a strike</Checkbox></p>}
                    <Input.TextArea placeholder="Note (what the student asked on WhatsApp)" onChange={(event) => { note = event.target.value }} />
                </>
            ),
            okText: "Yes, do it",
            onOk: async () => {
                try {
                    const response = await config.run()
                    message.success(response.data.message)
                    fetchAll()
                    onDataChanged()
                } catch (error) {
                    message.error(error.response?.data?.message || "That didn't work")
                }
            },
        })
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

    const columns = [
        // Round 35 (owner): name and email stay in view while the table scrolls sideways
        { title: "Name", fixed: "left", width: 140, render: (_, record) => record.student?.name || "—" },
        { title: "Email", fixed: "left", width: 200, render: (_, record) => record.student?.email || "—" },
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
        { title: "Languages", render: (_, record) => (record.languages || []).join(", ") || "—" },
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
        { title: "Status", dataIndex: "matchStatus", render: (value, record) => `${STATUS_WORDS[value] || value}${(record.sessions || []).length ? ` · ${record.sessions.length} done` : ""}${record.sameFieldNewMentor ? " · different mentor wanted" : ""}${record.resolution === "refund_requested" ? " · refund asked for" : ""}` },
        { title: "Mentor", render: (_, record) => record.assignedMentor?.name || "—" },
        // Round 35: booked (with the times the mentor gave us), waiting, or the booking time missed
        {
            title: "Booking",
            render: (_, record) => {
                if (record.matchStatus !== "matched") return record.bookedMainAt ? `Was booked for ${dayjs(record.bookedMainAt).format("DD MMM, h:mm a")}` : "—"
                if (record.bookedMainAt) return `Booked · main ${dayjs(record.bookedMainAt).format("DD MMM, h:mm a")}${record.bookedFollowUpAt ? ` · follow-up ${dayjs(record.bookedFollowUpAt).format("DD MMM, h:mm a")}` : " · no follow-up"}`
                if (record.bookingMissed) return <strong className="admin-alert">Booking time missed — check with the mentor, then Student no-show</strong>
                return `Not booked yet · book by ${record.bookBy ? dayjs(record.bookBy).format("DD MMM, h:mm a") : "—"}`
            },
        },
        // Round 28: how the mentor may reach the student, and where this match's steps stand
        { title: "Contact", render: (_, record) => (record.contactConsented ? (record.contactVia === "email" ? "Email" : "WhatsApp") : "Waiting for consent") },
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
                                                .map((mentor) => ({ value: mentor.user, label: `${mentor.name} — ${mentor.discipline} · Tier ${mentor.tier || 1}${mentor.calendlyMain ? "" : " · no Calendly links"}` }))}
                                            value={chosenMentor[studentId]}
                                            onChange={(value) => setChosenMentor((prev) => ({ ...prev, [studentId]: value }))}
                                        />{" "}
                                        <Popconfirm title="Did you ask the mentor to open Calendly slots? Matching shows the student the links and emails both." onConfirm={() => handleMatch(studentId)} disabled={!chosenMentor[studentId]}>
                                            <Button type="primary" size="small" disabled={!chosenMentor[studentId]}>Match</Button>
                                        </Popconfirm>{" "}
                                    </>
                                ) : <span>Waiting for the student's contact consent </span>}

                            </>
                        )}
                        {record.matchStatus === "matched" && record.whatsappInvite && (
                            <><Button size="small" onClick={() => sendWhatsapp(record)}>{record.whatsappInviteAt ? "Message the mentor again" : "Message the mentor on WhatsApp"}</Button>{" "}</>
                        )}
                        {record.matchStatus === "matched" && (
                            <><Button size="small" type={record.bookedMainAt ? "default" : "primary"} onClick={() => openBooking(record)}>{record.bookedMainAt ? "Change booking" : "Sessions booked…"}</Button>{" "}</>
                        )}
                        {record.matchStatus === "matched" && (
                            <>
                                <Popconfirm title="Has the mentor told you the session is done? The student's feedback form opens now." onConfirm={() => handleDone(studentId)}>
                                    <Button type="primary" size="small">Session done</Button>
                                </Popconfirm>{" "}
                                <Popconfirm title="The student didn't book in time or didn't join? The ticket closes with no refund; the mentor is still paid." onConfirm={() => handleNoShow(studentId)}>
                                    <Button size="small">Student no-show</Button>
                                </Popconfirm>{" "}
                            </>
                        )}
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
                        {(record.choiceSentAt || ["refund_requested", "student_no_show"].includes(record.resolution)) && (
                            <Dropdown
                                trigger={["click"]}
                                menu={{
                                    items: [
                                        record.choiceSentAt && { key: "new_mentor", label: "Find another mentor" },
                                        record.canResetChoice && { key: "reset", label: "Reset the career choice (within 7 days)" },
                                        record.matchStatus === "closed" && record.resolution === "student_no_show" && { key: "same_mentor", label: "Re-arrange with the same mentor (after a no-show)" },
                                        { key: "refund", label: "Refund the mentor part", danger: true },
                                    ].filter(Boolean),
                                    onClick: ({ key }) => changeTicket(record, key),
                                }}
                            >
                                <Button size="small">Close or change this ticket ▾</Button>
                            </Dropdown>
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
                options={["awaiting_choice", "matching", "matched", "completed", "closed", "all"].map((value) => ({ value, label: STATUS_WORDS[value] || "All" }))}
                value={statusFilter}
                onChange={setStatusFilter}
            />{" "}
            <Button onClick={fetchAll}>Refresh</Button>

            <StudentSearch value={search} onChange={setSearch} />
            <Table rowKey={(record) => record.student?._id} loading={loading} columns={columns} dataSource={visibleRows.filter((row) => matchesStudent(row.student, search))} scroll={{ x: "max-content" }} />

            <Modal
                open={Boolean(booking)}
                title={booking ? `Sessions booked — ${booking.record.student?.name}` : ""}
                onCancel={() => setBooking(null)}
                footer={booking ? [
                    booking.record.bookedMainAt && <Button key="clear" danger onClick={() => saveBooking(true)}>Not booked after all</Button>,
                    <Button key="cancel" onClick={() => setBooking(null)}>Cancel</Button>,
                    <Button key="save" type="primary" disabled={!booking.mainAt} onClick={() => saveBooking(false)}>Save — tell the student</Button>,
                ].filter(Boolean) : null}
            >
                {booking && (
                    <div className="booking-form">
                        <p>From the mentor's WhatsApp message (your local time):</p>
                        <label>Main session (1 hour)<DatePicker showTime={{ format: "h:mm a", minuteStep: 5 }} format="DD MMM YYYY, h:mm a" value={booking.mainAt} onChange={(value) => setBooking((prev) => ({ ...prev, mainAt: value }))} /></label>
                        <label>Follow-up (20 minutes) — leave empty if none was booked<DatePicker showTime={{ format: "h:mm a", minuteStep: 5 }} format="DD MMM YYYY, h:mm a" value={booking.followUpAt} onChange={(value) => setBooking((prev) => ({ ...prev, followUpAt: value }))} /></label>
                    </div>
                )}
            </Modal>
        </div>
    )
}

export default MentorMatchesList
