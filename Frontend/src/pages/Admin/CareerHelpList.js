import { useState, useEffect, useCallback } from "react"
import { Table, Button, Select, message } from "antd"
import dayjs from "dayjs"
import { getCareerHelpForAdmin, updateCareerHelpForAdmin } from "../../apiCall/careerHelpApi"

// "How else can we help?" (Round 25): students who joined the waitlist from the dashboard or the
// mentor page. Every row was saved with the consent box ticked. Call them, then mark the row.
const STATUS_NAMES = { new: "New", called: "Called", closed: "Closed" }
const WANT_NAMES = { toolkit: "Skill kit", opportunities: "Internships / jobs / fellowships", abroad: "Master's or settling abroad", other: "Other" }
const PLAN_NAMES = { 1: "Career Discovery", 2: "Discovery + Mentor", 3: "Mentor Only" }

function CareerHelpList() {
    const [rows, setRows] = useState([])
    const [loading, setLoading] = useState(false)

    const fetchAll = useCallback(async () => {
        try {
            setLoading(true)
            const response = await getCareerHelpForAdmin()
            setRows(response.data.data)
        } catch (error) {
            message.error("Failed to fetch the help waitlist")
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { fetchAll() }, [fetchAll])

    const setStatus = async (record, status) => {
        try {
            await updateCareerHelpForAdmin(record._id, status, record.adminNote)
            message.success("Saved")
            fetchAll()
        } catch (error) {
            message.error(error.response?.data?.message || "Could not save")
        }
    }

    const columns = [
        { title: "Asked", dataIndex: "updatedAt", render: (value) => dayjs(value).format("DD MMM YYYY") },
        { title: "Student", render: (_, record) => (record.user ? record.user.name : "—") },
        { title: "Email", render: (_, record) => (record.user ? record.user.email : "—") },
        { title: "Phone", render: (_, record) => (record.user && record.user.phone) || "—" },
        { title: "Plan", dataIndex: "planTier", render: (value) => PLAN_NAMES[value] || "—" },
        { title: "Career", dataIndex: "careerName", render: (value) => value || "Not sure yet" },
        { title: "Wants", dataIndex: "wants", render: (value) => (value || []).map((want) => WANT_NAMES[want] || want).join(", ") },
        { title: "Anything else", dataIndex: "otherText", render: (value) => value || "—" },
        { title: "Consent", render: (_, record) => `${dayjs(record.consentAt).format("DD MMM YYYY")} · policy ${record.policyVersion}` },
        {
            title: "Status",
            render: (_, record) => (
                <Select
                    value={record.status}
                    style={{ minWidth: 140 }}
                    onChange={(value) => setStatus(record, value)}
                    options={Object.entries(STATUS_NAMES).map(([value, label]) => ({ value, label }))}
                />
            ),
        },
    ]

    return (
        <div>
            <p>
                {rows.filter((row) => row.status === "new").length} new · {rows.length} in all{" "}
                <Button onClick={fetchAll}>Refresh</Button>
            </p>
            <Table rowKey="_id" loading={loading} columns={columns} dataSource={rows} scroll={{ x: "max-content" }} />
        </div>
    )
}

export default CareerHelpList
