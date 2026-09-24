import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useDispatch, useSelector } from "react-redux"
import { message } from "antd"
import { getPricing, getQuote, getMyRequests, createOrder, getMyFinancialAid } from "../../apiCall/paymentsApi"
import { getCurrentUser, resendVerification } from "../../apiCall/userApi"
import { setUser } from "../../store/userSlice"
import RequestAccessForm from "./RequestAccessForm"
import FinancialAidForm from "./FinancialAidForm"
import { formatCallback } from "./callbackOptions"
import Navbar from "../Navbar"

// loads Razorpay's checkout script once, only when Razorpay mode is on
const loadRazorpayCheckout = () => {
    return new Promise((resolve) => {
        if (window.Razorpay) return resolve(true)
        const script = document.createElement("script")
        script.src = "https://checkout.razorpay.com/v1/checkout.js"
        script.onload = () => resolve(true)
        script.onerror = () => resolve(false)
        document.body.appendChild(script)
    })
}

function Paywall() {
    const navigate = useNavigate()
    const dispatch = useDispatch()
    const { user } = useSelector((state) => state.user)
    const [pricing, setPricing] = useState(null)
    const [selectedTier, setSelectedTier] = useState(null) // null | 1 | 2
    const [coupon, setCoupon] = useState("")
    const [couponError, setCouponError] = useState("")
    const [quote, setQuote] = useState(null)
    const [pendingRequest, setPendingRequest] = useState(null)
    const [aidRequests, setAidRequests] = useState([])
    const [showForm, setShowForm] = useState(false)
    const [showAidForm, setShowAidForm] = useState(false)
    const [loading, setLoading] = useState(false)

    // ─── Fetch pricing + any pending request on mount ────────────────────────
    useEffect(() => {
        fetchPaywallData()
    }, [])

    const fetchPaywallData = async () => {
        try {
            setLoading(true)
            const [pricingRes, requestsRes, aidRes] = await Promise.all([
                getPricing(),
                getMyRequests(),
                getMyFinancialAid(),
            ])
            setPricing(pricingRes.data.data)
            setPendingRequest(requestsRes.data.data.find((request) => request.status === "pending") || null)
            setAidRequests(aidRes.data.data)
        } catch (error) {
            message.error("Failed to fetch pricing")
        } finally {
            setLoading(false)
        }
    }

    // ─── Quote ───────────────────────────────────────────────────────────────
    // A rejected coupon must not wipe the price and the Request button along with it — the student
    // would be left with a "Selected" tier, no amount and no way forward but re-clicking the tier.
    // So a failed quote keeps the last good one and shows the problem beside the coupon field.
    const handleSelectTier = async (tier, couponCode) => {
        try {
            setSelectedTier(tier)
            const response = await getQuote({ tier, coupon: couponCode })
            setQuote(response.data.data)
            setCouponError("")
        } catch (error) {
            const failureMessage = error.response?.data?.message || "Failed to fetch quote"

            // retry without the coupon, so the undiscounted price is still on screen
            try {
                const fallback = await getQuote({ tier, coupon: "" })
                setQuote(fallback.data.data)
                setCouponError(`${failureMessage} — showing the price without a coupon.`)
            } catch (fallbackError) {
                setQuote(null)
                setCouponError("")
                message.error(fallbackError.response?.data?.message || failureMessage)
            }
        }
    }

    const handleApplyCoupon = async () => {
        if (!selectedTier) {
            message.error("Pick a plan first")
            return
        }
        await handleSelectTier(selectedTier, coupon)
    }

    const handleResendVerification = async () => {
        const response = await resendVerification()

        if (response?.data?.success) {
            message.success("Confirmation email sent — check your inbox")
        } else {
            message.error(response?.data?.message || "Could not send the email")
        }
    }

    const handleRefreshUser = async () => {
        const response = await getCurrentUser()

        if (response?.data?.userData) {
            dispatch(setUser({ user: response.data.userData }))
        }
    }

    // ─── Razorpay mode ───────────────────────────────────────────────────────
    const handlePayNow = async () => {
        try {
            const isLoaded = await loadRazorpayCheckout()
            if (!isLoaded) {
                message.error("Could not load Razorpay. Check your connection.")
                return
            }

            const response = await createOrder({ tier: quote.tier, coupon: quote.coupon })
            const { order, keyId } = response.data.data

            const checkout = new window.Razorpay({
                key: keyId,
                order_id: order.id,
                amount: order.amount,
                currency: "INR",
                name: "Freshmxn",
                description: `Tier ${quote.tier}`,
                prefill: { name: user?.name, email: user?.email },
                // this callback is NOT trusted — access is only granted by the verified webhook.
                // we just wait for the webhook to land.
                handler: () => {
                    message.info("Payment received — confirming...")
                    waitForAccess()
                },
            })
            checkout.open()
        } catch (error) {
            message.error(error.response?.data?.message || "Failed to start payment")
        }
    }

    const waitForAccess = async () => {
        for (let attempt = 0; attempt < 15; attempt++) {
            await new Promise((resolve) => setTimeout(resolve, 2000))
            const currentUserResponse = await getCurrentUser()
            const userData = currentUserResponse?.data?.userData
            if (userData && userData.paid && userData.currentTier >= quote.tier) {
                dispatch(setUser({ user: userData }))
                message.success("Access unlocked")
                navigate("/dashboard")
                return
            }
        }
        message.warning("Payment is still being confirmed. Please refresh in a minute.")
    }

    const handleAddSuccess = (newRequest) => {
        setPendingRequest(newRequest)
        setShowForm(false)
    }

    const handleAidSuccess = (newAidRequest) => {
        setAidRequests((prev) => [newAidRequest, ...prev])
        setShowAidForm(false)
    }

    if (loading || !pricing || !user) {
        return <div>Loading...</div>
    }

    const isOnTierTwo = user.paid && user.currentTier === 2
    const pendingAid = aidRequests.find((request) => request.status === "pending")
    const approvedAid = aidRequests.find((request) => request.status === "approved" && !request.usedAt)

    return (
        <div>
            <Navbar />
            <h2>Choose your plan</h2>

            {/* An unconfirmed address can never receive a reset link or a receipt, so paying waits */}
            {!user.isEmailVerified && (
                <div>
                    <p>
                        <strong>Please confirm your email first.</strong> We've sent a link to {user.email} —
                        click it and you'll be able to buy a plan.
                    </p>
                    <button type="button" onClick={handleResendVerification}>Resend confirmation email</button>
                    {" "}
                    <button type="button" onClick={handleRefreshUser}>I've confirmed it</button>
                    <hr />
                </div>
            )}

            {isOnTierTwo && (
                <p>You already have the Mentor Connection plan — the highest tier. <button type="button" onClick={() => navigate("/dashboard")}>Go home</button></p>
            )}

            {/* Pending request */}
            {pendingRequest && (
                <div>
                    <p>
                        <strong>Your request is pending.</strong> Tier {pendingRequest.requestedTier} —
                        ₹{pendingRequest.finalAmountInr}. We'll call you
                        ({formatCallback(pendingRequest.callbackDay, pendingRequest.callbackSlot)}) to complete the payment.
                    </p>
                </div>
            )}

            {/* Offerings */}
            {!isOnTierTwo && !pendingRequest && (
                <div>
                    <div>
                        <h3>Tier 1 — {pricing.tiers[1].name}</h3>
                        <p>₹{pricing.tiers[1].amountInr}</p>
                        <p>Full assessment, your psychometric profile, a journey-shaped profession report, readiness layer and values profile.</p>
                        {user.paid && user.currentTier === 1 ? (
                            <p><em>Your current plan</em></p>
                        ) : (
                            <button type="button" onClick={() => handleSelectTier(1, coupon)}>
                                {selectedTier === 1 ? "Selected" : "Choose Tier 1"}
                            </button>
                        )}
                    </div>

                    <div>
                        <h3>Tier 2 — {pricing.tiers[2].name}</h3>
                        <p>
                            ₹{pricing.tiers[2].amountInr}
                            {user.paid && user.currentTier === 1 && ` — upgrade for ₹${pricing.upgradeAmountInr}`}
                        </p>
                        <p>Everything in Tier 1, plus a mentor matched to your chosen profession: a 1-hour clarity session and a 20-minute follow-up.</p>
                        <button type="button" onClick={() => handleSelectTier(2, coupon)}>
                            {selectedTier === 2 ? "Selected" : user.paid && user.currentTier === 1 ? "Upgrade to Tier 2" : "Choose Tier 2"}
                        </button>
                    </div>

                    {/* Coupon */}
                    <div>
                        <label>Coupon code (optional)</label>
                        <br />
                        <input value={coupon} onChange={(e) => setCoupon(e.target.value)} />
                        <button type="button" onClick={handleApplyCoupon}>Apply</button>
                        {couponError && <p><strong>{couponError}</strong></p>}
                    </div>

                    {/* Final amount */}
                    {quote && (
                        <div>
                            <p>
                                {quote.isUpgrade ? "Upgrade amount" : "Amount"}: ₹{quote.baseAmountInr}
                                {quote.isFinancialAid && " — financial aid rate"}
                                {!quote.isFinancialAid && quote.discountPct > 0 && ` − ${quote.discountPct}% (${quote.coupon})`}
                                {" = "}
                                <strong>₹{quote.finalAmountInr}</strong>
                            </p>

                            {pricing.paymentMode === "razorpay" ? (
                                <button type="button" onClick={handlePayNow}>Pay ₹{quote.finalAmountInr}</button>
                            ) : (
                                <button type="button" onClick={() => setShowForm(true)}>Request access</button>
                            )}
                        </div>
                    )}

                    {/* Financial aid */}
                    <hr />
                    {approvedAid ? (
                        <p>
                            💙 <strong>Financial aid approved.</strong> Your price for Tier {approvedAid.requestedTier} is
                            ₹{approvedAid.approvedAmountInr} — pick that tier above and it will be applied.
                        </p>
                    ) : pendingAid ? (
                        <p>💙 <strong>Your financial aid request is pending.</strong> We'll call you soon.</p>
                    ) : (
                        <div>
                            <h3>💙 FINANCIAL AID AVAILABLE</h3>
                            <p>
                                Can't afford it? Tell us on a quick call. If the need is genuine, we'll offer you a
                                subsidised rate.
                            </p>
                            <button type="button" onClick={() => setShowAidForm(true)}>
                                Ask about financial aid
                            </button>
                        </div>
                    )}
                </div>
            )}

            <RequestAccessForm
                visible={showForm}
                onClose={() => setShowForm(false)}
                quote={quote}
                defaultName={user.name}
                defaultPhone={user.phone}
                onAddSuccess={handleAddSuccess}
            />

            <FinancialAidForm
                visible={showAidForm}
                onClose={() => setShowAidForm(false)}
                tier={selectedTier || 1}
                defaultName={user.name}
                defaultPhone={user.phone}
                onAddSuccess={handleAidSuccess}
            />
        </div>
    )
}

export default Paywall
