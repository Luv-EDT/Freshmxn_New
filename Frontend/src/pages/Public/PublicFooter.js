import { Link } from "react-router-dom"
import logoLight from "../../assets/brand/logo-light.png"

// contact details from landing_page_content_v3.md §9 — the one dark section, so the white logo
function PublicFooter() {
    return (
        <footer className="site-footer">
            <div className="page">
                <div className="footer-grid">
                    <div>
                        <img src={logoLight} alt="Freshmxn" height="36" className="brand-logo" />
                        <p style={{ marginTop: 16 }}>Explore. Get clarity. Take action.</p>
                    </div>
                    <div>
                        <h3>Contact</h3>
                        <p>
                            <a href="https://wa.me/918882756287" target="_blank" rel="noreferrer" className="btn btn-whatsapp btn-sm">
                                WhatsApp: Message us
                            </a>
                        </p>
                        <p>
                            <strong>WhatsApp / Call:</strong> <a href="tel:8882756287">8882756287</a>
                            <br />
                            <strong>Email:</strong> <a href="mailto:luvgoel@freshmxn.com">luvgoel@freshmxn.com</a>
                        </p>
                    </div>
                    <div>
                        <h3>Explore</h3>
                        <ul className="footer-links">
                            <li><Link to="/success-stories">Success stories</Link></li>
                            <li><Link to="/mentor-waitlist">Mentor waitlist</Link></li>
                            <li><Link to="/mentor/register">Are you a professional? Mentor with us</Link></li>
                        </ul>
                    </div>
                </div>
                <div className="footer-bottom">© Freshmxn Labs</div>
            </div>
        </footer>
    )
}

export default PublicFooter
