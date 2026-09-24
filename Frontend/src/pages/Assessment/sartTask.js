// The SART's engine, kept apart from its screens — 04_Item_Bank.md §6.
//
// WHY THIS IS NOT IN THE COMPONENT. Every rule in §6 is about milliseconds, and React is the wrong
// tool for all of them: a setState per frame would re-render the tree 60 times a second and the
// thing being measured would be the renderer. So the loop below touches the DOM directly through
// elements the component rendered ONCE, and React never learns that a trial happened until the
// block is over.
//
// THE FOUR NON-NEGOTIABLES FROM §6, and what each one is actually protecting:
//
//   performance.now(), never Date.now()
//       Date.now() follows the system clock, which a phone re-syncs over NTP whenever it feels
//       like it. A backwards jump mid-block produces a negative reaction time, and a negative
//       number sails through every "is this suspiciously fast" check ever written.
//
//   requestAnimationFrame, never setTimeout
//       setTimeout(x, 250) means "not before 250ms". Under load it means 280, and it says nothing
//       about when the browser actually painted. rAF fires with the timestamp of the frame being
//       composited, so the time recorded is the time the student could first have seen the digit.
//
//   frames pre-rendered before the block begins
//       Creating a text node at 120pt costs a layout and a paint. Doing it inside the trial adds
//       that cost to the stimulus onset, and it is not constant across the five font sizes — so
//       the error would be systematic rather than noise. All 45 combinations exist before the
//       first trial and the loop only flips `display`.
//
//   the block is refused below 50Hz
//       Trial timing is quantised to the frame interval. At 60Hz that is ±8ms and tolerable; at
//       30Hz it is ±17ms before anything has gone wrong, and no amount of careful code recovers it.
//
// TIMING IS MEASURED, NOT ASSUMED. Every trial records the frame timestamp at which its digit was
// actually painted, so the realised trial duration is known for all 225. §6 sets the threshold: a
// median error above 20ms means the implementation is wrong on that device. The caller compares
// against it and — this is the part that matters — a session that fails produces NO score. The
// scoring engine already treats a missing SART as a clean null, which costs processing speed and
// nothing else. A wrong number would cost more than the missing one.

export const DIGIT_MS = 250
export const MASK_MS = 900
export const TRIAL_MS = DIGIT_MS + MASK_MS      // 1150
export const NO_GO_DIGIT = 3
export const GO_DIGITS = [1, 2, 4, 5, 6, 7, 8, 9]
export const FONT_SIZES = [48, 72, 94, 100, 120]        // pt, §6 — randomised per trial
export const PRACTICE_TRIALS = 18
export const TEST_TRIALS = 225
export const NO_GO_TRIALS = 25                  // ~11% of 225, §6
export const NO_RESPONSE_RT = 900               // the sentinel sartScoring.js reads as "no response"
export const MIN_REFRESH_HZ = 50
export const MAX_MEDIAN_TIMING_ERROR_MS = 20

const randomOf = (list) => list[Math.floor(Math.random() * list.length)]

// 225 trials with 25 no-go, spread rather than sprinkled.
//
// A MINIMUM GAP IS PART OF THE PARADIGM. Two 3s in a row, or a 3 in the first few trials, both
// measure something other than sustained attention: the first is a double-take, the second catches
// a student who has not yet settled into the rhythm the task depends on. Random placement produces
// both regularly — with 25 targets in 225 slots, adjacent pairs are likely, not rare.
export const buildTrials = (count = TEST_TRIALS, noGoCount = NO_GO_TRIALS) => {
    const MIN_GAP = 3
    const FIRST_ALLOWED = 5

    const positions = new Set()
    let guard = 0

    while (positions.size < noGoCount && guard < 20000) {
        guard += 1
        const candidate = FIRST_ALLOWED + Math.floor(Math.random() * (count - FIRST_ALLOWED))
        const tooClose = [...positions].some((taken) => Math.abs(taken - candidate) < MIN_GAP)
        if (!tooClose) positions.add(candidate)
    }

    const trials = []

    for (let index = 0; index < count; index += 1) {
        const isGo = !positions.has(index)

        trials.push({
            isGo,
            // The digit and the trial type are the same fact stated twice, and sartScoring.js checks
            // that they agree on every row before it trusts a single number — a column-order change
            // would otherwise silently reverse the meaning of the whole file.
            digit: isGo ? randomOf(GO_DIGITS) : NO_GO_DIGIT,
            fontIndex: Math.floor(Math.random() * FONT_SIZES.length),
        })
    }

    return trials
}

