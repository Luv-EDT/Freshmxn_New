import { useEffect, useState } from "react"
import { message } from "antd"
import { getMyTest, saveMyTest, getVideoUploadUrl, submitMyTest, saveMyLinks } from "../../apiCall/mentorTestApi"

// THE MENTOR COMPETENCE TEST (owner, Round 34) — 10 questions after the training documents, before our
// team approves a new mentor: the 5-step flow in order, their two Calendly links, a 5–10 minute video
// for a sample student, and 7 multiple-choice questions drawn for them. Answers save as they go; it is
// sent once. The video goes straight from the browser to our private storage and is deleted once we
// decide (or within 30 days). Round 35 (owner): every part is compulsory — the five steps put in order,
// both Calendly links, the video and every question. "Save and come back later" is always there; "Send
// my test" appears only once nothing is missing (and the server refuses a test with anything missing).
// YOUR BOOKING LINKS (owner, Round 35): the Calendly links live on this tab only — in the test, then here
// once it's sent (or for a mentor approved before the test existed)
function BookingLinks({ initial, onSaved }) {
    const [links, setLinks] = useState({ calendlyMain: (initial && initial.calendlyMain) || "", calendlyFollowUp: (initial && initial.calendlyFollowUp) || "" })
    const [busy, setBusy] = useState(false)
    const save = async () => {
        setBusy(true)
        const response = await saveMyLinks(links)
        setBusy(false)
        if (!response || response.data.success === false) {
            message.error(response?.data?.message || "Could not save your links")
            return
        }
        message.success(response.data.message)
        if (onSaved) onSaved()
    }
    return (
        <section className="booking-links-box">
            <h3>Your Calendly links</h3>
            <p className="report-small">Students book from these. They stay the same for every student — you only change the weekly hours (Training → How to get onboarded).</p>
            <label htmlFor="links-main">1-hour main session</label>
            <input id="links-main" type="url" placeholder="https://calendly.com/your-name/1-hour" value={links.calendlyMain} onChange={(event) => setLinks({ ...links, calendlyMain: event.target.value })} />
            <label htmlFor="links-follow">20-minute follow-up</label>
            <input id="links-follow" type="url" placeholder="https://calendly.com/your-name/20-min" value={links.calendlyFollowUp} onChange={(event) => setLinks({ ...links, calendlyFollowUp: event.target.value })} />
            <p><button type="button" className="btn btn-ghost tap" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save my links"}</button></p>
        </section>
    )
}

