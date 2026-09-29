import { useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { useDispatch } from "react-redux"
import { getCurrentUser } from "../apiCall/userApi"
import { setUser } from "../store/userSlice"

// Google sign-in lands here with our JWT in the URL fragment: /oauth-success#token=...
function OAuthSuccess() {
    const navigate = useNavigate()
    const dispatch = useDispatch()
    const hasRun = useRef(false) // React StrictMode runs effects twice in dev; the token can only be read once

    useEffect(() => {
        if (hasRun.current) return
        hasRun.current = true

        const checkAuth = async () => {
            const token = new URLSearchParams(window.location.hash.slice(1)).get("token")

            // clear the token out of the address bar and browser history straight away
            window.history.replaceState(null, "", window.location.pathname)

            if (!token) {
                alert("Google sign-in failed")
                navigate("/login")
                return
            }

            localStorage.setItem("token", token)

            const currentUserResponse =
                await getCurrentUser()

            if (!currentUserResponse || currentUserResponse.data.success === false) {
                localStorage.removeItem("token")
                alert("Google sign-in failed")
                navigate("/login")
                return
            }

            const userData = currentUserResponse.data.userData

            dispatch(
                setUser({
                    user: userData,
                })
            )

            if (userData.role === "admin") { navigate("/admin"); return }
            if (!userData.age || !userData.journey) { navigate("/complete-profile"); return }
            if (!userData.paid) { navigate("/paywall"); return }

            navigate("/dashboard")
        }

        checkAuth()
    }, [navigate, dispatch])

    return <div>Signing you in...</div>
}

export default OAuthSuccess
