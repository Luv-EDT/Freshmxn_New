import { useState, useEffect, useCallback } from "react"
import { Table, Button, Popconfirm, Input, message } from "antd"
import dayjs from "dayjs"
import { getActivityFoldsForAdmin, splitActivityFoldForAdmin, getActivityReadingsForAdmin } from "../../apiCall/dataUpdatesApi"

// ACTIVITY MATCHES (Round 14, owner: "keep 0.90, measure it"). When a student's activity is close
// enough to one we have already rated (similarity ≥ the threshold), it reuses that rating instead of
// paying for a new one. Here are those matches, closest calls first. "Not the same" splits a wrong one
// off, so the next student who writes it gets it rated on its own. If the bottom of this list keeps
// holding wrong matches, raise ACTIVITY_DEDUP_COSINE on Render; if it is all obvious paraphrases
// rated separately, lower it.
//
// Round 17: "How we read a student's activities" — look a student up by email to see what each of
// their activities was read as (the cache names every new wording, e.g. "Cricketer" → "playing cricket").
const HIT_WORDS = {
    exact: "known wording — no AI call",
    named: "named, matched an activity we know",
    near: "close to an activity we know",
    miss: "new — rated for the first time",
    unrateable: "not an activity we can rate",
}

function StudentReadings() {
    const [email, setEmail] = useState("")
    const [result, setResult] = useState(null)
    const [loading, setLoading] = useState(false)

    const lookUp = async () => {
        try {
            setLoading(true)
            const response = await getActivityReadingsForAdmin(email)
            setResult(response.data.data)
        } catch (error) {
            setResult(null)
            message.error(error.response?.data?.message || "Could not look that student up")
        } finally {
            setLoading(false)
        }
    }

    return (
        <section className="section-card">
            <h3>How we read a student's activities</h3>
            <p className="report-small">Only activities ticked as ongoing in Current interests reach the matcher. Readings come from the student's latest report.</p>
            <Input.Search placeholder="Student's email" value={email} onChange={(event) => setEmail(event.target.value)} onSearch={lookUp} enterButton="Look up" loading={loading} style={{ maxWidth: 420 }} />
            {result && (
                <div>
                    <p><strong>{result.name}</strong> · {result.email}</p>
                    <p>Ticked as ongoing: {result.ticked.length > 0 ? result.ticked.join(" · ") : "none — nothing from the interest form reached the matcher"}</p>
                    {result.storyFreeRecall && (
                        <p className="report-small">
                            Story free recall: {result.storyFreeRecall.graded ? "marked" : `not marked${result.storyFreeRecall.reason ? ` — ${result.storyFreeRecall.reason}` : ""} (long-term memory then counts only the 7 structured points, "Partial · 58%")`}
                        </p>
                    )}
                    {/* THE TRACE (Round 19): the resolver's steps, in order, for each activity */}
                    {(result.trace || []).length > 0 ? (
                        <ol className="activity-trace">
                            {result.trace.map((step, index) => (
                                <li key={`${step.wrote}-${index}`}>
                                    <p><strong>Wrote:</strong> {step.wrote}</p>
                                    <p><strong>Named as:</strong> {step.namedAs || (step.cache === "exact" ? "— (this exact wording was already in the cache, so no naming call)" : "—")}</p>
                                    <p>
                                        <strong>Cache:</strong> {HIT_WORDS[step.cache] || step.cache || "—"}
                                        {typeof step.nearScore === "number" && <> — similarity <strong>{step.nearScore.toFixed(3)}</strong> ≥ {result.threshold.toFixed(2)}</>}
                                        {step.readAs && <> → row <strong>{step.readAs}</strong></>}
                                    </p>
                                    <p><strong>Careers this points to:</strong></p>
                                    <ul className="report-small">
                                        {step.careers.length > 0
                                            ? step.careers.map((career) => <li key={career.id}>{career.name} — {career.landed}</li>)
                                            : <li>none stored (reports built before Round 19 did not keep this)</li>}
                                    </ul>
                                </li>
                            ))}
                        </ol>
                    ) : (
                        <p className="report-small">No readings stored yet — they are recorded when the student's report is next built.</p>
                    )}
                </div>
            )}
        </section>
    )
}

function ActivityMatchesList() {
    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(false)

    const fetchAll = useCallback(async () => {
        try {
            setLoading(true)
            const response = await getActivityFoldsForAdmin()
            setData(response.data.data)
        } catch (error) {
            message.error("Failed to fetch activity matches")
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { fetchAll() }, [fetchAll])

    const split = async (record) => {
        try {
            const response = await splitActivityFoldForAdmin(record.rowId, record.text)
            message.success(response.data.message)
            fetchAll()
        } catch (error) {
            message.error(error.response?.data?.message || "Failed to split the match")
        }
    }

    const columns = [
        { title: "What the student wrote", dataIndex: "text" },
        { title: "Treated as", dataIndex: "cachedActivity" },
        { title: "Similarity", dataIndex: "score", render: (score) => (typeof score === "number" ? score.toFixed(3) : "—") },
        { title: "When", dataIndex: "at", render: (at) => (at ? dayjs(at).format("D MMM YYYY") : "—") },
        {
            title: "",
            render: (_, record) => (
                <Popconfirm title={`Rate "${record.text}" on its own from now on?`} okText="Not the same" cancelText="Keep" onConfirm={() => split(record)}>
                    <Button size="small">Not the same</Button>
                </Popconfirm>
            ),
        },
    ]

    return (
        <div>
            <StudentReadings />
            {data && (
                <p>
                    Two activities count as the same at a similarity of <strong>{data.threshold.toFixed(2)}</strong> or more
                    (change it with <code>ACTIVITY_DEDUP_COSINE</code> on Render). {data.cachedActivities} activities rated,{" "}
                    {data.foldCount} reused matches, {data.closeCalls} of them below 0.93.
                </p>
            )}
            <div className="table-scroll">
                <Table
                    rowKey={(record) => `${record.rowId}-${record.text}`}
                    columns={columns}
                    dataSource={data ? data.folds : []}
                    loading={loading}
                    pagination={{ pageSize: 25 }}
                    locale={{ emptyText: "No reused matches yet — they appear as students fill in the interest form" }}
                />
            </div>
        </div>
    )
}

export default ActivityMatchesList
