import { useState, useEffect } from "react"
import { Table, Button, Popconfirm, Segmented, Input, message } from "antd"
import dayjs from "dayjs"
import { getAllMentorsForAdmin, approveMentorForAdmin } from "../../apiCall/mentorsApi"

// Mentors who have onboarded. Every mentor lands as pending_review; approving them is what makes
// them available on the Mentor Matches tab. This is the one screen that shows the two admin-only
// fields (payment currency, residence).
//
// Round 12 (owner): the full list of onboarded mentors, searchable — by name, email, phone,
// profession, job role, industry or language — with the ones waiting for approval a tap away.
function MentorsList({ dataVersion, onDataChanged }) {
    const [mentors, setMentors] = useState([])
    const [loading, setLoading] = useState(false)
    // opens on "Waiting for approval" when someone is waiting (that is the job to do), otherwise on
    // the onboarded list; the admin can switch either way
    const [statusFilter, setStatusFilter] = useState(null) // onboarded | pending_review | all
    const [search, setSearch] = useState("")

    useEffect(() => {
        fetchMentors()
    }, [dataVersion])

    const fetchMentors = async () => {
        try {
            setLoading(true)
            const response = await getAllMentorsForAdmin()
            setMentors(response.data.data)
            setStatusFilter((current) => current || (response.data.data.some((mentor) => mentor.status === "pending_review") ? "pending_review" : "onboarded"))
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
        { title: "Profession", render: (_, record) => record.professionName || record.discipline },
        { title: "Job role", render: (_, record) => `${record.jobRole || record.currentRole}${record.jobRoleOther ? " (their words)" : ""}` },
        { title: "Industries", render: (_, record) => record.sectors.join(", ") },
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

    const count = (status) => mentors.filter((mentor) => status === "all" || mentor.status === status).length
    const words = search.trim().toLowerCase().split(/\s+/).filter(Boolean)
    const searchable = (mentor) => [
        mentor.name, mentor.email, mentor.phone, mentor.professionName, mentor.discipline, mentor.jobRole, mentor.currentRole,
        ...(mentor.sectors || []), ...(mentor.languages || []),
    ].join(" ").toLowerCase()
    const visibleMentors = mentors
        .filter((mentor) => statusFilter === "all" || mentor.status === statusFilter)
        .filter((mentor) => words.every((word) => searchable(mentor).includes(word)))

    return (
        <div>
            <Segmented
                options={[
                    { label: `Onboarded (${count("onboarded")})`, value: "onboarded" },
                    { label: `Waiting for approval (${count("pending_review")})`, value: "pending_review" },
                    { label: `All (${count("all")})`, value: "all" },
                ]}
                value={statusFilter || "onboarded"}
                onChange={setStatusFilter}
            />{" "}
            <Button onClick={fetchMentors}>Refresh</Button>
            <Input.Search
                allowClear
                placeholder="Search name, email, phone, profession, role, industry, language"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                style={{ maxWidth: 480, margin: "12px 0", display: "block" }}
            />

            <Table rowKey="_id" loading={loading} columns={columns} dataSource={visibleMentors} scroll={{ x: "max-content" }} />
        </div>
    )
}

export default MentorsList
