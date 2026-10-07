import { useNavigate } from "react-router-dom"

// "← Dashboard" (owner, Round 19) — always in sight on the interest form, the assessment, the report,
// the matches page, compare and the mentor page, which no longer carry the four-step journey bar.
// A page with unsaved answers passes `onLeave` and asks first (save and go / leave / stay); every
// other page simply goes.
function BackToDashboard({ onLeave }) {
    const navigate = useNavigate()

    return (
        <div className="back-to-dashboard">
            <button type="button" className="btn btn-ghost btn-sm tap" onClick={() => (onLeave ? onLeave() : navigate("/dashboard"))}>
                ← Dashboard
            </button>
        </div>
    )
}

export default BackToDashboard
