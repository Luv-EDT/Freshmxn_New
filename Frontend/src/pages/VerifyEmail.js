import { useState, useEffect, useRef } from "react"
import { useNavigate, useParams, Link } from "react-router-dom"
import { verifyEmail } from "../apiCall/userApi"

// the link from the signup email lands here. React StrictMode runs effects twice in development,
// and the token is single-use, so the second run would always report failure without this guard.
function VerifyEmail() {
    const navigate = useNavigate()
    const { token } = useParams()
    const [status, setStatus] = useState("checking")    // checking | done | failed
    const [errorMessage, setErrorMessage] = useState("")
    const hasRun = useRef(false)

    useEffect(() => {
        if (hasRun.current) return
        hasRun.current = true

        confirmEmail()
    }, [])

    const confirmEmail = async () => {
        const response = await verifyEmail(token)

        if (!response) {
            setStatus("failed")
            setErrorMessage("Cannot reach the server")
            return
        }

        if (response.data.success === false) {
            setStatus("failed")
            setErrorMessage(response.data.message)
            return
        }

        setStatus("done")
    }

    if (status === "checking") {
        return <div><h2>Confirming your email...</h2></div>
    }

    if (status === "failed") {
        return (
            <div>
                <h2>That link didn't work</h2>
                <p>{errorMessage}</p>
                <p>Log in and use "Resend confirmation email" on your profile to get a fresh link.</p>
                <p><Link to="/login">Back to login</Link></p>
            </div>
        )
    }

    return (
        <div>
            <h2>Email confirmed</h2>
            <p>Thanks — your email address is confirmed. You can now buy a plan.</p>
            <button type="button" onClick={() => navigate("/paywall")}>See plans</button>
            {" "}
            <button type="button" onClick={() => navigate("/")}>Go to home</button>
        </div>
    )
}

export default VerifyEmail
