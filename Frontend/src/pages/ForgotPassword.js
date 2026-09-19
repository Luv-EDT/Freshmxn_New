import { useState } from "react"
import { Link } from "react-router-dom"
import { forgotPassword } from "../apiCall/userApi"

function ForgotPassword() {
    const [email, setEmail] = useState("")
    const [isSent, setIsSent] = useState(false)

    const handleSubmit = async (e) => {
        e.preventDefault()

        const payload = {
            email: email,
        }

        const forgotResponse = await forgotPassword(payload)

        if (!forgotResponse) {
            alert("Cannot reach the server")
            return
        }

        if (forgotResponse.data.success === false) {
            alert(forgotResponse.data.message)
            return
        }

        // the server says the same thing whether or not the email exists
        setIsSent(true)
        setEmail("")
    }

    return (
        <div>
            <h2>Forgot password</h2>

            {isSent ? (
                <p>If that email has an account, a reset link is on its way. It expires in 30 minutes.</p>
            ) : (
                <form onSubmit={handleSubmit}>
                    <label>Your account email</label>
                    <br />
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                    <button type="submit">Send reset link</button>
                </form>
            )}

            <p><Link to="/login">Back to login</Link></p>
        </div>
    )
}

export default ForgotPassword
