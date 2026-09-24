import { useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import { useDispatch } from "react-redux"
import { Input } from "antd"
import { loginUser, getCurrentUser } from "../../apiCall/userApi"
import { setUser } from "../../store/userSlice"
import logo from "../../assets/brand/logo.png"

// The mentor login page (PRD §C.1: separate page, same auth stack). It calls the ordinary
// /user/login — the account's role decides where it lands.
function MentorLogin() {
    const navigate = useNavigate()
    const dispatch = useDispatch()
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")

    const handleLogin = async (e) => {
        e.preventDefault()

        const loginResponse = await loginUser({ email, password })

        if (!loginResponse) {
            alert("Cannot reach the server")
            return
        }

        if (loginResponse.data?.success !== true || !loginResponse.data.token) {
            alert(loginResponse.data?.message || "Could not log in. Please try again.")
            setPassword("")
            return
        }

        localStorage.setItem("token", loginResponse.data.token)

        const currentUserResponse = await getCurrentUser()
        const userData = currentUserResponse.data.userData

        dispatch(setUser({ user: userData }))

        // a student or admin who came in through the wrong door still gets in — to their own home
        if (userData.role !== "mentor") {
            alert("This is the mentor login — taking you to your own account.")
            navigate(userData.role === "admin" ? "/admin" : "/")
            return
        }

        navigate("/mentor")
    }

    return (
        <div className="page">
            <img src={logo} alt="Freshmxn" height="40" />
            <h2>Mentor login</h2>

            <form onSubmit={handleLogin}>
                <div>
                    <label>Email</label>
                    <br />
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div>
                    <label>Password</label>
                    <br />
                    <Input.Password value={password} onChange={(e) => setPassword(e.target.value)} required />
                </div>
                <button type="submit" className="tap">Log in</button>
            </form>

            <p><Link to="/forgot-password">Forgot password?</Link></p>
            <p>New mentor? <Link to="/mentor/register">Create a mentor account</Link></p>
            <p>Student? <Link to="/login">Student login</Link></p>
        </div>
    )
}

export default MentorLogin
