import { useState, useEffect, useCallback } from "react"
import { Table, Button, Segmented, Popconfirm, message } from "antd"
import dayjs from "dayjs"
import { getProposalsForAdmin, decideProposalForAdmin, exportPatchForAdmin } from "../../apiCall/dataUpdatesApi"
import { runHousekeepingForAdmin } from "../../apiCall/followUpsApi"

// The monthly data refresh's suggestions (Round 10): demand and pay changes found in the named public
// sources and on Adzuna. Nothing changes until it is approved here; approving shows the new value on
// the career page at once. "Export patch" downloads every approved value as a file to commit
// (node Backend/tools/applyDataPatch.js <file> --write).
const FIELD_NAMES = { india_demand: "Demand in India", early_earnings_lpa: "Starting pay (LPA)", mid_career_lpa: "Mid-career pay (LPA)" }

function DataUpdatesList() {
    const [status, setStatus] = useState("open")
    const [data, setData] = useState({ proposals: [], summary: { open: 0, careersChecked: 0 } })
    const [loading, setLoading] = useState(false)

    const fetchAll = useCallback(async () => {
        try {
            setLoading(true)
            const response = await getProposalsForAdmin(status)
            setData(response.data.data)
        } catch (error) {
            message.error("Failed to fetch data updates")
        } finally {
            setLoading(false)
        }
    }, [status])

    useEffect(() => { fetchAll() }, [fetchAll])

    const decide = async (id, decision) => {
        try {
            const response = await decideProposalForAdmin(id, decision)
            message.success(response.data.message)
            fetchAll()
        } catch (error) {
            message.error(error.response?.data?.message || "Could not save")
        }
    }

    const runRefresh = async () => {
        try {
            const response = await runHousekeepingForAdmin("data_refresh")
            message.success(response.data.message)
        } catch (error) {
            message.error(error.response?.data?.message || "Could not start the refresh")
        }
    }

    const exportPatch = async () => {
        try {
            const response = await exportPatchForAdmin()
            const blob = new Blob([JSON.stringify(response.data.data.patch, null, 2)], { type: "application/json" })
            const link = document.createElement("a")
            link.href = URL.createObjectURL(blob)
            link.download = `freshmxn-data-patch-${dayjs().format("YYYY-MM-DD")}.json`
            link.click()
            URL.revokeObjectURL(link.href)
        } catch (error) {
            message.error("Could not export the patch")
        }
    }

    const columns = [
        { title: "Found", dataIndex: "createdAt", render: (value) => dayjs(value).format("DD MMM YYYY") },
        { title: "Career", dataIndex: "profession" },
        { title: "What", dataIndex: "field", render: (value) => FIELD_NAMES[value] || value },
        { title: "Now", dataIndex: "currentValue", render: (value) => value || "—" },
        { title: "Proposed", dataIndex: "proposedValue", render: (value) => <strong>{value}</strong> },
        { title: "Confidence", dataIndex: "confidence" },
        { title: "Why", dataIndex: "reason" },
        {
            title: "Job board",
            render: (_, record) => (record.adzuna && record.adzuna.count !== null && record.adzuna.count !== undefined
                ? `${record.adzuna.count} postings${record.adzuna.medianLpa ? ` · median ${record.adzuna.medianLpa} LPA` : ""}`
                : "—"),
        },
        {
            title: "Sources",
            render: (_, record) => (record.sources || []).slice(0, 4).map((source) => (
                <div key={source.url}><a href={source.url} target="_blank" rel="noreferrer">{source.title || source.url}</a></div>
            )),
        },
        {
            title: "Decide",
            render: (_, record) => (record.status === "open"
                ? (
                    <span>
                        <Popconfirm title="Show this value on the career page?" onConfirm={() => decide(record._id, "approved")}>
                            <Button type="primary" size="small">Approve</Button>
                        </Popconfirm>{" "}
                        <Button size="small" onClick={() => decide(record._id, "rejected")}>Reject</Button>
                    </span>
                )
                : record.status),
        },
    ]

    return (
        <div>
            <p>
                {data.summary.open} waiting · {data.summary.careersChecked} careers checked so far{" "}
                <Button onClick={runRefresh}>Run the refresh now</Button> <Button onClick={exportPatch}>Export patch</Button>{" "}
                <Button onClick={fetchAll}>Refresh</Button>
            </p>
            <Segmented
                value={status}
                onChange={setStatus}
                options={[{ label: "Waiting", value: "open" }, { label: "Approved", value: "approved" }, { label: "Rejected", value: "rejected" }, { label: "Replaced", value: "superseded" }]}
            />
            <Table rowKey="_id" loading={loading} columns={columns} dataSource={data.proposals} scroll={{ x: "max-content" }} />
        </div>
    )
}

export default DataUpdatesList
