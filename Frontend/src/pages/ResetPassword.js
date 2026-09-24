import { useState } from "react"
import { useNavigate, useParams, Link } from "react-router-dom"
import { resetPassword } from "../apiCall/userApi"
import logo from "../assets/brand/logo.png"
import { Input } from "antd"

function ResetPassword() {
    const navigate = useNavigate()
    const { token } = useParams()
    const [password, setPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")

    const handleSubmit = async (e) => {
        e.preventDefault()

        if (password !== confirmPassword) {
            alert("Passwords do not match")
            return
        }

        const payload = {
            password: password,
        }

        const resetResponse = await resetPassword(token, payload)

        setPassword("")
        setConfirmPassword("")

        if (!resetResponse) {
            alert("Cannot reach the server")
            return
        }

        if (resetResponse.data.success === false) {
            alert(resetResponse.data.message)
            return
        }

        alert("Password reset successfully. Please log in.")
        navigate("/login")
    }

    return (
        <div>
            <Link to="/"><img src={logo} alt="Freshmxn" height="40" /></Link>
            <h2>Set a new password</h2>

            <form onSubmit={handleSubmit}>
                <div>
                    <label>New password (at least 8 characters)</label>
                    <br />
                    <Input.Password value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required />
                </div>
                <div>
                    <label>Confirm new password</label>
                    <br />
                    <Input.Password value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} minLength={8} required />
                </div>
                <button type="submit">Reset password</button>
            </form>

            <p><Link to="/login">Back to login</Link></p>
        </div>
    )
}

export default ResetPassword
