import { useState, useEffect } from "react"
import { Table, Collapse, DatePicker } from "antd"
import dayjs from "dayjs"
import { getAiUsageForAdmin } from "../../apiCall/dataUpdatesApi"

// What the AI calls cost this month (Round 11), measured from the API's own token counts. List
// prices only — a contracted discount would make the real bill lower. A model with no listed price
// shows its tokens and no cost.
const JOB_NAMES = {
    grading: "Grading written answers",
    report: "Writing reports",
    activity_resolver: "Matching activities to careers",
    screenshot_reader: "Reading test screenshots (old uploads)",
    data_refresh: "Monthly career data refresh",
    career_scout: "Weekly careers scout",
    study_refresh: "Monthly study bot",
    draft_career: "Drafting approved careers",
}
const thousands = (value) => (value >= 1000 ? `${Math.round(value / 1000)}k` : String(value))

function AiUsageCard() {
    const [month, setMonth] = useState(dayjs())
    const [data, setData] = useState(null)

    useEffect(() => {
        getAiUsageForAdmin(month.format("YYYY-MM"))
            .then((response) => setData(response.data.data))
            .catch(() => setData(null))
    }, [month])

    const columns = [
        { title: "Job", dataIndex: "job", render: (value) => JOB_NAMES[value] || value },
        { title: "Calls", dataIndex: "calls" },
        { title: "Tokens in / out", render: (_, row) => `${thousands(row.inputTokens)} / ${thousands(row.outputTokens)}` },
        { title: "From cache", dataIndex: "cacheReadTokens", render: thousands },
        { title: "Web searches", dataIndex: "webSearches" },
        { title: "Cost (USD)", dataIndex: "cost", render: (value) => `$${value.toFixed(2)}` },
    ]

    const label = data
        ? `AI usage, ${month.format("MMM YYYY")}: about $${data.totalCost.toFixed(2)}${data.unpriced ? " (plus a model with no listed price)" : ""}`
        : "AI usage"

    return (
        <Collapse
            items={[{
                key: "usage",
                label,
                children: (
                    <>
                        <DatePicker picker="month" value={month} onChange={(value) => value && setMonth(value)} allowClear={false} />
                        <Table rowKey="job" size="small" columns={columns} dataSource={data ? data.jobs : []} pagination={false} scroll={{ x: "max-content" }} />
                    </>
                ),
            }]}
        />
    )
}

export default AiUsageCard
