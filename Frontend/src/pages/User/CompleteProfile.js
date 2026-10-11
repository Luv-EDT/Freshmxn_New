import { useState, useEffect } from "react"
import StageFields, { EMPTY_DETAIL } from "../StageFields"
import { useNavigate, Link } from "react-router-dom"
import { useDispatch, useSelector } from "react-redux"
import { updateProfile } from "../../apiCall/userApi"
import { setUser } from "../../store/userSlice"
import Navbar from "../Navbar"

// Google sign-ins arrive here — they have a name and email but no age or journey yet
function CompleteProfile() {
    const navigate = useNavigate()
    const dispatch = useDispatch()
    const { user } = useSelector((state) => state.user)
    const [age, setAge] = useState("")
    const [phone, setPhone] = useState("")
    const [journey, setJourney] = useState("")
    const [journeyDetail, setJourneyDetail] = useState({ ...EMPTY_DETAIL })
    // TEMPORARY (V1): self-declared parent permission for under-18 students
    const [parentConsentChecked, setParentConsentChecked] = useState(false)
    const [parentName, setParentName] = useState("")
    const [parentPhone, setParentPhone] = useState("")
    const [parentEmail, setParentEmail] = useState("")

    useEffect(() => {
        if (user && user.age) setAge(String(user.age))
        if (user && user.journey) setJourney(user.journey)
        if (user && user.phone) setPhone(user.phone)
    }, [user])

    const isMinor = age !== "" && Number(age) < 18

    // ─── Save ────────────────────────────────────────────────────────────────
    const handleSubmit = async (e) => {
        e.preventDefault()

        const payload = {
            age: Number(age),
            phone: phone,
            journey: journey,
            journeyDetail: journeyDetail,
            parentConsentChecked: parentConsentChecked,
            parentName: parentName,
            parentPhone: parentPhone,
            parentEmail: parentEmail,
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

        // the plan chosen on /programs before Google sign-in is picked up by the paywall (Round 25)
        navigate(userData.paid ? "/dashboard" : "/paywall")
    }

    return (
        <div>
            <Navbar />
            <h2>Complete your profile</h2>
            <p>A few details so we can show you the right questions.</p>

            <form onSubmit={handleSubmit}>
                <div>
                    <label>Age</label>
                    <br />
                    <input type="number" min="8" max="100" value={age} onChange={(e) => setAge(e.target.value)} required />
                </div>
                <div>
                    <label>Mobile number (10 digits)</label>
                    <br />
                    <input type="tel" inputMode="numeric" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))} pattern="[0-9]{10}" required />
                </div>

                <StageFields journey={journey} setJourney={setJourney} detail={journeyDetail} setDetail={setJourneyDetail} />

                {/* under-18: the student's tick here, then the parent's own confirmation by an emailed code (Round 10) */}
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
                        <div>
                            <label>Parent/guardian email</label>
                            <br />
                            <input type="email" value={parentEmail} onChange={(e) => setParentEmail(e.target.value)} required />
                            <p className="legal-agree">We email them a 6-digit code so they can confirm their permission themselves.</p>
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
