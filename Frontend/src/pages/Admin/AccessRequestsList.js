import { useState, useEffect } from "react"
import { Table, Button, Popconfirm, Segmented, message } from "antd"
import dayjs from "dayjs"
import {
    getAllRequestsForAdmin,
    grantAccessForAdmin,
    declineAccessForAdmin,
    overturnGrantForAdmin,
} from "../../apiCall/paymentsApi"
import { formatCallback } from "../User/callbackOptions"
import StudentEditForm from "./StudentEditForm"

function AccessRequestsList({ dataVersion, onDataChanged }) {
    const [accessRequests, setAccessRequests] = useState([])
    const [loading, setLoading] = useState(false)
    const [statusFilter, setStatusFilter] = useState("pending") // pending | granted | declined | all
    const [editingStudent, setEditingStudent] = useState(null)

    // ─── Fetch on mount, and again whenever any tab changes student data ─────
    useEffect(() => {
        fetchAccessRequests()
    }, [dataVersion])

    const fetchAccessRequests = async () => {
        try {
            setLoading(true)
            const response = await getAllRequestsForAdmin()
            setAccessRequests(response.data.data)
        } catch (error) {
            message.error("Failed to fetch access requests")
        } finally {
            setLoading(false)
        }
    }

    // ─── Grant ───────────────────────────────────────────────────────────────
    const handleGrant = async (id) => {
        try {
            await grantAccessForAdmin(id)
            message.success("Access granted successfully")
            // update locally without refetching
            setAccessRequests((prev) =>
                prev.map((request) =>
                    request._id === id ? { ...request, status: "granted", handledAt: new Date().toISOString() } : request
                )
            )
            onDataChanged()
        } catch (error) {
            message.error(error.response?.data?.message || "Failed to grant access")
        }
    }

    // ─── Decline ─────────────────────────────────────────────────────────────
    const handleDecline = async (id) => {
        try {
            await declineAccessForAdmin(id)
            message.success("Access request declined")
            setAccessRequests((prev) =>
                prev.map((request) =>
                    request._id === id ? { ...request, status: "declined", handledAt: new Date().toISOString() } : request
                )
            )
            onDataChanged()
        } catch (error) {
            message.error(error.response?.data?.message || "Failed to decline request")
        }
    }

    // ─── Overturn (the grant was a mistake — no money ever arrived) ──────────
    const handleOverturn = async (id) => {
        try {
            const response = await overturnGrantForAdmin(id)
            message.success(response.data.message)
            setAccessRequests((prev) =>
                prev.map((request) =>
                    request._id === id ? { ...request, status: "pending", handledAt: null } : request
                )
            )
            onDataChanged()
        } catch (error) {
            message.error(error.response?.data?.message || "Failed to overturn grant")
        }
    }

    // an edit writes the user document, so every row belonging to that student updates together
    const handleSaved = (updatedUser) => {
        setAccessRequests((prev) =>
            prev.map((request) =>
                request.user?._id === updatedUser._id ? { ...request, user: updatedUser } : request
            )
        )
        setEditingStudent(null)
        onDataChanged()
    }

    // ─── Columns ─────────────────────────────────────────────────────────────
    // Name and phone come from the user document, never from the request's own copy, so the
    // Students tab and this one can never disagree
    const columns = [
        { title: "Requested", dataIndex: "createdAt", render: (value) => dayjs(value).format("DD MMM YYYY, HH:mm") },
        { title: "Student", render: (_, record) => `${record.user?.name || "N/A"} (${record.user?.email || "N/A"})` },
        { title: "Phone", render: (_, record) => record.user?.phone || record.phone || "—" },
        { title: "Call at", render: (_, record) => formatCallback(record.callbackDay, record.callbackSlot) },
        { title: "Tier", render: (_, record) => `${record.requestedTier}${record.isUpgrade ? " (upgrade)" : ""}` },
        { title: "Coupon", render: (_, record) => (record.coupon ? `${record.coupon} (${record.discountPct}%)` : "—") },
        { title: "Collect (₹)", dataIndex: "finalAmountInr" },
        { title: "Status", dataIndex: "status" },
        {
            title: "Action",
            render: (_, record) => (
                <>
                    {record.status === "pending" && (
                        <>
                            <Popconfirm
                                title={`Collected ₹${record.finalAmountInr}? Grant Tier ${record.requestedTier}.`}
                                onConfirm={() => handleGrant(record._id)}
                            >
                                <Button type="primary" size="small">Grant access</Button>
                            </Popconfirm>{" "}
                            <Popconfirm title="Decline this request?" onConfirm={() => handleDecline(record._id)}>
                                <Button size="small" danger>Decline</Button>
                            </Popconfirm>{" "}
                        </>
                    )}
                    {record.status === "granted" && (
                        <>
                            <Popconfirm
                                title="Undo this grant? Use this only when the payment never arrived — the student loses access and the request goes back to pending. No refund is recorded."
                                okText="Overturn"
                                onConfirm={() => handleOverturn(record._id)}
                            >
                                <Button size="small" danger>Overturn grant</Button>
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

    const visibleRequests = statusFilter === "all"
        ? accessRequests
        : accessRequests.filter((request) => request.status === statusFilter)

    return (
        <div>
            {/* Toolbar */}
            <Segmented
                options={["pending", "granted", "declined", "all"]}
                value={statusFilter}
                onChange={setStatusFilter}
            />{" "}
            <Button onClick={fetchAccessRequests}>Refresh</Button>

            <Table rowKey="_id" loading={loading} columns={columns} dataSource={visibleRequests} />

            <StudentEditForm
                visible={editingStudent !== null}
                student={editingStudent}
                onClose={() => setEditingStudent(null)}
                onSaved={handleSaved}
            />
        </div>
    )
}

export default AccessRequestsList
