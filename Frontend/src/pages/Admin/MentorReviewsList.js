import { useState, useEffect, useCallback } from "react"
import { Button, Popconfirm, Tag, message } from "antd"
import dayjs from "dayjs"
import { getSuggestionsForAdmin, decideSuggestionsForAdmin } from "../../apiCall/mentorReviewsApi"

// Mentors' suggested changes to their own profession — ONE CARD PER PROFESSION (owner, Round 15).
// Only what a mentor says should change arrives here; a second mentor of the same field adds to the
// same card, and where two say the same thing it shows first. "Approve" sends the card's suggestions
// to Data updates → Export patch and empties the card; "Drop" removes one that isn't right.
// Nothing changes on the site from here.
const DIRECTION_WORDS = { higher: "should be higher", lower: "should be lower" }
const SECTION_WORDS = { skills_missing: "Skills we're missing" }

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

    const decide = async (row, action, index) => {
        try {
            const response = await decideSuggestionsForAdmin(row.professionId, action, index)
            message.success(response.data.message)
            fetchAll()
        } catch (error) {
            message.error(error.response?.data?.message || "Could not save")
        }
    }

    return (
        <div>
            <p>
                <Button onClick={fetchAll} loading={loading}>Refresh</Button>{" "}
                <span className="report-small">{rows.length} {rows.length === 1 ? "profession has" : "professions have"} suggestions waiting</span>
            </p>
            {rows.length === 0 && <p>No suggestions waiting. Mentors' "looks right" answers stay on their own sheets.</p>}

            {rows.map((row) => (
                <section key={row.professionId} className="section-card">
                    <h3>{row.professionName}</h3>
                    <p className="report-small">{row.suggestions.length} {row.suggestions.length === 1 ? "suggestion" : "suggestions"} from {row.mentors} {row.mentors === 1 ? "mentor" : "mentors"}</p>
                    {row.agreement.length > 0 && (
                        <p>
                            <strong>Mentors agree:</strong>{" "}
                            {row.agreement.map((entry) => <Tag key={entry.what} color="gold">{entry.count} say {entry.what}</Tag>)}
                        </p>
                    )}
                    <div className="table-scroll">
                        <table>
                            <tbody>
                                {row.suggestions.map((suggestion, index) => (
                                    <tr key={`${suggestion.mentor}-${suggestion.section}-${suggestion.factor || ""}`}>
                                        <td>
                                            {suggestion.section === "qualities"
                                                ? <span><strong>{suggestion.what.replace(/ should be \w+$/, "")}</strong> ({suggestion.currentLevel || "—"} today) — {DIRECTION_WORDS[suggestion.direction]}</span>
                                                : <span><strong>{SECTION_WORDS[suggestion.section] || suggestion.what}</strong> — needs a change</span>}
                                            {suggestion.note && <div>{suggestion.note}</div>}
                                            {suggestion.sourceUrl && <div><a href={suggestion.sourceUrl} target="_blank" rel="noreferrer">{suggestion.sourceUrl}</a></div>}
                                            <div className="report-small">{suggestion.mentorName || "A mentor"} · {dayjs(suggestion.suggestedAt).format("DD MMM YYYY")}</div>
                                        </td>
                                        <td>
                                            <Popconfirm title="Drop this suggestion as not right?" okText="Drop" cancelText="Keep" onConfirm={() => decide(row, "drop", index)}>
                                                <Button size="small" danger>Drop</Button>
                                            </Popconfirm>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <Popconfirm title={`Approve all ${row.suggestions.length} for ${row.professionName}? They go into Export patch and this card empties.`} okText="Approve" cancelText="Not yet" onConfirm={() => decide(row, "approve")}>
                        <Button type="primary">Approve all for this profession</Button>
                    </Popconfirm>
                </section>
            ))}
            <p className="report-small">Approved suggestions appear in Data updates → Export patch. Make the change by hand in the data files, then commit; the patch also writes each profession's waiting list into ALL-professions.json (mentor_suggestions).</p>
        </div>
    )
}

export default MentorReviewsList
