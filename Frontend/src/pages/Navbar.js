import { useNavigate, Link } from "react-router-dom"
import { useDispatch, useSelector } from "react-redux"
import { Popconfirm } from "antd"
import { setUser } from "../store/userSlice"

function Navbar() {
    const navigate = useNavigate()
    const dispatch = useDispatch()
    const { user } = useSelector((state) => state.user)

    const handleLogout = () => {
        dispatch(setUser({
            user: null,
        }))
        localStorage.removeItem("token")
        navigate("/login")
    }

    return (
        <div>
            <strong>Freshmxn</strong>
            {" | "}
            {user && user.role === "admin" && <Link to="/admin">Admin</Link>}
            {user && user.role !== "admin" && (
                <>
                    <Link to="/">Home</Link>
                    {" | "}
                    {user.paid ? <Link to="/interest">Interest Form</Link> : <Link to="/paywall">Get Access</Link>}
                    {/* Mentorship is what Tier 2 buys, so the waitlist page only exists for them */}
                    {user.currentTier === 2 && (
                        <>
                            {" | "}
                            <Link to="/mentorship">Mentorship</Link>
                        </>
                    )}
                </>
            )}
            {user && (
                <>
                    {" | "}
                    <Link to="/profile">{user.name}</Link>
                    {" "}
                    <Popconfirm
                        title="Log out of Freshmxn?"
                        okText="Log out"
                        cancelText="Stay"
                        onConfirm={handleLogout}
                    >
                        <button type="button">Logout</button>
                    </Popconfirm>
                </>
            )}
            <hr />
        </div>
    )
}

export default Navbar
