import { useState, useEffect, useCallback } from "react"
import { Button, Tag, message } from "antd"
import dayjs from "dayjs"
import { getSuggestionsForAdmin } from "../../apiCall/mentorReviewsApi"
import MentorOpinions from "./MentorOpinions"

// What mentors say about their own profession — ONE CARD PER PROFESSION, one row per TOPIC (owner,
// Rounds 15–17). Opinions are kept for good and stacked: who wants a change, who agrees with what we
// show. READ ONLY: on the 1st of each month Claude weighs the topics with new input and what it
// proposes appears in Data updates, where the admin decides (and can "Remove as wrong" there).
const OUTCOME_WORDS = { proposed: "Change proposed", not_changed: "Kept as it is" }

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

    const due = rows.reduce((total, row) => total + row.topics.filter((topic) => topic.due).length, 0)

    return (
        <div>
            <p>
                <Button onClick={fetchAll} loading={loading}>Refresh</Button>{" "}
                <span className="report-small">{due} {due === 1 ? "topic has" : "topics have"} new mentor input for the next monthly look</span>
            </p>
            <p className="report-small">
                Mentors' opinions are kept and stacked per topic. On the 1st of each month (or Run now in Data updates) Claude
                weighs every topic with new input — how many mentors agree, their experience, and any sources — and what it
                proposes appears in Data updates as "Mentor + sources" for you to approve or reject. You decide there, and can
                remove an opinion that is clearly wrong.
            </p>
            {rows.length === 0 && <p>No mentor input yet.</p>}

            {rows.map((row) => (
                <section key={row.professionId} className="section-card">
                    <h3>{row.professionName}</h3>
                    <p className="report-small">{row.topics.length} {row.topics.length === 1 ? "topic" : "topics"} · {row.mentors} {row.mentors === 1 ? "mentor" : "mentors"}</p>
                    {row.topics.map((topic) => (
                        <div key={topic.key} className="mentor-topic">
                            <p>
                                <strong>{topic.what}</strong>
                                {topic.currentLevel && <span className="report-small"> ({topic.currentLevel} today)</span>}
                                {" · "}{topic.wantChange} want a change · {topic.agreeToday} agree with what we show{" "}
                                {topic.wantChange >= 2 && <Tag color="gold">{topic.wantChange} mentors agree on a change</Tag>}
                                {topic.due && <span className="status-chip is-pending">New input</span>}
                            </p>
                            <MentorOpinions professionId={row.professionId} topic={topic.key} opinions={topic.opinions} />
                            {topic.lastOutcome && topic.lastOutcome.decision && (
                                <p className="report-small">
                                    Last look {dayjs(topic.lastCheckedAt).format("DD MMM YYYY")}: {OUTCOME_WORDS[topic.lastOutcome.decision] || topic.lastOutcome.decision}
                                    {topic.lastOutcome.reason && ` — ${topic.lastOutcome.reason}`}
                                    {topic.adminDecision && ` · you ${topic.adminDecision} it`}
                                </p>
                            )}
                        </div>
                    ))}
                    {row.removed.length > 0 && (
                        <details className="faq-item">
                            <summary>Removed as wrong ({row.removed.length})</summary>
                            <ul>
                                {row.removed.map((entry, index) => (
                                    <li key={`${entry.topic}-${index}`} className="report-small">
                                        {dayjs(entry.at).format("DD MMM YYYY")} · {entry.mentorName} on {entry.topic}: {entry.note || "—"} (by {entry.by})
                                    </li>
                                ))}
                            </ul>
                        </details>
                    )}
                </section>
            ))}
            <p className="report-small">Export patch writes each profession's whole stack into ALL-professions.json (mentor_suggestions) and lists every approved mentor wording change under mentorNotes, which Claude Code writes into the data files at the next data commit.</p>
        </div>
    )
}

export default MentorReviewsList
