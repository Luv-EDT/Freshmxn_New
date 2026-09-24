import { Link } from "react-router-dom"
import { useSelector } from "react-redux"

function Navbar() {
    const { user } = useSelector((state) => state.user)

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
            {/* LOG OUT LIVES ON THE PROFILE PAGE, NOT HERE. It was in both places, and a nav bar is
                the wrong one: it sits next to Home and Interest Form on every screen, including
                mid-assessment, where the most destructive action available is one mis-tap from the
                thing beside it. Profile.js already has it, behind the same confirm, next to the
                account it belongs to. */}
            {user && (
                <>
                    {" | "}
                    <Link to="/profile">{user.name}</Link>
                </>
            )}
            <hr />
        </div>
    )
}

export default Navbar
