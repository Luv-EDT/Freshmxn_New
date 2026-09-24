import { useNavigate } from "react-router-dom"
import { useDispatch } from "react-redux"
import { Popconfirm } from "antd"
import { setUser } from "../store/userSlice"

// Shared by Profile (students) and the admin dashboard. It used to live only on Profile, which an
// admin can never reach — ProtectedRoute bounces every admin to /admin — so admins had no way out.
// Kept behind the same confirm: logging out mid-task is the most destructive tap on either page.
function LogoutButton() {
    const navigate = useNavigate()
    const dispatch = useDispatch()

    const handleLogout = () => {
        dispatch(setUser({ user: null }))
        localStorage.removeItem("token")
        navigate("/login")
    }

    return (
        <Popconfirm
            title="Log out of Freshmxn?"
            okText="Log out"
            cancelText="Stay"
            onConfirm={handleLogout}
        >
            <button type="button">Log out</button>
        </Popconfirm>
    )
}

export default LogoutButton
