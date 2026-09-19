import { useState, useEffect } from "react"
import { Table, Button, Popconfirm, Input, message } from "antd"
import dayjs from "dayjs"
import { getAllUsersForAdmin } from "../../apiCall/userApi"
import { downgradeUserForAdmin, getPricing } from "../../apiCall/paymentsApi"
import StudentEditForm from "./StudentEditForm"

function StudentsList({ dataVersion, onDataChanged }) {
    const [users, setUsers] = useState([])
    const [loading, setLoading] = useState(false)
    const [paymentMode, setPaymentMode] = useState("manual")
    const [search, setSearch] = useState("")
    const [editingStudent, setEditingStudent] = useState(null)

    // ─── Fetch users (and again whenever any tab changes student data) ───────
    useEffect(() => {
        fetchUsers()
    }, [dataVersion])

    const fetchUsers = async () => {
        try {
            setLoading(true)
            const [usersRes, pricingRes] = await Promise.all([
                getAllUsersForAdmin(),
                getPricing(),
            ])
            setUsers(usersRes.data.data)
            setPaymentMode(pricingRes.data.data.paymentMode)
        } catch (error) {
            message.error("Failed to fetch students")
        } finally {
            setLoading(false)
        }
    }

    // ─── Downgrade (Tier 2 → Tier 1, refunds the Tier-2 part) ────────────────
    const handleDowngrade = async (id) => {
        try {
            const response = await downgradeUserForAdmin(id)
            message.success(response.data.message)
            const updatedUser = response.data.data.user
            setUsers((prev) =>
                prev.map((user) =>
                    user._id === id ? { ...user, ...updatedUser } : user
                )
            )
            onDataChanged()
        } catch (error) {
            message.error(error.response?.data?.message || "Failed to downgrade")
        }
    }

    // the edit writes the user document every other tab reads, so they all have to be told
    const handleSaved = (updatedUser) => {
        setUsers((prev) =>
            prev.map((user) => (user._id === updatedUser._id ? { ...user, ...updatedUser } : user))
        )
        setEditingStudent(null)
        onDataChanged()
    }

    // ─── Columns ─────────────────────────────────────────────────────────────
    const downgradeConfirmText = paymentMode === "razorpay"
        ? "Move to Tier 1. Razorpay will refund the Tier-2 part automatically."
        : "Move to Tier 1. Send the Tier-2 part back yourself, then confirm."

    const columns = [
        { title: "Joined", dataIndex: "createdAt", render: (value) => dayjs(value).format("DD MMM YYYY") },
        { title: "Name", dataIndex: "name" },
        { title: "Email", render: (_, record) => `${record.email}${record.isEmailVerified ? " ✓" : " (unconfirmed)"}` },
        { title: "Phone", render: (_, record) => record.phone || "—" },
        { title: "Role", dataIndex: "role" },
        { title: "Age", dataIndex: "age" },
        { title: "Journey", dataIndex: "journey" },
        { title: "Paid", render: (_, record) => (record.paid ? "Yes" : "No") },
        { title: "Tier", dataIndex: "currentTier" },
        { title: "Interest form", render: (_, record) => record.progress?.interestForm || "N/A" },
        {
            title: "Action",
            render: (_, record) => (
                <>
                    {record.paid && record.currentTier === 2 && (
                        <>
                            <Popconfirm title={downgradeConfirmText} onConfirm={() => handleDowngrade(record._id)}>
                                <Button size="small" danger>Downgrade to Tier 1</Button>
                            </Popconfirm>{" "}
                        </>
                    )}
                    <Button size="small" onClick={() => setEditingStudent(record)}>Edit</Button>
                </>
            ),
        },
    ]

    const searchText = search.trim().toLowerCase()
    const visibleUsers = users.filter((user) =>
        !searchText || user.name.toLowerCase().includes(searchText) || user.email.toLowerCase().includes(searchText)
    )

    return (
        <div>
            {/* Toolbar */}
            <Input placeholder="Search name or email" value={search} onChange={(e) => setSearch(e.target.value)} style={{ maxWidth: 300 }} />{" "}
            <Button onClick={fetchUsers}>Refresh</Button>

            <Table rowKey="_id" loading={loading} columns={columns} dataSource={visibleUsers} />

            <StudentEditForm
                visible={editingStudent !== null}
                student={editingStudent}
                onClose={() => setEditingStudent(null)}
                onSaved={handleSaved}
            />
        </div>
    )
}

export default StudentsList