// Counts frames for a moment and turns that into a refresh rate.
//
// Rounded to the nearest common panel rate rather than reported raw: a measurement taken while the
// page is still settling reads 57.3Hz on a 60Hz screen, and refusing that student would be a bug
// wearing the costume of a safety check.
export const measureRefreshRate = (durationMs = 500) => new Promise((resolve) => {
    let frames = 0
    let start = null

    const tick = (now) => {
        if (start === null) start = now
        frames += 1

        if (now - start >= durationMs) {
            const measured = (frames - 1) * 1000 / (now - start)
            const known = [30, 48, 60, 72, 90, 120, 144, 165, 240]
            const nearest = known.reduce((best, rate) => (Math.abs(rate - measured) < Math.abs(best - measured) ? rate : best), known[0])
            resolve({ measured: Math.round(measured * 10) / 10, hz: Math.abs(nearest - measured) <= 5 ? nearest : Math.round(measured) })
            return
        }

        requestAnimationFrame(tick)
    }

    requestAnimationFrame(tick)
})

// One row per trial, in the tab-separated PsyToolkit SART2 layout sartScoring.js parses:
//
//     block  blockNo  trialType  digit  fontSize  correct  rt
//
// WRITTEN IN THE OTHER TOOL'S FORMAT ON PURPOSE. The scorer is pure, tested and off-limits, and it
// already knows how to read this. Inventing a nicer shape here would mean changing it, which would
// mean re-proving it. The browser bends to the file that is already correct.
export const toPsyToolkitRows = (records, blockName, blockNumber) => records.map((record) => [
    blockName,
    blockNumber,
    record.isGo ? 1 : 0,
    record.digit,
    record.fontIndex + 1,
    record.correct ? 1 : 0,
    record.rt === null ? NO_RESPONSE_RT : Math.round(record.rt),
].join("\t"))

