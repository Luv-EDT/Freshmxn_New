import { useState, useEffect, useRef } from "react"
import { message } from "antd"
import { getExternalState, uploadTestResult, confirmTestResult } from "../../apiCall/submissionsApi"
import { EXTERNAL_TESTS, shrinkImage } from "./externalTestItems"
import OneAttemptWarning from "./OneAttemptWarning"

// An external test, start to finish — 04_Item_Bank.md §7. Four screens:
//
//     warn      one attempt only, said before the link and not after it
//     upload    the screenshot, plus the typed time-per-question on the reasoning test
//     check     the numbers read back, for the student to agree with or dispute
//     done      confirmed and locked
//
// THE CHECK SCREEN IS THE POINT OF THE WHOLE FLOW. A model reading a screenshot can return a number
// that is wrong and completely believable — 71 where the screen said 17 — and every automatic guard
// passes it: it is in range, it is an integer, and the model's own confidence is high because the
// digits were perfectly legible. It just read the wrong ones. The student is looking at the same
// screen, so they are the only check that catches it. Skipping this screen would mean the failure
// the item bank names most explicitly is the one failure nothing is watching for.
//
// THE PHASE COMES FROM THE SERVER, not from where the student clicked. Someone who uploads on their
// phone and opens the section on a laptop must land on the check screen, not back at the warning.

