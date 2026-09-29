import { useEffect, useState } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { useDispatch } from "react-redux"
import { getCurrentUser } from "../../apiCall/userApi"
import { setUser } from "../../store/userSlice"

// requirePaid: true → a student who hasn't paid is sent to the paywall
function ProtectedRoute({ children, requirePaid }) {
    const dispatch = useDispatch()
    const navigate = useNavigate()
    const location = useLocation()
    const [loading, setLoading] = useState(true)

    const token = localStorage.getItem("token")

    useEffect(() => {
        if (!token) {
            setLoading(false)
            navigate("/login")
            return
        }

        const checkAuth = async () => {
            try {
                const currentUserResponse = await getCurrentUser()

                if (!currentUserResponse || currentUserResponse.data.success === false) {
                    localStorage.removeItem("token")
                    setLoading(false)
                    navigate("/login")
                    alert("session expired")
                    return
                }

                const userData = currentUserResponse.data.userData

                dispatch(
                    setUser({
                        user: userData,
                    })
                )

                if (userData.role === "admin") {
                    navigate("/admin")
                    return
                }

                // mentors have their own pages — the student journey is not theirs
                if (userData.role === "mentor") {
                    navigate("/mentor")
                    return
                }

                // a Google sign-in has no age or journey yet
                if ((!userData.age || !userData.journey) && location.pathname !== "/complete-profile") {
                    navigate("/complete-profile")
                    return
                }

                if (requirePaid && !userData.paid) {
                    navigate("/paywall")
                    return
                }

            } catch (error) {
                localStorage.removeItem("token")
                navigate("/login")
                alert("session expired")
            } finally {
                setLoading(false)
            }
        }

        checkAuth()
    }, [token, navigate, dispatch, requirePaid, location.pathname])

    if (loading) {
        return <div>Loading...</div> // swap for a spinner/skeleton if you have one
    }
    return children
}

export default ProtectedRoute
