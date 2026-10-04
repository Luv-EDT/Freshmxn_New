import { useState, useEffect, useCallback } from "react"
import { Button, Tag, message } from "antd"
import dayjs from "dayjs"
import { getSuggestionsForAdmin } from "../../apiCall/mentorReviewsApi"

// Mentors' suggested changes to their own profession — ONE CARD PER PROFESSION (owner, Round 15).
// READ ONLY since Round 16 (owner: one queue). On the 1st of each month the data refresh has Claude
// check every waiting suggestion against sources: what holds up becomes a proposal in Data updates
// (tagged "Mentor + sources") where the admin approves it; the rest is discarded with a reason. This
// tab shows what is still waiting and what happened to the rest. Nothing is decided here.
const DIRECTION_WORDS = { higher: "should be higher", lower: "should be lower" }
const SECTION_WORDS = { skills_missing: "Skills we're missing" }
const OUTCOME_TAGS = { used: ["green", "Used — in Data updates"], discarded: ["default", "Discarded"] }

const What = ({ suggestion }) => (suggestion.section === "qualities"
    ? <span><strong>{suggestion.what.replace(/ should be \w+$/, "")}</strong> ({suggestion.currentLevel || "—"} today) — {DIRECTION_WORDS[suggestion.direction]}</span>
    : <span><strong>{SECTION_WORDS[suggestion.section] || suggestion.what}</strong> — needs a change</span>)

const Said = ({ suggestion }) => (
    <>
        {suggestion.note && <div>{suggestion.note}</div>}
        {suggestion.sourceUrl && <div><a href={suggestion.sourceUrl} target="_blank" rel="noreferrer">{suggestion.sourceUrl}</a></div>}
        <div className="report-small">{suggestion.mentorName || "A mentor"} · {dayjs(suggestion.suggestedAt).format("DD MMM YYYY")}</div>
    </>
)

function MentorReviewsList() {
    const [rows, setRows] = useState([])
    const [loading, setLoading] = useState(false)

    const fetchAll = useCallback(async () => {
        try {
            setLoading(true)
            const response = await getSuggestionsForAdmin()
            setRows(response.data.data)
        } catch (error) {
            message.error("Failed to fetch mentor suggestions")
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { fetchAll() }, [fetchAll])

    const waiting = rows.reduce((total, row) => total + row.waiting.length, 0)

    return (
        <div>
            <p>
                <Button onClick={fetchAll} loading={loading}>Refresh</Button>{" "}
                <span className="report-small">{waiting} {waiting === 1 ? "suggestion is" : "suggestions are"} waiting for the monthly check</span>
            </p>
            <p className="report-small">
                You don't decide here. On the 1st of each month the data refresh has Claude check these against sources (Run now on
                Data updates runs it too). Suggestions a source supports appear in Data updates as "Mentor + sources", for you to
                approve or reject; the others are discarded with the reason shown below.
            </p>
            {rows.length === 0 && <p>No suggestions yet. Mentors' "looks right" answers stay on their own sheets.</p>}

            {rows.map((row) => (
                <section key={row.professionId} className="section-card">
                    <h3>{row.professionName}</h3>
                    <p className="report-small">{row.waiting.length} waiting · {row.processed.length} checked · {row.mentors} {row.mentors === 1 ? "mentor" : "mentors"}</p>
                    {row.agreement.length > 0 && (
                        <p>
                            <strong>Mentors agree:</strong>{" "}
                            {row.agreement.map((entry) => <Tag key={entry.what} color="gold">{entry.count} say {entry.what}</Tag>)}
                        </p>
                    )}
                    {row.waiting.length > 0 && (
                        <div className="table-scroll">
                            <table>
                                <tbody>
                                    {row.waiting.map((suggestion) => (
                                        <tr key={`${suggestion.mentor}-${suggestion.section}-${suggestion.factor || ""}`}>
                                            <td><What suggestion={suggestion} /><Said suggestion={suggestion} /></td>
                                            <td><span className="status-chip is-pending">Waiting</span></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                    {row.processed.length > 0 && (
                        <details className="faq-item">
                            <summary>What the monthly check did ({row.processed.length})</summary>
                            <div className="table-scroll">
                                <table>
                                    <tbody>
                                        {row.processed.map((suggestion, index) => (
                                            <tr key={`${suggestion.mentor}-${suggestion.section}-${suggestion.factor || ""}-${index}`}>
                                                <td>
                                                    <What suggestion={suggestion} />
                                                    <Said suggestion={suggestion} />
                                                    {suggestion.reason && <div><em>{suggestion.reason}</em></div>}
                                                </td>
                                                <td>
                                                    <Tag color={(OUTCOME_TAGS[suggestion.outcome] || OUTCOME_TAGS.discarded)[0]}>{(OUTCOME_TAGS[suggestion.outcome] || OUTCOME_TAGS.discarded)[1]}</Tag>
                                                    <div className="report-small">{dayjs(suggestion.processedAt || suggestion.approvedAt).format("DD MMM YYYY")}</div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </details>
                    )}
                </section>
            ))}
            <p className="report-small">Export patch writes each profession's waiting list into ALL-professions.json (mentor_suggestions) — empty once checked — and lists every approved mentor change under mentorNotes, for a reviewed data commit.</p>
        </div>
    )
}

export default MentorReviewsList
