import { useState, useEffect, useCallback } from "react"
import { Table, Button, Popconfirm, message } from "antd"
import dayjs from "dayjs"
import { getActivityFoldsForAdmin, splitActivityFoldForAdmin } from "../../apiCall/dataUpdatesApi"

// ACTIVITY MATCHES (Round 14, owner: "keep 0.90, measure it"). When a student's activity is close
// enough to one we have already rated (similarity ≥ the threshold), it reuses that rating instead of
// paying for a new one. Here are those matches, closest calls first. "Not the same" splits a wrong one
// off, so the next student who writes it gets it rated on its own. If the bottom of this list keeps
// holding wrong matches, raise ACTIVITY_DEDUP_COSINE on Render; if it is all obvious paraphrases
// rated separately, lower it.
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
