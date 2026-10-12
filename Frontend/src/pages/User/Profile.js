import { useState, useEffect } from "react"
import ParentConsentBanner from "./ParentConsentBanner"
import { useSelector, useDispatch } from "react-redux"
import { Link } from "react-router-dom"
import { Table, Collapse, message } from "antd"
import dayjs from "dayjs"
import { getMyPayments, getMyRefundRequests, getMyFinancialAid } from "../../apiCall/paymentsApi"
import { getMyWaitlist } from "../../apiCall/mentorWaitlistApi"
import { hasMentor } from "../plans"
import { resendVerification, getCurrentUser } from "../../apiCall/userApi"
import { setUser } from "../../store/userSlice"
import RequestRefundForm from "./RequestRefundForm"
import Navbar from "../Navbar"
import LogoutButton from "../LogoutButton"
import AccountEdit, { EmailChange } from "./AccountEdit"
import { JOURNEY_OPTIONS } from "../journeyOptions"
import { PLAN_NAMES as TIER_NAMES } from "../plans"
import { ACTION_WORDS, paymentStatusWord, REQUEST_WORDS, AID_WORDS, trackingIds } from "./paymentWords"


const OPEN_REFUND_STATUSES = ["pending", "refund_pending", "refund_failed"]

// Account + money. Refunds are payment rows, so purchases, upgrades and refunds all sit in the
// one Payment history table rather than being split across two.
function Profile() {
    const dispatch = useDispatch()
    const { user } = useSelector((state) => state.user)
    const [payments, setPayments] = useState([])
    const [refundRequests, setRefundRequests] = useState([])
    const [aidRequests, setAidRequests] = useState([])
    const [loading, setLoading] = useState(false)
    const [showForm, setShowForm] = useState(false)
    const [editing, setEditing] = useState(false)
    const [mentorSessions, setMentorSessions] = useState([])   // Round 28: sessions done, from the waitlist place

    useEffect(() => {
        fetchHistory()
    }, [])

    useEffect(() => {
        if (!hasMentor(user)) return
        getMyWaitlist().then((response) => setMentorSessions((response?.data?.data && response.data.data.sessions) || [])).catch(() => setMentorSessions([]))
    }, [user])

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

    // after clicking the link in a second tab, this pulls the confirmed status in
    const handleRefreshUser = async () => {
        const response = await getCurrentUser()

        if (response?.data?.userData) {
            dispatch(setUser({ user: response.data.userData }))
            message.success("Account refreshed")
        }
    }

    // Round 28: plain words for every status, and the ids to quote to Razorpay or a bank
    const columns = [
        { title: "Date", dataIndex: "createdAt", render: (value) => dayjs(value).format("DD MMM YYYY") },
        { title: "What", dataIndex: "action", render: (value) => ACTION_WORDS[value] || value },
        { title: "Plan after", dataIndex: "tier", render: (value) => TIER_NAMES[value] || value },
        { title: "Amount (₹)", dataIndex: "amountInr" },
        {
            title: "Status",
            render: (_, row) => (
                <>
                    <strong>{paymentStatusWord(row)}</strong>
                    {row.status === "failed" && row.failureMessage && <div className="pc-small">{row.failureMessage}</div>}
                    {row.action === "refund" && row.status === "refund_pending" && <div className="pc-small">Razorpay usually takes 5–7 working days</div>}
                    {trackingIds(row).map((id) => <div key={id} className="pc-small">{id}</div>)}
                </>
            ),
        },
    ]

    if (!user) return null

    const openRefundRequest = refundRequests.find((request) => OPEN_REFUND_STATUSES.includes(request.status))
    const approvedAid = aidRequests.find((request) => request.status === "approved" && !request.usedAt)
    const pendingAid = aidRequests.find((request) => request.status === "pending")
    const journeyLabel = JOURNEY_OPTIONS.find((option) => option.value === user.journey)

    // refunds open only once all three Career Discovery steps have actually been delivered — and
    // any time on Mentor Only, whose promise is a full refund if we can't match (Round 12)
    const hasCompletedTierOne = user.currentTier === 3 || (user.progress?.interestForm === "done"
        && user.progress?.psychometric === "done"
        && user.progress?.report !== "locked")

    // Account carries the student's access state, so the refund controls belong beside the plan
    const accountPanel = editing ? <AccountEdit user={user} onDone={() => setEditing(false)} /> : (
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
            <EmailChange user={user} />
            <p>Phone: <strong>{user.phone || "not added yet"}</strong></p>
            <p>Age: <strong>{user.age}</strong></p>
            <p>Stage: <strong>{journeyLabel ? journeyLabel.label : user.journey}</strong></p>
            {user.role === "student" && (
                <p><button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(true)}>Edit my details</button></p>
            )}
            <p>Your plan: <strong>{TIER_NAMES[user.currentTier] || TIER_NAMES[0]}</strong></p>

            {openRefundRequest && (
                <p>
                    Your {openRefundRequest.refundType === "rollover" ? "move back to Career Discovery" : "refund request"}
                    {" "}(₹{openRefundRequest.amountInr}): <strong>{REQUEST_WORDS[openRefundRequest.status] || openRefundRequest.status}</strong>.
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
        // Round 28 (owner): the whole report, and the psychometric analysis inside it, rather than the
        // scores repeated here
        {
            key: "report",
            label: "Your report",
            children: user.progress?.report === "ready"
                ? (
                    <p className="report-card-actions">
                        <Link to="/report" className="btn btn-primary btn-sm tap">Open your report →</Link>{" "}
                        <Link to="/report/psychometric" className="btn btn-ghost btn-sm tap">Your psychometric analysis →</Link>
                    </p>
                )
                : <p>Your report appears here once it's ready — finish Virtual Career Counselling and the assessment first.</p>,
        },
        {
            key: "payments",
            label: "Payment history",
            children: (
                <>
                    <div className="table-scroll"><Table rowKey="_id" loading={loading} columns={columns} dataSource={payments} pagination={false} /></div>
                    {/* every refund request, including a declined one with our reason (Round 28) */}
                    {refundRequests.length > 0 && (
                        <>
                            <h3 className="pc-section-title">Refund requests</h3>
                            <ul className="refund-request-list">
                                {refundRequests.map((request) => (
                                    <li key={request._id}>
                                        {dayjs(request.createdAt).format("DD MMM YYYY")} · ₹{request.amountInr} ·{" "}
                                        {request.refundType === "rollover" ? "Move back to Career Discovery" : "Full refund"} ·{" "}
                                        <strong>{REQUEST_WORDS[request.status] || request.status}</strong>
                                        {request.status === "declined" && request.adminNote && <div>Reason: {request.adminNote}</div>}
                                        {(request.refunds || []).flatMap(trackingIds).map((id) => <div key={id} className="pc-small">{id}</div>)}
                                    </li>
                                ))}
                            </ul>
                        </>
                    )}
                </>
            ),
        },
    ]

    // only worth a panel if they've actually asked for aid; every request shows, with our reason for a
    // "no" (Round 28)
    if (aidRequests.length > 0) {
        panels.push({
            key: "aid",
            label: "Financial aid",
            children: (
                <>
                    {approvedAid && (
                        <p>
                            💙 Approved: your price for {TIER_NAMES[approvedAid.requestedTier]} is{" "}
                            <strong>₹{approvedAid.approvedAmountInr}</strong>. Pick that plan on the plans page
                            and it will be applied.
                        </p>
                    )}
                    {pendingAid && <p>💙 Your financial aid request is <strong>waiting</strong> — we'll call you soon.</p>}
                    <ul className="refund-request-list">
                        {aidRequests.map((request) => (
                            <li key={request._id}>
                                {dayjs(request.createdAt).format("DD MMM YYYY")} · {TIER_NAMES[request.requestedTier]} ·{" "}
                                <strong>{AID_WORDS[request.status] || request.status}</strong>
                                {request.status === "declined" && request.adminNote && <div>Reason: {request.adminNote}</div>}
                            </li>
                        ))}
                    </ul>
                </>
            ),
        })
    }

    // MENTOR SESSIONS (owner, Round 28): every session done, with another one bookable on /mentorship
    if (hasMentor(user)) {
        panels.push({
            key: "mentor-sessions",
            label: "Mentor sessions",
            children: mentorSessions.length === 0
                ? <p>No sessions done yet. <Link to="/mentorship">See where your mentor match stands →</Link></p>
                : (
                    <>
                        <ul className="refund-request-list">
                            {mentorSessions.map((session, index) => (
                                <li key={`${session.profession}-${index}`}>
                                    {session.completedAt ? dayjs(session.completedAt).format("DD MMM YYYY") : "—"} ·{" "}
                                    <strong>{session.jobRole ? `${session.jobRole} (${session.profession})` : session.profession}</strong>
                                    {session.mentorName ? ` · with ${session.mentorName}` : ""}
                                </li>
                            ))}
                        </ul>
                        <p><Link to="/mentorship">Book another mentor session →</Link></p>
                    </>
                ),
        })
    }

    // last, so it's always in the same place — same numbers as the public site's footer
    panels.push({
        key: "contact",
        label: "Contact us",
        children: (
            <>
                <p>Questions about your journey, your report or a payment? We're a message away.</p>
                <p>
                    <a href="https://wa.me/918882756287" target="_blank" rel="noreferrer" className="tap">Chat on WhatsApp</a>
                </p>
                <p>
                    Call: <a href="tel:8882756287">8882756287</a>
                    {" · "}
                    Email: <a href="mailto:luvgoel@freshmxn.com">luvgoel@freshmxn.com</a>
                </p>
            </>
        ),
    })

    return (
        <div>
            <Navbar />
            <main className="page">
                <h2>Your profile</h2>

                {/* every section starts folded — the student opens what they came for */}
                <ParentConsentBanner />
                <Collapse items={panels} />

                <p>
                    <LogoutButton />
                </p>
            </main>

            <RequestRefundForm
                visible={showForm}
                onClose={() => setShowForm(false)}
                onAddSuccess={handleAddSuccess}
            />
        </div>
    )
}

export default Profile
