import { useState, useCallback } from "react"
import { useNavigate, Link } from "react-router-dom"
import { useDispatch } from "react-redux"
import { Input } from "antd"
import { registerMentor } from "../../apiCall/mentorsApi"
import { setUser } from "../../store/userSlice"
import logo from "../../assets/brand/logo.png"
import AuthCard from "../AuthCard"
import TurnstileBox, { turnstileOn } from "../TurnstileBox"

// Mentor sign-up. The account is created with role "mentor" by the server — which endpoint is
// called decides the role, never a field in the form.
function MentorRegister() {
    const navigate = useNavigate()
    const dispatch = useDispatch()
    const [name, setName] = useState("")
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    // Round 27: the same spam shields as the student sign-up — the bots of 6–10 Oct came through here
    const [website, setWebsite] = useState("")
    const [turnstileToken, setTurnstileToken] = useState("")
    const onToken = useCallback((token) => setTurnstileToken(token), [])

    const handleRegister = async (e) => {
        e.preventDefault()

        const response = await registerMentor({ name, email, password, website, turnstileToken })

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
        <AuthCard>
            <Link to="/" className="brand-link"><img src={logo} alt="Freshmxn" height="40" /></Link>
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
                {/* not for people: hidden from view and from screen readers; only a bot fills it */}
                <div className="hp-field" aria-hidden="true">
                    <label>Website</label>
                    <input type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
                </div>
                <div>
                    <label>Password (at least 8 characters)</label>
                    <br />
                    <Input.Password value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required />
                </div>
                <TurnstileBox onToken={onToken} />

                <button type="submit" className="tap" disabled={turnstileOn && !turnstileToken}>Create mentor account</button>
            </form>

            <p>Already a mentor? <Link to="/mentor/login">Log in</Link></p>
            <p>Looking for career guidance instead? <Link to="/register">Student sign-up</Link></p>
        </AuthCard>
    )
}

export default MentorRegister
