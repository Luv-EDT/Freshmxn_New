/* ============================================================================
   SART SCORING — sart@1.0.0
   ----------------------------------------------------------------------------
   Parses raw PsyToolkit SART2 output and returns two factor inputs:

       sart_attention     0-10   -> feeds focus_score
       processing_speed   0-10   -> Factor 21, reported on its own

   ---------------------------------------------------------------------------
   INPUT FORMAT — PsyToolkit SART2, tab-separated, 7 columns, one row per trial
   ---------------------------------------------------------------------------
     1  block name      "training" (18 trials) or "realtest" (225 trials)
     2  block number    1 or 2
     3  trial type      1 = GO (digit is not 3)   0 = NO-GO (digit is 3)
     4  digit shown     1-9
     5  font size       1-5 (SART varies stimulus size; ignored in scoring)
     6  correct         1 = correct   0 = error
     7  reaction time   milliseconds. 900 = no response within the window.

   Training trials are DISCARDED. They exist to teach the task.

   ---------------------------------------------------------------------------
   THE VALIDITY PROBLEM THIS FILE EXISTS TO SOLVE
   ---------------------------------------------------------------------------
   SART is trivially easy to fake in a way that LOOKS excellent. Tapping the
   key rhythmically without reading the digits produces a very low mean
   reaction time - which naive scoring reads as outstanding processing speed.

   Human simple visual reaction time has a floor around 150-200 ms. Anything
   faster was pressed BEFORE the stimulus could be processed. These are
   "anticipatory" responses and they are not responses at all.

   Real example from a live session:
       mean RT including everything      183 ms   ("exceptional!")
       mean RT excluding sub-150 ms      302 ms   (perfectly average)
       proportion of responses <150 ms   49%
       commission error rate             68%      (typical adult: 30-45%)

   That session is invalid. Scored naively it would have produced a glowing
   processing-speed number for someone who never read a single digit.

   So: anticipatory responses are ALWAYS excluded from the RT mean, and a
   session with too many of them returns null for both scores rather than a
   flattering one.
   ========================================================================== */

