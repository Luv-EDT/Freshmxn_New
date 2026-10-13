import { useState } from "react"
import { useDispatch } from "react-redux"
import { message } from "antd"
import { updateProfile } from "../../apiCall/userApi"
import { setUser } from "../../store/userSlice"
import StageFields, { detailForForm } from "../StageFields"

// EDITING YOUR OWN DETAILS AFTER REGISTERING (owner, Round 25). Mobile, age, stage and its details
// save at once; a change of stage or detail offers "Update my report" on the report, since the
// switching cost reads them. The name and email are not editable here (owner, Round 29) — the admin
// can change them.
function AccountEdit({ user, onDone }) {
    const dispatch = useDispatch()
    const [phone, setPhone] = useState(user.phone || "")
    const [age, setAge] = useState(user.age ? String(user.age) : "")
    const [journey, setJourney] = useState(user.journey || "")
    const [detail, setDetail] = useState(detailForForm(user.journeyDetail))
    const [saving, setSaving] = useState(false)

    const save = async (event) => {
        event.preventDefault()
        setSaving(true)
        const response = await updateProfile({ phone, age: Number(age), journey, journeyDetail: detail })
        setSaving(false)
        if (!response || response.data.success === false) {
            message.error(response?.data?.message || "Could not save")
            return
        }
        dispatch(setUser({ user: response.data.userData }))
        message.success("Saved")
        onDone()
    }

    return (
        <form onSubmit={save} className="account-edit">
            <p className="report-small">To change your name or email, WhatsApp us on 8882756287.</p>
            <div>
                <label>Mobile number (10 digits)</label>
                <br />
                <input type="tel" inputMode="numeric" value={phone} onChange={(event) => setPhone(event.target.value.replace(/\D/g, "").slice(0, 10))} pattern="[0-9]{10}" required />
            </div>
            <div>
                <label>Age</label>
                <br />
                <input type="number" min="8" max="100" value={age} onChange={(event) => setAge(event.target.value)} required />
            </div>
            <StageFields journey={journey} setJourney={setJourney} detail={detail} setDetail={setDetail} />
            <p className="report-small">Changing your stage or its details lets you update your report, so your matches use them.</p>
            <p>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Saving…" : "Save changes"}</button>{" "}
                <button type="button" className="btn btn-ghost" onClick={onDone}>Cancel</button>
            </p>
        </form>
    )
}

export default AccountEdit
