import { useEffect } from "react"
import { useLocation } from "react-router-dom"

// React Router keeps the scroll position between pages, so a footer link (or "Join the waitlist"
// on a pricing card) opened the next page still scrolled to the bottom — it looked as if the click
// had done nothing. Every page change now starts at the top; a link with a #hash lands on that
// section instead, so the legal pages' contents links keep working.
function ScrollToTop() {
    const { pathname, hash } = useLocation()

    useEffect(() => {
        if (hash) {
            const target = document.getElementById(hash.slice(1))
            if (target) {
                target.scrollIntoView()
                return
            }
        }
        window.scrollTo(0, 0)
    }, [pathname, hash])

    return null
}

export default ScrollToTop