function MentorTest({ onSubmitted }) {
    const [test, setTest] = useState(null)
    const [busy, setBusy] = useState(false)
    const [upload, setUpload] = useState(null)   // { percent } while a video uploads

    const load = async () => setTest((await getMyTest())?.data?.data || { failed: true })
    useEffect(() => { load() }, [])

    if (!test) return <div className="skeleton skeleton-block" />
    if (test.failed) return <p>We couldn't load your test. Please refresh.</p>
    if (test.notNeeded) {
        return (
            <section className="mentor-test">
                <p>You were approved before the test existed — there's nothing to take.</p>
                <BookingLinks initial={test.bookingLinks} onSaved={onSubmitted} />
            </section>
        )
    }

    const sent = Boolean(test.submittedAt)

    const save = async (payload) => {
        const response = await saveMyTest(payload)
        if (!response || response.data.success === false) {
            message.error(response?.data?.message || "Could not save")
            return false
        }
        setTest(response.data.data)
        return true
    }

    const moveStep = (index, by) => {
        const steps = [...test.steps]
        const target = index + by
        if (target < 0 || target >= steps.length) return
        ;[steps[index], steps[target]] = [steps[target], steps[index]]
        setTest({ ...test, steps })
        save({ stepOrder: steps.map((step) => step.id) })
    }

    const uploadVideo = async (file) => {
        if (!file) return
        // some browsers (Windows especially) give a .MOV no type at all — go by the file's ending
        const ending = (file.name.split(".").pop() || "").toLowerCase()
        const type = file.type || { mov: "video/quicktime", mp4: "video/mp4", m4v: "video/mp4", webm: "video/webm" }[ending] || ""
        const ready = await getVideoUploadUrl({ contentType: type, size: file.size })
        if (!ready || ready.data.success === false) {
            message.error(ready?.data?.message || "Could not start the upload")
            return
        }
        // straight to storage, with progress
        setUpload({ percent: 0 })
        const status = await new Promise((resolve) => {
            const request = new XMLHttpRequest()
            request.open("PUT", ready.data.data.url)
            request.setRequestHeader("Content-Type", type)
            request.upload.onprogress = (event) => event.lengthComputable && setUpload({ percent: Math.round((event.loaded / event.total) * 100) })
            request.onload = () => resolve(request.status)
            request.onerror = () => resolve(0)
            request.send(file)
        })
        setUpload(null)
        if (status < 200 || status >= 300) {
            // say why, so a stuck mentor (or our team) knows where to look
            message.error(status === 0
                ? "The upload didn't finish — the connection dropped or our storage refused it. Please try again, or paste a link to your video and tell us on WhatsApp."
                : `The upload didn't finish (storage said ${status}). Please try again — if it keeps happening, tell us on WhatsApp.`, 8)
            return
        }
        if (await save({ videoKey: ready.data.data.key, videoType: type })) message.success("Video uploaded")
    }

    const send = async () => {
        setBusy(true)
        const response = await submitMyTest()
        setBusy(false)
        if (!response || response.data.success === false) {
            message.error(response?.data?.message || "Could not send your test")
            return
        }
        message.success(response.data.message)
        setTest(response.data.data)
        if (onSubmitted) onSubmitted()
    }

    if (sent) {
        return (
            <section className="mentor-test">
                {!test.decision && (
                    <p className="mentor-test-status">
                        <strong>Your test is with our team.</strong> It usually takes a couple of days to review your profile and
                        test — we'll let you know by email whether you're onboarded.
                    </p>
                )}
                {test.decision === "approved" && <p className="mentor-test-status"><strong>You passed — you're approved.</strong> {test.decisionNote}</p>}
                {test.decision === "rejected" && <p className="mentor-test-status"><strong>We couldn't approve you this time.</strong> {test.decisionNote}</p>}
                {test.decision && <p className="report-small">As promised, your video has been deleted.</p>}
                <BookingLinks initial={test.bookingLinks} onSaved={onSubmitted} />
            </section>
        )
    }

    const answered = test.questions.filter((question) => Number.isInteger(test.answers[question.id])).length
    const CALENDLY = /^https:\/\/calendly\.com\/\S+$/   // the same check as the server's
    const missing = [
        !test.stepsArranged && "the 5-step mentor flow in order",
        !(CALENDLY.test(test.calendlyMain || "") && CALENDLY.test(test.calendlyFollowUp || "")) && "both Calendly links",
        !(test.video.uploaded || test.video.link) && "your video",
        answered < test.questions.length && `${test.questions.length - answered} multiple-choice question${test.questions.length - answered === 1 ? "" : "s"}`,
    ].filter(Boolean)
    const ready = missing.length === 0

    const saveAll = async () => {
        if (await save({ calendlyMain: test.calendlyMain || "", calendlyFollowUp: test.calendlyFollowUp || "", ...(test.uploadsOn ? {} : { videoLink: test.video.link || "" }), answers: test.answers })) {
            message.success("Saved — come back any time to finish")
        }
    }

    const trySend = () => {
        if (!ready) {
            message.error(`Please complete ${missing.join(", ")} first`)
            return
        }
        send()
    }

    return (
        <section className="mentor-test">
            <p className="mentor-once-note">
                This test is a revision of how you'll mentor our students, and your proof to us that you understand the
                platform and how to mentor — so we can stand behind you for our students. 10 questions. Your answers save
                as you go; you send it once, at the end.
            </p>

            <ol className="mentor-test-list">
                <li>
                    <h3>Put the 5-step mentor flow in order <span className="test-must">required</span></h3>
                    <ol className="step-order">
                        {test.steps.map((step, index) => (
                            <li key={step.id}>
                                <span>{step.text}</span>
                                <span className="step-moves">
                                    <button type="button" className="btn btn-ghost btn-sm" aria-label="Move up" disabled={index === 0} onClick={() => moveStep(index, -1)}>↑</button>
                                    <button type="button" className="btn btn-ghost btn-sm" aria-label="Move down" disabled={index === test.steps.length - 1} onClick={() => moveStep(index, 1)}>↓</button>
                                </span>
                            </li>
                        ))}
                    </ol>
                    {test.stepsArranged
                        ? <p className="report-small">✓ Order saved. Move a step to change it.</p>
                        : <button type="button" className="btn btn-ghost btn-sm" onClick={() => save({ stepOrder: test.steps.map((step) => step.id) })}>This order is right</button>}
                </li>

                <li>
                    <h3>Your Calendly links <span className="test-must">required</span></h3>
                    <p>From your Calendly, with slots open in the next 6 days: main sessions on days 1–4, follow-ups on days 3–6 (Training → How to get onboarded).</p>
                    <label htmlFor="test-main">1-hour main session</label>
                    <input id="test-main" type="url" placeholder="https://calendly.com/your-name/1-hour" value={test.calendlyMain || ""} onChange={(event) => setTest({ ...test, calendlyMain: event.target.value })} onBlur={() => save({ calendlyMain: test.calendlyMain })} />
                    <label htmlFor="test-follow">20-minute follow-up</label>
                    <input id="test-follow" type="url" placeholder="https://calendly.com/your-name/20-min" value={test.calendlyFollowUp || ""} onChange={(event) => setTest({ ...test, calendlyFollowUp: event.target.value })} onBlur={() => save({ calendlyFollowUp: test.calendlyFollowUp })} />
                </li>

                <li>
                    <h3>A 5–10 minute video for this student <span className="test-must">required</span></h3>
                    <blockquote className="sample-student">{test.sample}</blockquote>
                    <p>Record yourself talking to them, as you would in a session. Cover:</p>
                    <ul>
                        <li>A quick introduction to your own journey — how you got where you are.</li>
                        <li>One big positive and one negative of your current work.</li>
                        <li>One direct reference to their profile, using a connection point — "I noticed you're interested in X — when I started, I felt similarly…", or "You mentioned struggling with Y — here's how I managed…".</li>
                        <li>Then answer: <strong>"If you were in this student's position today, what would you do to reach your level or beyond?"</strong></li>
                    </ul>
                    {test.uploadsOn ? (
                        <>
                            <label htmlFor="test-video">Upload your video (MP4, MOV or WebM, under 1 GB)</label>
                            <input id="test-video" type="file" accept="video/mp4,video/quicktime,video/webm,.mov,.mp4,.m4v,.webm" onChange={(event) => uploadVideo(event.target.files[0])} disabled={Boolean(upload)} />
                            {upload && <p role="status">Uploading… {upload.percent}%</p>}
                            {test.video.uploaded && !upload && <p>✓ Video uploaded. Upload again to replace it.</p>}
                            {/* Round 35: never stuck — a link works too if an upload won't go through */}
                            {!test.video.uploaded && (
                                <details className="video-link-fallback">
                                    <summary>Upload not working? Paste a link instead</summary>
                                    <label htmlFor="test-video-link">A link to your video (Loom, Google Drive — anyone with the link can view)</label>
                                    <input id="test-video-link" type="url" placeholder="https://" value={test.video.link || ""} onChange={(event) => setTest({ ...test, video: { ...test.video, link: event.target.value } })} onBlur={() => save({ videoLink: test.video.link || "" })} />
                                </details>
                            )}
                        </>
                    ) : (
                        <>
                            <label htmlFor="test-video-link">Paste a link to your video (Loom, Google Drive — anyone with the link can view)</label>
                            <input id="test-video-link" type="url" placeholder="https://" value={test.video.link || ""} onChange={(event) => setTest({ ...test, video: { ...test.video, link: event.target.value } })} onBlur={() => save({ videoLink: test.video.link || "" })} />
                        </>
                    )}
                    <p className="report-small">We delete your video once we've approved or declined you — and within 30 days at most.</p>
                </li>

                {test.questions.map((question, index) => (
                    <li key={question.id}>
                        <fieldset className="feedback-q">
                            <legend><strong>{question.q}</strong></legend>
                            {question.options.map((option, optionIndex) => (
                                <label key={option} className="choice">
                                    <input
                                        type="radio"
                                        name={`q-${question.id}`}
                                        checked={test.answers[question.id] === optionIndex}
                                        onChange={() => {
                                            const answers = { ...test.answers, [question.id]: optionIndex }
                                            setTest({ ...test, answers })
                                            save({ answers })
                                        }}
                                    />
                                    <span>{option}</span>
                                </label>
                            ))}
                        </fieldset>
                    </li>
                ))}
            </ol>

            <div className="mentor-send">
                <p>{answered} of {test.questions.length} multiple-choice questions answered.</p>
                {ready
                    ? <p className="report-small">Everything's done. After you send it, it takes around a couple of days for our team to review your profile and test and let you know whether you're onboarded.</p>
                    : <p className="test-missing" role="status">Still to do before you can send: {missing.join(", ")}.</p>}
                <div className="btn-row">
                    <button type="button" className="btn btn-ghost tap" onClick={saveAll}>Save and come back later</button>
                    {ready && <button type="button" className="btn btn-primary tap" disabled={busy} onClick={trySend}>{busy ? "Sending…" : "Send my test"}</button>}
                </div>
            </div>
        </section>
    )
}

export default MentorTest
