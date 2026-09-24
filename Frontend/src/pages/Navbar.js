import { Link, NavLink } from "react-router-dom"
import { useSelector } from "react-redux"
import logo from "../assets/brand/logo.png"

// The logged-in app header. The logo always leads to the company landing page; "Home" is the
// student's own dashboard.
function Navbar() {
    const { user } = useSelector((state) => state.user)

    const navClass = ({ isActive }) => (isActive ? "nav-link active" : "nav-link")

    return (
        <header className="app-header">
            <nav className="nav-row">
                <Link to="/"><img src={logo} alt="Freshmxn" height="32" className="brand-logo" /></Link>

                {user && user.role === "admin" && <NavLink to="/admin" className={navClass}>Admin</NavLink>}
                {user && user.role !== "admin" && (
                    <>
                        <NavLink to="/dashboard" className={navClass}>Home</NavLink>
                        {/* the interest form is reached from the dashboard's journey, not from here */}
                        {!user.paid && <NavLink to="/paywall" className={navClass}>Get Access</NavLink>}
                        {/* Mentorship is what Tier 2 buys, so the waitlist page only exists for them */}
                        {user.currentTier === 2 && <NavLink to="/mentorship" className={navClass}>Mentorship</NavLink>}
                    </>
                )}

                <span className="nav-spacer" />

                {/* LOG OUT LIVES ON THE PROFILE PAGE, NOT HERE. It was in both places, and a nav bar is
                    the wrong one: it sits next to Home and Interest Form on every screen, including
                    mid-assessment, where the most destructive action available is one mis-tap from the
                    thing beside it. Profile.js already has it, behind the same confirm, next to the
                    account it belongs to. */}
                {/* not for admins: /profile bounces them straight back to /admin, so it is a dead link */}
                {user && user.role !== "admin" && (
                    <Link to="/profile" className="nav-user">
                        <span className="nav-avatar" aria-hidden="true">{(user.name || "?").trim().charAt(0).toUpperCase()}</span>
                        <span className="nav-user-name">{user.name}</span>
                    </Link>
                )}
            </nav>
        </header>
    )
}

export default Navbar
