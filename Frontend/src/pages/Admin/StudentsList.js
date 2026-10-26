import { useState, useEffect } from "react"
import { Table, Button, message } from "antd"
import dayjs from "dayjs"
import { getAllUsersForAdmin } from "../../apiCall/userApi"
import StudentEditForm from "./StudentEditForm"
import { GiveFreeAccess, DeleteAccount } from "./StudentAccessActions"
import { PLAN_NAMES } from "../plans"
import { getProgressForAdmin } from "../../apiCall/submissionsApi"
import { sectionsDone, ASSESSMENT_MODULES } from "../Assessment/assessmentModules"
import StudentSearch, { matchesStudent } from "./StudentSearch"

// THREE COLUMNS ON WHERE EACH STUDENT IS (owner, Round 29): the assessment (the same count the
// student's own page shows), the mentorship stage, and the report updates with their log.
const assessmentText = (progress) => {
    if (!progress || Object.keys(progress.psychometric || {}).length === 0) return "not started"
    const { pct, pending } = sectionsDone(progress.psychometric)
    return `${pct}%${pending.length ? ` · pending: ${pending.join(", ")}` : progress.submittedAt ? " · submitted" : " · not submitted"}`
}

const UPDATE_KINDS = { own: "own change", free: "free (a retake we asked for)", system: "our improvement", granted: "free update given" }

const testTitle = (key) => (ASSESSMENT_MODULES.find((module) => module.key === key) || { title: key }).title

function ReportUpdates({ user, progress }) {
    const log = user.updateLog || []
    // Round 30: a retake we asked for makes the NEXT update free (never more than one waiting). Round 31
    // (owner): so does a report on our older scoring or matching, and a test we've offered again
    const freeUsed = log.filter((entry) => entry.kind === "free").length
    const waiting = user.freeUpdates > 0 ? "next update free"
        : progress && progress.systemUpdate ? "free update waiting — our improvement"
            : "no free update waiting"
    const offers = (progress && progress.offers) || []
    const summary = `Own: ${user.selfUpdatesUsed || 0} of 3 used · ${waiting}${offers.length ? ` · offered again: ${offers.map(testTitle).join(", ")}` : ""}${freeUsed ? ` · ${freeUsed} free used so far` : ""}`
    if (log.length === 0) return summary
    return (
        <details>
            <summary>{summary}</summary>
            <ul className="admin-log">
                {log.slice().reverse().map((entry, index) => (
                    <li key={index}>{dayjs(entry.at).format("DD MMM YYYY, HH:mm")} · {UPDATE_KINDS[entry.kind] || entry.kind} · {entry.via}</li>
                ))}
            </ul>
        </details>
    )
}

function StudentsList({ dataVersion, onDataChanged }) {
    const [users, setUsers] = useState([])
    const [progress, setProgress] = useState({})
    const [loading, setLoading] = useState(false)
    const [search, setSearch] = useState("")
    const [editingStudent, setEditingStudent] = useState(null)

    // ─── Fetch users (and again whenever any tab changes student data) ───────
    useEffect(() => {
        fetchUsers()
    }, [dataVersion])

    const fetchUsers = async () => {
        try {
            setLoading(true)
            const [usersRes, progressRes] = await Promise.all([
                getAllUsersForAdmin(),
                getProgressForAdmin(),
            ])
            setUsers(usersRes.data.data)
            setProgress(progressRes.data.data || {})
        } catch (error) {
            message.error("Failed to fetch students")
        } finally {
            setLoading(false)
        }
    }

    // Round 34 (owner): "Downgrade to Tier 1" moved to the mentor ticket — Admin → Mentors → Mentor
    // matches → Close or change this ticket → Refund the mentor part does the same thing in one place

    // the edit writes the user document every other tab reads, so they all have to be told
    const handleSaved = (updatedUser) => {
        setUsers((prev) =>
            prev.map((user) => (user._id === updatedUser._id ? { ...user, ...updatedUser } : user))
        )
        setEditingStudent(null)
        onDataChanged()
    }

    // ─── Columns ─────────────────────────────────────────────────────────────
    const columns = [
        { title: "Joined", dataIndex: "createdAt", render: (value) => dayjs(value).format("DD MMM YYYY") },
        { title: "Name", dataIndex: "name" },
        { title: "Email", render: (_, record) => `${record.email}${record.isEmailVerified ? " ✓" : " (unconfirmed)"}` },
        { title: "Phone", render: (_, record) => record.phone || "—" },
        { title: "Role", dataIndex: "role" },
        { title: "Age", dataIndex: "age" },
        // under-18s: has a parent confirmed by the emailed code? (Round 10)
        { title: "Parent consent", render: (_, record) => ({ verified: "Confirmed", waiting_for_parent: "Waiting for parent", missing: "Missing", not_needed: "—" }[record.parentConsent] || "—") },
        { title: "Journey", dataIndex: "journey" },
        { title: "Paid", render: (_, record) => (record.paid ? "Yes" : "No") },
        { title: "Tier", dataIndex: "currentTier", render: (value) => `${value} · ${PLAN_NAMES[value] || ""}` },
        { title: "Interest form", render: (_, record) => record.progress?.interestForm || "N/A" },
        { title: "Assessment", render: (_, record) => (record.role === "student" ? assessmentText(progress[record._id]) : "—") },
        { title: "Mentorship", render: (_, record) => (progress[record._id] && progress[record._id].mentorship) || "—" },
        { title: "Report updates", render: (_, record) => (record.role === "student" ? <ReportUpdates user={record} progress={progress[record._id]} /> : "—") },
        {
            title: "Action",
            render: (_, record) => (
                <>
                    <Button size="small" onClick={() => setEditingStudent(record)}>Edit</Button>
                    {/* Round 26 (owner): a plan for free, and deleting an account with everything in it */}
                    {record.role === "student" && record.currentTier !== 2 && (
                        <>{" "}<GiveFreeAccess student={record} onDone={handleSaved} /></>
                    )}
                    {record.role !== "admin" && (
                        <>{" "}<DeleteAccount student={record} onDone={(id) => { setUsers((prev) => prev.filter((user) => user._id !== id)); onDataChanged() }} /></>
                    )}
                </>
            ),
        },
    ]

    const visibleUsers = users.filter((user) => matchesStudent(user, search))

    return (
        <div>
            {/* Toolbar */}
            <Button onClick={fetchUsers}>Refresh</Button>
            <StudentSearch value={search} onChange={setSearch} />

            <Table rowKey="_id" loading={loading} columns={columns} dataSource={visibleUsers} scroll={{ x: "max-content" }} />

            <StudentEditForm
                visible={editingStudent !== null}
                student={editingStudent}
                onClose={() => setEditingStudent(null)}
                onSaved={handleSaved}
            />
        </div>
    )
}

export default StudentsList
