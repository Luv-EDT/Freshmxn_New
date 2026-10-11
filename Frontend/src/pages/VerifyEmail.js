import { useState } from "react"
import { useNavigate, useParams, Link } from "react-router-dom"
import { useDispatch } from "react-redux"
import { verifyEmail, getCurrentUser } from "../apiCall/userApi"
import { setUser } from "../store/userSlice"
import logo from "../assets/brand/logo.png"
import AuthCard from "./AuthCard"

// The link from the "confirm your email" message lands here. Since Round 25 the email is confirmed
// only when a person presses the button: inbox link-scanners open every link in a message, and when
// this page confirmed on load they were quietly verifying spam sign-ups. The token is single-use, so
// the button is disabled once pressed.
function VerifyEmail() {
    const navigate = useNavigate()
    const dispatch = useDispatch()
    const { token } = useParams()
    const [status, setStatus] = useState("waiting")    // waiting | checking | done | failed
    const [doneMessage, setDoneMessage] = useState("")
    const [errorMessage, setErrorMessage] = useState("")

    const confirmEmail = async () => {
        setStatus("checking")
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

        setDoneMessage(response.data.message)
        setStatus("done")

        // a logged-in student sees the confirmed (or changed) email straight away
        if (localStorage.getItem("token")) {
            const current = await getCurrentUser()
            if (current?.data?.userData) dispatch(setUser({ user: current.data.userData }))
        }
    }

    if (status === "waiting" || status === "checking") {
        return (
            <AuthCard>
                <Link to="/" className="brand-link"><img src={logo} alt="Freshmxn" height="40" /></Link>
                <h2>Confirm your email</h2>
                <p>Press the button to confirm this email address for your Freshmxn account.</p>
                <button type="button" className="btn btn-primary" disabled={status === "checking"} onClick={confirmEmail}>
                    {status === "checking" ? "Confirming…" : "Confirm my email"}
                </button>
            </AuthCard>
        )
    }

    if (status === "failed") {
        return (
            <AuthCard>
                <Link to="/" className="brand-link"><img src={logo} alt="Freshmxn" height="40" /></Link>
                <h2>That link didn't work</h2>
                <p>{errorMessage}</p>
                <p>Log in and use "Resend confirmation email" on your profile to get a fresh link.</p>
                <p><Link to="/login">Back to login</Link></p>
            </AuthCard>
        )
    }

    return (
        <AuthCard>
            <Link to="/" className="brand-link"><img src={logo} alt="Freshmxn" height="40" /></Link>
            <h2>Email confirmed</h2>
            <p>{doneMessage === "Email confirmed successfully" ? "Thanks — your email address is confirmed. You can now buy a plan." : doneMessage}</p>
            <button type="button" onClick={() => navigate("/paywall")}>See plans</button>
            {" "}
            <button type="button" onClick={() => navigate("/dashboard")}>Go to home</button>
        </AuthCard>
    )
}

export default VerifyEmail
