import { useEffect, useState } from "react"
import { useSelector } from "react-redux"
import { Tabs, message } from "antd"
import { getMyMentorProfile, onboardMentor, updateMyMentorProfile } from "../../apiCall/mentorsApi"
import MentorOnboarding from "./MentorOnboarding"
import MentorReviewSheet from "./MentorReviewSheet"
import MentorStudents from "./MentorStudents"
import MentorTraining from "./MentorTraining"
import MentorTest, { BookingLinks } from "./MentorTest"
import MentorPayouts from "./MentorPayouts"
import LogoutButton from "../LogoutButton"
import logo from "../../assets/brand/logo.png"

// THE MENTOR DASHBOARD (owner, Rounds 34–35). TWO STAGES, ONE TAB BAR (the step chips above it were dropped
// as a second bar that did nothing):
//   onboarding (until the test is sent)   1. Training · 2. Tell us about yourself · 3. Test (locked until the profile is in)
//   after it                               Home (the status, or once approved the current student and history)
//                                          · My profession data · Payouts (once approved)
// The profile — and, once onboarded, the training documents and the Calendly links — open from the round
// profile icon in the header, the only place with Log out (owner, Round 35).
const STATUS_TEXT = {
    pending_review: "Next: take your test (step 3). Our team approves mentors after the test.",
    test_submitted: "Your test is with our team. It usually takes a couple of days — we'll let you know by email.",
    onboarded: "You're approved. Before we match you with a student, we'll message you on WhatsApp so you can open slots on your Calendly links.",
    rejected: "We couldn't approve you this time — see the Test tab for our note.",
    paused: "Your profile is paused, so you won't be matched with new students for now. Our team will be in touch.",
    removed: "You're no longer matched with students. Questions? WhatsApp +91 8882756287.",
}

const REGION_WORDS = { indian: "Indian", international: "International" }
const TEST_SENT = ["test_submitted", "onboarded", "rejected", "paused", "removed"]

