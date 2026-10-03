import { useState, useEffect, useCallback } from "react"
import { Button, Segmented, Tag, message } from "antd"
import dayjs from "dayjs"
import { getReviewsForAdmin, decideReviewItemForAdmin } from "../../apiCall/mentorReviewsApi"

// Mentors' reviews of our data for their own profession (Round 12), grouped by profession. Where two
// or more mentors say the same thing it is shown first. Each item gets a decision:
//   Accept  → goes into Export patch as a mentor note, for a reviewed data commit
//   Noted   → kept, nothing to change
//   Reject  → not right
// Nothing changes on the site from here.
const DECISION_COLOURS = { accepted: "green", noted: "blue", rejected: "red" }
const DIRECTION_WORDS = { right: "about right", higher: "should be higher", lower: "should be lower" }

function MentorReviewsList() {
    const [reviews, setReviews] = useState([])
    const [agreement, setAgreement] = useState({})
    const [show, setShow] = useState("open")
    const [loading, setLoading] = useState(false)

    const fetchAll = useCallback(async () => {
        try {
            setLoading(true)
            const response = await getReviewsForAdmin()
            setReviews(response.data.data.reviews)
            setAgreement(response.data.data.agreement)
        } catch (error) {
            message.error("Failed to fetch mentor reviews")
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { fetchAll() }, [fetchAll])

    const decide = async (review, item, decision) => {
        try {
            await decideReviewItemForAdmin(review._id, item.key, decision)
            fetchAll()
        } catch (error) {
            message.error(error.response?.data?.message || "Could not save")
        }
    }

    const shown = reviews.filter((review) => show === "all" || review.status === show)
    const byProfession = shown.reduce((groups, review) => {
        (groups[review.professionId] = groups[review.professionId] || []).push(review)
        return groups
    }, {})

    return (
        <div>
            <p>
                <Segmented
                    value={show}
                    onChange={setShow}
                    options={[
                        { value: "open", label: `To decide (${reviews.filter((review) => review.status === "open").length})` },
                        { value: "reviewed", label: "Decided" },
                        { value: "all", label: `All (${reviews.length})` },
                    ]}
                />{" "}
                <Button onClick={fetchAll} loading={loading}>Refresh</Button>
            </p>
            {Object.keys(byProfession).length === 0 && <p>No reviews here yet.</p>}

            {Object.entries(byProfession).map(([professionId, group]) => (
                <section key={professionId} className="section-card">
                    <h3>{group[0].professionName}</h3>
                    {(agreement[professionId] || []).length > 0 && (
                        <p>
                            <strong>Mentors agree:</strong>{" "}
                            {agreement[professionId].map((entry) => <Tag key={entry.what} color="gold">{entry.count} say {entry.what}</Tag>)}
                        </p>
                    )}
                    {group.map((review) => (
                        <div key={review._id}>
                            <p className="report-small">
                                {review.mentor ? `${review.mentor.name} · ${review.mentor.email}` : "—"} · sent {dayjs(review.submittedAt).format("DD MMM YYYY")}
                            </p>
                            <div className="table-scroll">
                                <table>
                                    <tbody>
                                        {review.items.map((item) => (
                                            <tr key={item.key}>
                                                <td>
                                                    {item.section === "qualities"
                                                        ? <span><strong>{item.factorLabel}</strong> ({item.currentLevel || "—"} today) — {DIRECTION_WORDS[item.direction]}</span>
                                                        : <span><strong>{item.section.replace(/_/g, " ")}</strong> — {item.verdict === "right" ? "looks right" : "needs a change"}</span>}
                                                    {item.note && <div>{item.note}</div>}
                                                    {item.sourceUrl && <div><a href={item.sourceUrl} target="_blank" rel="noreferrer">{item.sourceUrl}</a></div>}
                                                </td>
                                                <td>
                                                    {item.decision
                                                        ? <Tag color={DECISION_COLOURS[item.decision]}>{item.decision}</Tag>
                                                        : (
                                                            <>
                                                                <Button size="small" type="primary" onClick={() => decide(review, item, "accepted")}>Accept</Button>{" "}
                                                                <Button size="small" onClick={() => decide(review, item, "noted")}>Noted</Button>{" "}
                                                                <Button size="small" danger onClick={() => decide(review, item, "rejected")}>Reject</Button>
                                                            </>
                                                        )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            {review.skillsMissing && <p><strong>Skills we're missing:</strong> {review.skillsMissing}</p>}
                        </div>
                    ))}
                </section>
            ))}
            <p className="report-small">Accepted items appear in Data updates → Export patch as mentor notes. Make the change by hand in the data files, then commit.</p>
        </div>
    )
}

export default MentorReviewsList
