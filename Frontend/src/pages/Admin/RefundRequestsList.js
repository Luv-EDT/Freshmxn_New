import { useState, useEffect } from "react"
import { Table, Button, Popconfirm, Segmented, message } from "antd"
import dayjs from "dayjs"
import {
    getAllRefundRequestsForAdmin,
    refundForAdmin,
    declineRefundForAdmin,
    getFailedRefundsForAdmin,
    getPricing,
} from "../../apiCall/paymentsApi"
import StudentEditForm from "./StudentEditForm"
import { PLAN_NAMES } from "../plans"
import ReasonModal from "./ReasonModal"
import { ADMIN_REQUEST_WORDS, paymentStatusWord, trackingIds } from "../User/paymentWords"

function RefundRequestsList({ dataVersion, onDataChanged }) {
    const [refundRequests, setRefundRequests] = useState([])
    const [failedRefunds, setFailedRefunds] = useState([])
    const [paymentMode, setPaymentMode] = useState("manual")
    const [loading, setLoading] = useState(false)
    const [statusFilter, setStatusFilter] = useState("open") // open | refunded | declined | all
    const [editingStudent, setEditingStudent] = useState(null)
    const [declining, setDeclining] = useState(null)      // the request being declined, waiting for a reason

    // ─── Fetch on mount, and again whenever any tab changes student data ─────
    useEffect(() => {
        fetchRefunds()
    }, [dataVersion])

    const fetchRefunds = async () => {
        try {
            setLoading(true)
            const [requestsRes, failedRes, pricingRes] = await Promise.all([
                getAllRefundRequestsForAdmin(),
                getFailedRefundsForAdmin(),
                getPricing(),
            ])
            setRefundRequests(requestsRes.data.data)
            setFailedRefunds(failedRes.data.data)
            setPaymentMode(pricingRes.data.data.paymentMode)
        } catch (error) {
            message.error("Failed to fetch refund requests")
        } finally {
            setLoading(false)
        }
    }

    // ─── Refund ──────────────────────────────────────────────────────────────
    const handleRefund = async (id) => {
        try {
            const response = await refundForAdmin(id, {})
            const updatedRequest = response.data.data.refundRequest

            if (response.data.success === false) {
                message.error(response.data.message)
            } else {
                message.success(response.data.message)
            }

            setRefundRequests((prev) =>
                prev.map((request) =>
                    request._id === id ? { ...request, ...updatedRequest, user: request.user } : request
                )
            )
            onDataChanged()
        } catch (error) {
            message.error(error.response?.data?.message || "Failed to process refund")
        }
    }

    // ─── Decline ─────────────────────────────────────────────────────────────
    const handleDecline = async (id, reason) => {
        try {
            const response = await declineRefundForAdmin(id, { adminNote: reason })
            message.success(response.data.message)
            setRefundRequests((prev) =>
                prev.map((request) =>
                    request._id === id ? { ...request, status: "declined", adminNote: reason } : request
                )
            )
            setDeclining(null)
            onDataChanged()
        } catch (error) {
            message.error(error.response?.data?.message || "Failed to decline refund request")
        }
    }

    // an edit writes the user document, so every row belonging to that student updates together
    const handleSaved = (updatedUser) => {
        setRefundRequests((prev) =>
            prev.map((request) =>
                request.user?._id === updatedUser._id ? { ...request, user: updatedUser } : request
            )
        )
        setEditingStudent(null)
        onDataChanged()
    }

    // ─── Columns ─────────────────────────────────────────────────────────────
    const refundMoneyText = paymentMode === "razorpay"
        ? "Razorpay will send the money back automatically."
        : "Send the money back yourself (UPI/bank), then confirm."

    // a rollover keeps Tier 1 alive; only a full refund closes the account
    const getRefundConfirmText = (record) => record.refundType === "rollover"
        ? `${refundMoneyText} The student moves back to Tier 1 and keeps that access.`
        : `${refundMoneyText} The student loses access now.`

    const columns = [
        { title: "Requested", dataIndex: "createdAt", render: (value) => dayjs(value).format("DD MMM YYYY, HH:mm") },
        { title: "Student", render: (_, record) => `${record.user?.name || "N/A"} (${record.user?.email || "N/A"})` },
        { title: "Tier", dataIndex: "tierAtRequest", render: (value) => `${value} · ${PLAN_NAMES[value] || ""}` },
        {
            title: "Type",
            render: (_, record) => (
                <>
                    {record.refundType === "rollover" ? "Back to Tier 1" : "Full refund"}
                    {record.initiatedBy === "admin" && <div>(admin downgrade)</div>}
                </>
            ),
        },
        { title: "Refund (₹)", dataIndex: "amountInr" },
        { title: "Reason", dataIndex: "reason", width: 320 },
        {
            title: "Status",
            render: (_, record) => (
                <>
                    <strong>{ADMIN_REQUEST_WORDS[record.status] || record.status}</strong>
                    {record.failureMessage && <div>{record.failureMessage}</div>}
                    {record.status === "declined" && record.adminNote && <div>Reason: {record.adminNote}</div>}
                    {(record.refunds || []).map((row) => (
                        <div key={row._id} className="pc-small">
                            ₹{row.amountInr}: {paymentStatusWord(row, true)}
                            {trackingIds(row).map((id) => <div key={id}>{id}</div>)}
                        </div>
                    ))}
                </>
            ),
        },
        {
            title: "Action",
            render: (_, record) => (
                <>
                    {record.status === "pending" && (
                        <>
                            <Popconfirm title={getRefundConfirmText(record)} onConfirm={() => handleRefund(record._id)}>
                                <Button type="primary" size="small" danger>Refund</Button>
                            </Popconfirm>{" "}
                            <Button size="small" onClick={() => setDeclining(record)}>Decline</Button>{" "}
                        </>
                    )}
                    {record.status === "refund_failed" && (
                        <>
                            <Popconfirm title="Retry the refund?" onConfirm={() => handleRefund(record._id)}>
                                <Button size="small" danger>Refund failed — retry</Button>
                            </Popconfirm>{" "}
                        </>
                    )}
                    {record.user && (
                        <Button size="small" onClick={() => setEditingStudent(record.user)}>Edit</Button>
                    )}
                </>
            ),
        },
    ]

    const failedColumns = [
        { title: "When", dataIndex: "createdAt", render: (value) => dayjs(value).format("DD MMM YYYY, HH:mm") },
        { title: "Student", render: (_, record) => `${record.user?.name || "N/A"} (${record.user?.email || "N/A"})` },
        { title: "Amount (₹)", dataIndex: "amountInr" },
        { title: "From", render: (_, record) => (record.tier === 1 ? "Back to Tier 1" : "Full refund") },
        { title: "Reason", dataIndex: "failureMessage" },
    ]

    const visibleRequests = refundRequests.filter((request) => {
        if (statusFilter === "all") return true
        if (statusFilter === "open") return ["pending", "refund_pending", "refund_failed"].includes(request.status)
        return request.status === statusFilter
    })

    return (
        <div>
            {/* Toolbar */}
            <p>Payment mode: <strong>{paymentMode}</strong></p>
            <Segmented
                options={["open", "refunded", "declined", "all"]}
                value={statusFilter}
                onChange={setStatusFilter}
            />{" "}
            <Button onClick={fetchRefunds}>Refresh</Button>

            <Table rowKey="_id" loading={loading} columns={columns} dataSource={visibleRequests} />

            {failedRefunds.length > 0 && (
                <>
                    <h3>Failed Razorpay refunds</h3>
                    <p>A downgrade whose refund failed can be retried by clicking Downgrade again on the Students tab.</p>
                    <Table rowKey="_id" columns={failedColumns} dataSource={failedRefunds} pagination={false} />
                </>
            )}

            <ReasonModal
                open={declining !== null}
                title="Why are you declining this refund?"
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

export default RefundRequestsList
