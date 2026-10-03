import { useState, useEffect, useCallback } from "react"
import { Table, Button, Segmented, Tag, Modal, Input, message } from "antd"
import dayjs from "dayjs"
import { getScoutForAdmin, decideScoutForAdmin, decideDraftForAdmin } from "../../apiCall/dataUpdatesApi"
import { runHousekeepingForAdmin } from "../../apiCall/followUpsApi"

// The weekly scout's watchlist (Round 10/11): titles that are none of our careers or job titles, from
// the job board, from what students said they wanted, and from the official reports — one tag each.
// Approving as a new or combined career drafts it the way the 223 were built (housekeeping/
// draftCareer.js); the draft shows here to accept or send back, and an accepted draft goes into the
// Data updates tab's "Export patch".
const SOURCE_TAGS = {
    job_board: <Tag color="blue" key="job_board">Job board</Tag>,
    student_aspirations: <Tag color="magenta" key="student_aspirations">Students</Tag>,
    reports: <Tag color="green" key="reports">Reports</Tag>,
}
const DRAFT_STATUS = { drafting: "Drafting…", ready: "Draft ready", failed: "Draft failed", accepted: "Accepted — in Export patch", sent_back: "Sent back — redrafting" }
const KIND = { new: "Nothing close", between: "Between two careers" }

function EmergingCareersList() {
    const [status, setStatus] = useState("watch")
    const [candidates, setCandidates] = useState([])
    const [loading, setLoading] = useState(false)
    const [viewing, setViewing] = useState(null)     // the row whose draft is open
    const [note, setNote] = useState("")

    const fetchAll = useCallback(async () => {
        try {
            setLoading(true)
            const response = await getScoutForAdmin(status)
            setCandidates(response.data.data.candidates)
        } catch (error) {
            message.error("Failed to fetch the watchlist")
        } finally {
            setLoading(false)
        }
    }, [status])

    useEffect(() => { fetchAll() }, [fetchAll])

    const decide = async (id, decision) => {
        try {
            const response = await decideScoutForAdmin(id, decision)
            message.success(response.data.message)
            fetchAll()
        } catch (error) {
            message.error(error.response?.data?.message || "Could not save")
        }
    }

    const runScout = async () => {
        try {
            const response = await runHousekeepingForAdmin("career_scout")
            message.success(response.data.message)
        } catch (error) {
            message.error(error.response?.data?.message || "Could not start the scout")
        }
    }

    const decideDraft = async (decision) => {
        try {
            const response = await decideDraftForAdmin(viewing._id, decision, note)
            message.success(response.data.message)
            setViewing(null)
            setNote("")
            fetchAll()
        } catch (error) {
            message.error(error.response?.data?.message || "Could not save")
        }
    }

    const latest = (record) => {
        const counts = record.postingCounts || []
        return counts.length ? counts.map((row) => row.count).join(" → ") : "—"
    }

    const columns = [
        { title: "Title", dataIndex: "title", render: (value, record) => <span>{value}<br />{(record.sources || []).map((source) => SOURCE_TAGS[source])}</span> },
        { title: "Kind", dataIndex: "kind", render: (value) => KIND[value] || value },
        { title: "Nearest careers", render: (_, record) => (record.nearest || []).map((near) => <div key={near.id}>{near.name} ({near.similarity})</div>) },
        { title: "Nearest job titles", render: (_, record) => (record.nearestRoles || []).map((near) => <div key={`${near.professionId}-${near.role}`}>{near.role} ({near.similarity})</div>) },
        { title: "Students", dataIndex: "aspirationCount" },
        { title: "Postings by week", render: (_, record) => latest(record) },
        { title: "What it is", render: (_, record) => record.assessment?.oneLiner || "—" },
        { title: "Pay (LPA)", render: (_, record) => record.assessment?.payLpa || "—" },
        { title: "AI-proof", render: (_, record) => record.assessment?.aiResilience || "—" },
        { title: "Growth", render: (_, record) => record.assessment?.growth || "—" },
        {
            title: "Sources",
            render: (_, record) => (record.assessment?.sources || []).slice(0, 3).map((source) => (
                <div key={source.url}><a href={source.url} target="_blank" rel="noreferrer">{source.title || source.url}</a></div>
            )),
        },
        { title: "Last seen", dataIndex: "lastSeenAt", render: (value) => (value ? dayjs(value).format("DD MMM YYYY") : "—") },
        {
            title: "Draft",
            render: (_, record) => (record.draft
                ? (
                    <span>
                        {DRAFT_STATUS[record.draft.status] || record.draft.status}
                        {record.draft.error ? <div className="report-small">{record.draft.error}</div> : null}
                        {["ready", "accepted", "sent_back", "failed"].includes(record.draft.status) && record.draft.record && (
                            <div><Button size="small" onClick={() => setViewing(record)}>View draft</Button></div>
                        )}
                    </span>
                )
                : "—"),
        },
        {
            title: "Decide",
            render: (_, record) => (
                <span>
                    {record.status !== "approved_combined" && <Button size="small" onClick={() => decide(record._id, "approved_combined")}>Combined career</Button>}{" "}
                    {record.status !== "approved_new" && <Button size="small" onClick={() => decide(record._id, "approved_new")}>New career</Button>}{" "}
                    {record.status !== "dismissed" && <Button size="small" onClick={() => decide(record._id, "dismissed")}>Dismiss</Button>}{" "}
                    {record.status !== "watch" && <Button size="small" onClick={() => decide(record._id, "watch")}>Back to watch</Button>}
                </span>
            ),
        },
    ]

    return (
        <div>
            <p>
                <Button onClick={runScout}>Run the scout now</Button> <Button onClick={fetchAll}>Refresh</Button>
            </p>
            <Segmented
                value={status}
                onChange={setStatus}
                options={[{ label: "Watching", value: "watch" }, { label: "Combined", value: "approved_combined" }, { label: "New", value: "approved_new" }, { label: "Dismissed", value: "dismissed" }]}
            />
            <Table rowKey="_id" loading={loading} columns={columns} dataSource={candidates} scroll={{ x: "max-content" }} />

            <Modal
                open={Boolean(viewing)}
                title={viewing ? `Draft: ${viewing.draft.record.profession || viewing.draft.record.name}` : ""}
                onCancel={() => setViewing(null)}
                width={760}
                footer={viewing && viewing.draft.status === "ready" ? [
                    <Button key="back" onClick={() => decideDraft("send_back")} disabled={!note.trim()}>Send back with note</Button>,
                    <Button key="accept" type="primary" onClick={() => decideDraft("accept")} disabled={(viewing.draft.warnings || []).some((warning) => warning.startsWith("MUST FIX"))}>Accept</Button>,
                ] : null}
            >
                {viewing && (
                    <div>
                        {(viewing.draft.warnings || []).length > 0 && (
                            <ul>{viewing.draft.warnings.map((warning) => <li key={warning}><strong>{warning}</strong></li>)}</ul>
                        )}
                        <DraftSummary draft={viewing.draft} />
                        {viewing.draft.status === "ready" && (
                            <Input.TextArea rows={3} placeholder="What should change? (needed to send it back)" value={note} onChange={(event) => setNote(event.target.value)} />
                        )}
                    </div>
                )}
            </Modal>
        </div>
    )
}

