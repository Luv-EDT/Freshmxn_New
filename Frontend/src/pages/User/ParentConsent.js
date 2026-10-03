import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { message } from "antd"
import Navbar from "../Navbar"
import { getMyConsent, sendParentOtp, verifyParentOtp } from "../../apiCall/consentApi"

// Your parent confirms (owner, Round 10) — the page an under-18 student is sent to by the dashboard
// banner or the paywall. We email the PARENT a 6-digit code; the parent gives it to the student (or
// types it in themselves). Until then nothing can be paid for. SMS codes come later.
function ParentConsent() {
    const [consent, setConsent] = useState(null)
    const [email, setEmail] = useState("")
    const [code, setCode] = useState("")
    const [busy, setBusy] = useState(false)
    const [wait, setWait] = useState(0)

    const load = async () => {
        try {
            const response = await getMyConsent()
            setConsent(response.data.data)
            setWait(response.data.data.resendInSeconds || 0)
        } catch (error) {
            message.error("Could not load this page — check your connection")
        }
    }

    useEffect(() => { load() }, [])

    // the resend countdown
    useEffect(() => {
        if (wait <= 0) return undefined
        const timer = setTimeout(() => setWait((left) => left - 1), 1000)
        return () => clearTimeout(timer)
    }, [wait])

    const send = async () => {
        setBusy(true)
        try {
            const response = await sendParentOtp(email.trim() ? { parentEmail: email.trim() } : {})
            message.success(response.data.message)
            setEmail("")
            await load()
        } catch (error) {
            message.error(error.response?.data?.message || "Could not send the code")
            if (error.response?.data?.data?.resendInSeconds) setWait(error.response.data.data.resendInSeconds)
        } finally {
            setBusy(false)
        }
    }

    const verify = async () => {
        setBusy(true)
        try {
            const response = await verifyParentOtp({ code })
            message.success(response.data.message)
            await load()
        } catch (error) {
            message.error(error.response?.data?.message || "Could not check the code")
        } finally {
            setBusy(false)
        }
    }

    if (!consent) return (<div><Navbar /><div className="page"><p>Loading…</p></div></div>)

    return (
        <div>
            <Navbar />
            <div className="page parent-consent">
                <h1>Your parent's permission</h1>

                {consent.status === "not_needed" && <p>You're 18 or over, so there is nothing to do here.</p>}

                {consent.status === "verified" && (
                    <>
                        <p className="retake-note"><strong>Confirmed.</strong> Your parent has given their permission — thank you.</p>
                        <p><Link to="/dashboard">Back to your dashboard</Link></p>
                    </>
                )}

                {(consent.status === "waiting_for_parent" || consent.status === "missing") && (
                    <>
                        <p>
                            Because you're under 18, the law asks your parent or guardian to confirm that you can use
                            Freshmxn. We email them a 6-digit code — ask them to read it out to you, or to type it in
                            here themselves.
                        </p>

                        {consent.status === "missing" && (
                            <p>Add your parent's details on your <Link to="/complete-profile">profile</Link> first.</p>
                        )}

                        {consent.hasParentEmail && (
                            <p>
                                {consent.codeSent ? "We sent the code to " : "We'll send the code to "}
                                <strong>{consent.parentEmail}</strong>. It works for 10 minutes.
                            </p>
                        )}

                        {consent.status === "waiting_for_parent" && (
                            <div className="consent-step">
                                <label htmlFor="code">The code from your parent's email</label>
                                <input
                                    id="code"
                                    inputMode="numeric"
                                    autoComplete="one-time-code"
                                    maxLength={6}
                                    value={code}
                                    onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
                                />
                                <button type="button" className="btn btn-primary" onClick={verify} disabled={busy || code.length !== 6}>Confirm</button>
                            </div>
                        )}

                        {consent.status === "waiting_for_parent" && (
                            <details className="faq-item">
                                <summary>Didn't get it, or wrong email?</summary>
                                <p>Check the spam folder first. Then send a new code — to the same address, or to a corrected one.</p>
                                <label htmlFor="parent-email">Parent's email (leave empty to use {consent.parentEmail || "the one you gave"})</label>
                                <input id="parent-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
                                <button type="button" className="btn btn-ghost" onClick={send} disabled={busy || wait > 0}>
                                    {wait > 0 ? `Send a new code in ${wait}s` : "Send a new code"}
                                </button>
                            </details>
                        )}
                    </>
                )}
            </div>
        </div>
    )
}

export default ParentConsent
