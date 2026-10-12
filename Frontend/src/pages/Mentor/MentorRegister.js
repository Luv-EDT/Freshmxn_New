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
    const [attempts, setAttempts] = useState(0)     // a failed try asks Cloudflare for a fresh token

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
            setAttempts((count) => count + 1)
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
                    <input type="email" name="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div>
                    <label>Password (at least 8 characters)</label>
                    <br />
                    <Input.Password name="new-password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required />
                    <p className="legal-agree">Any 8 or more characters — letters, numbers or symbols.</p>
                </div>
                <TurnstileBox onToken={onToken} resetKey={attempts} />

                <button type="submit" className="tap" disabled={turnstileOn && !turnstileToken}>Create mentor account</button>
                {/* not for people: hidden from view and from screen readers; only a bot fills it. It sits
                    AFTER the button (Round 28): placed just before the password, password managers took it
                    for the username box, filled it, and the sign-up quietly went nowhere */}
                <div className="hp-field" aria-hidden="true">
                    <label>Leave this empty</label>
                    <input type="text" name="hp_url" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
                </div>
            </form>

            <p>Already a mentor? <Link to="/mentor/login">Log in</Link></p>
            <p>Looking for career guidance instead? <Link to="/register">Student sign-up</Link></p>
        </AuthCard>
    )
}

export default MentorRegister
