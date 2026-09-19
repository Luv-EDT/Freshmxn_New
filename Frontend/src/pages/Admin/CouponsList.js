import { useState, useEffect } from "react"
import { Table, Button, Popconfirm, message } from "antd"
import dayjs from "dayjs"
import { getAllCoupons, updateCoupon, deleteCoupon } from "../../apiCall/couponsApi"
import CouponsForm from "./CouponsForm"

function CouponsList() {
    const [coupons, setCoupons] = useState([])
    const [loading, setLoading] = useState(false)
    const [mode, setMode] = useState(null) // null | "edit" | "delete" | "add"
    const [showForm, setShowForm] = useState(false)
    const [selectedCoupon, setSelectedCoupon] = useState(null) // for edit

    // ─── Fetch all coupons on mount ──────────────────────────────────────────
    useEffect(() => {
        fetchCoupons()
    }, [])

    const fetchCoupons = async () => {
        try {
            setLoading(true)
            const response = await getAllCoupons()
            setCoupons(response.data.data)
        } catch (error) {
            message.error("Failed to fetch coupons")
        } finally {
            setLoading(false)
        }
    }

    // ─── Add ─────────────────────────────────────────────────────────────────
    const handleAddSuccess = (newCoupon) => {
        setCoupons((prev) => [newCoupon, ...prev])
        setShowForm(false)
        setMode(null)
    }

    // ─── Update ──────────────────────────────────────────────────────────────
    const handleUpdate = async (id, updatedData) => {
        try {
            const response = await updateCoupon(id, updatedData)
            message.success("Coupon updated successfully")
            // update locally without refetching
            setCoupons((prev) =>
                prev.map((coupon) =>
                    coupon._id === id ? { ...coupon, ...response.data.data } : coupon
                )
            )
            setShowForm(false)
            setSelectedCoupon(null)
            setMode(null)
        } catch (error) {
            message.error(error.response?.data?.message || "Failed to update coupon")
        }
    }

    // ─── Delete ──────────────────────────────────────────────────────────────
    const handleDelete = async (id) => {
        try {
            await deleteCoupon(id)
            message.success("Coupon deleted successfully")
            setCoupons((prev) => prev.filter((coupon) => coupon._id !== id))
        } catch (error) {
            message.error("Failed to delete coupon")
        }
    }

    // ─── Columns ─────────────────────────────────────────────────────────────
    const columns = [
        { title: "Code", dataIndex: "code" },
        { title: "Discount %", dataIndex: "discountPct" },
        { title: "Active", render: (_, record) => (record.isActive ? "Yes" : "No") },
        { title: "Used", render: (_, record) => `${record.timesUsed} / ${record.usageLimit === 0 ? "∞" : record.usageLimit}` },
        { title: "Expires", render: (_, record) => (record.expiresAt ? dayjs(record.expiresAt).format("DD MMM YYYY") : "Never") },
        {
            title: "Action",
            render: (_, record) => {
                if (mode === "edit") {
                    return (
                        <Button size="small" onClick={() => { setSelectedCoupon(record); setShowForm(true) }}>
                            Edit
                        </Button>
                    )
                }
                if (mode === "delete") {
                    return (
                        <Popconfirm title="Delete this coupon?" onConfirm={() => handleDelete(record._id)}>
                            <Button size="small" danger>Delete</Button>
                        </Popconfirm>
                    )
                }
                return null
            },
        },
    ]

    return (
        <div>
            {/* Toolbar */}
            <Button type="primary" onClick={() => { setMode("add"); setSelectedCoupon(null); setShowForm(true) }}>
                Add Coupon
            </Button>{" "}
            <Button onClick={() => setMode(mode === "edit" ? null : "edit")}>
                {mode === "edit" ? "Done editing" : "Edit"}
            </Button>{" "}
            <Button onClick={() => setMode(mode === "delete" ? null : "delete")}>
                {mode === "delete" ? "Done deleting" : "Delete"}
            </Button>

            <Table rowKey="_id" loading={loading} columns={columns} dataSource={coupons} />

            <CouponsForm
                visible={showForm}
                onClose={() => {
                    setShowForm(false)
                    setSelectedCoupon(null)
                    setMode(null)
                }}
                initialData={selectedCoupon}      // null = add mode, object = edit mode
                onAddSuccess={handleAddSuccess}
                onUpdateSuccess={handleUpdate}
            />
        </div>
    )
}

export default CouponsList