function MentorHome() {
    const { user } = useSelector((state) => state.user)
    const [profile, setProfile] = useState(null)
    const [loading, setLoading] = useState(true)
    const [editing, setEditing] = useState(false)
    const [view, setView] = useState("dashboard")   // dashboard | profile (from the profile icon)
    const [tab, setTab] = useState(null)

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
        setTab("test")
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

    const status = profile ? profile.status : null
    const approved = status === "onboarded"
    const testSent = TEST_SENT.includes(status)
    const standing = (profile && profile.standing) || {}

    const header = (
        <>
            <nav className="nav-row mentor-nav">
                <img src={logo} alt="Freshmxn" height="32" />
                <span>Mentor</span>
                <button
                    type="button"
                    className={`nav-profile mentor-profile-icon${view === "profile" ? " is-open" : ""}`}
                    aria-label="My profile"
                    title="My profile"
                    onClick={() => setView(view === "profile" ? "dashboard" : "profile")}
                >
                    <span className="nav-avatar" aria-hidden="true">{(user.name || "?").trim().charAt(0).toUpperCase()}</span>
                </button>
            </nav>
            <hr />
        </>
    )

    const helpLine = <p className="help-line">Any doubt? WhatsApp <a href="https://wa.me/918882756287" target="_blank" rel="noreferrer">+91 8882756287</a> or email <a href="mailto:luvgoel@freshmxn.com">luvgoel@freshmxn.com</a></p>

    // ─── the profile, from the profile icon only — with Log out ──────────────
    if (view === "profile") {
        return (
            <div>
                {header}
                <main className="page mentor-dashboard">
                    <p><button type="button" className="btn btn-ghost btn-sm" onClick={() => { setEditing(false); setView("dashboard") }}>← Back to dashboard</button></p>
                    <h2 className="page-title-center">My profile</h2>
                    {!profile ? (
                        <>
                            <ul className="mentor-profile-list">
                                <li><strong>Name:</strong> {user.name}</li>
                                <li><strong>Email:</strong> {user.email}</li>
                            </ul>
                            <p className="report-small">Your full profile appears here once you've sent it (step 2 on your dashboard).</p>
                        </>
                    ) : editing ? (
                        <MentorOnboarding initial={profile} submitLabel="Save changes" onSubmit={handleUpdate} onCancel={() => setEditing(false)} />
                    ) : (
                        <>
                            {!profile.calendlyMain && <p className="form-missing">Your Calendly links go in on the Test tab — students book from them.</p>}
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
                                <li><strong>Paid to (only our team sees this):</strong> {profile.payout && (profile.payout.upiId || profile.payout.accountNumber || profile.payout.intlMethod) ? (profile.payout.upiId || profile.payout.intlMethod || `account ending ${String(profile.payout.accountNumber).slice(-4)}`) : "—"}</li>
                            </ul>
                            <p><button type="button" className="tap" onClick={() => setEditing(true)}>Edit my profile</button></p>
                            {testSent && <BookingLinks initial={{ calendlyMain: profile.calendlyMain, calendlyFollowUp: profile.calendlyFollowUp }} onSaved={load} />}
                            {testSent && (
                                <section className="profile-training">
                                    <h3>Training documents</h3>
                                    <MentorTraining />
                                </section>
                            )}
                        </>
                    )}
                    <div className="mentor-logout"><LogoutButton /></div>
                    {helpLine}
                </main>
            </div>
        )
    }

    // ─── the dashboard ───────────────────────────────────────────────────────
    const home = (
        <>
            <section className="mentor-tier">
                <p>
                    <strong>Tier {profile ? profile.tier || 1 : 1}</strong> · {REGION_WORDS[profile && profile.region] || "Indian"} mentor · {standing.sessions || 0} session{standing.sessions === 1 ? "" : "s"} with feedback
                    {standing.average ? ` · average ${standing.average}/10` : ""}
                </p>
                {profile && Number(profile.tier || 1) < 3 && (standing.tier3Missing || []).length > 0 && (
                    <p className="report-small">For Tier 3: {standing.tier3Missing.join(", ")}. Tier 2 comes by itself after 7 sessions averaging 8/10 or more.</p>
                )}
            </section>
            <MentorStudents />
        </>
    )

    const onboarding = [
        {
            key: "training",
            label: "1. Training",
            children: (
                <>
                    <MentorTraining />
                    {!profile && <p><button type="button" className="btn btn-primary tap" onClick={() => setTab("profile")}>I've read them — tell us about yourself →</button></p>}
                </>
            ),
        },
        {
            key: "profile",
            label: `2. Tell us about yourself${profile ? " ✓" : ""}`,
            children: profile ? (
                <p className="mentor-step-done">
                    ✓ Your profile is in. To see or change it, open your profile with the round icon at the top right.
                    {" "}Next: <button type="button" className="link-button" onClick={() => setTab("test")}>take your test →</button>
                </p>
            ) : (
                <>
                    <p>A few questions, then your test. Our team approves every mentor before matching them with a student.</p>
                    <MentorOnboarding defaultName={user.name} defaultEmail={user.email} submitLabel="Submit my profile" onSubmit={handleOnboard} />
                </>
            ),
        },
        {
            key: "test",
            // Round 35 (owner): locked until the profile is in
            label: profile ? "3. Test" : "3. Test 🔒",
            disabled: !profile,
            children: profile ? <MentorTest onSubmitted={load} /> : null,
        },
    ]
    const afterOnboarding = [
        { key: "home", label: "Home", children: approved ? home : <MentorTest onSubmitted={load} /> },
        {
            key: "profession",
            label: "My profession data",
            children: approved ? <MentorReviewSheet /> : <p>This opens once you're approved: our data on your profession to check, and your starter skills roadmap.</p>,
        },
        approved && { key: "payouts", label: "Payouts", children: <MentorPayouts standing={standing} /> },
    ].filter(Boolean)
    const items = testSent ? afterOnboarding : onboarding

    const defaultTab = testSent ? "home" : !profile ? "training" : "test"
    const activeTab = items.some((item) => item.key === tab) ? tab : defaultTab

    return (
        <div>
            {header}
            <main className="page mentor-dashboard">
                <h2 className="page-title-center">{approved ? "Your mentor dashboard" : "Welcome, mentor"}</h2>
                {status && <p className={`mentor-status-line status-${status}`}>{STATUS_TEXT[status]}</p>}
                <Tabs className="mentor-tabs" activeKey={activeTab} onChange={setTab} items={items} />
                {helpLine}
            </main>
        </div>
    )
}

export default MentorHome
