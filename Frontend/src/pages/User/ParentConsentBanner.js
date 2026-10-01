import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { getMyConsent } from "../../apiCall/consentApi"

// Shown to an under-18 whose parent has not confirmed yet (Round 10) — on the dashboard and the
// profile. Not a lock: a student already using Freshmxn keeps going; only paying waits for it.
function ParentConsentBanner() {
    const [status, setStatus] = useState(null)

    useEffect(() => {
        getMyConsent()
            .then((response) => setStatus(response.data.data.status))
            .catch(() => setStatus(null))
    }, [])

    if (status !== "waiting_for_parent" && status !== "missing") return null

    return (
        <p className="retake-note consent-banner">
            <strong>Ask your parent to confirm.</strong> We've emailed them a code — once they give it to you,{" "}
            <Link to="/parent-consent">enter it here</Link>.
        </p>
    )
}

export default ParentConsentBanner
