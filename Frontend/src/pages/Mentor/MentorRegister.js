import { useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import { useDispatch } from "react-redux"
import { Input } from "antd"
import { registerMentor } from "../../apiCall/mentorsApi"
import { setUser } from "../../store/userSlice"
import logo from "../../assets/brand/logo.png"

// Mentor sign-up. The account is created with role "mentor" by the server — which endpoint is
// called decides the role, never a field in the form.
function MentorRegister() {
    const navigate = useNavigate()
    const dispatch = useDispatch()
    const [name, setName] = useState("")
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")

    const handleRegister = async (e) => {
        e.preventDefault()

        const response = await registerMentor({ name, email, password })

        if (!response) {
            alert("Cannot reach the server")
            return
        }

        // success must be explicit: an HTML error page (a proxy, CORS) has no success flag at all
        if (response.data?.success !== true || !response.data.token) {
            alert(response.data?.message || "Could not create your account. Please try again.")
            return
        }

        localStorage.setItem("token", response.data.token)
        dispatch(setUser({ user: response.data.userData }))
        navigate("/mentor")
    }

    return (
        <div className="page">
            <img src={logo} alt="Freshmxn" height="40" />
            <h2>Mentor with Freshmxn</h2>
            <p>
                Students are matched with working professionals in the field they've chosen — someone who was once
                exactly where they are. Create your mentor account, then tell us about yourself.
            </p>

            <form onSubmit={handleRegister}>
                <div>
                    <label>Full name</label>
                    <br />
                    <input value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
                <div>
                    <label>Email</label>
                    <br />
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div>
                    <label>Password (at least 8 characters)</label>
                    <br />
                    <Input.Password value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required />
                </div>
                <button type="submit" className="tap">Create mentor account</button>
            </form>

            <p>Already a mentor? <Link to="/mentor/login">Log in</Link></p>
            <p>Looking for career guidance instead? <Link to="/register">Student sign-up</Link></p>
        </div>
    )
}

export default MentorRegister
