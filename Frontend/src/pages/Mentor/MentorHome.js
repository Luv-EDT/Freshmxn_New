import { useEffect, useState } from "react"
import { useSelector } from "react-redux"
import { message } from "antd"
import { getMyMentorProfile, onboardMentor, updateMyMentorProfile } from "../../apiCall/mentorsApi"
import MentorOnboarding from "./MentorOnboarding"
import LogoutButton from "../LogoutButton"
import logo from "../../assets/brand/logo.png"

const STATUS_TEXT = {
    pending_review: "Thanks — our team is reviewing your profile. We'll be in touch before we match you with a student.",
    onboarded: "You're approved. We'll contact you when a student in your field is matched with you.",
}

// The mentor's home: the onboarding form until it's submitted, then their status and a read-only
// summary they can edit. V1 has no booking or sessions here — matching is done by our team.
function MentorHome() {
    const { user } = useSelector((state) => state.user)
    const [profile, setProfile] = useState(null)
    const [loading, setLoading] = useState(true)
    const [editing, setEditing] = useState(false)

    useEffect(() => {
        const load = async () => {
            const response = await getMyMentorProfile()
            setProfile(response?.data?.data || null)
            setLoading(false)
        }
        load()
    }, [])

    const handleOnboard = async (form) => {
        const response = await onboardMentor(form)
        if (!response || response.data.success === false) {
            message.error(response?.data?.message || "Could not save your profile")
            return
        }
        message.success(response.data.message)
        setProfile(response.data.data)
    }

    const handleUpdate = async (form) => {
        const response = await updateMyMentorProfile(form)
        if (!response || response.data.success === false) {
            message.error(response?.data?.message || "Could not update your profile")
            return
        }
        message.success("Profile updated")
        setProfile(response.data.data)
        setEditing(false)
    }

    if (!user || loading) return <div className="page">Loading...</div>

    return (
        <div>
            <nav className="nav-row">
                <img src={logo} alt="Freshmxn" height="32" />
                <span>Mentor · {user.name}</span>
                <LogoutButton />
            </nav>
            <hr />

            <main className="page">
                {!profile && (
                    <>
                        <h2>Tell us about yourself</h2>
                        <p>Twelve quick questions. Our team reviews every mentor before matching them with a student.</p>
                        <MentorOnboarding
                            defaultName={user.name}
                            defaultEmail={user.email}
                            submitLabel="Submit my profile"
                            onSubmit={handleOnboard}
                        />
                    </>
                )}

                {profile && editing && (
                    <>
                        <h2>Edit your profile</h2>
                        <MentorOnboarding initial={profile} submitLabel="Save changes" onSubmit={handleUpdate} onCancel={() => setEditing(false)} />
                    </>
                )}

                {profile && !editing && (
                    <>
                        <h2>Your mentor profile</h2>
                        <p><strong>Status:</strong> {profile.status === "onboarded" ? "Approved" : "Under review"}</p>
                        <p>{STATUS_TEXT[profile.status]}</p>

                        <ul>
                            <li><strong>Name:</strong> {profile.name}</li>
                            <li><strong>Email:</strong> {profile.email}</li>
                            <li><strong>Contact:</strong> {profile.phone}</li>
                            <li><strong>Role:</strong> {profile.currentRole}</li>
                            <li><strong>Discipline:</strong> {profile.discipline}</li>
                            <li><strong>Sectors:</strong> {profile.sectors.join(", ")}</li>
                            <li><strong>Experience:</strong> {profile.yearsExperience} years</li>
                            <li><strong>Languages:</strong> {profile.languages.join(", ")}</li>
                            <li><strong>Why you mentor:</strong> {profile.motivation}</li>
                            <li><strong>High school → college:</strong> {profile.transitionCategory}</li>
                            <li><strong>Payment currency (team only):</strong> {profile.preferredCurrency}</li>
                            <li><strong>Residence / citizenship (team only):</strong> {profile.residenceCitizenship}</li>
                        </ul>
                        <button type="button" className="tap" onClick={() => setEditing(true)}>Edit my profile</button>
                    </>
                )}
            </main>
        </div>
    )
}

export default MentorHome
