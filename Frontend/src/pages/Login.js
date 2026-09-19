import { useState, useEffect, useRef } from "react"
import { useNavigate, Link, useSearchParams } from "react-router-dom"
import { useDispatch } from "react-redux"
import { loginUser, getCurrentUser, getGoogleSignInUrl } from "../apiCall/userApi"
import { setUser } from "../store/userSlice"

function Login() {
    const navigate = useNavigate()
    const dispatch = useDispatch()
    const [searchParams] = useSearchParams()
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const hasShownOauthError = useRef(false) // StrictMode runs effects twice in dev — alert once

    // If already logged in, go to Home
    useEffect(() => {
        const token = localStorage.getItem("token")
        if (token) {
            navigate("/")
            return
        }

        // Google sign-in sends people back here with a reason when it fails
        const oauthError = searchParams.get("oauthError")
        if (oauthError && !hasShownOauthError.current) {
            hasShownOauthError.current = true
            alert(oauthError)
        }
    }, [navigate, searchParams])

    // ─── Login ───────────────────────────────────────────────────────────────
    const handleLogin = async (e) => {
        e.preventDefault()

        const payload = {
            email: email,
            password: password,
        }

        const loginResponse = await loginUser(payload)

        if (!loginResponse) {
            alert("Cannot reach the server")
            return
        }

        if (loginResponse.data.message === "User not found") {
            alert("User not found")
            setEmail("")
            setPassword("")
            navigate("/register")
            return
        }

        if (loginResponse.data.message === "This account uses Google Sign-In") {
            alert("This account uses Google Sign-In. Please use the Google button.")
            setPassword("")
            return
        }

        if (loginResponse.data.success === false) {
            alert(loginResponse.data.message)
            setPassword("")
            return
        }

        localStorage.setItem("token", loginResponse.data.token)

        const currentUserResponse =
            await getCurrentUser()

        const userData = currentUserResponse.data.userData

        dispatch(
            setUser({
                user: userData,
            })
        )

        setEmail("")
        setPassword("")

        if (userData.role === "admin") { navigate("/admin"); return }
        if (!userData.age || !userData.journey) { navigate("/complete-profile"); return }
        if (!userData.paid) { navigate("/paywall"); return }

        navigate("/")
    }

    return (
        <div>
            <h2>Login</h2>

            <form onSubmit={handleLogin}>
                <div>
                    <label>Email</label>
                    <br />
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div>
                    <label>Password</label>
                    <br />
                    <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                </div>
                <button type="submit">Login</button>
            </form>

            <p><Link to="/forgot-password">Forgot password?</Link></p>

            <p>or</p>

            {/* full-page redirect: backend → Google → backend → /oauth-success */}
            <a href={getGoogleSignInUrl()}>
                <button type="button">Sign in with Google</button>
            </a>

            <p>New here? <Link to="/register">Create an account</Link></p>
        </div>
    )
}

export default Login
