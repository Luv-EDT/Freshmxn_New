import { useEffect, useState } from "react"
import { Table, Button, Segmented, Modal, Input, Select, message } from "antd"
import dayjs from "dayjs"
import { getPayoutsForAdmin, markPayoutPaidForAdmin, decideFirstSessionForAdmin, addFollowUpPayoutForAdmin } from "../../apiCall/mentorPayoutsApi"
import { getAllMentorsForAdmin } from "../../apiCall/mentorsApi"

// WHAT WE OWE MENTORS (owner, Round 34). One row per session, written when the student's feedback
// arrives, at the mentor's tier and region that day. Record-only: pay outside the app (UPI, bank, Wise),
// then "Mark paid" with the reference. A mentor's first session asks whether to keep them. CSV for the
// accounts.
const inr = (amount) => `₹${Number(amount || 0).toLocaleString("en-IN")}`

const csvOf = (rows) => {
    const cell = (value) => `"${String(value === undefined || value === null ? "" : value).replace(/"/g, '""')}"`
    const head = ["Date", "Mentor", "Student", "Kind", "Tier", "Region", "Amount INR", "Amount USD", "Rating", "Status", "Reference", "Paid on"]
    const lines = rows.map((row) => [dayjs(row.createdAt).format("YYYY-MM-DD"), row.mentorName, row.student ? row.student.email : "", row.kind, row.tier, row.region, row.amountInr, row.amountUsd || "", row.rating || "", row.status, row.reference, row.paidAt ? dayjs(row.paidAt).format("YYYY-MM-DD") : ""].map(cell).join(","))
    return [head.map(cell).join(","), ...lines].join("\n")
}

function MentorPayoutsList() {
    const [rows, setRows] = useState([])
    const [loading, setLoading] = useState(false)
    const [filter, setFilter] = useState("due")

    const load = async () => {
        setLoading(true)
        const response = await getPayoutsForAdmin()
        setRows((response && response.data && response.data.data) || [])
        setLoading(false)
    }
    useEffect(() => { load() }, [])

    const markPaid = (row) => {
        let reference = ""
        Modal.confirm({
            title: `Mark ${inr(row.amountInr)} to ${row.mentorName} as paid?`,
            content: <Input placeholder="UPI ref / bank UTR / Wise id" onChange={(event) => { reference = event.target.value }} />,
            onOk: async () => {
                const response = await markPayoutPaidForAdmin(row._id, { reference })
                if (!response || response.data.success === false) return message.error(response?.data?.message || "Could not save")
                message.success(response.data.message)
                load()
            },
        })
    }

    const firstSession = async (row, keep) => {
        const response = await decideFirstSessionForAdmin(row._id, { keep })
        if (!response || response.data.success === false) return message.error(response?.data?.message || "Could not save")
        message.success(response.data.message)
        load()
    }

    const addFollowUp = async () => {
        const mentors = ((await getAllMentorsForAdmin()).data.data || []).filter((mentor) => mentor.status === "onboarded")
        let mentorUserId = null
        let studentEmail = ""
        let note = ""
        Modal.confirm({
            title: "Add a later follow-up (30% of the mentor's main rate)",
            content: (
                <>
                    <Select placeholder="Mentor" style={{ width: "100%", marginBottom: 8 }} options={mentors.map((mentor) => ({ value: mentor.user, label: `${mentor.name} — Tier ${mentor.tier || 1}` }))} onChange={(value) => { mentorUserId = value }} />
                    <Input placeholder="Student's email (optional)" style={{ marginBottom: 8 }} onChange={(event) => { studentEmail = event.target.value }} />
                    <Input placeholder="Note" onChange={(event) => { note = event.target.value }} />
                </>
            ),
            onOk: async () => {
                const response = await addFollowUpPayoutForAdmin({ mentorUserId, studentEmail, note })
                if (!response || response.data.success === false) return message.error(response?.data?.message || "Could not add")
                message.success(response.data.message)
                load()
            },
        })
    }

    const download = () => {
        const blob = new Blob([csvOf(visible)], { type: "text/csv" })
        const link = document.createElement("a")
        link.href = URL.createObjectURL(blob)
        link.download = `mentor-payouts-${dayjs().format("YYYY-MM-DD")}.csv`
        link.click()
        URL.revokeObjectURL(link.href)
    }

    const visible = rows.filter((row) => filter === "all" || row.status === filter)
    const dueTotal = rows.filter((row) => row.status === "due").reduce((sum, row) => sum + row.amountInr, 0)

    const columns = [
        { title: "Date", dataIndex: "createdAt", render: (value) => dayjs(value).format("DD MMM YYYY") },
        { title: "Mentor", dataIndex: "mentorName" },
        { title: "Student", render: (_, row) => (row.student ? `${row.student.name} (${row.student.email})` : "—") },
        { title: "Kind", render: (_, row) => (row.kind === "followup" ? "Later follow-up" : row.note === "student no-show" ? "Main (student no-show)" : "Main session") },
        { title: "Tier · region", render: (_, row) => `Tier ${row.tier} · ${row.region === "international" ? "International" : "Indian"}` },
        { title: "Amount", render: (_, row) => `${inr(row.amountInr)}${row.amountUsd ? ` ($${row.amountUsd})` : ""}` },
        { title: "Rating", dataIndex: "rating", render: (value) => value || "—" },
        { title: "Pay to", render: (_, row) => (row.payTo ? [row.payTo.upiId, row.payTo.accountNumber && `A/c ${row.payTo.accountNumber} · ${row.payTo.ifsc}`, row.payTo.intlMethod].filter(Boolean).join(" · ") || "—" : "—") },
        { title: "Status", render: (_, row) => (row.status === "paid" ? `Paid ${dayjs(row.paidAt).format("DD MMM")} · ${row.reference}` : row.status === "cancelled" ? `Cancelled${row.note ? ` (${row.note})` : ""}` : "Due") },
        {
            title: "Action",
            render: (_, row) => (
                <>
                    {row.needsApproval && (
                        <>
                            <span className="report-small">First session — keep this mentor? </span>
                            <Button size="small" type="primary" onClick={() => firstSession(row, true)}>Keep</Button>{" "}
                            <Button size="small" danger onClick={() => firstSession(row, false)}>Remove</Button>{" "}
                        </>
                    )}
                    {row.status === "due" && <Button size="small" onClick={() => markPaid(row)}>Mark paid</Button>}
                </>
            ),
        },
    ]

    return (
        <div>
            <p><strong>Due now: {inr(dueTotal)}</strong> across {rows.filter((row) => row.status === "due").length} payout(s).</p>
            <Segmented options={[{ label: "Due", value: "due" }, { label: "Paid", value: "paid" }, { label: "Cancelled", value: "cancelled" }, { label: "All", value: "all" }]} value={filter} onChange={setFilter} />{" "}
            <Button onClick={load}>Refresh</Button>{" "}
            <Button onClick={download}>Download CSV</Button>{" "}
            <Button onClick={addFollowUp}>Add a later follow-up</Button>
            <Table rowKey="_id" loading={loading} columns={columns} dataSource={visible} scroll={{ x: "max-content" }} style={{ marginTop: 12 }} />
        </div>
    )
}

export default MentorPayoutsList
