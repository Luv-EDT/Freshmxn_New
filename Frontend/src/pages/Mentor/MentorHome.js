import { useEffect, useState } from "react"
import { useSelector } from "react-redux"
import { Tabs, message } from "antd"
import { getMyMentorProfile, onboardMentor, updateMyMentorProfile } from "../../apiCall/mentorsApi"
import MentorOnboarding from "./MentorOnboarding"
import MentorReviewSheet from "./MentorReviewSheet"
import MentorStudents from "./MentorStudents"
import MentorTraining from "./MentorTraining"
import MentorTest from "./MentorTest"
import MentorPayouts from "./MentorPayouts"
import LogoutButton from "../LogoutButton"
import logo from "../../assets/brand/logo.png"

// THE MENTOR DASHBOARD (owner, Round 34). Before the profile is in: the onboarding form. Then six tabs —
// Home (the current student and the history), Training (the three documents), Test (before approval),
// My profile, My profession (our data to check, and the starter skills roadmap) and Payouts. A new
// mentor goes training → profile → test → our approval before any student is matched (Round 35, owner:
// the training documents come before "Tell us about yourself").
const STATUS_TEXT = {
    pending_review: "Next: take your test (Test tab). Our team approves mentors after the test.",
    test_submitted: "Your test is with our team. It usually takes a couple of days — we'll let you know by email.",
    onboarded: "You're approved. Before we match you with a student, we'll message you on WhatsApp so you can open slots on your Calendly links.",
    rejected: "We couldn't approve you this time — see the Test tab for our note.",
    paused: "Your profile is paused, so you won't be matched with new students for now. Our team will be in touch.",
    removed: "You're no longer matched with students. Questions? WhatsApp +91 8882756287.",
}

const REGION_WORDS = { indian: "Indian", international: "International" }

