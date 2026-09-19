import { useState, useEffect, useRef } from "react"

// the "?" next to a question — click to open the help text, click outside to close
function HelpIcon({ title, children }) {
    const [isOpen, setIsOpen] = useState(false)
    const containerRef = useRef(null)

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false)
            }
        }

        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside)
        }

        return () => {
            document.removeEventListener("mousedown", handleClickOutside)
        }
    }, [isOpen])

    return (
        <span ref={containerRef}>
            <button type="button" onClick={() => setIsOpen(!isOpen)} title="Click for help">?</button>
            {isOpen && (
                <div>
                    <strong>{title}</strong>
                    <div>{children}</div>
                    <button type="button" onClick={() => setIsOpen(false)} aria-label="Close help dialog">Close</button>
                </div>
            )}
        </span>
    )
}

export default HelpIcon
