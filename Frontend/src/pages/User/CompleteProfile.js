import { useState, useEffect } from "react"
import { useNavigate, Link } from "react-router-dom"
import { useDispatch, useSelector } from "react-redux"
import { updateProfile } from "../../apiCall/userApi"
import { setUser } from "../../store/userSlice"
import { JOURNEY_OPTIONS, STREAM_SUBJECTS } from "../journeyOptions"
import Navbar from "../Navbar"

// Google sign-ins arrive here — they have a name and email but no age or journey yet
function CompleteProfile() {
    const navigate = useNavigate()
    const dispatch = useDispatch()
    const { user } = useSelector((state) => state.user)
    const [age, setAge] = useState("")
    const [journey, setJourney] = useState("")
    const [journeyDetail, setJourneyDetail] = useState({ class: "", stream: [], collegeStage: "", courseYear: "", experienceYears: "" })
    // TEMPORARY (V1): self-declared parent permission for under-18 students
    const [parentConsentChecked, setParentConsentChecked] = useState(false)
    const [parentName, setParentName] = useState("")
    const [parentPhone, setParentPhone] = useState("")

    useEffect(() => {
        if (user && user.age) setAge(String(user.age))
        if (user && user.journey) setJourney(user.journey)
    }, [user])

    const isMinor = age !== "" && Number(age) < 18

    // ─── Journey detail helpers ──────────────────────────────────────────────
    const handleDetailChange = (field, value) => {
        setJourneyDetail((prev) => ({ ...prev, [field]: value }))
    }

    const handleStreamToggle = (subject) => {
        setJourneyDetail((prev) => ({
            ...prev,
            stream: prev.stream.includes(subject)
                ? prev.stream.filter((s) => s !== subject)
                : [...prev.stream, subject],
        }))
    }

    // ─── Save ────────────────────────────────────────────────────────────────
    const handleSubmit = async (e) => {
        e.preventDefault()

        const payload = {
            age: Number(age),
            journey: journey,
            journeyDetail: journeyDetail,
            parentConsentChecked: parentConsentChecked,
            parentName: parentName,
            parentPhone: parentPhone,
        }

        const updateResponse = await updateProfile(payload)

        if (!updateResponse) {
            alert("Cannot reach the server")
            return
        }

        if (updateResponse.data.success === false) {
            alert(updateResponse.data.message)
            return
        }

        const userData = updateResponse.data.userData

        dispatch(
            setUser({
                user: userData,
            })
        )

        navigate(userData.paid ? "/" : "/paywall")
    }

    return (
        <div>
            <Navbar />
            <h2>Complete your profile</h2>
            <p>A couple of details so we can show you the right questions.</p>

            <form onSubmit={handleSubmit}>
                <div>
                    <label>Age</label>
                    <br />
                    <input type="number" min="8" max="100" value={age} onChange={(e) => setAge(e.target.value)} required />
                </div>

                {/* Journey */}
                <div>
                    <label>Where are you right now?</label>
                    <br />
                    <select value={journey} onChange={(e) => setJourney(e.target.value)} required>
                        <option value="">-- Select --</option>
                        {JOURNEY_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                    </select>
                </div>

                {journey === "class9_10" && (
                    <div>
                        <label>Which class?</label>
                        <br />
                        <select value={journeyDetail.class} onChange={(e) => handleDetailChange("class", e.target.value)} required>
                            <option value="">-- Select --</option>
                            <option value="9">Class 9</option>
                            <option value="10">Class 10</option>
                        </select>
                    </div>
                )}

                {journey === "class11_12" && (
                    <div>
                        <label>Which class?</label>
                        <br />
                        <select value={journeyDetail.class} onChange={(e) => handleDetailChange("class", e.target.value)} required>
                            <option value="">-- Select --</option>
                            <option value="11">Class 11</option>
                            <option value="12">Class 12</option>
                        </select>
                        <p>Which subjects do you study?</p>
                        {STREAM_SUBJECTS.map((subject) => (
                            <label key={subject.value}>
                                <input
                                    type="checkbox"
                                    checked={journeyDetail.stream.includes(subject.value)}
                                    onChange={() => handleStreamToggle(subject.value)}
                                />
                                {subject.label}{" "}
                            </label>
                        ))}
                    </div>
                )}

                {journey === "college" && (
                    <div>
                        <label>Are you already in college?</label>
                        <br />
                        <select value={journeyDetail.collegeStage} onChange={(e) => handleDetailChange("collegeStage", e.target.value)} required>
                            <option value="">-- Select --</option>
                            <option value="pre_admission">Not yet — I just passed Class 12 and am choosing a course</option>
                            <option value="enrolled">Yes, I'm enrolled</option>
                        </select>
                        {journeyDetail.collegeStage === "enrolled" && (
                            <div>
                                <label>Which year?</label>
                                <br />
                                <select value={journeyDetail.courseYear} onChange={(e) => handleDetailChange("courseYear", e.target.value)} required>
                                    <option value="">-- Select --</option>
                                    <option value="1">1st year</option>
                                    <option value="2">2nd year</option>
                                    <option value="3">3rd year</option>
                                    <option value="4">4th year or later</option>
                                </select>
                            </div>
                        )}
                    </div>
                )}

                {journey === "early_professional" && (
                    <div>
                        <label>Years of work experience</label>
                        <br />
                        <input type="number" min="0" max="40" value={journeyDetail.experienceYears} onChange={(e) => handleDetailChange("experienceYears", e.target.value)} required />
                    </div>
                )}

                {/* TEMPORARY (V1): parent permission for under-18 — a proper parental consent step comes in V2 */}
                {isMinor && (
                    <div>
                        <p><strong>You're under 18</strong></p>
                        <label>
                            <input type="checkbox" checked={parentConsentChecked} onChange={(e) => setParentConsentChecked(e.target.checked)} />
                            I have taken permission from my parent/guardian to use Freshmxn, and they agree to the{" "}
                            <Link to="/terms" target="_blank">Terms</Link> and <Link to="/privacy" target="_blank">Privacy Policy</Link>.
                        </label>
                        <div>
                            <label>Parent/guardian name</label>
                            <br />
                            <input value={parentName} onChange={(e) => setParentName(e.target.value)} required />
                        </div>
                        <div>
                            <label>Parent/guardian mobile (10 digits)</label>
                            <br />
                            <input value={parentPhone} onChange={(e) => setParentPhone(e.target.value)} pattern="[0-9]{10}" required />
                        </div>
                    </div>
                )}

                <p className="legal-agree">
                    By continuing you agree to our <Link to="/terms" target="_blank">Terms</Link> and{" "}
                    <Link to="/privacy" target="_blank">Privacy Policy</Link>.
                </p>

                <button type="submit">Save and continue</button>
            </form>
        </div>
    )
}

export default CompleteProfile
