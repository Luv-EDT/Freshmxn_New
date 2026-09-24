import { useState, useEffect } from "react"
import { Table, Button, Popconfirm, Segmented, message } from "antd"
import dayjs from "dayjs"
import { getAllMentorsForAdmin, approveMentorForAdmin } from "../../apiCall/mentorsApi"

// Mentors who have onboarded. Every mentor lands as pending_review; approving them is what makes
// them available on the Mentor Matches tab. This is the one screen that shows the two admin-only
// fields (payment currency, residence).
function MentorsList({ dataVersion, onDataChanged }) {
    const [mentors, setMentors] = useState([])
    const [loading, setLoading] = useState(false)
    const [statusFilter, setStatusFilter] = useState("pending_review") // pending_review | onboarded | all

    useEffect(() => {
        fetchMentors()
    }, [dataVersion])

    const fetchMentors = async () => {
        try {
            setLoading(true)
            const response = await getAllMentorsForAdmin()
            setMentors(response.data.data)
        } catch (error) {
            message.error("Failed to fetch mentors")
        } finally {
            setLoading(false)
        }
    }

    const handleApprove = async (id) => {
        try {
            await approveMentorForAdmin(id)
            message.success("Mentor approved")
            setMentors((prev) => prev.map((mentor) => (mentor._id === id ? { ...mentor, status: "onboarded" } : mentor)))
            onDataChanged()
        } catch (error) {
            message.error(error.response?.data?.message || "Failed to approve mentor")
        }
    }

    const columns = [
        { title: "Joined", dataIndex: "createdAt", render: (value) => dayjs(value).format("DD MMM YYYY") },
        { title: "Mentor", render: (_, record) => `${record.name} (${record.email})` },
        { title: "Phone", dataIndex: "phone" },
        { title: "Role", render: (_, record) => `${record.currentRole} · ${record.discipline}` },
        { title: "Sectors", render: (_, record) => record.sectors.join(", ") },
        { title: "Years", dataIndex: "yearsExperience" },
        { title: "Languages", render: (_, record) => record.languages.join(", ") },
        { title: "HS → college", dataIndex: "transitionCategory" },
        { title: "Motivation", dataIndex: "motivation" },
        { title: "Currency (admin only)", dataIndex: "preferredCurrency" },
        { title: "Residence (admin only)", dataIndex: "residenceCitizenship" },
        { title: "Status", dataIndex: "status" },
        {
            title: "Action",
            render: (_, record) => record.status === "pending_review" && (
                <Popconfirm title={`Approve ${record.name} as a mentor?`} onConfirm={() => handleApprove(record._id)}>
                    <Button type="primary" size="small">Approve</Button>
                </Popconfirm>
            ),
        },
    ]

    const visibleMentors = statusFilter === "all" ? mentors : mentors.filter((mentor) => mentor.status === statusFilter)

    return (
        <div>
            <Segmented options={["pending_review", "onboarded", "all"]} value={statusFilter} onChange={setStatusFilter} />{" "}
            <Button onClick={fetchMentors}>Refresh</Button>

            <Table rowKey="_id" loading={loading} columns={columns} dataSource={visibleMentors} scroll={{ x: "max-content" }} />
        </div>
    )
}

export default MentorsList
