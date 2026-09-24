import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useDispatch } from "react-redux"
import { getCurrentAdmin } from "../../apiCall/userApi"
import { setUser } from "../../store/userSlice"

function AdminProtectedRoute({ children }) {
    const dispatch = useDispatch()
    const navigate = useNavigate()
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
                const currentUserResponse = await getCurrentAdmin()

                if (currentUserResponse.data.message === "Permission Not Granted for this request") {
                    alert("Not allowed to access Admin pages.")
                    navigate("/dashboard")
                    return
                }

                if (currentUserResponse.data.success === false) {
                    localStorage.removeItem("token")
                    setLoading(false)
                    navigate("/login")
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
                navigate("/login")
                alert("session expired")
            } finally {
                setLoading(false)
            }
        }

        checkAuth()
    }, [token, navigate, dispatch])

    if (loading) {
        return <div>Loading...</div> // swap for a spinner/skeleton if you have one
    }
    return children
}

export default AdminProtectedRoute
