import { useState, useEffect, useCallback } from "react"
import { Table, Button, Segmented, Popconfirm, Tag, message } from "antd"
import dayjs from "dayjs"
import { getProposalsForAdmin, decideProposalForAdmin, exportPatchForAdmin } from "../../apiCall/dataUpdatesApi"
import { runHousekeepingForAdmin } from "../../apiCall/followUpsApi"
import ModelChoiceCard from "./ModelChoiceCard"

// The monthly data refresh's suggestions (Round 10): demand and pay changes found in the named public
// sources and on Adzuna. Nothing changes until it is approved here; approving shows the new value on
// the career page at once. "Export patch" downloads every approved value as a file to commit
// (node Backend/tools/applyDataPatch.js <file> --write).
//
// Round 11: the monthly study bot files here too — exam rows (checked on the exam's own site) and
// college lists (NIRF first). The Kind column tells them apart.
//
// Round 16 (owner: one queue): mentors' suggestions arrive here too, after Claude's monthly check
// against sources (Backend/housekeeping/mentorPass.js), tagged "Mentor + sources" with the mentors'
// own words beside Claude's sources. A "Mentor's wording" row changes no page when approved — it goes
// into Export patch (mentorNotes) for a reviewed data commit.
const FIELD_NAMES = {
    india_demand: "Demand in India", early_earnings_lpa: "Starting pay (LPA)", mid_career_lpa: "Mid-career pay (LPA)",
    usual_application_window: "Applications usually", usual_exam_month: "Exam usually", eligibility: "Who can sit it",
    new_exam: "A new exam", add_institution: "Add an institution", remove_institution: "Remove an institution", update_institution: "Change a rank",
    after_undergrad: "Master's needed?", abroad: "Studying abroad", closing_rank: "Last closing rank", licence: "Licence abroad",
}
const MENTOR_SECTIONS = {
    what_it_is: "What it is", path: "The path", exams: "Exams", where_to_study: "Where to study", working_abroad: "Working abroad",
    degrees: "Degrees that count", ai: "AI exposure", nuances: "Worth knowing", skills_missing: "Skills we're missing",
}
const KIND_NAMES = { career: "Career", exam: "Exam", college: "College", study_fact: "Study fact", cutoff: "Cut-off", abroad_licence: "Licence abroad", mentor_text: "Mentor's wording" }

// what a mentor's-wording row is about: a section of the sheet, or a quality going up or down
const mentorWhat = (record) => (record.section === "qualities"
    ? `Quality: ${String(record.factor || "").replace(/_/g, " ")} ${record.direction === "higher" ? "↑" : "↓"}`
    : MENTOR_SECTIONS[record.section] || record.section)

// a college or new-exam proposal carries its institution or exam as JSON text
const readable = (value) => {
    try {
        const parsed = JSON.parse(value)
        if (parsed && typeof parsed === "object") {
            if (parsed.exam && parsed.body) return [parsed.exam, parsed.body, parsed.steps, parsed.url].filter(Boolean).join(" · ")
            if (parsed.closing_rank) return [`rank ${parsed.closing_rank}`, parsed.year, parsed.round, parsed.source_url].filter(Boolean).join(" · ")
            if (parsed.need) return [parsed.need.replace(/_/g, " "), parsed.stage, parsed.why].filter(Boolean).join(" · ")
            return [parsed.name, parsed.city, parsed.ownership, parsed.basis || parsed.conducting_body, parsed.official_url].filter(Boolean).join(" · ")
        }
    } catch (error) {
        // plain text
    }
    return value
}

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

    const runRefresh = async (job) => {
        try {
            const response = await runHousekeepingForAdmin(job)
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
        {
            title: "Kind",
            dataIndex: "kind",
            render: (value, record) => (
                <span>
                    {KIND_NAMES[value || "career"]}
                    {record.origin === "mentor" && <div><Tag color="gold">Mentor + sources</Tag></div>}
                </span>
            ),
        },
        { title: "Career / exam / discipline", dataIndex: "profession" },
        { title: "What", dataIndex: "field", render: (value, record) => (value === "mentor_text" ? mentorWhat(record) : FIELD_NAMES[value] || value) },
        { title: "Now", dataIndex: "currentValue", render: (value) => (value ? readable(value) : "—") },
        { title: "Proposed", dataIndex: "proposedValue", render: (value) => <strong>{readable(value)}</strong> },
        { title: "Confidence", dataIndex: "confidence" },
        {
            title: "Why",
            dataIndex: "reason",
            render: (value, record) => (
                <span>
                    {value}
                    {(record.fromMentors || []).map((mentor, index) => (
                        <div key={`${mentor.mentorName}-${index}`} className="report-small">
                            {mentor.mentorName || "A mentor"}: “{mentor.note}”
                            {mentor.sourceUrl && <> · <a href={mentor.sourceUrl} target="_blank" rel="noreferrer">their link</a></>}
                        </div>
                    ))}
                </span>
            ),
        },
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
                        <Popconfirm title={record.kind === "mentor_text" ? "Approve? It goes into Export patch for a data commit." : "Show this on the career pages?"} onConfirm={() => decide(record._id, "approved")}>
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
            <ModelChoiceCard />
            <p>
                {data.summary.open} waiting · {data.summary.careersChecked} careers checked so far{" "}
                <Button onClick={() => runRefresh("data_refresh")}>Run the career refresh now (with mentors' suggestions)</Button>{" "}
                <Button onClick={() => runRefresh("study_refresh")}>Run the study bot now</Button>{" "}
                <Button onClick={() => runRefresh("batch_collect")}>Collect batch answers now</Button>{" "}
                <Button onClick={exportPatch}>Export patch</Button>{" "}
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
