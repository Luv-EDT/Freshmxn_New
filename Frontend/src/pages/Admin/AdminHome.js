import { useState } from "react"
import { Tabs } from "antd"
import Navbar from "../Navbar"
import LogoutButton from "../LogoutButton"
import AccessRequestsList from "./AccessRequestsList"
import RefundRequestsList from "./RefundRequestsList"
import StudentsList from "./StudentsList"
import FinancialAidList from "./FinancialAidList"
import CouponsList from "./CouponsList"
import MentorsList from "./MentorsList"
import MentorMatchesList from "./MentorMatchesList"

function AdminHome() {
    // One version counter that every student-facing tab both bumps and watches. antd keeps a tab
    // mounted once visited, so without this a tab would keep showing whatever it fetched when it
    // was opened — which is why editing a student used to update Students but nothing else.
    // Coupons is left out: a coupon change doesn't alter student data.
    const [dataVersion, setDataVersion] = useState(0)
    const handleDataChanged = () => setDataVersion((prev) => prev + 1)

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
