import { useState, useEffect, useCallback } from "react"
import { Table, Button, Select, message } from "antd"
import dayjs from "dayjs"
import { getLeadsForAdmin, updateLeadForAdmin } from "../../apiCall/studyAbroadApi"

// Students who asked to be connected with the study-abroad partner (Round 11). Every row was made
// with the consent box ticked; the consent date and policy version are shown. Share the details with
// the partner by hand, then mark the row "Shared".
const STATUS_NAMES = { new: "New", shared: "Shared with partner", closed: "Closed" }

function StudyAbroadList() {
    const [leads, setLeads] = useState([])
    const [loading, setLoading] = useState(false)

    const fetchAll = useCallback(async () => {
        try {
            setLoading(true)
            const response = await getLeadsForAdmin()
            setLeads(response.data.data.leads)
        } catch (error) {
            message.error("Failed to fetch study-abroad leads")
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { fetchAll() }, [fetchAll])

    const setStatus = async (record, status) => {
        try {
            await updateLeadForAdmin(record._id, status, record.adminNote)
            message.success("Saved")
            fetchAll()
        } catch (error) {
            message.error(error.response?.data?.message || "Could not save")
        }
    }

    const columns = [
        { title: "Asked", dataIndex: "createdAt", render: (value) => dayjs(value).format("DD MMM YYYY") },
        { title: "Student", render: (_, record) => (record.user ? record.user.name : "—") },
        { title: "Email", render: (_, record) => (record.user ? record.user.email : "—") },
        { title: "Phone", render: (_, record) => (record.user && record.user.phone) || "—" },
        // Round 18: the report now offers a waitlist (help with a master's abroad, later), not a partner
        { title: "Asked for", dataIndex: "kind", render: (value) => (value === "waitlist" ? "Master's-abroad waitlist" : "Partner connection") },
        { title: "Careers", dataIndex: "careers", render: (value) => (value || []).join(", ") },
        { title: "Consent", render: (_, record) => `${dayjs(record.consentAt).format("DD MMM YYYY")} · policy ${record.policyVersion}` },
        {
            title: "Status",
            render: (_, record) => (
                <Select
                    value={record.status}
                    style={{ minWidth: 180 }}
                    onChange={(value) => setStatus(record, value)}
                    options={Object.entries(STATUS_NAMES).map(([value, label]) => ({ value, label }))}
                />
            ),
        },
    ]

    return (
        <div>
            <p>
                {leads.filter((lead) => lead.status === "new").length} new · {leads.length} in all{" "}
                <Button onClick={fetchAll}>Refresh</Button>
            </p>
            <Table rowKey="_id" loading={loading} columns={columns} dataSource={leads} scroll={{ x: "max-content" }} />
        </div>
    )
}

export default StudyAbroadList
