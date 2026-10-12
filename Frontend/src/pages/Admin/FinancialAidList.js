import { useState, useEffect } from "react"
import { Table, Button, Popconfirm, Segmented, InputNumber, message } from "antd"
import dayjs from "dayjs"
import {
    getAllFinancialAidForAdmin,
    approveFinancialAidForAdmin,
    declineFinancialAidForAdmin,
} from "../../apiCall/paymentsApi"
import { formatCallback } from "../User/callbackOptions"
import StudentEditForm from "./StudentEditForm"
import { PLAN_NAMES } from "../plans"
import ReasonModal from "./ReasonModal"
import { AID_WORDS } from "../User/paymentWords"

// You call the student, agree a figure, and type it here. From then on their paywall quotes that
// figure for that tier — which works unchanged in manual mode (they pay you) and in Razorpay mode
// (the Pay button charges the approved amount).
function FinancialAidList({ dataVersion, onDataChanged }) {
    const [aidRequests, setAidRequests] = useState([])
    const [loading, setLoading] = useState(false)
    const [statusFilter, setStatusFilter] = useState("pending") // pending | approved | declined | all
    const [amounts, setAmounts] = useState({})                   // { [requestId]: rupees }
    const [editingStudent, setEditingStudent] = useState(null)
    const [declining, setDeclining] = useState(null)

    // fetch on mount, and again whenever any tab changes student data
    useEffect(() => {
        fetchAidRequests()
    }, [dataVersion])

    const fetchAidRequests = async () => {
        try {
            setLoading(true)
            const response = await getAllFinancialAidForAdmin()
            setAidRequests(response.data.data)
        } catch (error) {
            message.error("Failed to fetch financial aid requests")
        } finally {
            setLoading(false)
        }
    }

    const handleApprove = async (id) => {
        try {
            const response = await approveFinancialAidForAdmin(id, { approvedAmountInr: amounts[id] })
            message.success(response.data.message)
            setAidRequests((prev) =>
                prev.map((request) =>
                    request._id === id ? { ...request, ...response.data.data, user: request.user } : request
                )
            )
            onDataChanged()
        } catch (error) {
            message.error(error.response?.data?.message || "Failed to approve financial aid")
        }
    }

    const handleDecline = async (id, reason) => {
        try {
            const response = await declineFinancialAidForAdmin(id, { adminNote: reason })
            message.success(response.data.message)
            setAidRequests((prev) =>
                prev.map((request) =>
                    request._id === id ? { ...request, status: "declined", adminNote: reason } : request
                )
            )
            setDeclining(null)
            onDataChanged()
        } catch (error) {
            message.error(error.response?.data?.message || "Failed to decline request")
        }
    }

    const handleSaved = (updatedUser) => {
        setAidRequests((prev) =>
            prev.map((request) =>
                request.user?._id === updatedUser._id ? { ...request, user: updatedUser } : request
            )
        )
        setEditingStudent(null)
        onDataChanged()
    }

    const columns = [
        { title: "Requested", dataIndex: "createdAt", render: (value) => dayjs(value).format("DD MMM YYYY, HH:mm") },
        { title: "Student", render: (_, record) => `${record.user?.name || "N/A"} (${record.user?.email || "N/A"})` },
        { title: "Phone", render: (_, record) => record.user?.phone || record.phone || "—" },
        { title: "Call at", render: (_, record) => formatCallback(record.callbackDay, record.callbackSlot) },
        { title: "Tier", dataIndex: "requestedTier", render: (value) => `${value} · ${PLAN_NAMES[value] || ""}` },
        { title: "Their reason", dataIndex: "reason", width: 320 },
        {
            title: "Status",
            render: (_, record) => (
                <>
                    <strong>{AID_WORDS[record.status] || record.status}</strong>
                    {record.approvedAmountInr && <div>₹{record.approvedAmountInr}</div>}
                    {record.adminNote && <div>{record.adminNote}</div>}
                    {record.usedAt && <div>(used)</div>}
                </>
            ),
        },
        {
            title: "Action",
            render: (_, record) => (
                <>
                    {record.status === "pending" && (
                        <>
                            <InputNumber
                                size="small"
                                min={1}
                                placeholder="₹"
                                value={amounts[record._id]}
                                onChange={(value) => setAmounts((prev) => ({ ...prev, [record._id]: value }))}
                                style={{ width: 90 }}
                            />{" "}
                            <Popconfirm
                                title={`Approve a subsidised rate of ₹${amounts[record._id] || 0} for Tier ${record.requestedTier}?`}
                                onConfirm={() => handleApprove(record._id)}
                            >
                                <Button type="primary" size="small">Approve</Button>
                            </Popconfirm>{" "}
                            <Button size="small" danger onClick={() => setDeclining(record)}>Decline</Button>{" "}
                        </>
                    )}
                    {record.user && (
                        <Button size="small" onClick={() => setEditingStudent(record.user)}>Edit</Button>
                    )}
                </>
            ),
        },
    ]

    const visibleRequests = statusFilter === "all"
        ? aidRequests
        : aidRequests.filter((request) => request.status === statusFilter)

    return (
        <div>
            <Segmented
                options={["pending", "approved", "declined", "cancelled", "all"]}
                value={statusFilter}
                onChange={setStatusFilter}
            />{" "}
            <Button onClick={fetchAidRequests}>Refresh</Button>

            <Table rowKey="_id" loading={loading} columns={columns} dataSource={visibleRequests} />

            <ReasonModal
                open={declining !== null}
                title="Why are you declining this financial aid request?"
                onCancel={() => setDeclining(null)}
                onSubmit={(reason) => handleDecline(declining._id, reason)}
            />

            <StudentEditForm
                visible={editingStudent !== null}
                student={editingStudent}
                onClose={() => setEditingStudent(null)}
                onSaved={handleSaved}
            />
        </div>
    )
}

export default FinancialAidList
