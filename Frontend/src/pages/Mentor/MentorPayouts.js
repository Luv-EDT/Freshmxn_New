import { useEffect, useState } from "react"
import dayjs from "dayjs"
import { getMyPayouts } from "../../apiCall/mentorPayoutsApi"

// THE MENTOR'S PAYOUTS (owner, Round 34): each session's amount — fixed at their tier and region the day
// the student's feedback came in — and whether we've paid it, with our reference.
const inr = (amount) => `₹${Number(amount || 0).toLocaleString("en-IN")}`

function MentorPayouts({ standing }) {
    const [rows, setRows] = useState(null)
    useEffect(() => { getMyPayouts().then((response) => setRows((response && response.data && response.data.data) || [])) }, [])

    return (
        <section className="mentor-payouts">
            {standing && standing.mainRate && (
                <p>
                    A main session pays you <strong>{inr(standing.mainRate.inr)}</strong>{standing.mainRate.usd ? ` ($${standing.mainRate.usd})` : ""} at
                    your tier now; a later follow-up {inr(standing.followUpRate.inr)}. You're paid once the student's feedback comes in.
                </p>
            )}
            {!rows && <div className="skeleton skeleton-block" />}
            {rows && rows.length === 0 && <p className="report-small">No payouts yet.</p>}
            {rows && rows.length > 0 && (
                <div className="table-scroll">
                    <table className="training-table">
                        <thead><tr><th>Date</th><th>Session</th><th>Tier</th><th>Amount</th><th>Status</th><th>Reference</th></tr></thead>
                        <tbody>
                            {rows.map((row) => (
                                <tr key={row._id}>
                                    <td>{dayjs(row.createdAt).format("D MMM YYYY")}</td>
                                    <td>{row.kind === "followup" ? "Follow-up" : "Main session"}</td>
                                    <td>{row.tier}</td>
                                    <td>{inr(row.amountInr)}{row.amountUsd ? ` ($${row.amountUsd})` : ""}</td>
                                    <td>{row.status === "paid" ? `Paid ${dayjs(row.paidAt).format("D MMM")}` : "Due"}</td>
                                    <td>{row.reference || "—"}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    )
}

export default MentorPayouts
