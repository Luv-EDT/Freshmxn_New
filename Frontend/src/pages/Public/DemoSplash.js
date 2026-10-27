import { useEffect } from "react"
import { Link } from "react-router-dom"
import logo from "../../assets/brand/logo-light.png"

// THE FRONT DOOR (owner, Round 33). The first thing a visitor sees on the home page: the landing page sits
// blurred behind, and one invitation in front — the logo, "Freshmxn's Lab", the one-line promise and a big
// "Try a Free Demo". ✕ (top right) closes it to explore the landing page first. Shown once per visit
// (this tab's sessionStorage) and never to a logged-in student — Landing decides that.
export const SPLASH_KEY = "freshmxnSplashSeen"

export const splashSeen = () => {
    try { return sessionStorage.getItem(SPLASH_KEY) === "1" } catch (error) { return true }
}

const markSeen = () => {
    try { sessionStorage.setItem(SPLASH_KEY, "1") } catch (error) { /* a private window — it just shows again */ }
}

function DemoSplash({ onClose }) {
    // once per visit: seen as soon as it shows, so a refresh doesn't bring it back
    useEffect(() => {
        markSeen()
        document.body.style.overflow = "hidden"
        const onKey = (event) => { if (event.key === "Escape") onClose() }
        window.addEventListener("keydown", onKey)
        return () => {
            document.body.style.overflow = ""
            window.removeEventListener("keydown", onKey)
        }
    }, [onClose])

    return (
        <div className="splash" role="dialog" aria-modal="true" aria-labelledby="splash-title">
            <div className="splash-glow" aria-hidden="true" />
            <img src={logo} alt="Freshmxn" height="34" className="splash-logo" />
            <button type="button" className="splash-close" onClick={onClose} aria-label="Close and see the home page">
                {/* Round 36 (owner): a drawn ✕, so it sits dead-centre in its circle on every screen and font */}
                <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M3 3 L13 13 M13 3 L3 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
            </button>

            <div className="splash-body">
                <h1 id="splash-title" className="splash-title">Freshmxn's Lab</h1>
                <p className="splash-lead">
                    We match your story and strengths to careers that are{" "}
                    <strong className="highlight-pink">in demand and AI-resilient</strong>, then help you get there.
                </p>
                <Link to="/try-demo" className="btn splash-cta tap">Try a Free Demo →</Link>
                {/* Round 36 (owner): one small line instead of the three tags */}
                <p className="splash-time">It takes just 5 minutes.</p>
                <button type="button" className="splash-skip" onClick={onClose}>or explore the home page first</button>
            </div>
        </div>
    )
}

export default DemoSplash
