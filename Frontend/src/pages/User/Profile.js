import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useSelector, useDispatch } from "react-redux"
import { Table, Collapse, Popconfirm, message } from "antd"
import dayjs from "dayjs"
import { getMyPayments, getMyRefundRequests, getMyFinancialAid } from "../../apiCall/paymentsApi"
import { resendVerification, getCurrentUser } from "../../apiCall/userApi"
import { setUser } from "../../store/userSlice"
import RequestRefundForm from "./RequestRefundForm"
import Navbar from "../Navbar"
import { JOURNEY_OPTIONS } from "../journeyOptions"

const TIER_NAMES = {
    0: "No plan yet",
    1: "Tier 1 — Career Recommendation + Psychometric Analysis",
    2: "Tier 2 — Mentor Connection",
}

const OPEN_REFUND_STATUSES = ["pending", "refund_pending", "refund_failed"]

// Account + money. Refunds are payment rows, so purchases, upgrades and refunds all sit in the
// one Payment history table rather than being split across two.
function Profile() {
    const navigate = useNavigate()
    const dispatch = useDispatch()
    const { user } = useSelector((state) => state.user)
    const [payments, setPayments] = useState([])
    const [refundRequests, setRefundRequests] = useState([])
    const [aidRequests, setAidRequests] = useState([])
    const [loading, setLoading] = useState(false)
    const [showForm, setShowForm] = useState(false)

    useEffect(() => {
        fetchHistory()
    }, [])

    const fetchHistory = async () => {
        try {
            setLoading(true)
            const [paymentsRes, refundsRes, aidRes] = await Promise.all([
                getMyPayments(),
                getMyRefundRequests(),
                getMyFinancialAid(),
            ])
            setPayments(paymentsRes.data.data)
            setRefundRequests(refundsRes.data.data)
            setAidRequests(aidRes.data.data)
        } catch (error) {
            message.error("Failed to fetch your payments")
        } finally {
            setLoading(false)
        }
    }

    const handleAddSuccess = (newRefundRequest) => {
        setRefundRequests((prev) => [newRefundRequest, ...prev])
        setShowForm(false)
    }

    const handleResendVerification = async () => {
        const response = await resendVerification()

        if (response?.data?.success) {
            message.success("Confirmation email sent — check your inbox")
        } else {
            message.error(response?.data?.message || "Could not send the email")
        }
    }

    const handleLogout = () => {
        dispatch(setUser({ user: null }))
        localStorage.removeItem("token")
        navigate("/login")
    }

    // after clicking the link in a second tab, this pulls the confirmed status in
    const handleRefreshUser = async () => {
        const response = await getCurrentUser()

        if (response?.data?.userData) {
            dispatch(setUser({ user: response.data.userData }))
            message.success("Account refreshed")
        }
    }

    const columns = [
        { title: "Date", dataIndex: "createdAt", render: (value) => dayjs(value).format("DD MMM YYYY") },
        { title: "What", dataIndex: "action" },
        { title: "Tier after", dataIndex: "tier" },
        { title: "Amount (₹)", dataIndex: "amountInr" },
        { title: "Status", dataIndex: "status" },
    ]

    if (!user) return null

    const openRefundRequest = refundRequests.find((request) => OPEN_REFUND_STATUSES.includes(request.status))
    const approvedAid = aidRequests.find((request) => request.status === "approved" && !request.usedAt)
    const pendingAid = aidRequests.find((request) => request.status === "pending")
    const journeyLabel = JOURNEY_OPTIONS.find((option) => option.value === user.journey)

    // refunds open only once all three Tier 1 steps have actually been delivered
    const hasCompletedTierOne = user.progress?.interestForm === "done"
        && user.progress?.psychometric === "done"
        && user.progress?.report !== "locked"

    // Account carries the student's access state, so the refund controls belong beside the plan
    const accountPanel = (
        <>
            <p>Name: <strong>{user.name}</strong></p>
            <p>
                Email: <strong>{user.email}</strong>{" "}
                {user.isEmailVerified
                    ? <span>✓ confirmed</span>
                    : (
                        <>
                            <span>— not confirmed yet</span>
                            {" "}
                            <button type="button" onClick={handleResendVerification}>Resend confirmation email</button>
                            {" "}
                            <button type="button" onClick={handleRefreshUser}>I've confirmed it</button>
                        </>
                    )}
            </p>
            {user.phone && <p>Phone: <strong>{user.phone}</strong></p>}
            <p>Age: <strong>{user.age}</strong></p>
            <p>Stage: <strong>{journeyLabel ? journeyLabel.label : user.journey}</strong></p>
            <p>Your plan: <strong>{TIER_NAMES[user.currentTier] || TIER_NAMES[0]}</strong></p>

            {openRefundRequest && (
                <p>
                    Your {openRefundRequest.refundType === "rollover" ? "move back to Career Discovery" : "refund request"}
                    {" "}is <strong>{openRefundRequest.status}</strong> (₹{openRefundRequest.amountInr}).
                </p>
            )}
            {user.paid && !openRefundRequest && hasCompletedTierOne && (
                <p>
                    Not happy?{" "}
                    <button type="button" onClick={() => setShowForm(true)}>Request a refund</button>
                </p>
            )}
        </>
    )

    const panels = [
        { key: "account", label: "Account information", children: accountPanel },
        {
            key: "payments",
            label: "Payment history",
            children: <Table rowKey="_id" loading={loading} columns={columns} dataSource={payments} pagination={false} />,
        },
    ]

    // only worth a panel if they've actually asked for aid
    if (pendingAid || approvedAid) {
        panels.push({
            key: "aid",
            label: "Financial aid",
            children: approvedAid
                ? (
                    <p>
                        💙 Approved: your price for Tier {approvedAid.requestedTier} is{" "}
                        <strong>₹{approvedAid.approvedAmountInr}</strong>. Pick that tier on the plans page
                        and it will be applied.
                    </p>
                )
                : <p>💙 Your financial aid request is <strong>pending</strong> — we'll call you soon.</p>,
        })
    }

    return (
        <div>
            <Navbar />
            <h2>Your profile</h2>

            <Collapse items={panels} defaultActiveKey={["account"]} />

            <p>
                <Popconfirm
                    title="Log out of Freshmxn?"
                    okText="Log out"
                    cancelText="Stay"
                    onConfirm={handleLogout}
                >
                    <button type="button">Log out</button>
                </Popconfirm>
            </p>

            <RequestRefundForm
                visible={showForm}
                onClose={() => setShowForm(false)}
                onAddSuccess={handleAddSuccess}
            />
        </div>
    )
}

export default Profile
