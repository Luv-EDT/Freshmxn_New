import { useState, useEffect, useRef } from "react"
import { message } from "antd"
import { savePsychometric } from "../../apiCall/submissionsApi"
import {
    DIGIT_MS, TRIAL_MS, FONT_SIZES, GO_DIGITS, NO_GO_DIGIT,
    PRACTICE_TRIALS, TEST_TRIALS, MIN_REFRESH_HZ, MAX_MEDIAN_TIMING_ERROR_MS,
    buildTrials, runBlock, runTimingCheck,
    toPsyToolkitRows, median, describeDevice, describeSession, TYPICAL,
} from "./sartTask"
import OneAttemptWarning from "./OneAttemptWarning"

// SART — sustained attention and processing speed. 04_Item_Bank.md §6.
//
// THE SCREENS ARE HERE, THE MILLISECONDS ARE IN sartTask.js, and they do not mix. React state is
// touched at the boundaries of a block and never inside one; the loop writes to the DOM through the
// refs below. A single setState per trial would put the renderer inside the measurement.
//
// THE 45 STIMULUS FRAMES ARE RENDERED ONCE, at mount, all hidden. §6 requires the frames to be
// pre-rendered before the block begins, and this is what that means in a browser: nine digits at
// five font sizes exist as real elements with real layout, and a trial costs one `display` change.
// Building the text node inside the trial would add a layout and a paint to the stimulus onset —
// and a different amount at 48pt than at 120pt, so the error would lean rather than scatter.
//
// THE TIMING CHECK RUNS BEFORE THE TASK, ON THIS DEVICE, EVERY TIME. §6 asks for the implementation
// to be validated against the intended 1150ms with a median error under 20ms, specifically on a
// low-end Android. Doing that once on a developer's laptop would prove something about the laptop.
// Doing it on the student's phone, moments before their block, proves the thing that matters.
//
// AND IF IT FAILS, NOTHING IS SAVED. No `sartRaw`, so the scoring engine sees no SART at all and
// resolves processing speed to null — which it already handles, and which costs one factor of
// twenty-seven. The alternative is a confident processing-speed score produced by a browser that
// was dropping frames, and a student would act on that. An honest null beats a fake number.

