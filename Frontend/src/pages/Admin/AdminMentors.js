import { useState } from "react"
import { Link } from "react-router-dom"
import { Tabs } from "antd"
import Navbar from "../Navbar"
import LogoutButton from "../LogoutButton"
import MentorsList from "./MentorsList"
import MentorMatchesList from "./MentorMatchesList"
import MentorPayoutsList from "./MentorPayoutsList"
import SessionFeedbackList from "./SessionFeedbackList"
import MentorReviewsList from "./MentorReviewsList"

// THE ADMIN'S MENTOR SECTION (owner, Round 34) — its own page, so all mentor work happens in one place:
//   Mentors           approve from the test, Tier 3, region and rate
//   Mentor matches    every student's mentor ticket: match, Session done, no-shows, the ticket menu
//   Payouts           what we owe mentors; Mark paid; CSV
//   Session feedback  students' feedback and reports about mentors
//   Profession data   what mentors suggest about our career data
// The page is /admin/mentors; no API prefix starts with /admin.
function AdminMentors() {
    const [dataVersion, setDataVersion] = useState(0)
    const handleDataChanged = () => setDataVersion((prev) => prev + 1)

    const items = [
        { key: "matches", label: "Mentor matches", children: <MentorMatchesList dataVersion={dataVersion} onDataChanged={handleDataChanged} /> },
        { key: "mentors", label: "Mentors", children: <MentorsList dataVersion={dataVersion} onDataChanged={handleDataChanged} /> },
        { key: "payouts", label: "Payouts", children: <MentorPayoutsList /> },
        { key: "feedback", label: "Session feedback", children: <SessionFeedbackList /> },
        { key: "profession", label: "Profession data", children: <MentorReviewsList /> },
    ]

    return (
        <div>
            <Navbar />
            <div className="page">
                <p><Link to="/admin">← Admin</Link></p>
                <h2>Mentors</h2>
                <LogoutButton />
                <Tabs className="admin-tabs" items={items} />
            </div>
        </div>
    )
}

export default AdminMentors
