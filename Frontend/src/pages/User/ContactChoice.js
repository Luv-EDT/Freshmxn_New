import { useState } from "react"
import { message } from "antd"
import { saveMyContact } from "../../apiCall/mentorWaitlistApi"

// HOW YOUR MENTOR CONTACTS YOU (owner, Round 28): WhatsApp or email, and the student's agreement that
// we share their first name and that one contact with their mentor. Asked with the choice on
// /mentorship/choose, and on /mentorship for a choice sent before this was asked.
export const contactReady = (value) => Boolean(value && ["whatsapp", "email"].includes(value.contactVia) && value.consent === true)

export function ContactChoice({ value, onChange }) {
    const set = (part) => onChange({ ...value, ...part })
    return (
        <fieldset className="contact-choice">
            <legend>How should your mentor contact you?</legend>
            <label className="choice">
                <input type="radio" name="contactVia" checked={value.contactVia === "whatsapp"} onChange={() => set({ contactVia: "whatsapp" })} />
                <span>WhatsApp (the phone number on your profile)</span>
            </label>
            <label className="choice">
                <input type="radio" name="contactVia" checked={value.contactVia === "email"} onChange={() => set({ contactVia: "email" })} />
                <span>Email</span>
            </label>
            <label className="consent-check">
                <input type="checkbox" checked={value.consent === true} onChange={(event) => set({ consent: event.target.checked })} />
                <span>
                    <span aria-hidden="true">🔒</span> Freshmxn may share my first name and my {value.contactVia === "email" ? "email" : value.contactVia === "whatsapp" ? "WhatsApp number" : "WhatsApp number or email"} with
                    my mentor, only to arrange my sessions. Mentors agree to keep it private.
                </span>
            </label>
        </fieldset>
    )
}

// the same, standing alone with its own Save — for a student who sent their choice before Round 28
export function ContactCard({ onSaved }) {
    const [value, setValue] = useState({ contactVia: null, consent: false })
    const [busy, setBusy] = useState(false)

    const save = async () => {
        setBusy(true)
        const response = await saveMyContact({ contactVia: value.contactVia, contactConsent: value.consent })
        setBusy(false)
        if (!response || response.data.success === false) {
            message.error(response?.data?.message || "Could not save")
            return
        }
        message.success(response.data.message)
        onSaved(response.data.data)
    }

    return (
        <section className="contact-card">
            <h3>One thing before we match you</h3>
            <ContactChoice value={value} onChange={setValue} />
            <button type="button" className="btn btn-primary tap" disabled={!contactReady(value) || busy} onClick={save}>
                {busy ? "Saving…" : "Save"}
            </button>
        </section>
    )
}
