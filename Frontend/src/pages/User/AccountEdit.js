import { useState } from "react"
import { useDispatch } from "react-redux"
import { message } from "antd"
import { updateProfile, changeEmail, cancelEmailChange } from "../../apiCall/userApi"
import { setUser } from "../../store/userSlice"
import StageFields, { detailForForm } from "../StageFields"

// EDITING YOUR OWN DETAILS AFTER REGISTERING (owner, Round 25). Name, mobile, age, stage and its
// details save at once; a change of stage or detail offers "Update my report" on the report, since
// the switching cost reads them. The email is different: the new address waits until its own
// confirmation link is clicked — until then the old one still logs in. Either way the account (and
// its id, payments, answers and report) stays the same.
function AccountEdit({ user, onDone }) {
    const dispatch = useDispatch()
    const [name, setName] = useState(user.name || "")
    const [phone, setPhone] = useState(user.phone || "")
    const [age, setAge] = useState(user.age ? String(user.age) : "")
    const [journey, setJourney] = useState(user.journey || "")
    const [detail, setDetail] = useState(detailForForm(user.journeyDetail))
    const [saving, setSaving] = useState(false)

    const save = async (event) => {
        event.preventDefault()
        setSaving(true)
        const response = await updateProfile({ name, phone, age: Number(age), journey, journeyDetail: detail })
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
            <div>
                <label>Name</label>
                <br />
                <input value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={60} required />
            </div>
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

// the email, changed on its own: pending until confirmed from the new inbox
export function EmailChange({ user }) {
    const dispatch = useDispatch()
    const [open, setOpen] = useState(false)
    const [newEmail, setNewEmail] = useState("")

    const keep = (pendingEmail) => dispatch(setUser({ user: { ...user, pendingEmail } }))

    const send = async (event) => {
        event.preventDefault()
        const response = await changeEmail(newEmail)
        if (!response || response.data.success === false) {
            message.error(response?.data?.message || "Could not change the email")
            return
        }
        message.success(response.data.message)
        keep(response.data.data.pendingEmail)
        setOpen(false)
        setNewEmail("")
    }

    const resend = async () => {
        const response = await changeEmail(user.pendingEmail)
        if (!response || response.data.success === false) {
            message.error(response?.data?.message || "Could not send the email")
            return
        }
        message.success(response.data.message)
    }

    const cancel = async () => {
        const response = await cancelEmailChange()
        if (!response || response.data.success === false) {
            message.error(response?.data?.message || "Could not cancel")
            return
        }
        message.success(response.data.message)
        keep(null)
    }

    if (user.pendingEmail) {
        return (
            <p className="email-pending">
                Waiting for you to confirm <strong>{user.pendingEmail}</strong> — click the link we sent there.
                Until then, keep logging in with {user.email}.{" "}
                <button type="button" onClick={resend}>Resend</button>{" "}
                <button type="button" onClick={cancel}>Cancel</button>
            </p>
        )
    }

    if (!open) return <button type="button" className="link-button" onClick={() => setOpen(true)}>Change email</button>

    return (
        <form onSubmit={send} className="email-change">
            <label htmlFor="new-email">New email</label>
            <br />
            <input id="new-email" type="email" value={newEmail} onChange={(event) => setNewEmail(event.target.value)} required />{" "}
            <button type="submit">Send confirmation link</button>{" "}
            <button type="button" onClick={() => setOpen(false)}>Cancel</button>
        </form>
    )
}

export default AccountEdit