function MentorHome() {
    const { user } = useSelector((state) => state.user)
    const [profile, setProfile] = useState(null)
    const [loading, setLoading] = useState(true)
    const [editing, setEditing] = useState(false)
    const [firstTab, setFirstTab] = useState("training")   // before the profile: training, then "Tell us about yourself"

    const load = async () => {
        const response = await getMyMentorProfile()
        setProfile(response?.data?.data || null)
        setLoading(false)
    }
    useEffect(() => { load() }, [])

    const handleOnboard = async (form) => {
        const response = await onboardMentor(form)
        if (!response || response.data.success === false) {
            message.error(response?.data?.message || "Could not save your profile")
            return
        }
        message.success("Thanks — next, take your test")
        load()
    }

    const handleUpdate = async (form) => {
        const response = await updateMyMentorProfile(form)
        if (!response || response.data.success === false) {
            message.error(response?.data?.message || "Could not update your profile")
            return
        }
        message.success("Profile updated")
        setEditing(false)
        load()
    }

    if (!user || loading) return <div className="page">Loading...</div>

    const header = (
        <>
            <nav className="nav-row">
                <img src={logo} alt="Freshmxn" height="32" />
                <span>Mentor · {user.name}</span>
                <LogoutButton />
            </nav>
            <hr />
        </>
    )

    if (!profile) {
        return (
            <div>
                {header}
                <main className="page mentor-dashboard">
                    <h2 className="page-title-center">Welcome, mentor</h2>
                    <ol className="mentor-path" aria-label="Your first steps">
                        <li className={firstTab === "training" ? "current" : "done"}>Read the training</li>
                        <li className={firstTab === "profile" ? "current" : ""}>Tell us about yourself</li>
                        <li>Take the test</li>
                        <li>Our approval</li>
                    </ol>
                    <Tabs
                        activeKey={firstTab}
                        onChange={setFirstTab}
                        items={[
                            {
                                key: "training",
                                label: "1. Training",
                                children: (
                                    <>
                                        <MentorTraining />
                                        <p><button type="button" className="btn btn-primary tap" onClick={() => setFirstTab("profile")}>I've read them — tell us about yourself →</button></p>
                                    </>
                                ),
                            },
                            {
                                key: "profile",
                                label: "2. Tell us about yourself",
                                children: (
                                    <>
                                        <p>A few questions, then your test. Our team approves every mentor before matching them with a student.</p>
                                        <MentorOnboarding defaultName={user.name} defaultEmail={user.email} submitLabel="Submit my profile" onSubmit={handleOnboard} />
                                    </>
                                ),
                            },
                        ]}
                    />
                    <p className="help-line">Any doubt? WhatsApp <a href="https://wa.me/918882756287" target="_blank" rel="noreferrer">+91 8882756287</a> or email <a href="mailto:luvgoel@freshmxn.com">luvgoel@freshmxn.com</a></p>
                </main>
            </div>
        )
    }

    const approved = profile.status === "onboarded"
    const standing = profile.standing || {}

    const home = (
        <>
            {approved && (
                <section className="mentor-tier">
                    <p>
                        <strong>Tier {profile.tier || 1}</strong> · {REGION_WORDS[profile.region] || "Indian"} mentor · {standing.sessions || 0} session{standing.sessions === 1 ? "" : "s"} with feedback
                        {standing.average ? ` · average ${standing.average}/10` : ""}
                    </p>
                    {Number(profile.tier || 1) < 3 && (standing.tier3Missing || []).length > 0 && (
                        <p className="report-small">For Tier 3: {standing.tier3Missing.join(", ")}. Tier 2 comes by itself after 7 sessions averaging 8/10 or more.</p>
                    )}
                </section>
            )}
            {approved ? <MentorStudents /> : <p>{STATUS_TEXT[profile.status]}</p>}
        </>
    )

    const myProfile = editing ? (
        <MentorOnboarding initial={profile} submitLabel="Save changes" onSubmit={handleUpdate} onCancel={() => setEditing(false)} />
    ) : (
        <>
            {!profile.calendlyMain && <p className="form-missing">Please add your Calendly links — students book from them.</p>}
            <ul className="mentor-profile-list">
                <li><strong>Name:</strong> {profile.name}</li>
                <li><strong>Email:</strong> {profile.email}</li>
                <li><strong>Contact:</strong> {profile.phone}</li>
                <li><strong>Role:</strong> {profile.currentRole}</li>
                <li><strong>Profession:</strong> {profile.discipline}</li>
                <li><strong>Industries:</strong> {(profile.sectors || []).join(", ")}</li>
                <li><strong>Experience:</strong> {profile.yearsExperience} years</li>
                <li><strong>Languages:</strong> {(profile.languages || []).join(", ")}</li>
                <li><strong>Why you mentor:</strong> {profile.motivation}</li>
                <li><strong>High school → college:</strong> {profile.transitionCategory}</li>
                <li><strong>Where you live:</strong> {profile.region === "international" ? "Abroad" : profile.region === "indian" ? "India" : "—"}{profile.residenceCitizenship ? ` (${profile.residenceCitizenship})` : ""}</li>
                <li><strong>Calendly — main:</strong> {profile.calendlyMain || "—"}</li>
                <li><strong>Calendly — follow-up:</strong> {profile.calendlyFollowUp || "—"}</li>
                <li><strong>Paid to (only our team sees this):</strong> {profile.payout && (profile.payout.upiId || profile.payout.accountNumber || profile.payout.intlMethod) ? (profile.payout.upiId || profile.payout.intlMethod || `account ending ${String(profile.payout.accountNumber).slice(-4)}`) : "—"}</li>
            </ul>
            <button type="button" className="tap" onClick={() => setEditing(true)}>Edit my profile</button>
        </>
    )

    const items = [
        { key: "home", label: "Home", children: home },
        { key: "training", label: "Training", children: <MentorTraining /> },
        { key: "test", label: approved ? "Test" : "Test ★", children: <MentorTest onSubmitted={load} /> },
        { key: "profile", label: "My profile", children: myProfile },
        { key: "profession", label: "My profession", children: approved ? <MentorReviewSheet /> : <p>This opens once you're approved: our data on your profession to check, and your starter skills roadmap.</p> },
        { key: "payouts", label: "Payouts", children: <MentorPayouts standing={standing} /> },
    ]

    return (
        <div>
            {header}
            <main className="page mentor-dashboard">
                <h2 className="page-title-center">Your mentor dashboard</h2>
                <p className={`mentor-status-line status-${profile.status}`}>{STATUS_TEXT[profile.status]}</p>
                <Tabs items={items} defaultActiveKey={approved ? "home" : "test"} />
                <p className="help-line">Any doubt? WhatsApp <a href="https://wa.me/918882756287" target="_blank" rel="noreferrer">+91 8882756287</a> or email <a href="mailto:luvgoel@freshmxn.com">luvgoel@freshmxn.com</a></p>
            </main>
        </div>
    )
}

export default MentorHome
