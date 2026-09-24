import { useState, useEffect } from "react"
import { useNavigate, Link } from "react-router-dom"
import { useDispatch } from "react-redux"
import { registerUser, getGoogleSignInUrl } from "../apiCall/userApi"
import { setUser } from "../store/userSlice"
import { Input } from "antd"
import logo from "../assets/brand/logo.png"
import { JOURNEY_OPTIONS, STREAM_SUBJECTS } from "./journeyOptions"

function Register() {
    const navigate = useNavigate()
    const dispatch = useDispatch()
    const [name, setName] = useState("")
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [age, setAge] = useState("")
    const [journey, setJourney] = useState("")
    const [journeyDetail, setJourneyDetail] = useState({ class: "", stream: [], collegeStage: "", courseYear: "", experienceYears: "" })
    // TEMPORARY (V1): self-declared parent permission for under-18 students
    const [parentConsentChecked, setParentConsentChecked] = useState(false)
    const [parentName, setParentName] = useState("")
    const [parentPhone, setParentPhone] = useState("")

    // If already logged in, go to Home
    useEffect(() => {
        const token = localStorage.getItem("token")
        if (token) {
            navigate("/dashboard")
            return
        }
    }, [navigate])

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

    // ─── Register ────────────────────────────────────────────────────────────
    const handleRegister = async (e) => {
        e.preventDefault()

        const payload = {
            name: name,
            email: email,
            password: password,
            age: Number(age),
            journey: journey,
            journeyDetail: journeyDetail,
            parentConsentChecked: parentConsentChecked,
            parentName: parentName,
            parentPhone: parentPhone,
        }

        const registerResponse = await registerUser(payload)

        if (!registerResponse) {
            alert("Cannot reach the server")
            return
        }

        if (registerResponse.data.message === "User already exists") {
            alert("User already exists")
            navigate("/login")
            return
        }

        if (registerResponse.data.success === false) {
            alert(registerResponse.data.message)
            setPassword("")
            return
        }

        localStorage.setItem("token", registerResponse.data.token)

        dispatch(
            setUser({
                user: registerResponse.data.userData,
            })
        )

        setName("")
        setEmail("")
        setPassword("")

        // payment comes immediately after signup
        navigate("/paywall")
    }

    return (
        <div>
            <img src={logo} alt="Freshmxn" height="40" />
            <h2>Create your account</h2>

            <form onSubmit={handleRegister}>
                <div>
                    <label>Name</label>
                    <br />
                    <input value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
                <div>
                    <label>Email</label>
                    <br />
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div>
                    <label>Password (at least 8 characters)</label>
                    <br />
                    <Input.Password value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required />
                </div>
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
                            I have taken permission from my parent/guardian to use Freshmxn.
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

                <button type="submit">Create account</button>
            </form>

            <p>or</p>

            <a href={getGoogleSignInUrl()}>
                <button type="button">Sign up with Google</button>
            </a>

            <p>Already have an account? <Link to="/login">Login</Link></p>
        </div>
    )
}

export default Register
