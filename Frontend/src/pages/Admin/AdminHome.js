import { useState, useEffect } from "react"
import { Tabs, Badge } from "antd"
import Navbar from "../Navbar"
import LogoutButton from "../LogoutButton"
import AccessRequestsList from "./AccessRequestsList"
import RefundRequestsList from "./RefundRequestsList"
import StudentsList from "./StudentsList"
import FinancialAidList from "./FinancialAidList"
import CouponsList from "./CouponsList"
import MentorsList from "./MentorsList"
import MentorMatchesList from "./MentorMatchesList"
import AssessmentIssuesList from "./AssessmentIssuesList"
import FollowUpsList from "./FollowUpsList"
import DataUpdatesList from "./DataUpdatesList"
import EmergingCareersList from "./EmergingCareersList"
import { getAllIssuesForAdmin } from "../../apiCall/assessmentIssuesApi"

function AdminHome() {
    // One version counter that every student-facing tab both bumps and watches. antd keeps a tab
    // mounted once visited, so without this a tab would keep showing whatever it fetched when it
    // was opened — which is why editing a student used to update Students but nothing else.
    // Coupons is left out: a coupon change doesn't alter student data.
    const [dataVersion, setDataVersion] = useState(0)
    const handleDataChanged = () => setDataVersion((prev) => prev + 1)

    // the open-issues count rides on the tab label, so a broken test is visible without opening it
    const [openIssues, setOpenIssues] = useState(0)
    useEffect(() => {
        getAllIssuesForAdmin()
            .then((response) => setOpenIssues(response.data.data.openCount))
            .catch(() => setOpenIssues(0))
    }, [dataVersion])

    const items = [
        {
            key: "accessRequests",
            label: "Access Requests",
            children: <AccessRequestsList dataVersion={dataVersion} onDataChanged={handleDataChanged} />,
        },
        {
            key: "refundRequests",
            label: "Refund Requests",
            children: <RefundRequestsList dataVersion={dataVersion} onDataChanged={handleDataChanged} />,
        },
        {
            key: "financialAid",
            label: "Financial Aid",
            children: <FinancialAidList dataVersion={dataVersion} onDataChanged={handleDataChanged} />,
        },
        {
            key: "students",
            label: "Students",
            children: <StudentsList dataVersion={dataVersion} onDataChanged={handleDataChanged} />,
        },
        {
            key: "mentors",
            label: "Mentors",
            children: <MentorsList dataVersion={dataVersion} onDataChanged={handleDataChanged} />,
        },
        {
            key: "mentorMatches",
            label: "Mentor Matches",
            children: <MentorMatchesList dataVersion={dataVersion} onDataChanged={handleDataChanged} />,
        },
        {
            key: "assessmentIssues",
            label: <Badge count={openIssues} size="small" offset={[8, -2]}>Assessment issues</Badge>,
            children: <AssessmentIssuesList dataVersion={dataVersion} onDataChanged={handleDataChanged} onOpenCount={setOpenIssues} />,
        },
        {
            key: "followUps",
            label: "Follow-ups",
            children: <FollowUpsList dataVersion={dataVersion} />,
        },
        {
            key: "dataUpdates",
            label: "Data updates",
            children: <DataUpdatesList />,
        },
        {
            key: "emergingCareers",
            label: "Emerging careers",
            children: <EmergingCareersList />,
        },
        {
            key: "coupons",
            label: "Coupons",
            children: <CouponsList />,
        },
    ]

    return (
        <div>
            <Navbar />
            <div className="page">
                <h2>Admin</h2>
                <LogoutButton />
                <Tabs items={items} />
            </div>
        </div>
    )
}

export default AdminHome