function Sart({ alreadyTaken, onDone }) {
    const [phase, setPhase] = useState(alreadyTaken ? "alreadyTaken" : "intro")
    const [check, setCheck] = useState(null)        // the timing-check result
    const [refresh, setRefresh] = useState(null)
    const [checkProgress, setCheckProgress] = useState(0)
    const [practiceFeedback, setPracticeFeedback] = useState(null)
    const [practiceCount, setPracticeCount] = useState(0)
    const [trialCount, setTrialCount] = useState(0)
    const [summary, setSummary] = useState(null)
    const [busy, setBusy] = useState(false)

    const stageRef = useRef(null)
    const frameRefs = useRef({})            // "digit-fontIndex" → the pre-rendered element
    const maskRef = useRef(null)
    const controls = useRef({})             // filled in by runBlock
    const practiceRecords = useRef([])      // kept so they can go into the file as "training" rows
    const interruptions = useRef({ blur: 0, hidden: 0, fullscreenExits: 0 })
    const visible = useRef(null)            // which frame element is currently shown
    const currentTrial = useRef(null)       // what is on screen, for the practice error feedback
    const feedbackOn = useRef(false)        // the written "missed one" line — practice only
    const errorShown = useRef(false)        // one red cross per trial, not one per tap

    // ── stimulus presentation, by direct DOM write ──────────────────────────────────────────────

    const hide = () => {
        if (visible.current) visible.current.style.display = "none"
        if (maskRef.current) maskRef.current.style.display = "none"
        visible.current = null
    }

    const show = (what, trial) => {
        if (visible.current) visible.current.style.display = "none"
        if (maskRef.current) maskRef.current.style.display = "none"

        if (what === "mask") {
            if (maskRef.current) maskRef.current.style.display = "block"
            visible.current = null
            return
        }

        // Which trial is on screen, so the response handler knows whether a press was a mistake.
        // A ref, not state: this is read inside an event handler during a timed block.
        currentTrial.current = trial
        errorShown.current = false

        // The mask goes back to white at the start of every trial, so a red one always refers to
        // the digit just shown and never lingers from the last mistake.
        if (maskRef.current) maskRef.current.style.color = "#fff"

        const element = frameRefs.current[`${trial.digit}-${trial.fontIndex}`]
        if (element) {
            element.style.display = "block"
            visible.current = element
        }
    }

    // A press on a 3 turns the cross that follows it red — in BOTH blocks.
    //
    // THIS IS THE FEEDBACK THAT TEACHES THE TASK. "Press for everything except 3" is simple to read
    // and surprisingly hard to feel until you have made the mistake once and seen it. Pressing on a
    // 3 is the error the whole instrument is built around, and a student who never notices they are
    // making it just thinks the task is easy and comes away thinking it measured nothing.
    //
    // 🟩 IN THE SCORED BLOCK TOO — AN OWNER DECISION, AND IT HAS A COST WORTH WRITING DOWN.
    // 04_Item_Bank.md §6 gives feedback to the practice block only, and the reason is real: knowing
    // you have just erred makes people slow down on the next few trials (post-error slowing), which
    // inflates reaction times right after every mistake. So a block with feedback partly measures
    // how someone responds to being corrected, alongside how long they can hold attention.
    //
    // It is not fatal to the instrument. The commission count — the primary lapse measure — is
    // unaffected, and RT variability rises rather than falls, which makes the attention score
    // CONSERVATIVE rather than flattering. But it means this cohort's reaction times are not
    // comparable with a no-feedback SART norm, and `sartMeta.feedbackInScoredBlock` records that on
    // every session so it can never be forgotten when norms are built.
    // Written straight to the DOM, like every other stimulus change, so it costs no re-render.
    const flagCommission = () => {
        if (!currentTrial.current || currentTrial.current.isGo) return
        if (errorShown.current) return

        errorShown.current = true
        if (maskRef.current) maskRef.current.style.color = "#ff3b30"
    }

    // ── responses ───────────────────────────────────────────────────────────────────────────────
    //
    // The timestamp is taken HERE, in the event handler, not when the loop next runs. A press that
    // lands between two frames would otherwise be recorded up to 16ms late, systematically, and
    // sustained attention is measured partly from the variability of these numbers.

    useEffect(() => {
        const onKey = (event) => {
            if (event.code !== "Space" && event.key !== " ") return
            event.preventDefault()      // space scrolls the page otherwise, mid-block
            if (controls.current.respond) controls.current.respond(performance.now())
            flagCommission()
        }

        window.addEventListener("keydown", onKey)
        return () => window.removeEventListener("keydown", onKey)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // §6: listen for visibilitychange and blur — any tab switch flags the session. Counted rather
    // than aborted: a notification stealing focus on a phone is not cheating, but the block it
    // landed in is no longer clean, and only a count tells the two apart afterwards.
    useEffect(() => {
        const counters = interruptions.current
        const running = controls.current

        const onBlur = () => { counters.blur += 1 }
        const onHidden = () => { if (document.hidden) counters.hidden += 1 }
        const onFullscreen = () => { if (!document.fullscreenElement) counters.fullscreenExits += 1 }

        window.addEventListener("blur", onBlur)
        document.addEventListener("visibilitychange", onHidden)
        document.addEventListener("fullscreenchange", onFullscreen)

        return () => {
            window.removeEventListener("blur", onBlur)
            document.removeEventListener("visibilitychange", onHidden)
            document.removeEventListener("fullscreenchange", onFullscreen)
            // A block left running after the component unmounts would keep an rAF loop alive for
            // four minutes, writing to elements that no longer exist. `controls` is a ref object
            // that runBlock mutates in place, so the same object is still the live one here.
            if (running.cancel) running.cancel()
        }
    }, [])

    // Requested, never required. §6 asks for full screen and for exits to be logged; iOS Safari
    // does not implement it on an element at all, and refusing every iPhone over a nicety would
    // trade a real measurement for a cosmetic one.
    const requestFullscreen = async () => {
        try {
            if (stageRef.current && stageRef.current.requestFullscreen && !document.fullscreenElement) {
                await stageRef.current.requestFullscreen()
            }
        } catch (error) {
            // Denied or unsupported. The block runs either way; the exit counter records the rest.
        }
    }

    const leaveFullscreen = async () => {
        try {
            if (document.fullscreenElement) await document.exitFullscreen()
        } catch (error) {
            // nothing to do — the block is already over
        }
    }

    // ── the checks that run before any student data exists ──────────────────────────────────────

    // Two seconds of watching frames, and that is the whole check. It used to run twenty short
    // blocks of real trials, which is seven and a half minutes of black screen before a five-minute
    // task — an arithmetic mistake, not a trade-off. Frame gaps bound the trial timing error
    // directly, so this measures the same thing at the right level. See runTimingCheck.
    const runChecks = async () => {
        setPhase("checking")
        setCheckProgress(0)

        const result = await runTimingCheck({ onProgress: setCheckProgress })

        setCheck(result)
        setRefresh({ hz: result.hz, measured: result.hz })
        setPhase(result.passed ? "ready" : "blocked")
    }

    // ── the blocks ──────────────────────────────────────────────────────────────────────────────

    const runPractice = async () => {
        setPhase("practice")
        setPracticeCount(0)
        setPracticeFeedback(null)
        feedbackOn.current = true
        await requestFullscreen()

        // FEEDBACK ONLY IN PRACTICE, and that is the whole difference between the two blocks. §6
        // gives the practice block feedback because that is what makes it teaching; the real block
        // has none, because knowing you just missed a 3 changes how hard you try on the next one,
        // and the score stops being comparable between students.
        const result = await runBlock({
            trials: buildTrials(PRACTICE_TRIALS, 3),
            show,
            hide,
            controls: controls.current,
            onTrial: ({ index, correct, isGo }) => {
                setPracticeCount(index + 1)
                setPracticeFeedback(correct ? null : isGo ? "missed one" : "pressed on a 3")
            },
        })

        feedbackOn.current = false

        // LEAVING FULL SCREEN IS NOT TIDYING UP — omitting it hung the module. The stage is the
        // element that was made full screen, and the screen after practice hides it with
        // `display: none`. A hidden element that the browser is still displaying full screen leaves
        // the student staring at black with no buttons and no way forward except reloading the page,
        // which looks exactly like a crash. Every block now exits before the phase changes.
        await leaveFullscreen()

        if (result.aborted) return

        practiceRecords.current = result.records
        setPhase("practiceDone")
    }

    const runTest = async () => {
        setPhase("test")
        setTrialCount(0)
        await requestFullscreen()

        const trials = buildTrials(TEST_TRIALS)

        const result = await runBlock({
            trials,
            show,
            hide,
            controls: controls.current,
            onTrial: ({ index }) => {
                // One setState per trial, and only for a coarse counter that is not on screen
                // during the block — the progress bar below reads it after. It is deliberately not
                // rendered inside the stage.
                if (index % 25 === 0) setTrialCount(index)
            },
        })

        await leaveFullscreen()

        if (result.aborted) {
            setPhase("ready")
            return
        }

        await finish(result, trials)
    }

    // ── what gets saved, and what does not ──────────────────────────────────────────────────────

    const finish = async (result, trials) => {
        setBusy(true)

        const errors = result.durations.map((duration) => Math.abs(duration - TRIAL_MS))
        const medianError = median(errors)
        const dropped = result.records.filter((record) => record.dropped).length

        // THE SESSION IS RE-CHECKED AGAINST ITS OWN TIMING, not just the warm-up's. A phone that
        // passed the eight-second check and then thermally throttled through a four-minute block
        // would otherwise have its degraded block scored on the strength of a measurement taken
        // when it was cool.
        const timingOk = medianError !== null && medianError <= MAX_MEDIAN_TIMING_ERROR_MS

        const meta = {
            completedAt: new Date().toISOString(),
            device: describeDevice(refresh),
            warmupCheck: check,
            sessionTiming: {
                trials: result.records.length,
                measured: result.durations.length,
                medianTrialMs: Math.round((median(result.durations) || 0) * 10) / 10,
                medianErrorMs: medianError === null ? null : Math.round(medianError * 10) / 10,
                droppedTrials: dropped,
                thresholdMs: MAX_MEDIAN_TIMING_ERROR_MS,
                passed: timingOk,
            },
            interruptions: { ...interruptions.current },
            scored: timingOk,
            // Recorded on every session because it changes what the reaction times mean. §6's
            // no-feedback design is what published SART norms assume; this cohort departs from it.
            feedbackInScoredBlock: true,
            // Stored alongside the raw rows so the counts the student was shown are recoverable
            // later — if anyone ever disputes what their screen said, this is the record of it.
            descriptives: describeSession(result.records),
        }

        try {
            // sartMeta is saved WHETHER OR NOT the session is scored. A refused session is a fact
            // about a device, and the only way to ever know how often this happens — and on which
            // phones — is to keep the refusals.
            await savePsychometric({ module: "sartMeta", block: meta })

            if (timingOk) {
                // The practice block goes in as "training" rows. sartScoring.js drops them itself —
                // they are in the file because the format has them and because a session where
                // practice went badly and the real block went perfectly is worth being able to see
                // later. Nothing downstream reads them.
                const rows = [
                    ...toPsyToolkitRows(practiceRecords.current, "training", 1),
                    ...toPsyToolkitRows(result.records, "realtest", 1),
                ]
                await savePsychometric({ module: "sartRaw", block: rows.join("\n") })
            }

            setSummary({ ...meta.sessionTiming, scored: timingOk, interruptions: meta.interruptions, descriptives: meta.descriptives })
            setPhase("done")

        } catch (error) {
            message.error("Could not save the result — check your connection and try again")
            setPhase("ready")
        } finally {
            setBusy(false)
        }
    }

    // ── the stage: rendered once, hidden, never re-rendered during a block ──────────────────────

    const stage = (
        <div
            ref={stageRef}
            onPointerDown={(event) => {
                event.preventDefault()
                if (controls.current.respond) controls.current.respond(performance.now())
                flagCommission()
            }}
            style={{
                position: "relative",
                width: "100%",
                // The tap area IS the stage, full width and tall, because §6 specifies a full-screen
                // tap area on mobile. A button would make the task a test of aim.
                minHeight: "60vh",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "#000",
                color: "#fff",
                touchAction: "manipulation",     // kills the 300ms double-tap-zoom delay on Android
                userSelect: "none",
                cursor: "pointer",
                overflow: "hidden",
            }}
        >
            {/* All 45 combinations, laid out once. `display: none` keeps them out of the paint but
                their fonts are loaded and their boxes are known, so the first showing of a 120pt 7
                costs no more than the hundredth. */}
            {[...GO_DIGITS, NO_GO_DIGIT].map((digit) => (
                FONT_SIZES.map((size, fontIndex) => (
                    <span
                        key={`${digit}-${fontIndex}`}
                        ref={(element) => { frameRefs.current[`${digit}-${fontIndex}`] = element }}
                        style={{
                            display: "none",
                            position: "absolute",
                            fontSize: `${size}pt`,
                            lineHeight: 1,
                            fontWeight: "bold",
                            fontFamily: "Arial, sans-serif",
                        }}
                    >
                        {digit}
                    </span>
                ))
            ))}

            {/* The mask — §6's encircled X. Same position, same layer, shown between digits. */}
            <span
                ref={maskRef}
                style={{
                    display: "none",
                    position: "absolute",
                    fontSize: "72pt",
                    lineHeight: 1,
                    fontFamily: "Arial, sans-serif",
                }}
            >
                ⊗
            </span>
        </div>
    )

    const button = { padding: "12px 18px", minHeight: "44px", fontSize: "16px" }

    // ── screens ─────────────────────────────────────────────────────────────────────────────────

    // The stage stays mounted through every phase, hidden when it is not in use. Unmounting it
    // would destroy the pre-rendered frames and rebuild them at the start of each block, which is
    // precisely the cost §6 says to pay before the block instead of during it.
    const wrap = (content, showStage) => (
        <div style={{ maxWidth: "620px" }}>
            {content}
            <div style={{ display: showStage ? "block" : "none" }}>{stage}</div>
        </div>
    )

    if (phase === "alreadyTaken") {
        return wrap(
            <>
                <h2>Staying focused</h2>
                <p><strong>You have already done this one.</strong> Your result is saved.</p>
                <p>
                    Like the number task, this cannot be retaken — you now know the rhythm and where
                    the 3s tend to fall, and a second attempt would measure practice rather than
                    attention.
                </p>
                <button type="button" style={button} onClick={onDone}>Back to the assessment</button>
            </>,
            false
        )
    }

    if (phase === "intro") {
        return wrap(
            <>
                <h2>Staying focused</h2>

                <OneAttemptWarning
                    minutes={6}
                    reason="Once you know the rhythm and roughly where the 3s fall, a second attempt measures practice rather than attention — so there is no way to start this one again."
                />

                <p>
                    Digits will appear one at a time, quickly.<br />
                    <strong>Press SPACE for every digit — except 3.</strong><br />
                    When you see <strong>3</strong>, do nothing.
                </p>

                <p>On a phone, tap anywhere on the black area instead of pressing space.</p>

                <p>
                    Go as fast as you can while still being accurate. This takes about 5 minutes and
                    cannot be paused. There is a short practice round first.
                </p>

                <p>
                    <em>
                        It is normal to press on a 3 sometimes. Almost everybody does — that is the
                        thing being measured, not a failure.
                    </em>
                </p>

                <p>
                    <button type="button" style={button} onClick={runChecks}>Check my device and start</button>
                </p>
            </>,
            false
        )
    }

    if (phase === "checking") {
        return wrap(
            <>
                <h2>Checking your screen — two seconds</h2>

                {/* PLAIN LANGUAGE, AND IT SAYS WHAT WE GAIN BY CHECKING. "Validating device timing
                    capability" tells a fifteen-year-old nothing except that something technical is
                    happening to them. */}
                <p>
                    This task measures how fast you react, in <strong>thousandths of a second</strong>.
                </p>
                <p>
                    Screens redraw about 60 times a second. Some older or busy phones manage far
                    fewer — and on those, a number we show for a quarter of a second is really on
                    screen for longer. Your reactions would then look slower than they are, and
                    nothing in the result would show that the screen caused it rather than you.
                </p>
                <p>
                    So we watch your screen for two seconds first. <strong>Almost every device
                    passes.</strong>
                </p>

                <p><strong>{checkProgress}%</strong></p>
                <p><em>Just leave this screen on for a moment.</em></p>
            </>,
            false
        )
    }

    if (phase === "blocked") {
        const slow = check && check.hz < MIN_REFRESH_HZ
        const stuttery = check && check.jankRate !== null && check.jankRate > 0.1

        return wrap(
            <>
                <h2>Staying focused</h2>
                <p><strong>This screen cannot keep the timing this task needs.</strong></p>

                {slow && (
                    <p>
                        Your screen is redrawing about <strong>{check.hz} times a second</strong>. This
                        task needs at least {MIN_REFRESH_HZ}, because each digit has to appear for
                        exactly {DIGIT_MS} thousandths of a second and a slower screen cannot show it
                        that briefly.
                    </p>
                )}

                {!slow && stuttery && (
                    <p>
                        Your screen is fast enough, but it is <strong>stuttering</strong> — some
                        redraws are taking far longer than others. That usually means something else
                        on the device is busy.
                    </p>
                )}

                {!slow && !stuttery && (
                    <p>
                        Each digit has to appear for exactly {DIGIT_MS} thousandths of a second, in a
                        cycle of {TRIAL_MS}. On this screen the timing is off by about{" "}
                        {check && check.medianError} thousandths, and {MAX_MEDIAN_TIMING_ERROR_MS} is
                        the most we can allow.
                    </p>
                )}

                <p>
                    <strong>This is about the screen, not about you.</strong> We could still run the
                    task and produce a number, but it would be measuring the phone as much as your
                    attention — and once it is in your report there would be no way to tell which.
                    So we would rather leave it out than show you something that is not true.
                </p>

                <p><strong>What usually fixes it:</strong></p>
                <ul>
                    <li>Close other apps and browser tabs, then try again.</li>
                    <li>Turn off battery saver — it deliberately slows the screen down.</li>
                    <li>Plug the phone in, or let it cool down if it feels warm.</li>
                    <li>If you have a laptop or a newer phone, open this page there instead.</li>
                </ul>

                <p>
                    If none of that works, carry on. Your report is built from everything else and
                    will tell you which part is missing.
                </p>

                <p>
                    <button type="button" style={{ ...button, marginRight: "8px" }} onClick={runChecks}>Check again</button>
                    <button type="button" style={button} onClick={onDone}>Go back</button>
                </p>
            </>,
            false
        )
    }

    if (phase === "ready") {
        return wrap(
            <>
                <h2>Your screen is fine</h2>
                <p>
                    Redrawing about <strong>{check && check.hz} times a second</strong> — plenty for
                    this task.
                </p>
                <p>
                    <strong>Press SPACE for every digit except 3.</strong> On a phone, tap the black
                    area. The practice round tells you when you get one wrong; the real one does not.
                </p>
                <p>
                    <button type="button" style={button} onClick={runPractice}>Start the practice round</button>
                </p>
            </>,
            false
        )
    }

    if (phase === "practice") {
        return wrap(
            <>
                <p>
                    Practice — {practiceCount} of {PRACTICE_TRIALS}
                    {practiceFeedback && <strong> · {practiceFeedback}</strong>}
                </p>
            </>,
            true
        )
    }

    if (phase === "practiceDone") {
        return wrap(
            <>
                <h2>Practice finished</h2>
                <p>
                    The real round is {TEST_TRIALS} digits and takes about four and a half minutes. It
                    will not tell you when you get one wrong.
                </p>
                <p>
                    <strong>Once it starts it cannot be paused.</strong> Put your phone on silent and
                    do not switch apps — we record it if you do.
                </p>
                <p>
                    <button type="button" style={{ ...button, marginRight: "8px" }} onClick={runTest}>Start</button>
                    <button type="button" style={button} onClick={runPractice}>Practise again</button>
                </p>
            </>,
            false
        )
    }

    if (phase === "test") {
        return wrap(
            <>
                {/* Deliberately almost nothing: a counter ticking beside the digits is a second
                    thing to look at, and this task measures where attention goes. */}
                <p><em>About {Math.max(0, Math.round((TEST_TRIALS - trialCount) * TRIAL_MS / 60000))} minutes left</em></p>
            </>,
            true
        )
    }

    if (phase === "done") {
        return wrap(
            <>
                <h2>Finished</h2>

                {summary && summary.scored ? (
                    <>
                        <p><strong>Saved.</strong> Here is what happened.</p>

                        {(() => {
                            const d = summary.descriptives
                            if (!d) return null

                            const typicalCommission = d.commissionRate >= TYPICAL.commissionRate[0] && d.commissionRate <= TYPICAL.commissionRate[1]
                            const belowTypicalCommission = d.commissionRate < TYPICAL.commissionRate[0]

                            return (
                                <>
                                    {/* THE TWO THINGS THE TASK MEASURES, each given its own box with
                                        the raw counts, what it means, and what typical looks like. A
                                        bare "you scored 6.4" is not understandable — the student has
                                        no idea what was counted or whether it is normal, and the one
                                        thing a number cannot do on its own is reassure. */}
                                    <div style={{ border: "1px solid #999", padding: "16px", margin: "16px 0" }}>
                                        <p style={{ marginTop: 0 }}><strong>Catching the 3s</strong></p>
                                        <p style={{ fontSize: "18px", margin: "8px 0" }}>
                                            You saw <strong>{d.threes} threes</strong> and correctly did
                                            nothing on <strong>{d.threesResisted}</strong> of them.
                                        </p>
                                        <p style={{ margin: "8px 0" }}>
                                            You pressed on <strong>{d.commissions}</strong> — that is{" "}
                                            <strong>{Math.round(d.commissionRate * 100)}%</strong> of them.
                                        </p>
                                        <p style={{ margin: "8px 0" }}>
                                            <em>
                                                Most adults press on {Math.round(TYPICAL.commissionRate[0] * 100)}–
                                                {Math.round(TYPICAL.commissionRate[1] * 100)}% of the threes, so{" "}
                                                {typicalCommission
                                                    ? "yours is right in the usual range"
                                                    : belowTypicalCommission
                                                        ? "yours is better than usual"
                                                        : "yours is higher than usual"}
                                                . This is the hardest part of the task on purpose — once
                                                you settle into pressing for every digit, stopping for a 3
                                                takes real effort.
                                            </em>
                                        </p>
                                    </div>

                                    <div style={{ border: "1px solid #999", padding: "16px", margin: "16px 0" }}>
                                        <p style={{ marginTop: 0 }}><strong>How fast you responded</strong></p>
                                        <p style={{ fontSize: "18px", margin: "8px 0" }}>
                                            <strong>{d.meanRt} milliseconds</strong> on average — about{" "}
                                            {(d.meanRt / 1000).toFixed(2)} of a second.
                                        </p>
                                        <p style={{ margin: "8px 0" }}>
                                            Your times varied by about <strong>{d.spreadRt}ms</strong> either
                                            side of that.
                                        </p>
                                        <p style={{ margin: "8px 0" }}>
                                            <em>
                                                Typical is somewhere between {TYPICAL.meanRt[0]} and{" "}
                                                {TYPICAL.meanRt[1]}ms. How much your times <strong>varied</strong>{" "}
                                                matters as much as how fast they were — swinging between very
                                                fast and very slow is what attention drifting in and out looks
                                                like, even when the average looks fine.
                                            </em>
                                        </p>
                                    </div>

                                    <div style={{ border: "1px solid #999", padding: "16px", margin: "16px 0" }}>
                                        <p style={{ marginTop: 0 }}><strong>The rest</strong></p>
                                        <p style={{ margin: "8px 0" }}>
                                            You responded to {d.otherDigits - d.omissions} of the{" "}
                                            {d.otherDigits} other digits
                                            {d.omissions > 0 && <span> and missed {d.omissions}</span>}.
                                        </p>
                                        {d.anticipatory > 0 && (
                                            <p style={{ margin: "8px 0" }}>
                                                <em>
                                                    {d.anticipatory} of your presses came in under 150ms — faster
                                                    than anyone can actually read a digit, so those were left out
                                                    of the average above rather than counted as very quick.
                                                </em>
                                            </p>
                                        )}
                                    </div>

                                    {/* WHY THERE IS NO 0-10 HERE, said plainly rather than left as a
                                        gap the student wonders about. The counts are facts about
                                        what they just did; a score is a comparison, and a comparison
                                        against the rest of the picture is what the report is for. */}
                                    <p>
                                        <strong>Why there is no single score on this page.</strong> These
                                        are the raw counts from your own session — you can check them
                                        against what you remember. Turning them into a rating means
                                        weighing them against everything else you have done, and that is
                                        what your report does. It reads two things from this task:{" "}
                                        <strong>how well you hold attention</strong> (mostly the threes and
                                        how much your times varied) and{" "}
                                        <strong>how quickly you process</strong> (mostly the average).
                                    </p>
                                </>
                            )
                        })()}
                    </>
                ) : (
                    <>
                        <p><strong>This one will not be scored.</strong></p>
                        <p>
                            Your device could not hold the timing steadily enough through the whole
                            round, so the reaction times would not mean what they appear to mean.
                            Processing speed will be left out of your report; nothing else changes.
                        </p>
                    </>
                )}

                {summary && summary.interruptions && (summary.interruptions.blur > 0 || summary.interruptions.hidden > 0) && (
                    <p>
                        <em>
                            We noticed the screen lost focus during the round. That is recorded with
                            your result so it can be read in context.
                        </em>
                    </p>
                )}

                <button type="button" style={button} onClick={onDone} disabled={busy}>
                    {busy ? "Saving…" : "Back to the assessment"}
                </button>
            </>,
            false
        )
    }

    return wrap(<p>Loading…</p>, false)
}

export default Sart
