import { useState, useEffect, useCallback } from "react"
import StageFields, { EMPTY_DETAIL } from "./StageFields"
import TurnstileBox, { turnstileOn } from "./TurnstileBox"
import { useNavigate, Link } from "react-router-dom"
import { useDispatch } from "react-redux"
import { registerUser, getGoogleSignInUrl } from "../apiCall/userApi"
import { setUser } from "../store/userSlice"
import { Input } from "antd"
import logo from "../assets/brand/logo.png"
import AuthCard from "./AuthCard"

function Register() {
    const navigate = useNavigate()
    const dispatch = useDispatch()
    const [name, setName] = useState("")
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [phone, setPhone] = useState("")
    const [age, setAge] = useState("")
    const [journey, setJourney] = useState("")
    const [journeyDetail, setJourneyDetail] = useState({ ...EMPTY_DETAIL })
    // Round 25 (spam sign-ups): a box only bots fill, and Cloudflare's check once its keys are set
    const [website, setWebsite] = useState("")
    const [turnstileToken, setTurnstileToken] = useState("")
    const onToken = useCallback((token) => setTurnstileToken(token), [])
    const [attempts, setAttempts] = useState(0)     // a failed try asks Cloudflare for a fresh token
    // TEMPORARY (V1): self-declared parent permission for under-18 students
    const [parentConsentChecked, setParentConsentChecked] = useState(false)
    const [parentName, setParentName] = useState("")
    const [parentPhone, setParentPhone] = useState("")
    const [parentEmail, setParentEmail] = useState("")

    // the plan chosen on /programs rides along to the paywall (owner, Round 25)
    useEffect(() => {
        const plan = new URLSearchParams(window.location.search).get("plan")
        if (["1", "2", "3"].includes(plan)) localStorage.setItem("chosenPlan", plan)
    }, [])

    // If already logged in, go to Home
    useEffect(() => {
        const token = localStorage.getItem("token")
        if (token) {
            navigate("/dashboard")
            return
        }
    }, [navigate])

    const isMinor = age !== "" && Number(age) < 18

    // ─── Register ────────────────────────────────────────────────────────────
    const handleRegister = async (e) => {
        e.preventDefault()

        const payload = {
            name: name,
            email: email,
            password: password,
            phone: phone,
            age: Number(age),
            journey: journey,
            journeyDetail: journeyDetail,
            parentConsentChecked: parentConsentChecked,
            parentName: parentName,
            parentPhone: parentPhone,
            parentEmail: parentEmail,
            website: website,
            turnstileToken: turnstileToken,
        }

        const registerResponse = await registerUser(payload)

        if (!registerResponse) {
            alert("Cannot reach the server")
            return
        }

        if (registerResponse.data.message === "User already exists") {
            alert("User already exists")
            navigate("/login")
            return
        }

        // Round 28: the password stays as typed — wiping it on every error made it feel "not accepted"
        if (registerResponse.data.success === false) {
            alert(registerResponse.data.message)
            setAttempts((count) => count + 1)
            return
        }

        if (!registerResponse.data.token) {
            alert("Something went wrong creating your account. Please try again.")
            setAttempts((count) => count + 1)
            return
        }

        localStorage.setItem("token", registerResponse.data.token)

        dispatch(
            setUser({
                user: registerResponse.data.userData,
            })
        )

        setName("")
        setEmail("")
        setPassword("")

        // payment comes immediately after signup
        navigate("/paywall")
    }

    return (
        <AuthCard>
            <Link to="/" className="brand-link"><img src={logo} alt="Freshmxn" height="40" /></Link>
            <h2>Create your account</h2>

            <form onSubmit={handleRegister}>
                <div>
                    <label>Name</label>
                    <br />
                    <input value={name} onChange={(e) => setName(e.target.value)} minLength={2} maxLength={60} required />
                </div>
                <div>
                    <label>Email</label>
                    <br />
                    <input type="email" name="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div>
                    <label>Mobile number (10 digits)</label>
                    <br />
                    <input type="tel" inputMode="numeric" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))} pattern="[0-9]{10}" required />
                </div>
                <div>
                    <label>Password (at least 8 characters)</label>
                    <br />
                    <Input.Password name="new-password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required />
                    <p className="legal-agree">Any 8 or more characters — letters, numbers or symbols.</p>
                </div>
                <div>
                    <label>Age</label>
                    <br />
                    <input type="number" min="8" max="100" value={age} onChange={(e) => setAge(e.target.value)} required />
                </div>

                <StageFields journey={journey} setJourney={setJourney} detail={journeyDetail} setDetail={setJourneyDetail} />

                {/* under-18: the student's tick here, then the parent's own confirmation by an emailed code (Round 10) */}
                {isMinor && (
                    <div>
                        <p><strong>You're under 18</strong></p>
                        <label>
                            <input type="checkbox" checked={parentConsentChecked} onChange={(e) => setParentConsentChecked(e.target.checked)} />
                            I have taken permission from my parent/guardian to use Freshmxn, and they agree to the{" "}
                            <Link to="/terms" target="_blank">Terms</Link> and <Link to="/privacy" target="_blank">Privacy Policy</Link>.
                        </label>
                        <div>
                            <label>Parent/guardian name</label>
                            <br />
                            <input value={parentName} onChange={(e) => setParentName(e.target.value)} required />
                        </div>
                        <div>
                            <label>Parent/guardian mobile (10 digits)</label>
                            <br />
                            <input value={parentPhone} onChange={(e) => setParentPhone(e.target.value)} pattern="[0-9]{10}" required />
                        </div>
                        <div>
                            <label>Parent/guardian email</label>
                            <br />
                            <input type="email" value={parentEmail} onChange={(e) => setParentEmail(e.target.value)} required />
                            <p className="legal-agree">We email them a 6-digit code so they can confirm their permission themselves.</p>
                        </div>
                    </div>
                )}

                <p className="legal-agree">
                    By creating an account you agree to our <Link to="/terms" target="_blank">Terms</Link> and{" "}
                    <Link to="/privacy" target="_blank">Privacy Policy</Link>.
                </p>

                <TurnstileBox onToken={onToken} resetKey={attempts} />

                <button type="submit" disabled={turnstileOn && !turnstileToken}>Create account</button>
                {/* not for people: hidden from view and from screen readers; only a bot fills it. It sits
                    AFTER the button (Round 28): placed just before the password, password managers took it
                    for the username box, filled it, and the sign-up quietly went nowhere */}
                <div className="hp-field" aria-hidden="true">
                    <label>Leave this empty</label>
                    <input type="text" name="hp_url" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
                </div>
            </form>

            <p className="auth-divider">or</p>

            <a href={getGoogleSignInUrl()}>
                <button type="button">Sign up with Google</button>
            </a>

            <p>Already have an account? <Link to="/login">Login</Link></p>
        </AuthCard>
    )
}

export default Register
