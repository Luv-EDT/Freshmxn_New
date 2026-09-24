import { Link } from "react-router-dom"
import logo from "../../assets/brand/logo.png"

// The header on every public page. Logged-in visitors reach these pages too — the logo always leads
// to the company landing page — so they get their own way back instead of "Log in".
// Read synchronously from localStorage: no loading flash, and no network call on a public page.
function PublicNav() {
    const isLoggedIn = Boolean(localStorage.getItem("token"))

    return (
        <header>
            <nav className="nav-row">
                <Link to="/"><img src={logo} alt="Freshmxn" height="36" /></Link>
                <Link to="/success-stories">Success stories</Link>
                <Link to="/mentor-waitlist">Mentors</Link>
                {isLoggedIn ? (
                    <>
                        <Link to="/profile">Profile</Link>
                        <Link to="/dashboard" className="tap">My dashboard</Link>
                    </>
                ) : (
                    <>
                        <Link to="/login">Log in</Link>
                        <Link to="/register" className="tap">Let's figure out your career</Link>
                    </>
                )}
            </nav>
            <hr />
        </header>
    )
}

export default PublicNav