function scoreSart(rawText) {

  var SART_VERSION = "sart@1.0.0";

  /* ---- Thresholds. All tunable, all in one place. ---------------------- */
  var T = {
    ANTICIPATORY_MS:      150,   // below this, no human has processed the digit
    MAX_ANTICIPATORY_PCT: 0.15,  // >15% anticipatory = session invalid
    MAX_COMMISSION_PCT:   0.60,  // >60% = not following instructions
    MAX_OMISSION_PCT:     0.40,  // >40% = not engaging with the task
    MIN_VALID_GO_TRIALS:  100,   // need enough clean trials to mean anything

    /* Attention anchors. Replace with percentiles from your own sample
       once you have ~200 sessions per age band. */
    COMMISSION_BEST: 0.10,  COMMISSION_WORST: 0.60,
    CV_BEST:         0.20,  CV_WORST:         0.60,

    /* Processing speed anchors, in ms, on CLEAN responses only. */
    RT_FAST: 220,  RT_SLOW: 520
  };

  var problems = [];

  /* ---- Parse ------------------------------------------------------------ */
  if (rawText === null || rawText === undefined || String(rawText).trim() === "") {
    return nullResult(["no SART data supplied"]);
  }

  var lines = String(rawText).trim().split(/\r?\n/);
  var real = [];
  for (var i = 0; i < lines.length; i++) {
    var f = lines[i].split(/\t|\s{2,}/);
    if (f.length < 7) continue;
    if (String(f[0]).trim().toLowerCase() !== "realtest") continue;   // drop training
    real.push({
      isGo:    String(f[2]).trim() === "1",
      digit:   parseInt(f[3], 10),
      correct: String(f[5]).trim() === "1",
      rt:      parseInt(f[6], 10)
    });
  }

  if (real.length === 0) return nullResult(["no realtest rows found - check the paste"]);
  if (real.length < 150) problems.push("only " + real.length + " real trials (expected 225)");

  /* Structural check: trial-type column must agree with the digit column.
     If it doesn't, the columns are in a different order than expected and
     every number below would be wrong. */
  var structuralErrors = 0;
  for (var j = 0; j < real.length; j++) {
    if ((real[j].digit === 3) !== (!real[j].isGo)) structuralErrors++;
  }
  if (structuralErrors > 0) {
    return nullResult(["column mismatch: " + structuralErrors +
                       " rows where the go/no-go column disagrees with the digit. " +
                       "The export format has changed - do not trust these scores."]);
  }

  /* ---- Split trials ----------------------------------------------------- */
  var go = [], nogo = [];
  for (var k = 0; k < real.length; k++) (real[k].isGo ? go : nogo).push(real[k]);

  var commission = 0;                       // pressed on a 3
  for (var a = 0; a < nogo.length; a++) if (!nogo[a].correct) commission++;

  var omission = 0;                         // missed a go trial
  var correctGoRts = [];
  for (var b = 0; b < go.length; b++) {
    if (go[b].correct) correctGoRts.push(go[b].rt);
    else omission++;
  }

  var commissionRate = nogo.length ? commission / nogo.length : null;
  var omissionRate   = go.length   ? omission   / go.length   : null;

  /* ---- Separate real responses from anticipatory ones ------------------- */
  var clean = [], anticipatory = 0;
  for (var c = 0; c < correctGoRts.length; c++) {
    if (correctGoRts[c] < T.ANTICIPATORY_MS) anticipatory++;
    else clean.push(correctGoRts[c]);
  }
  var anticipatoryRate = correctGoRts.length ? anticipatory / correctGoRts.length : null;

  /* ---- Validity gate ---------------------------------------------------- */
  var invalid = [];
  if (anticipatoryRate !== null && anticipatoryRate > T.MAX_ANTICIPATORY_PCT)
    invalid.push("anticipatory responses " + pct(anticipatoryRate) +
                 " (limit " + pct(T.MAX_ANTICIPATORY_PCT) + ") - responding before reading");
  if (commissionRate !== null && commissionRate > T.MAX_COMMISSION_PCT)
    invalid.push("commission errors " + pct(commissionRate) +
                 " (limit " + pct(T.MAX_COMMISSION_PCT) + ") - not withholding on 3");
  if (omissionRate !== null && omissionRate > T.MAX_OMISSION_PCT)
    invalid.push("omission errors " + pct(omissionRate) +
                 " (limit " + pct(T.MAX_OMISSION_PCT) + ") - not engaging");
  if (clean.length < T.MIN_VALID_GO_TRIALS)
    invalid.push("only " + clean.length + " usable go-trials (need " +
                 T.MIN_VALID_GO_TRIALS + ")");

  /* ---- Descriptives (reported even when invalid, for the dashboard) ----- */
  var meanClean = mean(clean);
  var sdClean   = sd(clean, meanClean);
  var cv        = (meanClean && meanClean > 0) ? sdClean / meanClean : null;

  var descriptives = {
    real_trials:        real.length,
    go_trials:          go.length,
    nogo_trials:        nogo.length,
    commission_errors:  commission,
    omission_errors:    omission,
    commission_rate:    round3(commissionRate),
    omission_rate:      round3(omissionRate),
    anticipatory_count: anticipatory,
    anticipatory_rate:  round3(anticipatoryRate),
    mean_rt_all:        round0(mean(correctGoRts)),   // the misleading number
    mean_rt_clean:      round0(meanClean),            // the honest number
    sd_rt_clean:        round0(sdClean),
    cv_rt_clean:        round2(cv),
    /* Full distribution retained: the 0-10 score clamps at both ends, but
       the underlying data must stay re-scoreable when percentile norms
       replace the fixed anchors at ~200 sessions. */
    rt_p10: pct_rt(clean, 10), rt_p25: pct_rt(clean, 25),
    rt_p50: pct_rt(clean, 50), rt_p75: pct_rt(clean, 75),
    rt_p90: pct_rt(clean, 90),
    /* Attention decay across the block - a sustained-attention signal in
       its own right. */
    first_half_commission:  halfCommission(real, "first"),
    second_half_commission: halfCommission(real, "second")
  };

  if (invalid.length > 0) {
    return {
      sart_version: SART_VERSION,
      valid: false,
      sart_attention: null,
      processing_speed: null,
      descriptives: descriptives,
      invalid_reasons: invalid,
      problems: problems,
      /* Offer ONE retake. A second invalid session is itself information -
         it usually means the student will not engage with a timed task,
         not that the task is broken. */
      action: "offer_retake"
    };
  }

  /* ---- ATTENTION SCORE -------------------------------------------------- */
  /* Commission errors are the classic lapse measure. RT variability is the
     mind-wandering measure and is often the more sensitive of the two:
     someone whose responses swing between 180 ms and 600 ms is drifting in
     and out, even if the error count looks acceptable. */
  var commComponent = band(commissionRate, T.COMMISSION_WORST, T.COMMISSION_BEST);
  var cvComponent   = band(cv,             T.CV_WORST,         T.CV_BEST);
  var sart_attention = 0.60 * commComponent + 0.40 * cvComponent;

  /* ---- PROCESSING SPEED ------------------------------------------------- */
  /* Computed on CLEAN responses only. Anticipatory presses are excluded, so
     tapping fast cannot buy a high score - it invalidates the session first. */
  var processing_speed = band(meanClean, T.RT_SLOW, T.RT_FAST);

  /* Impulsive profile: quick responses bought with errors. This is a
     speed-accuracy trade-off, not superior processing, and the report must
     say so rather than praising the speed. */
  var impulsive = (meanClean < 260 && commissionRate > 0.45);

  /* Genuinely exceptional processing: fast AND accurate AND not anticipating.
     Named explicitly so a real fast responder is never lost to the ceiling
     of the RT_FAST anchor, which clamps at 10. Genuine speed shows as a
     tight distribution around 220-260 ms - not as sub-150 ms presses. */
  var exceptional = (meanClean < 240 &&
                     commissionRate < 0.25 &&
                     anticipatoryRate < 0.05);
  if (impulsive) problems.push("fast RT with high commission errors - " +
                               "speed-accuracy trade-off, not faster processing");

  return {
    sart_version: SART_VERSION,
    valid: true,
    sart_attention:   round1(sart_attention),
    processing_speed: round1(processing_speed),
    components: {
      commission_component: round1(commComponent),
      variability_component: round1(cvComponent)
    },
    descriptives: descriptives,
    flags: {
      impulsive_responding: impulsive,
      exceptional_speed: exceptional
    },
    invalid_reasons: [],
    problems: problems,
    action: "accept"
  };

  /* ---- helpers ---------------------------------------------------------- */
  function nullResult(reasons) {
    return {
      sart_version: SART_VERSION, valid: false,
      sart_attention: null, processing_speed: null,
      descriptives: null, invalid_reasons: reasons,
      problems: problems, action: "offer_retake"
    };
  }
  /* Map a raw value onto 0-10 given a worst and best anchor. Handles anchors
     in either direction (lower-is-better or higher-is-better). */
  function band(v, worst, best) {
    if (v === null || v === undefined || isNaN(v)) return null;
    var x = (worst - v) / (worst - best) * 10;
    return Math.max(0, Math.min(10, x));
  }
  function mean(arr) {
    if (!arr.length) return null;
    var s = 0; for (var i = 0; i < arr.length; i++) s += arr[i];
    return s / arr.length;
  }
  function sd(arr, m) {
    if (!arr.length || m === null) return null;
    var s = 0; for (var i = 0; i < arr.length; i++) s += (arr[i] - m) * (arr[i] - m);
    return Math.sqrt(s / arr.length);
  }
  function pct(x)    { return Math.round(x * 100) + "%"; }
  function pct_rt(arr, p) {
    if (!arr.length) return null;
    var a = arr.slice().sort(function (x, y) { return x - y; });
    var i = Math.min(a.length - 1, Math.floor((p / 100) * a.length));
    return a[i];
  }
  function halfCommission(trials, which) {
    var h = Math.floor(trials.length / 2);
    var part = (which === "first") ? trials.slice(0, h) : trials.slice(h);
    var n = 0, e = 0;
    for (var i = 0; i < part.length; i++) {
      if (!part[i].isGo) { n++; if (!part[i].correct) e++; }
    }
    return n ? Math.round(e / n * 1000) / 1000 : null;
  }
  function round0(v) { return v === null ? null : Math.round(v); }
  function round1(v) { return v === null ? null : Math.round(v * 10) / 10; }
  function round2(v) { return v === null ? null : Math.round(v * 100) / 100; }
  function round3(v) { return v === null ? null : Math.round(v * 1000) / 1000; }
}

// Ported unchanged from sart_scoring.js (sart@1.0.0).
// The only edit is this export — the original is an n8n Code node and exports nothing.
module.exports = scoreSart
