import { Link } from "react-router-dom"

// contact details from landing_page_content_v3.md §9
function PublicFooter() {
    return (
        <footer className="page">
            <hr />
            <h3>Contact</h3>
            <p>
                <strong>WhatsApp:</strong> <a href="https://wa.me/918882756287" target="_blank" rel="noreferrer">Message us</a> — 8882756287
            </p>
            <p>
                <strong>Call:</strong> <a href="tel:8882756287">8882756287</a>
                {" · "}
                <strong>Email:</strong> <a href="mailto:luvgoel@freshmxn.com">luvgoel@freshmxn.com</a>
            </p>
            <p>
                <Link to="/success-stories">Success stories</Link>
                {" · "}
                <Link to="/mentor-waitlist">Mentor waitlist</Link>
                {" · "}
                <Link to="/mentor/register">Are you a professional? Mentor with us</Link>
            </p>
        </footer>
    )
}

export default PublicFooter
