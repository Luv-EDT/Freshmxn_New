import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { message } from "antd"
import { getPricing, createOrder } from "../../apiCall/paymentsApi"
import { getMyWaitlist, startAnotherSession } from "../../apiCall/mentorWaitlistApi"
import { formatInr } from "../Public/usePricing"
import { loadRazorpayCheckout } from "./Paywall"
import { formatDate } from "./mentorshipParts"

// AFTER A MENTOR SESSION IS DONE (owner, Round 28). The session is logged; the student can book another
// — any career and job role from their recommendations (or any career on Mentor Only), or the same one
// with a different mentor. Each further session is a paid add-on at the Mentor Only price, which comes
// from the server. In manual payment mode the student asks us on WhatsApp and the admin records it.
function AnotherSession({ waitlist, onChanged }) {
    const navigate = useNavigate()
    const [pricing, setPricing] = useState(null)
    const [busy, setBusy] = useState(false)
    const credit = waitlist.extraSessionCredit || 0
    const last = (waitlist.sessions || [])[waitlist.sessions.length - 1]

    useEffect(() => {
        getPricing().then((response) => setPricing(response.data.data)).catch(() => setPricing(null))
    }, [])

    const start = async (sameField) => {
        setBusy(true)
        const response = await startAnotherSession({ sameField })
        setBusy(false)
        if (!response || response.data.success === false) {
            message.error(response?.data?.message || "Could not start another session")
            return
        }
        message.success(response.data.message)
        if (sameField) onChanged()
        else navigate("/mentorship/choose")
    }

    // pay, then wait for Razorpay's confirmation to add the session (the browser's word is never trusted)
    const pay = async () => {
        try {
            if (!(await loadRazorpayCheckout())) {
                message.error("Could not load Razorpay. Check your connection.")
                return
            }
            const response = await createOrder({ product: "mentor_session" })
            const { order, keyId } = response.data.data
            const checkout = new window.Razorpay({
                key: keyId,
                order_id: order.id,
                amount: order.amount,
                currency: "INR",
                name: "Freshmxn",
                description: "Another mentor session",
                handler: async () => {
                    message.info("Payment received — confirming...")
                    for (let attempt = 0; attempt < 15; attempt++) {
                        await new Promise((resolve) => setTimeout(resolve, 2000))
                        const place = (await getMyWaitlist())?.data?.data
                        if (place && place.extraSessionCredit > 0) {
                            message.success("Your next session is ready to book")
                            onChanged()
                            return
                        }
                    }
                    message.warning("Payment is still being confirmed. Please refresh in a minute.")
                },
            })
            checkout.on("payment.failed", (failure) => {
                message.error(`${failure?.error?.description || "The payment didn't go through"}. No money was taken — you can try again.`)
            })
            checkout.open()
        } catch (error) {
            message.error(error.response?.data?.message || "Failed to start payment")
        }
    }

    const price = pricing ? formatInr(pricing.mentorSessionInr) : ""

    return (
        <section className="another-session">
            <h3>Your mentor session is done</h3>
            {last && (
                <p>
                    You had your session in <strong>{last.jobRole ? `${last.jobRole} (${last.profession})` : last.profession}</strong>
                    {last.completedAt ? ` on ${formatDate(last.completedAt)}` : ""}. It's logged on your Profile under <strong>Mentor sessions</strong>.
                </p>
            )}
            <p>
                Want another? Pick a different career or job role from your recommendations — or the same one with a
                different mentor.
            </p>
            {credit > 0 ? (
                <div className="report-card-actions">
                    <button type="button" className="btn btn-primary tap" disabled={busy} onClick={() => start(false)}>Choose another career or job role →</button>
                    <button type="button" className="btn btn-ghost tap" disabled={busy} onClick={() => start(true)}>Same field — find me a different mentor</button>
                </div>
            ) : pricing && pricing.paymentMode === "razorpay" ? (
                <p><button type="button" className="btn btn-primary tap" onClick={pay}>Book another session — {price} →</button></p>
            ) : (
                <p>
                    Another session is {price}.{" "}
                    <a href={`https://wa.me/918882756287?text=${encodeURIComponent("Hi, I'd like to book another mentor session")}`} target="_blank" rel="noreferrer">WhatsApp us to book it</a>.
                </p>
            )}
        </section>
    )
}

export default AnotherSession
