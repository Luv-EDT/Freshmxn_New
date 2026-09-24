import { Link } from "react-router-dom"
import logo from "../../assets/brand/logo.png"

// the header on every public page — visitors who are not logged in
function PublicNav() {
    return (
        <header>
            <nav className="nav-row">
                <Link to="/"><img src={logo} alt="Freshmxn" height="36" /></Link>
                <Link to="/success-stories">Success stories</Link>
                <Link to="/mentor-waitlist">Mentors</Link>
                <Link to="/login">Log in</Link>
                <Link to="/register" className="tap">Let's figure out your career</Link>
            </nav>
            <hr />
        </header>
    )
}

export default PublicNav