export const median = (values) => {
    if (!values.length) return null
    const sorted = [...values].sort((left, right) => left - right)
    const middle = Math.floor(sorted.length / 2)
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

// The block itself.
//
// SCHEDULING IS IDEAL, MEASUREMENT IS REAL, and keeping those apart is the whole trick. Each trial
// is due at `start + n × 1150` — never at "1150 after the last one actually began", which would
// accumulate one frame of lateness per trial and finish the block eleven seconds adrift. What is
// RECORDED, separately, is the frame timestamp at which each digit was really painted, and the gaps
// between those timestamps are the realised trial durations §6 asks to be checked.
//
// `controls` is filled in with `respond` and `cancel` so the component can wire a keypress and a
// tap to the loop without knowing anything about its internals. Returns { records, durations,
// aborted } and never throws; the caller decides what the numbers mean.
export const runBlock = ({ trials, show, hide, onTrial, controls = {} }) => new Promise((resolve) => {
    const records = []
    const durations = []

    let index = 0
    let blockStart = null
    let onset = null            // when THIS trial's digit was actually painted
    let previousOnset = null
    let showing = null          // "digit" | "mask"
    let response = null         // performance.now() of the first press in this trial
    let rafId = null
    let stopped = false

    // ONLY THE FIRST PRESS IN A TRIAL COUNTS. A student who taps three times has not responded
    // three times, and taking the last one would reward hammering the key.
    const respond = (timestamp) => {
        if (response === null && onset !== null) response = timestamp
    }

    const finishTrial = () => {
        const trial = trials[index]
        const rt = response === null ? null : response - onset

        // GO: a press is correct, silence is an omission. NO-GO: silence is correct, a press is a
        // commission error. The scorer derives everything from these two columns, so they are
        // decided here rather than inferred later from the reaction time — a trial with no response
        // is written as 900ms by convention, and 900ms is also a perfectly possible real one.
        const correct = trial.isGo ? response !== null : response === null

        records.push({ ...trial, correct, rt })

        if (previousOnset !== null) durations.push(onset - previousOnset)
        if (onTrial) onTrial({ index, correct, isGo: trial.isGo, rt })

        previousOnset = onset
        index += 1
        response = null
        onset = null
        showing = null
    }

    const stop = (aborted) => {
        stopped = true
        cancelAnimationFrame(rafId)
        hide()
        resolve({ records, durations, aborted })
    }

    const tick = (now) => {
        if (stopped) return
        if (blockStart === null) blockStart = now

        // A WHILE RATHER THAN AN IF, which was measured rather than assumed and is the smaller of
        // the two things happening here: in a healthy block at most one window closes per frame, and
        // after a stall an `if` clears the backlog one trial per frame and reaches the same rows a
        // few frames later. The loop simply bounds recovery to the one frame.
        //
        // THE PART THAT IS LOAD-BEARING IS THE ELSE. A trial whose entire 1150ms window passed
        // without a single frame was never shown to anybody, and it must still produce a row.
        // Skipping it instead would hand the scorer 222 rows for a 225-trial block — which reads as
        // a short session rather than a damaged one, and quietly charges the student with omission
        // errors on digits they were never shown.
        while (index < trials.length && now - (blockStart + index * TRIAL_MS) >= TRIAL_MS) {
            if (onset !== null) {
                finishTrial()
            } else {
                // A whole 1150ms window passed without a single frame — the tab was hidden, or the
                // device stalled badly. Recorded as a dropped trial rather than quietly skipped, so
                // the row count stays honest and the damage is visible in the timing summary.
                records.push({ ...trials[index], correct: false, rt: null, dropped: true })
                index += 1
                showing = null
            }
        }

        if (index >= trials.length) {
            stop(false)
            return
        }

        const elapsed = now - (blockStart + index * TRIAL_MS)

        if (elapsed >= 0) {
            const wanted = elapsed < DIGIT_MS ? "digit" : "mask"

            if (showing !== wanted) {
                show(wanted, trials[index])

                // The onset is this frame's timestamp, not a performance.now() called a line later:
                // rAF is handed the time the frame is being composited for, which is the earliest
                // moment the student could have seen anything. Every reaction time in the block is
                // measured from here.
                if (wanted === "digit") onset = now

                showing = wanted
            }
        }

        rafId = requestAnimationFrame(tick)
    }

    controls.respond = respond
    controls.cancel = () => { if (!stopped) stop(true) }

    rafId = requestAnimationFrame(tick)
})

// Does this device actually keep time? Answered in about two seconds, by watching frames.
//
// THE FIRST VERSION OF THIS RAN TWENTY 20-TRIAL BLOCKS, which is twenty times twenty times 1150ms —
// SEVEN AND A HALF MINUTES of black screen before a student could begin a five-minute task. That
// was a straight arithmetic error on my part, not a trade-off anybody chose, and it made the module
// unusable.
//
// MEASURING FRAMES IS NOT A WEAKER TEST, it is the same test taken at the right level. A trial
// boundary can only ever be noticed on a frame, so the error on every boundary is bounded by the
// gap between frames: if a trial is due at T, the next frame lands somewhere in [T, T + gap), which
// makes the expected error gap/2 and the worst case gap. Running whole trials to discover that is
// measuring a 1150ms ruler with a 16ms ruler and waiting seven minutes for the answer.
//
// So two seconds of frames gives all three things that matter:
//     · the refresh rate            — the median gap; §6 refuses below 50Hz
//     · the expected trial error    — half the median gap
//     · whether the device stutters — how often a gap is far longer than the median
//
// AND THE REAL BLOCK STILL CHECKS ITSELF AFTERWARDS. Sart.js re-measures the actual trial durations
// across all 225 and refuses to save if they drifted, which catches the phone that passes this
// while cool and then thermally throttles four minutes later. That post-check is the authority;
// this one exists to turn away a hopeless device before the student sits through the task.
const JANK_MULTIPLE = 2          // a frame gap this many times the median is a stutter, not jitter
const MAX_JANK_RATE = 0.1        // more than one frame in ten stuttering will drop trials

export const runTimingCheck = ({ durationMs = 2000, onProgress } = {}) => new Promise((resolve) => {
    const gaps = []
    let start = null
    let last = null

    const tick = (now) => {
        if (start === null) {
            start = now
            last = now
            requestAnimationFrame(tick)
            return
        }

        gaps.push(now - last)
        last = now

        if (now - start < durationMs) {
            if (onProgress) onProgress(Math.min(100, Math.round((now - start) / durationMs * 100)))
            requestAnimationFrame(tick)
            return
        }

        const medianGap = median(gaps)

        // No frames at all is a FAILURE, not a pass. An empty list has a median of null, and
        // `null <= 20` is true in JavaScript — the exact shape of bug this whole file exists to
        // avoid, where the absence of evidence reads as evidence of success.
        if (gaps.length === 0 || medianGap === null || medianGap <= 0) {
            resolve({ frames: 0, hz: 0, medianError: null, worstError: null, jankRate: null, passed: false })
            return
        }

        const jank = gaps.filter((gap) => gap > medianGap * JANK_MULTIPLE)
        const jankRate = jank.length / gaps.length
        const hz = 1000 / medianGap

        // Expected error on a trial boundary: uniform within one frame, so half a frame.
        const medianError = medianGap / 2
        const worstError = Math.max(...gaps)

        resolve({
            frames: gaps.length,
            hz: Math.round(hz * 10) / 10,
            medianFrameMs: Math.round(medianGap * 100) / 100,
            medianError: Math.round(medianError * 10) / 10,
            worstError: Math.round(worstError * 10) / 10,
            jankRate: Math.round(jankRate * 1000) / 1000,
            passed: hz >= MIN_REFRESH_HZ
                && medianError <= MAX_MEDIAN_TIMING_ERROR_MS
                && jankRate <= MAX_JANK_RATE,
        })
    }

    requestAnimationFrame(tick)
})

// What happened, in counts a student can check against their own memory of the task.
//
// DESCRIPTIVE ONLY — THIS IS NOT THE SCORE. The 0-10 numbers that reach the report come from
// sartScoring.js on the server, which is the single source of truth and is off-limits to this file.
// What is computed here is arithmetic over the trial records: how many 3s there were, how many were
// resisted, how many digits were missed, and the mean reaction time. Nothing here is weighted,
// banded or normed.
//
// THE FIXTURE PROVES IT AGREES. Two places that count the same events can drift, so a pipeline
// fixture runs this and the real scorer over the same block and fails if any figure disagrees. That
// is what makes showing the student a number here safe.
//
// ANTICIPATORY PRESSES ARE EXCLUDED FROM THE MEAN, exactly as the scorer excludes them. A response
// under 150ms was made before a human could have read the digit, and leaving those in produces a
// flattering mean reaction time for somebody who was tapping rhythmically — the specific failure
// sartScoring.js was written to stop. Showing the student the flattering version here while the
// report used the honest one would be the worst of both.
export const ANTICIPATORY_MS = 150

export const describeSession = (records) => {
    const real = records.filter((record) => !record.dropped)
    const go = real.filter((record) => record.isGo)
    const noGo = real.filter((record) => !record.isGo)

    const commissions = noGo.filter((record) => !record.correct).length
    const omissions = go.filter((record) => !record.correct).length

    // ROUNDED BEFORE AVERAGING, TO THE SAME INTEGER THE FILE CARRIES.
    //
    // `toPsyToolkitRows` writes `Math.round(rt)`, so the scorer averages integers while this used to
    // average the raw floats. Mean-of-rounded and rounded-mean differ by up to 1ms, which made the
    // fixture that compares the two INTERMITTENTLY FAIL — it passed six runs in a row and failed
    // twice under load, which is the worst kind of test.
    //
    // It was also a real, if small, inconsistency: the student could be shown 311ms while their
    // report reasoned from 312ms. Rounding here first makes the two identical by construction, and
    // it aligns the 150ms anticipatory cut-off with the scorer's too.
    const responded = go
        .filter((record) => record.correct && record.rt !== null)
        .map((record) => Math.round(record.rt))
    const clean = responded.filter((rt) => rt >= ANTICIPATORY_MS)
    const anticipatory = responded.length - clean.length

    const mean = clean.length ? clean.reduce((total, rt) => total + rt, 0) / clean.length : null
    const spread = clean.length && mean
        ? Math.sqrt(clean.reduce((total, rt) => total + (rt - mean) * (rt - mean), 0) / clean.length)
        : null

    return {
        trials: real.length,
        threes: noGo.length,
        threesResisted: noGo.length - commissions,
        commissions,
        otherDigits: go.length,
        omissions,
        anticipatory,
        meanRt: mean === null ? null : Math.round(mean),
        spreadRt: spread === null ? null : Math.round(spread),
        // The share of 3s pressed on. This is the classic SART lapse measure and the one number a
        // student should look at, so it is computed rather than left to be eyeballed from counts.
        commissionRate: noGo.length ? Math.round(commissions / noGo.length * 100) / 100 : null,
    }
}

// Typical adult figures, for the one thing a bare number cannot do: tell you whether it is normal.
//
// Quoted as RANGES AND FROM THE LITERATURE, not as norms of our own — we have none yet, and a
// percentile computed from nothing would be a fabrication. sartScoring.js says the same thing about
// its own anchors: replace them with percentiles once there are ~200 sessions per age band.
export const TYPICAL = {
    commissionRate: [0.3, 0.45],    // the reference figure quoted in sartScoring.js for adults
    meanRt: [250, 400],
}

// Device facts §6 requires recorded with every session. None of them are identifying on their own;
// all of them are the difference between "this score is low" and "this score was measured on a
// phone that could not present the task".
export const describeDevice = (refresh) => ({
    userAgent: navigator.userAgent,
    isTouch: navigator.maxTouchPoints > 0,
    deviceType: navigator.maxTouchPoints > 0 ? "touch" : "pointer",
    screenWidth: window.screen && window.screen.width,
    screenHeight: window.screen && window.screen.height,
    devicePixelRatio: window.devicePixelRatio,
    hardwareConcurrency: navigator.hardwareConcurrency || null,
    refreshHz: refresh ? refresh.hz : null,
    refreshMeasured: refresh ? refresh.measured : null,
})
