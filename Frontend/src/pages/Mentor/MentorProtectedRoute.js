import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useDispatch } from "react-redux"
import { getCurrentMentor } from "../../apiCall/userApi"
import { setUser } from "../../store/userSlice"

// a copy of AdminProtectedRoute, for the mentor pages
function MentorProtectedRoute({ children }) {
    const dispatch = useDispatch()
    const navigate = useNavigate()
    const [loading, setLoading] = useState(true)

    const token = localStorage.getItem("token")

    useEffect(() => {
        if (!token) {
            setLoading(false)
            navigate("/mentor/login")
            return
        }

        const checkAuth = async () => {
            try {
                const currentUserResponse = await getCurrentMentor()

                // logged in, but as a student or admin — send them to their own home
                if (currentUserResponse?.data?.message === "Permission Not Granted for this request") {
                    navigate("/")
                    return
                }

                if (!currentUserResponse || currentUserResponse.data.success === false) {
                    localStorage.removeItem("token")
                    setLoading(false)
                    navigate("/mentor/login")
                    alert("session expired")
                    return
                }

                dispatch(
                    setUser({
                        user: currentUserResponse.data.userData,
                    })
                )
            } catch (error) {
                localStorage.removeItem("token")
                navigate("/mentor/login")
                alert("session expired")
            } finally {
                setLoading(false)
            }
        }

        checkAuth()
    }, [token, navigate, dispatch])

    if (loading) {
        return <div>Loading...</div>
    }
    return children
}

export default MentorProtectedRoute