// The fields a reviewer needs to judge a drafted career, then the full record for anything else.
function DraftSummary({ draft }) {
    const record = draft.record || {}
    if (draft.kind === "combined") {
        return (
            <dl>
                <dt>Name</dt><dd>{record.name}</dd>
                <dt>What it is</dt><dd>{record.oneLiner}</dd>
                <dt>How people get there</dt><dd>{record.howToGetThere}</dd>
                <dt>Sides</dt><dd>{record.sideA} × {record.sideB}</dd>
                <dt>Blue-collar</dt><dd>{record.blueCollar ? "Yes" : "No"}</dd>
            </dl>
        )
    }
    return (
        <div>
            <dl>
                <dt>Profession test (§8.95)</dt><dd>{record.profession_test ? `${record.profession_test.passes ? "Passes" : "FAILS"} — ${record.profession_test.reason || ""}` : "—"}</dd>
                <dt>What it is</dt><dd>{record.one_liner}</dd>
                <dt>Sector</dt><dd>{record.professional_sector}</dd>
                <dt>Job roles</dt><dd>{(record.job_roles || []).join(", ")}</dd>
                <dt>Path</dt><dd>{(record.path_to_entry || []).map((step) => `${step.step}. ${step.requirement}`).join(" → ")}</dd>
                <dt>Degree / way in</dt><dd>{record.degree_dependency} · {record.mid_stream_entry} · class 12: {Array.isArray(record.class12_prerequisite) ? record.class12_prerequisite.join(", ") : record.class12_prerequisite}</dd>
                <dt>Pay</dt><dd>{record.economics && `${record.economics.early_earnings_lpa} → ${record.economics.mid_career_lpa} LPA (${record.economics.verification && record.economics.verification.status})`}</dd>
                <dt>Demand · AI</dt><dd>{record.demand_signal && record.demand_signal.india_demand} · {record.ai_exposure && `${record.ai_exposure.band} (${record.ai_exposure.exposure_raw})`}</dd>
                <dt>Rating</dt><dd>{draft.rating ? `${draft.rating.samples} passes${draft.rating.admin_review && draft.rating.admin_review.required ? ` — ${draft.rating.admin_review.reason}` : " — passes agree"}` : "not rated (fix the MUST FIX items first)"}</dd>
                <dt>Embedding</dt><dd>{(draft.embedding || []).length > 0 ? "done" : "missing"}</dd>
            </dl>
            <details>
                <summary>The full record</summary>
                <pre style={{ whiteSpace: "pre-wrap", fontSize: 12 }}>{JSON.stringify(record, null, 2)}</pre>
            </details>
        </div>
    )
}

export default EmergingCareersList
