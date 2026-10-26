import { useState } from "react"
import { Button, Modal } from "antd"
import { storageCheckForAdmin, storageCleanupForAdmin } from "../../apiCall/mentorTestApi"

// CHECK VIDEO STORAGE (owner, Round 35). Mentors' test videos go from their browser straight to Cloudflare
// R2, so a wrong key, bucket or CORS rule shows up only as "the upload didn't finish". This runs the same
// path end to end — the server writes with the keys on Render, reads the bucket's CORS rules, and THIS
// browser uploads a tiny file from our own site — and says in plain words what to fix.
const corsFor = (origin) => JSON.stringify([{
    AllowedOrigins: [...new Set([origin, "https://www.freshmxn.com", "https://freshmxn.com"])],
    AllowedMethods: ["PUT", "GET"],
    AllowedHeaders: ["*"],
    MaxAgeSeconds: 3600,
}], null, 2)

const browserPut = (url) => new Promise((resolve) => {
    const request = new XMLHttpRequest()
    request.open("PUT", url)
    request.setRequestHeader("Content-Type", "text/plain")
    request.onload = () => resolve({ status: request.status, body: (request.responseText || "").slice(0, 300) })
    request.onerror = () => resolve({ status: 0, body: "" })
    request.send("freshmxn storage check")
})

function StorageCheck() {
    const [busy, setBusy] = useState(false)
    const [result, setResult] = useState(null)

    const run = async () => {
        setBusy(true)
        const response = await storageCheckForAdmin()
        const data = (response && response.data && response.data.data) || null
        let browser = null
        if (data && data.browserTest) {
            browser = await browserPut(data.browserTest.url)
            await storageCleanupForAdmin(data.browserTest.key)
        }
        setBusy(false)
        setResult({ data, browser, origin: window.location.origin })
    }

    const verdict = () => {
        const { data, browser, origin } = result
        if (!data) return { ok: false, title: "Couldn't run the check", text: "The server didn't answer. Refresh and try again." }
        if (!data.configured) return { ok: false, title: "Video storage isn't switched on", text: "One or more of R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and R2_BUCKET is missing on Render (Environment). Mentors paste a video link until it's set." }
        if (!data.serverWrite || !data.serverWrite.ok) return { ok: false, title: "The keys or the bucket name are wrong", text: `Our server couldn't save a test file: ${data.serverWrite ? data.serverWrite.error : "no answer"}. Check on Render that R2_ACCOUNT_ID is the Account ID from the R2 overview page (only the id), that R2_BUCKET is exactly the bucket's name, and that the API token is "Object Read & Write" for that bucket.` }
        if (browser && browser.status >= 200 && browser.status < 300) return { ok: true, title: "Everything works", text: `A test upload from ${origin} went through and was deleted. Mentors can upload their videos.` }
        if (browser && browser.status === 0) return { ok: false, title: "The bucket's CORS rule blocks uploads from this site", text: `The keys work, but the browser was not allowed to upload from ${origin}. In Cloudflare → R2 → your bucket → Settings → CORS policy, replace the policy with the one below and save; then run this check again (it can take a minute to apply).`, cors: corsFor(origin) }
        return { ok: false, title: `R2 refused the upload (code ${browser ? browser.status : "?"})`, text: `The keys work for our server, but the browser's upload was refused: ${browser ? browser.body || "no detail" : ""}. Send this message to Claude.` }
    }

    const shown = result && verdict()

    return (
        <>
            <Button onClick={run} loading={busy}>Check video storage</Button>
            <Modal open={Boolean(result)} title="Video storage (Cloudflare R2)" footer={<Button onClick={() => setResult(null)}>Close</Button>} onCancel={() => setResult(null)}>
                {shown && (
                    <div className="storage-check">
                        <p className={shown.ok ? "storage-ok" : "storage-bad"}><strong>{shown.ok ? "✓ " : "✗ "}{shown.title}</strong></p>
                        <p>{shown.text}</p>
                        {shown.cors && <pre className="storage-cors">{shown.cors}</pre>}
                        {result.data && result.data.configured && (
                            <details>
                                <summary>Details</summary>
                                <ul>
                                    <li>Account id: {result.data.accountId} · bucket: {result.data.bucket}</li>
                                    <li>Server write: {result.data.serverWrite && result.data.serverWrite.ok ? "ok" : (result.data.serverWrite && result.data.serverWrite.error) || "—"}</li>
                                    <li>Browser upload from {result.origin}: {result.browser ? (result.browser.status || "blocked (no answer)") : "—"}</li>
                                    <li>CORS rules: {result.data.cors && result.data.cors.rules ? JSON.stringify(result.data.cors.rules) : `couldn't read (${result.data.cors && result.data.cors.error}) — the token may not be allowed to; check them in the dashboard`}</li>
                                </ul>
                            </details>
                        )}
                    </div>
                )}
            </Modal>
        </>
    )
}

export default StorageCheck
