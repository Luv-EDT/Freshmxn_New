import { Link } from "react-router-dom"
import logo from "../../assets/brand/logo.png"

// The header on every public page. Logged-in visitors reach these pages too — the logo always leads
// to the company landing page — so they get their own way back instead of "Log in".
// Read synchronously from localStorage: no loading flash, and no network call on a public page.
function PublicNav() {
    const isLoggedIn = Boolean(localStorage.getItem("token"))

    return (
        <header className="public-header">
            <nav className="nav-row">
                <Link to="/"><img src={logo} alt="Freshmxn" height="34" className="brand-logo" /></Link>
                <div className="nav-links">
                    <Link to="/success-stories" className="nav-link">Success stories</Link>
                    <Link to="/mentor-waitlist" className="nav-link">Mentors</Link>
                    {isLoggedIn
                        ? <Link to="/profile" className="nav-link">Profile</Link>
                        : <Link to="/login" className="nav-link">Log in</Link>}
                </div>
                <div className="nav-cta">
                    {isLoggedIn
                        ? <Link to="/dashboard" className="btn btn-primary btn-sm tap">My dashboard</Link>
                        : (
                            <Link to="/register" className="btn btn-primary btn-sm tap">
                                <span className="label-long">Let's figure out your career</span>
                                <span className="label-short">Get started</span>
                            </Link>
                        )}
                </div>
            </nav>
        </header>
    )
}

export default PublicNav
