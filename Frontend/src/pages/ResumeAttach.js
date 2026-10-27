import { useState } from "react"

// ATTACH YOUR RÉSUMÉ (owner, Round 36) — one box for the demo's story step and Virtual Career Counselling.
// The file goes once to our server, a small AI model lists the activities in it, and `onRead(lists)` gets
// them; the student keeps or removes each. The file itself is never stored.
const ACCEPT = ".pdf,.docx,.jpg,.jpeg,.png,.webp,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png,image/webp"
const TYPE_BY_ENDING = { pdf: "application/pdf", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" }

const asBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "")
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
})

function ResumeAttach({ read, onRead, lead, addedNote }) {
    const [state, setState] = useState({ busy: false, note: "" })

    const pick = async (file) => {
        if (!file) return
        const mediaType = file.type || TYPE_BY_ENDING[(file.name.split(".").pop() || "").toLowerCase()] || ""
        if (file.size > 5 * 1024 * 1024) {
            setState({ busy: false, note: "Please attach a résumé under 5 MB." })
            return
        }
        setState({ busy: true, note: "" })
        let response
        try {
            response = await read({ file: await asBase64(file), mediaType })
        } catch (error) {
            response = null
        }
        if (!response || response.data.success === false) {
            setState({ busy: false, note: response?.data?.message || "Couldn't read that résumé — add your activities yourself." })
            return
        }
        const added = onRead(response.data.data)
        if (added > 0) setState({ busy: false, note: addedNote ? addedNote(added) : `Added ${added} from your résumé — remove any that don't fit, or add more.` })
        else setState({ busy: false, note: "We didn't find activities to add — add them yourself below." })
    }

    return (
        <div className="resume-attach">
            <p className="resume-attach-lead"><strong>📄 Got a résumé?</strong> {lead || "Attach it and we'll fill in the activities we find."}</p>
            <label className={`btn btn-ghost btn-sm tap resume-attach-btn${state.busy ? " is-busy" : ""}`}>
                {state.busy ? "Reading your résumé…" : "Attach résumé"}
                <input type="file" accept={ACCEPT} disabled={state.busy} onChange={(event) => { pick(event.target.files[0]); event.target.value = "" }} hidden />
            </label>
            <span className="resume-attach-hint">PDF, Word or a photo · read once, never stored</span>
            {state.note && <p className="resume-attach-note" role="status">{state.note}</p>}
        </div>
    )
}

export default ResumeAttach
