import { useEffect, useState } from "react"
import dayjs from "dayjs"
import { getMyMentorAgreement, uploadMentorAgreement } from "../../apiCall/mentorAgreementsApi"

// THE MENTOR AGREEMENT (owner, Round 38) — at the top of step 2, "Tell us about yourself": download it, read
// it, print it, sign it, scan it (a phone photo is fine) and upload it. The profile can't be sent without it
// (the server checks too). Once in, it shows as received, with a way to replace it — here and in the profile.
export const AGREEMENT_PDF = "/mentor-training/Freshmxn_Mentor_Agreement.pdf"
const ACCEPT = ".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
const TYPE_BY_ENDING = { pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png" }

const asBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "")
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
})

function MentorAgreement({ onChange }) {
    const [agreement, setAgreement] = useState(undefined)   // undefined = loading, null = none yet
    const [state, setState] = useState({ busy: false, note: "" })

    useEffect(() => {
        getMyMentorAgreement().then((response) => {
            const found = (response && response.data && response.data.data) || null
            setAgreement(found)
            if (onChange) onChange(found)
        })
    }, [])   // eslint-disable-line react-hooks/exhaustive-deps

    const pick = async (file) => {
        if (!file) return
        const contentType = file.type || TYPE_BY_ENDING[(file.name.split(".").pop() || "").toLowerCase()] || ""
        if (!Object.values(TYPE_BY_ENDING).includes(contentType)) {
            setState({ busy: false, note: "Please upload a PDF, JPG or PNG." })
            return
        }
        if (file.size > 5 * 1024 * 1024) {
            setState({ busy: false, note: "That file is over 5 MB — please scan it at a lower resolution." })
            return
        }
        setState({ busy: true, note: "" })
        const response = await uploadMentorAgreement({ fileName: file.name, contentType, data: await asBase64(file) })
        if (!response || response.data.success === false) {
            setState({ busy: false, note: (response && response.data && response.data.message) || "The upload didn't go through — please try again." })
            return
        }
        setAgreement(response.data.data)
        setState({ busy: false, note: "" })
        if (onChange) onChange(response.data.data)
    }

    if (agreement === undefined) return <div className="skeleton skeleton-block" />

    return (
        <section className={`mentor-agreement${agreement ? " is-in" : ""}`}>
            <h3>Your Mentor Agreement</h3>
            {agreement ? (
                <p className="mentor-agreement-done">
                    ✓ Signed agreement received — {agreement.fileName || "your file"}, {dayjs(agreement.uploadedAt).format("D MMM YYYY")}.
                </p>
            ) : (
                <ol className="mentor-agreement-steps">
                    <li><a href={AGREEMENT_PDF} target="_blank" rel="noreferrer"><strong>Download the agreement</strong></a> and read it — four short pages.</li>
                    <li>Print it, then fill in the date, your name and sign it on the last page.</li>
                    <li>Scan it, or take a clear photo of each page, and upload it below.</li>
                </ol>
            )}
            <div className="mentor-agreement-actions">
                <label className={`btn ${agreement ? "btn-ghost" : "btn-primary"} btn-sm tap mentor-agreement-btn${state.busy ? " is-busy" : ""}`}>
                    {state.busy ? "Uploading…" : agreement ? "Replace the signed copy" : "Upload the signed agreement"}
                    <input type="file" accept={ACCEPT} hidden disabled={state.busy} onChange={(event) => { pick(event.target.files[0]); event.target.value = "" }} />
                </label>
                {agreement && <a href={AGREEMENT_PDF} target="_blank" rel="noreferrer">Read the agreement again</a>}
                <span className="report-small">PDF, JPG or PNG, up to 5 MB</span>
            </div>
            {state.note && <p className="form-missing" role="alert">{state.note}</p>}
        </section>
    )
}

export default MentorAgreement