function ExternalTest({ moduleKey, onDone }) {
    const config = EXTERNAL_TESTS[moduleKey]

    const [state, setState] = useState(null)
    const [phase, setPhase] = useState("warn")
    const [seconds, setSeconds] = useState("")
    const [busy, setBusy] = useState(false)
    const [progress, setProgress] = useState("")
    const [problems, setProblems] = useState([])
    const fileInput = useRef(null)

    const load = async () => {
        try {
            const response = await getExternalState()
            const mine = response.data.data[moduleKey]
            setState(mine)

            if (mine.confirmed) setPhase("done")
            else if (mine.uploaded) setPhase("check")
        } catch (error) {
            message.error("Could not load your uploads")
            setState({ uploaded: false, confirmed: false, values: null })
        }
    }

    useEffect(() => {
        load()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [moduleKey])

    const handleFile = async (event) => {
        const file = event.target.files && event.target.files[0]
        if (!file) return

        setBusy(true)
        setProblems([])

        try {
            // Two distinct waits, and they are worth naming separately: the resize is instant on a
            // laptop and takes a noticeable moment on an old phone, and the reading is a call to a
            // model. A single "Uploading…" for both looks frozen on the device where it is slowest.
            setProgress("Preparing the image…")
            const shrunk = await shrinkImage(file)

            setProgress("Reading the numbers…")
            const response = await uploadTestResult({
                module: moduleKey,
                image: shrunk.dataUrl,
                secondsPerQuestion: config.asksSeconds && seconds !== "" ? Number(seconds) : undefined,
            })

            setProblems(response.data.data.problems || [])
            await load()
            setPhase("check")

        } catch (error) {
            const data = error?.response?.data
            setProblems(data?.data?.problems || [])
            message.error(data?.message || error.message || "That screenshot could not be read")
        } finally {
            setBusy(false)
            setProgress("")
            // Cleared so picking the SAME file again still fires onChange — otherwise a student who
            // re-crops and re-picks the identical filename gets no response at all.
            if (fileInput.current) fileInput.current.value = ""
        }
    }

    const handleConfirm = async (agrees) => {
        setBusy(true)

        try {
            await confirmTestResult({ module: moduleKey, agrees })

            if (agrees) {
                message.success("Saved")
                setPhase("done")
            } else {
                message.success("Thanks — someone will check it")
                await load()
                setPhase("upload")
            }
        } catch (error) {
            message.error(error?.response?.data?.message || "Could not save that")
        } finally {
            setBusy(false)
        }
    }

    if (!state) return <div>Loading…</div>

    // Full width on a phone, capped on a desktop. Every button below clears 44px so it is a real
    // tap target rather than a link that happens to be clickable.
    const button = { padding: "12px 18px", minHeight: "44px", fontSize: "16px" }

    // ── warn ────────────────────────────────────────────────────────────────────────────────────

    if (phase === "warn") {
        return (
            <div style={{ maxWidth: "620px" }}>
                <h2>{config.title}</h2>

                <OneAttemptWarning
                    minutes={config.minutes}
                    reason="Nobody is watching you take it, so this one runs on trust. Be honest with yourself here — take it once, properly. A score you nudged is a score your report will then reason from, and the only person it misleads is you."
                />

                <p>{config.what}</p>

                {/* Said plainly rather than buried. A student who is sent to another website with no
                    explanation reasonably wonders whether this product is just a wrapper around free
                    tests — and the honest answer is that it is not, that ours is coming, and that
                    this one is a properly validated instrument in the meantime. */}
                <p>
                    <strong>Why this one is on another site.</strong> We are building our own version
                    of this test and it will launch soon. Until then we use{" "}
                    <strong>{config.siteName}</strong>, which is internationally validated and measures{" "}
                    {config.measures} to the same standard — so nothing about your result is weaker
                    for it. You take it there and bring the result back here.
                </p>

                <p>
                    <a href={config.url} target="_blank" rel="noopener noreferrer">
                        <button type="button" className="btn btn-primary" style={button}>Open the test on {config.siteName}</button>
                    </a>
                </p>

                <p>
                    When you finish, come back here and upload a screenshot of {config.shotOf}.
                </p>

                <p>
                    <button type="button" className="btn btn-primary" style={button} onClick={() => setPhase("upload")}>
                        I have finished it — upload my screenshot
                    </button>
                </p>

                <p>
                    <em>You can leave this section and come back. Nothing is lost.</em>
                </p>
            </div>
        )
    }

    // ── upload ──────────────────────────────────────────────────────────────────────────────────

    if (phase === "upload") {
        return (
            <div style={{ maxWidth: "620px" }}>
                <h2>{config.title}</h2>
                <p>Upload a screenshot of {config.shotOf}.</p>

                {/* WHERE THE FILE IS, is the step that actually stops people. Taking a screenshot is
                    familiar; finding it again in a file picker is not, and on Windows the folder is
                    somewhere most students have never opened. Saying it here costs four lines and
                    saves a support message. */}
                <div style={{ border: "1px solid #999", padding: "12px", margin: "16px 0" }}>
                    <p style={{ marginTop: 0 }}><strong>Where to find your screenshot</strong></p>
                    <p style={{ margin: "6px 0" }}>
                        <strong>On a computer:</strong> press <strong>Windows key + Print Screen</strong>{" "}
                        (or <strong>Cmd + Shift + 4</strong> on a Mac). The file is saved in your{" "}
                        <strong>Pictures → Screenshots</strong> folder — that is the folder to pick it
                        from below.
                    </p>
                    <p style={{ margin: "6px 0 0" }}>
                        <strong>On a phone:</strong> it is in your Gallery or Photos, usually in an
                        album called Screenshots.
                    </p>
                </div>

                {config.asksSeconds && (
                    <div style={{ margin: "16px 0" }}>
                        <p><strong>{config.secondsLabel}</strong></p>
                        <input
                            type="number"
                            inputMode="decimal"
                            min="0"
                            value={seconds}
                            onChange={(event) => setSeconds(event.target.value)}
                            style={{ width: "100%", maxWidth: "200px", padding: "12px", fontSize: "16px", boxSizing: "border-box" }}
                        />
                        <p>
                            <em>
                                Only needed if your screenshot does not show it — we read it from the
                                image when we can.
                            </em>
                        </p>
                    </div>
                )}

                {/* No `capture` attribute: that forces the camera open on a phone, and what we want
                    is a screenshot from the gallery. Leaving it off lets Android offer both. */}
                <p>
                    <input
                        ref={fileInput}
                        type="file"
                        accept="image/*"
                        onChange={handleFile}
                        disabled={busy}
                        style={{ fontSize: "16px" }}
                    />
                </p>

                {busy && <p><strong>{progress}</strong> This takes a few seconds.</p>}

                {problems.length > 0 && (
                    <div style={{ border: "1px solid #b00", padding: "12px", margin: "12px 0" }}>
                        {problems.map((problem, index) => <p key={index} style={{ margin: "4px 0" }}>{problem}</p>)}
                        <p style={{ marginBottom: 0 }}>
                            <em>Try again — a screenshot of the page reads better than a photo of a screen.</em>
                        </p>
                    </div>
                )}

                <p>
                    <em>
                        The image is used to read the numbers and is not kept. Uploading again is fine
                        until you confirm the result.
                    </em>
                </p>

                <p>
                    <button type="button" className="btn btn-primary" style={button} onClick={() => setPhase("warn")} disabled={busy}>
                        Back
                    </button>
                </p>
            </div>
        )
    }

    // ── check ───────────────────────────────────────────────────────────────────────────────────

    if (phase === "check") {
        const values = state.values || {}

        return (
            <div style={{ maxWidth: "620px" }}>
                <h2>{config.title}</h2>
                <p><strong>This is what we read from your screenshot. Does it match?</strong></p>

                <div style={{ border: "1px solid #999", padding: "16px", margin: "16px 0" }}>
                    {config.readBack.map((row) => (
                        <p key={row.field} style={{ margin: "8px 0", fontSize: "18px" }}>
                            {row.label}:{" "}
                            <strong>
                                {values[row.field] === undefined || values[row.field] === null
                                    ? "not readable"
                                    : `${values[row.field]}${row.suffix || ""}`}
                            </strong>
                        </p>
                    ))}
                </div>

                {problems.length > 0 && problems.map((problem, index) => (
                    <p key={index}><em>{problem}</em></p>
                ))}

                <p>
                    <button type="button" className="btn btn-primary" style={{ ...button, marginRight: "8px" }} onClick={() => handleConfirm(true)} disabled={busy}>
                        Yes, that is right
                    </button>
                </p>
                <p>
                    <button type="button" style={button} onClick={() => handleConfirm(false)} disabled={busy}>
                        No, that is not my result
                    </button>
                </p>

                <p>
                    <em>
                        Saying no does not delete anything — it flags it for a person to check, and you
                        can upload a clearer screenshot.
                    </em>
                </p>
            </div>
        )
    }

    // ── done ────────────────────────────────────────────────────────────────────────────────────

    return (
        <div style={{ maxWidth: "620px" }}>
            <h2>{config.title}</h2>
            <p><strong>Saved and confirmed.</strong></p>

            <div style={{ border: "1px solid #999", padding: "16px", margin: "16px 0" }}>
                {config.readBack.map((row) => {
                    const values = state.values || {}
                    return (
                        <p key={row.field} style={{ margin: "8px 0" }}>
                            {row.label}:{" "}
                            <strong>
                                {values[row.field] === undefined || values[row.field] === null
                                    ? "—"
                                    : `${values[row.field]}${row.suffix || ""}`}
                            </strong>
                        </p>
                    )
                })}
            </div>

            <p>
                This one cannot be retaken or replaced, which is the rule the test itself sets rather
                than ours.
            </p>

            <button type="button" style={button} onClick={onDone}>Back to the assessment</button>
        </div>
    )
}

export default ExternalTest
