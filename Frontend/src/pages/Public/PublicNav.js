import { Link } from "react-router-dom"
import { useSelector } from "react-redux"
import logo from "../../assets/brand/logo.png"

// The header on every public page. Logged-in visitors reach these pages too — the logo always leads
// to the company landing page — so they get their own way back instead of "Log in".
// Read synchronously from localStorage: no loading flash, and no network call on a public page.
//
// A logged-in visitor gets a profile icon rather than the word "Profile" (owner, Round 10), the same
// round avatar the app header uses. Their initial when the app already knows who they are (they came
// from inside it); a plain person icon on a fresh load, since this header makes no network call.
function PublicNav() {
    const isLoggedIn = Boolean(localStorage.getItem("token"))
    const { user } = useSelector((state) => state.user)
    const initial = user && user.name ? user.name.trim().charAt(0).toUpperCase() : null

    return (
        <header className="public-header">
            <nav className="nav-row">
                <Link to="/"><img src={logo} alt="Freshmxn" height="34" className="brand-logo" /></Link>
                <div className="nav-links">
                    <Link to="/how-it-works" className="nav-link">How it works</Link>
                    <Link to="/success-stories" className="nav-link">Success stories</Link>
                    <Link to="/mentor-waitlist" className="nav-link">Mentors</Link>
                    <Link to="/about" className="nav-link">About us</Link>
                    {/* for working professionals (owner, Round 12) — only to visitors; a logged-in student is not the audience */}
                    {!isLoggedIn && <Link to="/mentor/register" className="nav-link">Become a mentor</Link>}
                    {!isLoggedIn && <Link to="/login" className="nav-link">Log in</Link>}
                </div>
                <div className="nav-cta">
                    {isLoggedIn && (
                        <Link to="/profile" className="nav-profile tap" aria-label="Your profile" title="Your profile">
                            <span className="nav-avatar" aria-hidden="true">
                                {initial || (
                                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" focusable="false">
                                        <circle cx="12" cy="8" r="4.2" />
                                        <path d="M3.8 20.5c.9-4.2 4.2-6.7 8.2-6.7s7.3 2.5 8.2 6.7z" />
                                    </svg>
                                )}
                            </span>
                        </Link>
                    )}
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
