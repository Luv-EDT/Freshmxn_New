import { useState, useEffect } from "react"
import { Table, Button, Popconfirm, Segmented, Input, Modal, Select, InputNumber, message } from "antd"
import dayjs from "dayjs"
import { getAllMentorsForAdmin, approveMentorForAdmin, setTier3ForAdmin, updateMentorTermsForAdmin } from "../../apiCall/mentorsApi"
import MentorTestReview from "./MentorTestReview"

// EVERY MENTOR (owner, Rounds 12 and 34): searchable, with where each stands — signed up, profile in,
// test sent, approved — their tier, region, sessions, average rating and strikes. A new mentor is
// approved from their test ("Review test"); Tier 2 comes by itself; "Move to Tier 3" appears only for
// mentors who meet the rule. This is the one screen that shows the admin-only details (how they're paid).
const STATUS_WORDS = {
    pending_review: "Profile in — training and test next",
    test_submitted: "Test sent — review it",
    onboarded: "Approved",
    rejected: "Rejected",
    paused: "Paused",
    removed: "Removed after first session",
}

const inr = (amount) => `₹${Number(amount || 0).toLocaleString("en-IN")}`

function MentorsList({ dataVersion, onDataChanged }) {
    const [mentors, setMentors] = useState([])
    const [loading, setLoading] = useState(false)
    const [statusFilter, setStatusFilter] = useState(null)   // test_submitted | onboarded | pending_review | all
    const [search, setSearch] = useState("")
    const [reviewing, setReviewing] = useState(null)         // the mentor whose test is open

    useEffect(() => {
        fetchMentors()
    }, [dataVersion])

    const fetchMentors = async () => {
        try {
            setLoading(true)
            const response = await getAllMentorsForAdmin()
            setMentors(response.data.data)
            // opens on the job to do: tests waiting, otherwise the approved list
            setStatusFilter((current) => current || (response.data.data.some((mentor) => mentor.status === "test_submitted") ? "test_submitted" : "onboarded"))
        } catch (error) {
            message.error("Failed to fetch mentors")
        } finally {
            setLoading(false)
        }
    }

    const act = async (request, done) => {
        try {
            const response = await request()
            message.success(response.data.message)
            fetchMentors()
            if (onDataChanged) onDataChanged()
            if (done) done()
        } catch (error) {
            message.error(error.response?.data?.message || "That didn't work")
        }
    }

    const editTerms = (record) => {
        let region = record.region || "indian"
        let customRateInr = record.customRateInr
        let customRateUsd = record.customRateUsd
        Modal.confirm({
            title: `${record.name} — region and Tier 3 rate`,
            content: (
                <>
                    <p>Region sets their pay. The Tier 3 rate counts only above the table's (₹1,500 Indian, ₹2,200 International).</p>
                    <Select defaultValue={region} style={{ width: 220 }} options={[{ value: "indian", label: "Indian (lives in India)" }, { value: "international", label: "International (lives abroad)" }]} onChange={(value) => { region = value }} />
                    <p>Tier 3 rate, ₹ <InputNumber min={0} defaultValue={customRateInr} onChange={(value) => { customRateInr = value }} /></p>
                    <p>Tier 3 rate, $ (international) <InputNumber min={0} defaultValue={customRateUsd} onChange={(value) => { customRateUsd = value }} /></p>
                </>
            ),
            onOk: () => act(() => updateMentorTermsForAdmin(record._id, { region, customRateInr, customRateUsd })),
        })
    }

    const columns = [
        { title: "Joined", dataIndex: "createdAt", render: (value) => dayjs(value).format("DD MMM YYYY") },
        { title: "Mentor", render: (_, record) => `${record.name} (${record.email})` },
        { title: "Phone", dataIndex: "phone" },
        { title: "Status", render: (_, record) => STATUS_WORDS[record.status] || record.status },
        { title: "Region", render: (_, record) => (record.region === "international" ? "International" : record.region === "indian" ? "Indian" : "—") },
        { title: "Tier · rate", render: (_, record) => `Tier ${record.tier || 1} · ${inr(record.mainRate && record.mainRate.inr)}${record.mainRate && record.mainRate.usd ? ` ($${record.mainRate.usd})` : ""}` },
        { title: "Sessions · average", render: (_, record) => `${record.standing ? record.standing.sessions : 0}${record.standing && record.standing.average ? ` · ${record.standing.average}/10` : ""}` },
        { title: "Strikes", render: (_, record) => (record.strikes || []).length || "—" },
        { title: "Test", render: (_, record) => (record.test ? (record.test.decision ? record.test.decision : record.test.submittedAt ? `sent · ${record.test.autoScore ? `${record.test.autoScore.correct}/${record.test.autoScore.of}` : ""}` : "started") : "—") },
        { title: "Profession", render: (_, record) => record.professionName || record.discipline },
        { title: "Job role", render: (_, record) => `${record.jobRole || record.currentRole}${record.jobRoleOther ? " (their words)" : ""}` },
        { title: "Industries", render: (_, record) => (record.sectors || []).join(", ") },
        { title: "Years", dataIndex: "yearsExperience" },
        { title: "Languages", render: (_, record) => (record.languages || []).join(", ") },
        { title: "Calendly", render: (_, record) => (record.calendlyMain ? <a href={record.calendlyMain} target="_blank" rel="noreferrer">main</a> : "—") },
        { title: "Paid to (admin only)", render: (_, record) => (record.payout ? [record.payout.upiId, record.payout.accountNumber && `A/c ${record.payout.accountNumber} · ${record.payout.ifsc}`, record.payout.intlMethod, record.payout.pan && `PAN ${record.payout.pan}`].filter(Boolean).join(" · ") || "—" : "—") },
        { title: "Lives in", dataIndex: "residenceCitizenship" },
        { title: "Motivation", dataIndex: "motivation" },
        {
            title: "Action",
            render: (_, record) => (
                <>
                    {record.test && record.test.submittedAt && (
                        <><Button type={record.status === "test_submitted" ? "primary" : "default"} size="small" onClick={() => setReviewing(record)}>Review test</Button>{" "}</>
                    )}
                    {record.status === "paused" && (
                        <><Popconfirm title={`Bring ${record.name} back?`} onConfirm={() => act(() => approveMentorForAdmin(record._id))}><Button size="small">Un-pause</Button></Popconfirm>{" "}</>
                    )}
                    {record.status === "onboarded" && Number(record.tier || 1) < 3 && (
                        (record.tier3Missing || []).length === 0
                            ? <><Popconfirm title={`Move ${record.name} to Tier 3?`} onConfirm={() => act(() => setTier3ForAdmin(record._id))}><Button type="primary" size="small">Move to Tier 3</Button></Popconfirm>{" "}</>
                            : <span className="report-small" title={record.tier3Missing.join(", ")}>Tier 3: not yet </span>
                    )}
                    <Button size="small" onClick={() => editTerms(record)}>Region / rate</Button>
                </>
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
                    { label: `Tests to review (${count("test_submitted")})`, value: "test_submitted" },
                    { label: `Approved (${count("onboarded")})`, value: "onboarded" },
                    { label: `Profile in (${count("pending_review")})`, value: "pending_review" },
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

            {reviewing && (
                <MentorTestReview mentor={reviewing} onClose={() => setReviewing(null)} onDecided={() => { setReviewing(null); fetchMentors(); if (onDataChanged) onDataChanged() }} />
            )}
        </div>
    )
}

export default MentorsList
