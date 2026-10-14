import { useEffect, useState } from "react"
import { useDispatch } from "react-redux"
import { message } from "antd"
import { getMyDemo, importMyDemo, declineMyDemo } from "../../apiCall/demoApi"
import { getCurrentUser } from "../../apiCall/userApi"
import { setUser } from "../../store/userSlice"

// RESUME, DON'T RESTART (owner, Round 32). A student who did "Try the demo" with the same, confirmed email
// is offered its answers here, once they have Career Discovery. They see what would be carried and choose;
// the server fills only what is still empty in their real form and assessment (Routers/demoResumeRouter.js).
// Shows nothing at all when there is no demo to carry.
function DemoCarryCard() {
    const dispatch = useDispatch()
    const [demo, setDemo] = useState(null)
    const [busy, setBusy] = useState(false)

    useEffect(() => {
        getMyDemo().then((response) => setDemo(response.data.data)).catch(() => setDemo(null))
    }, [])

    if (!demo) return null

    const refreshUser = async () => {
        const response = await getCurrentUser()
        dispatch(setUser({ user: response.data.userData }))
    }

    const act = async (carry) => {
        setBusy(true)
        try {
            const response = carry ? await importMyDemo() : await declineMyDemo()
            message.success(response.data.message)
            setDemo(null)
            if (carry) await refreshUser()
        } catch (error) {
            message.error(error.response?.data?.message || "Something went wrong — please try again")
        } finally {
            setBusy(false)
        }
    }

    const carries = [
        demo.carries.interests && `what pulls you (${demo.things.slice(0, 3).join(", ")}${demo.things.length > 3 ? "…" : ""})${demo.aspiration ? ` and "${demo.aspiration}"` : ""} — into Virtual Career Counselling`,
        demo.carries.openness && "your eight answers on how you see yourself — into the assessment",
        demo.carries.reasoning > 0 && `your first ${demo.carries.reasoning} reasoning puzzles — the test carries on from puzzle ${demo.carries.reasoning + 1}`,
    ].filter(Boolean)

    return (
        <div className="section-card demo-carry">
            <p className="next-card-label">You tried the demo</p>
            <p>Carry your answers forward so you don't repeat them:</p>
            <ul>{carries.map((line) => <li key={line}>{line}</li>)}</ul>
            <p className="demo-hint">You can change anything in the real form. Either way, the demo is then deleted.</p>
            <div className="btn-row">
                <button type="button" className="btn btn-primary" disabled={busy} onClick={() => act(true)}>Carry them forward</button>
                <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => act(false)}>Start fresh</button>
            </div>
        </div>
    )
}

export default DemoCarryCard
