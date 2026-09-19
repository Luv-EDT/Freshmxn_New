/* ============================================================================
   PERSPECTIVE SECTION — SCORING ENGINE (FINAL)
   Version: perspective@5.0.0
   ============================================================================

   ---------------------------------------------------------------------------
   WHAT THIS SECTION MEASURES
   ---------------------------------------------------------------------------
   This questionnaire measures exactly THREE things from its own items:

       belief_bank     crystallised knowledge of perspective and belief
       emotion_bank    emotional experience bank
       clm             cognitive load management

   Everything else is FETCHED from the sections that already measure it and
   passed in as an argument. This section never re-measures a trait that
   another section owns.

   Each bank = a multiple-choice block + one open-ended item scored by an LLM.
   The MCQ block gives reliability. The open item gives depth. A bank meant to
   represent "crystallised knowledge" cannot be measured by tick-boxes alone.

   ---------------------------------------------------------------------------
   IMPORTANT: emotional_stability, NOT neuroticism
   ---------------------------------------------------------------------------
   The input is EMOTIONAL STABILITY - already the reverse of neuroticism.
   It is used DIRECTLY. Do not invert it. Do not write (10 - x) anywhere.
   High value = calm and stable = contributes positively to EI and firmness.

   ---------------------------------------------------------------------------
   COMPUTATION ORDER (a strict DAG - no cycles anywhere)
   ---------------------------------------------------------------------------

       emotion_bank ──► ei_score ──┬──► firmness_score ──► idm ──┐
                                   │                             │
       belief_bank ────────────────┘                             │
                                                                 │
       clm ──────────► focus_score ──────────────────────────────┤
                                                                 │
       conscientiousness ────────────────────────────────────────┤
                                                                 ▼
                                                        consistency_score

   Nothing downstream ever feeds anything upstream. ei_score is computed
   first because both firmness and focus depend on it.

   ---------------------------------------------------------------------------
   FORM REQUIREMENT
   ---------------------------------------------------------------------------
   Every option in the Google Form must begin with a letter and a bracket:
   "A) ", "B) ", "C) ". The code reads ONLY that first character, so
   re-wording an option can never silently break a score. Anything
   unparseable returns null and is listed in flags.unmatched_items.

   Shuffle the option order for every question in the form. The highest-
   scoring option must not always be A. Then change ONLY the KEY maps below.
   ========================================================================== */

function func(
  /* ---- BELIEF BANK: 6 multiple-choice items ---- */
  p1, p2, p3, p4, p5, p6,
  /* ---- BELIEF BANK: open item, raw JSON string from the LLM node ---- */
  p7_json,

  /* ---- COGNITIVE LOAD: 5 multiple-choice items ---- */
  p8, p9, p10, p11, p12,
  /* ---- COGNITIVE LOAD: open item, raw JSON string from the LLM node ---- */
  p13_json,

  /* ---- EMOTION BANK: 8 multiple-choice items ---- */
  p14, p15, p16, p17, p18, p19, p20, p21,
  /* ---- EMOTION BANK: open item, raw JSON string from the LLM node ---- */
  p22_json,

  /* ---- VALUES: 4 fulfilment + 4 importance, 1-5 Likert ---- */
  p23, p24, p25, p26, p27, p28, p29, p30,

  /* ---- INTRAPERSONAL: open item, raw JSON string from the LLM node ---- */
  p33_json,

  /* ---- UNCERTAINTY TOLERANCE: 6 scored items + 1 calibration check ---- */
  u1, u2, u3, u4, u5, u6, u7,

  /* ---- PERSISTENCE: 4 situational items, direct input to consistency ---- */
  ps1, ps2, ps3, ps4,

  /* ---- SART outputs, from scoreSart(). Pass null if not taken yet. ---- */
  sart_attention, sart_processing_speed,

  /* ---- NARRATIVE ONLY, never scored ---- */
  p31, p32,

  /* ---- FETCHED from other sections. ALL already on a 0-10 scale. ---- */
  agreeableness,
  emotional_stability,   // <-- already reversed. Use directly. Do NOT invert.
  conscientiousness,
  openness,
  reasoning,
  short_term_memory,
  confidence
) {

  /* Stamp this onto every stored profile. If you change any KEY or WEIGHT
     below, bump this version. It is what lets you recompute every historical
     profile after a formula change instead of asking students to retake. */
  var SCORING_VERSION = "perspective@5.0.0";


  /* ==========================================================================
     SECTION 1 — HELPERS
     ========================================================================== */

  /* Questions whose answer could not be parsed. A non-empty list means your
     form option text and your KEY map have drifted apart. Fix the form, not
     the score. */
  var unmatched = [];

  /* LLM outputs that broke their own rubric (out of range, malformed JSON).
     These are bugs to investigate, not scores to quietly accept. */
  var llmProblems = [];

  /* Read the leading option letter: "C) I go along but..." -> "C" */
  function letter(v) {
    if (v === null || v === undefined) return null;
    var s = String(v).trim();
    if (s.length === 0) return null;
    var ch = s.charAt(0).toUpperCase();
    return (ch >= "A" && ch <= "E") ? ch : null;
  }

  /* Score one item against its key.
     An unmatched answer returns null, NEVER 0. Scoring a broken option
     string as zero silently punishes the student and hides the bug. */
  function item(v, key, name) {
    var L = letter(v);
    if (L === null || key[L] === undefined) {
      if (v !== null && v !== undefined && String(v).trim() !== "") {
        unmatched.push(name);
      }
      return null;
    }
    return key[L];
  }

  function num(v) {
    if (v === null || v === undefined || String(v).trim() === "") return null;
    var x = Number(v);
    return isNaN(x) ? null : x;
  }

  /* Mean of the answered items, rescaled to 0-10.
     Requires at least 80% of the block answered, otherwise returns null.
     We never fill a gap with an average - a missing block must stay visible. */
  function scale(values, maxPerItem) {
    var sum = 0, n = 0;
    for (var i = 0; i < values.length; i++) {
      if (values[i] !== null && values[i] !== undefined) { sum += values[i]; n++; }
    }
    if (n === 0) return null;
    if (n / values.length < 0.8) return null;
    return (sum / n / maxPerItem) * 10;
  }

  /* Parse the JSON an LLM node returns. Strips markdown fences if the model
     wrapped its output. Returns null on anything malformed. */
  function parseJson(raw, name) {
    if (raw === null || raw === undefined) return null;
    if (typeof raw === "object") return raw;          // already parsed upstream
    var s = String(raw).trim();
    if (s.length === 0) return null;
    s = s.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    try {
      return JSON.parse(s);
    } catch (e) {
      llmProblems.push(name + ": unparseable JSON");
      return null;
    }
  }

  /* Pull one sub-score out of an LLM result and range-check it.
     THE CODE DOES THE ARITHMETIC, NOT THE MODEL. We read the components
     and sum them ourselves, so a model that miscounts its own total cannot
     put a wrong number into a profile. */
  function sub(obj, field, max, name) {
    if (obj === null) return null;
    var x = num(obj[field]);
    if (x === null) return null;
    if (x < 0 || x > max) {
      llmProblems.push(name + "." + field + "=" + x + " (allowed 0-" + max + ")");
      x = (x < 0) ? 0 : max;
    }
    return x;
  }

  /* Rescale a summed LLM score onto 0-10. */
  function toTen(v, maxScore) {
    if (v === null) return null;
    return (v / maxScore) * 10;
  }

  /* Blend a multiple-choice block with an LLM-scored open item.
     If either side is missing the other carries the bank alone, and the
     result is marked incomplete so confidence can be downgraded. */
  function blend(mcq, open, mcqWeight) {
    if (mcq === null && open === null) return null;
    if (open === null) return { value: mcq,  complete: false };
    if (mcq  === null) return { value: open, complete: false };
    return { value: mcq * mcqWeight + open * (1 - mcqWeight), complete: true };
  }

  /* Weighted combination of a factor's inputs.

     parts[0] MUST be the directly-measured component. If it is missing the
     whole factor returns null. We never rebuild a factor out of its
     supporting traits alone - that is precisely the circular derivation
     this design exists to remove. A focus_score reconstructed from memory
     and reasoning when the load-management items are missing would be a
     number about general ability wearing the label "focus".

     Missing SUPPORTING components are dropped and the remaining weights
     renormalised, up to a limit of 40% of total weight missing. */
  function combine(parts) {
    if (parts.length === 0) return null;
    var primary = parts[0][0];
    if (primary === null || primary === undefined || isNaN(primary)) return null;

    var total = 0, used = 0;
    for (var i = 0; i < parts.length; i++) {
      var v = parts[i][0], w = parts[i][1];
      if (v !== null && v !== undefined && !isNaN(v)) { total += v * w; used += w; }
    }
    if (used < 0.6) return null;
    return { value: total / used, complete: (used > 0.999) };
  }

  /* Confidence must travel downstream. If belief_bank is only "partial"
     because the open item could not be scored, firmness_score cannot
     honestly report "full". This takes the weakest link.
     An upstream that is null counts as "partial": the factor still
     computed, so the missing input was already renormalised away. */
  function propagate(own, upstreams) {
    if (own === null) return null;
    var rank = { "partial": 1, "full": 2 };
    var worst = rank[own];
    for (var i = 0; i < upstreams.length; i++) {
      var u = (upstreams[i] === null) ? "partial" : upstreams[i];
      if (rank[u] < worst) worst = rank[u];
    }
    return (worst === 2) ? "full" : "partial";
  }

  function round1(v) { return (v === null || v === undefined) ? null : Math.round(v * 10) / 10; }
  function val(c)    { return c ? c.value : null; }
  /* Data quality of one computed value. Deliberately NOT called
     "confidence" - Confidence is Factor 16, a property of the student.
     This is a property of our measurement. */
  function dq(c)     { return c ? (c.complete ? "full" : "partial") : null; }


  /* ==========================================================================
     SECTION 2 — ANSWER KEYS
     Shuffle option order in the form, then edit ONLY these maps.
     ========================================================================== */

  var KEY = {
    /* ---- BELIEF BANK ---- */
    p1: { A: 4, B: 3, C: 2, D: 0 },           // values conflict with a group plan
    p2: { A: 4, B: 3, C: 1, D: 0 },           // belief meets contradicting data
    p3: { A: 4, B: 3, C: 2, D: 1, E: 0 },     // approach to a complex problem
    p4: { A: 4, B: 3, C: 2, D: 1, E: 0 },     // use of other people's opinions
    p5: { A: 4, B: 3, C: 2, D: 1, E: 0 },     // staying with a decision
    p6: { A: 4, B: 3, C: 2, D: 1, E: 0 },     // holding against family pressure

    /* ---- COGNITIVE LOAD MANAGEMENT ---- */
    p8:  { A: 0, B: 1, C: 3, D: 4 },          // how often derailed (REVERSED)
    p9:  { A: 4, B: 3, C: 2, D: 1, E: 0 },    // moving between tasks
    p10: { A: 4, B: 3, C: 2, D: 1, E: 0 },    // protecting a deep-work block
    p11: { A: 4, B: 3, C: 2, D: 1, E: 0 },    // using sharpest hours
    p12: { A: 4, B: 3, C: 2, D: 1, E: 0 },    // recovering from load

    /* ---- EMOTION BANK ----
       Graded partial credit, not right/wrong. These are judgement items:
       a defensible second-best answer earns 2, a clearly wrong one earns 0. */
    p14: { A: 4, B: 2, C: 2, D: 1, E: 0 },    // irreversible loss of a goal
    p15: { A: 4, B: 2, C: 1, D: 0, E: 0 },    // being wronged
    p16: { A: 4, B: 2, C: 2, D: 1, E: 0 },    // two emotions at once
    p17: { A: 4, B: 2, C: 2, D: 1, E: 1 },    // how an emotion changes over time
    p18: { A: 4, B: 2, C: 2, D: 1, E: 0 },    // managing own anxiety
    p19: { A: 4, B: 2, C: 2, D: 1, E: 0 },    // managing rumination
    p20: { A: 4, B: 2, C: 1, D: 1, E: 0 },    // managing another's distress
    p21: { A: 4, B: 2, C: 1, D: 1, E: 0 },    // naming a mixed feeling

    /* ---- UNCERTAINTY TOLERANCE ----
       NOTE: this scale is a POSITION, not a LEVEL. A low score is not a
       deficit - it points towards structured, defined-path professions.
       The report must not describe a low scorer as lacking anything. */
    u1: { A: 4, B: 3, C: 2, D: 1, E: 0 },     // stable job vs new company
    u2: { A: 4, B: 3, C: 2, D: 1, E: 0 },     // field with no defined path
    u3: { A: 4, B: 3, C: 2, D: 1, E: 0 },     // deciding on 60% information
    u4: { A: 4, B: 3, C: 2, D: 1, E: 0 },     // committing savings
    u5: { A: 4, B: 3, C: 2, D: 1, E: 0 },     // defined vs evolving role
    u6: { A: 3, B: 4, C: 3, D: 1, E: 0 },     // returning to risk after a loss

    /* ---- PERSISTENCE (direct input to consistency) ---- */
    ps1: { A: 4, B: 4, C: 2, D: 1, E: 0 },    // when it stops being interesting
    ps2: { A: 4, B: 3, C: 2, D: 1, E: 0 },    // the unglamorous middle
    ps3: { A: 4, B: 3, C: 2, D: 1, E: 0 },    // returning after an interruption
    ps4: { A: 4, B: 3, C: 2, D: 1, E: 0 }     // long horizons
    /* u7 is NOT scored into the scale - it is a calibration check only. */
  };


  /* ==========================================================================
     SECTION 3 — WEIGHTS
     Every tunable number in the model lives here and nowhere else.
     ========================================================================== */

  var W = {
    /* How much of each bank comes from the MCQ block. The remainder comes
       from the LLM-scored open item.
       belief is 60/40 rather than 70/30 because its open item DEMONSTRATES
       the reasoning rather than asking the student to rate it. */
    mcqShare: { belief: 0.60, emotion: 0.70, clm: 0.70 },

    /* EI = emotion bank + agreeableness + emotional stability + reasoning */
    ei: { emotion_bank: 0.40, agreeableness: 0.20,
          emotional_stability: 0.20, reasoning: 0.20 },

    /* FIRMNESS = belief bank + confidence + emotional stability + EI */
    firmness: { belief_bank: 0.40, confidence: 0.20,
                emotional_stability: 0.20, ei: 0.20 },

    /* FOCUS = cognitive load management + STM + reasoning + EI

       NOTE: conscientiousness has been REMOVED from this formula.
       It used to sit here as a proxy for "manages their own cognitive load".
       Cognitive load management is now measured directly, so that proxy is
       redundant. Conscientiousness moved to consistency_score, where it
       does work nothing else does, and where it appears exactly once. */
    /* SART is a DIRECT performance measure of sustained attention and now
       carries the largest weight. Every other term here is indirect.
       If SART has not been taken, its weight is renormalised across the
       rest and clm acts as the primary. */
    focus: { sart: 0.30, clm: 0.20, short_term_memory: 0.20,
             reasoning: 0.15, ei: 0.15 },

    /* INTRAPERSONAL INTELLIGENCE (Factor 20)
       Built from items that make the student DEMONSTRATE self-knowledge
       rather than rate it. Self-rated self-awareness is invalid by
       construction: not knowing yourself includes not knowing that. */
    intrapersonal: { self_awareness_bank: 0.55, emotion_bank: 0.25, openness: 0.20 },
    selfAwareness: { p33: 0.60, p7_revisability: 0.40 },

    /* INFORMED DECISION MAKING = reasoning + firmness + openness */
    idm: { reasoning: 0.40, firmness: 0.30, openness: 0.30 },

    /* CONSISTENCY = conscientiousness + focus + informed decision making

       Conscientiousness carries the largest weight because it is the only
       input that speaks to repeated execution over weeks and months. Focus
       covers attention within a session; IDM covers whether the goal was
       worth committing to. Neither covers turning up again tomorrow. */
    /* CONSISTENCY now has a directly-measured component. It was previously
       100% derived, which violated the model's own rule that a factor
       should not be built purely from other factors. */
    consistency: { conscientiousness: 0.35, persistence_items: 0.20,
                   focus: 0.30, idm: 0.15 }
  };


  /* ==========================================================================
     SECTION 4 — ITEM SCORES
     ========================================================================== */

  var beliefItems = [
    item(p1, KEY.p1, "p1"), item(p2, KEY.p2, "p2"), item(p3, KEY.p3, "p3"),
    item(p4, KEY.p4, "p4"), item(p5, KEY.p5, "p5"), item(p6, KEY.p6, "p6")
  ];

  var clmItems = [
    item(p8,  KEY.p8,  "p8"),  item(p9,  KEY.p9,  "p9"),
    item(p10, KEY.p10, "p10"), item(p11, KEY.p11, "p11"),
    item(p12, KEY.p12, "p12")
  ];

  var emotionItems = [
    item(p14, KEY.p14, "p14"), item(p15, KEY.p15, "p15"),
    item(p16, KEY.p16, "p16"), item(p17, KEY.p17, "p17"),
    item(p18, KEY.p18, "p18"), item(p19, KEY.p19, "p19"),
    item(p20, KEY.p20, "p20"), item(p21, KEY.p21, "p21")
  ];


  /* ==========================================================================
     SECTION 5 — LLM-SCORED OPEN ITEMS
     We read the SUB-SCORES the model returns and add them up ourselves.
     The model classifies; the code calculates.
     ========================================================================== */

  /* --- P7: belief statement. Three sub-scales, 0-3 each, total 0-9. --- */
  var beliefLlm    = parseJson(p7_json, "p7_belief");
  var bReasons     = sub(beliefLlm, "reasons",      3, "p7_belief");
  var bEvidence    = sub(beliefLlm, "evidence",     3, "p7_belief");
  var bRevisability = sub(beliefLlm, "revisability", 3, "p7_belief");
  var beliefOpenRaw = (bReasons === null || bEvidence === null || bRevisability === null)
                      ? null : (bReasons + bEvidence + bRevisability);
  var beliefOpen    = toTen(beliefOpenRaw, 9);

  /* --- P22: emotional narrative. 0-2 + 0-1 + 0-1, total 0-4. --- */
  var emotionLlm  = parseJson(p22_json, "p22_emotion");
  var eGranular   = sub(emotionLlm, "granularity", 2, "p22_emotion");
  var eComplexity = sub(emotionLlm, "complexity",  1, "p22_emotion");
  var ePerspective = sub(emotionLlm, "perspective", 1, "p22_emotion");
  var emotionOpenRaw = (eGranular === null || eComplexity === null || ePerspective === null)
                       ? null : (eGranular + eComplexity + ePerspective);
  var emotionOpen    = toTen(emotionOpenRaw, 4);

  /* --- P13: day plan. Five true/false criteria, total 0-5. --- */
  var dayLlm = parseJson(p13_json, "p13_dayplan");
  var dayOpenRaw = null;
  if (dayLlm !== null && dayLlm.criteria) {
    var names = ["deep_work_first", "urgency_order", "messages_batched",
                 "fixed_respected", "recovery"];
    var hits = 0, seen = 0;
    for (var k = 0; k < names.length; k++) {
      var c = dayLlm.criteria[names[k]];
      if (c === true || c === false) { seen++; if (c === true) hits++; }
    }
    if (seen === 5) dayOpenRaw = hits;
    else llmProblems.push("p13_dayplan: only " + seen + " of 5 criteria returned");
  }
  var dayOpen = toTen(dayOpenRaw, 5);


  /* --- P33: intrapersonal. Three sub-scales, 0-2 each, total 0-6. --- */
  var p33Llm      = parseJson(p33_json, "p33_intrapersonal");
  var iSpecific   = sub(p33Llm, "specificity",    2, "p33_intrapersonal");
  var iCausal     = sub(p33Llm, "causal_insight", 2, "p33_intrapersonal");
  var iIntegration = sub(p33Llm, "integration",   2, "p33_intrapersonal");
  var p33Raw = (iSpecific === null || iCausal === null || iIntegration === null)
               ? null : (iSpecific + iCausal + iIntegration);
  var p33Score = toTen(p33Raw, 6);


  /* ==========================================================================
     SECTION 5b — UNCERTAINTY TOLERANCE (Factor 22)

     Measured directly from its own items. It is NOT derived, because
     deriving it from openness + emotional stability would just relabel
     openness + emotional stability.

     This score is a POSITION on a dimension, not a level of ability.
     Low = suited to structured, defined-path work. High = suited to
     ambiguous, self-directed work. Neither end is better.
     ========================================================================== */

  var uncertaintyItems = [
    item(u1, KEY.u1, "u1"), item(u2, KEY.u2, "u2"), item(u3, KEY.u3, "u3"),
    item(u4, KEY.u4, "u4"), item(u5, KEY.u5, "u5"), item(u6, KEY.u6, "u6")
  ];
  var uncertainty_tolerance = scale(uncertaintyItems, 4);

  /* Persistence: the direct measurement inside consistency. */
  var persistenceItems = [
    item(ps1, KEY.ps1, "ps1"), item(ps2, KEY.ps2, "ps2"),
    item(ps3, KEY.ps3, "ps3"), item(ps4, KEY.ps4, "ps4")
  ];
  var persistence_raw = scale(persistenceItems, 4);

  /* u7 is a judgement check, deliberately kept OUT of the scale.
     Options C and D accept an unexplained "guaranteed" return - that is
     poor calibration, not high tolerance. Folding it in would let
     recklessness raise the score. */
  var u7Letter = letter(u7);
  var uncalibrated = (u7Letter === "C" || u7Letter === "D");


  /* ==========================================================================
     SECTION 6 — THE THREE BANKS
     The only things this section actually measures.
     ========================================================================== */

  var beliefMcq  = scale(beliefItems,  4);
  var clmMcq     = scale(clmItems,     4);
  var emotionMcq = scale(emotionItems, 4);

  var beliefC  = blend(beliefMcq,  beliefOpen,  W.mcqShare.belief);
  var emotionC = blend(emotionMcq, emotionOpen, W.mcqShare.emotion);
  var clmC     = blend(clmMcq,     dayOpen,     W.mcqShare.clm);

  var belief_bank  = val(beliefC);
  var emotion_bank = val(emotionC);
  var clm          = val(clmC);


  /* ==========================================================================
     SECTION 7 — FETCHED SCORES
     ========================================================================== */

  var A    = num(agreeableness);
  var ES   = num(emotional_stability);   // used DIRECTLY - already reversed
  var C    = num(conscientiousness);
  var O    = num(openness);
  var R    = num(reasoning);
  var STM  = num(short_term_memory);
  var CONF = num(confidence);
  var SART = num(sart_attention);           // 0-10, or null if not taken
  var PSPEED = num(sart_processing_speed);  // 0-10, Factor 21


  /* ==========================================================================
     SECTION 8 — DERIVED FACTORS, computed in DAG order
     ========================================================================== */

  /* 1. EMOTIONAL INTELLIGENCE
        Must be first: firmness and focus both depend on it. */
  var eiC = combine([
    [emotion_bank, W.ei.emotion_bank],          // primary - must be present
    [A,            W.ei.agreeableness],
    [ES,           W.ei.emotional_stability],
    [R,            W.ei.reasoning]
  ]);
  var ei_score = val(eiC);

  /* 2. FIRMNESS OF BELIEF */
  var firmnessC = combine([
    [belief_bank, W.firmness.belief_bank],      // primary - must be present
    [CONF,        W.firmness.confidence],
    [ES,          W.firmness.emotional_stability],
    [ei_score,    W.firmness.ei]
  ]);
  var firmness_score = val(firmnessC);

  /* 3. FOCUS / ATTENTION SPAN
        Requires at least ONE direct attention measure - SART or CLM.
        SART is preferred: it is performance-based and cannot be faked
        upwards (faking it fast invalidates the session). CLM is
        self-reported behaviour and is the fallback while students are
        still on Google Forms.
        If neither is present the factor is withheld rather than rebuilt
        from memory and reasoning, which would produce a general-ability
        number wearing the label "focus". */
  var focusParts;
  if (SART !== null)      focusParts = [[SART, W.focus.sart], [clm, W.focus.clm]];
  else if (clm !== null)  focusParts = [[clm, W.focus.clm + W.focus.sart]];
  else                    focusParts = [[null, W.focus.clm]];   // forces null

  focusParts = focusParts.concat([
    [STM,      W.focus.short_term_memory],
    [R,        W.focus.reasoning],
    [ei_score, W.focus.ei]
  ]);
  var focusC = combine(focusParts);
  var focus_score = val(focusC);

  /* 4. INFORMED DECISION MAKING */
  var idmC = combine([
    [R,              W.idm.reasoning],          // primary - must be present
    [firmness_score, W.idm.firmness],
    [O,              W.idm.openness]
  ]);
  var informed_decision_making = val(idmC);

  /* 5. CONSISTENCY / GRIT / PERSEVERANCE
        Conscientiousness is the primary input, not a footnote. It appears
        exactly once in the whole model - here - because it was removed
        from focus_score above. */
  var consistencyC = combine([
    [C,                        W.consistency.conscientiousness],  // primary
    [persistence_raw,          W.consistency.persistence_items],
    [focus_score,              W.consistency.focus],
    [informed_decision_making, W.consistency.idm]
  ]);
  var consistency_score = val(consistencyC);


  /* 6. INTRAPERSONAL INTELLIGENCE (Factor 20)
        P7's revisability sub-score is reused here on purpose: knowing what
        would change your own mind IS self-knowledge, so it legitimately
        serves both firmness and intrapersonal. emotion_bank is included
        deliberately too - emotional self-knowledge is a real component of
        intrapersonal intelligence, not an accidental overlap. */
  var p7RevTen = toTen(bRevisability, 3);
  var selfAwarenessC = combine([
    [p33Score,  W.selfAwareness.p33],           // primary - must be present
    [p7RevTen,  W.selfAwareness.p7_revisability]
  ]);
  var self_awareness_bank = val(selfAwarenessC);

  var intrapersonalC = combine([
    [self_awareness_bank, W.intrapersonal.self_awareness_bank],  // primary
    [emotion_bank,        W.intrapersonal.emotion_bank],
    [O,                   W.intrapersonal.openness]
  ]);
  var intrapersonal_intelligence = val(intrapersonalC);


  /* ==========================================================================
     SECTION 9 — CONFIDENCE, propagated along the DAG
     ========================================================================== */

  var cBelief  = dq(beliefC);
  var cEmotion = dq(emotionC);
  var cClm     = dq(clmC);

  var cEi    = propagate(dq(eiC),          [cEmotion]);
  var cFirm  = propagate(dq(firmnessC),    [cBelief, cEi]);
  var cFocus = propagate(dq(focusC),       [cClm, cEi]);
  var cIdm   = propagate(dq(idmC),         [cFirm]);
  var cCons  = propagate(dq(consistencyC), [cFocus, cIdm]);
  var cIntra = propagate(dq(intrapersonalC), [dq(selfAwarenessC), cEmotion]);


  /* ==========================================================================
     SECTION 10 — VALUES PROFILE
     Reported on its own. Never folded into any factor.
     The GAP between how important an area is and how fulfilled the student
     feels in it is the useful signal - it points at what is currently
     pulling them. Report the gaps; do not sum them into a score.
     ========================================================================== */

  var areas      = ["safety", "social", "esteem", "self_actualisation"];
  var fulfilment = [num(p23), num(p24), num(p25), num(p26)];
  var importance = [num(p27), num(p28), num(p29), num(p30)];

  var values_profile = {};
  var biggestGap = null, strongestPull = null;

  for (var i = 0; i < 4; i++) {
    var f = fulfilment[i], im = importance[i];
    var gap = (f === null || im === null) ? null : (im - f);
    values_profile[areas[i]] = { importance: im, fulfilment: f, gap: gap };
    if (gap !== null && (biggestGap === null || gap > biggestGap)) {
      biggestGap = gap;
      strongestPull = areas[i];
    }
  }
  values_profile.strongest_pull = strongestPull;


  /* ==========================================================================
     SECTION 11 — RESPONSE QUALITY FLAGS
     ========================================================================== */

  /* Straight-lining across the emotion block. Only meaningful once you have
     shuffled option order in the form. The emotion_bank guard stops a
     genuinely strong respondent being falsely flagged. */
  var counts = {}, maxSame = 0;
  var emotionRaw = [p14, p15, p16, p17, p18, p19, p20, p21];
  for (var j = 0; j < emotionRaw.length; j++) {
    var L = letter(emotionRaw[j]);
    if (L !== null) {
      counts[L] = (counts[L] || 0) + 1;
      if (counts[L] > maxSame) maxSame = counts[L];
    }
  }

  var llmMissing = [];
  if (beliefOpen  === null) llmMissing.push("p7_belief");
  if (dayOpen     === null) llmMissing.push("p13_dayplan");
  if (emotionOpen === null) llmMissing.push("p22_emotion");
  if (p33Score    === null) llmMissing.push("p33_intrapersonal");

  var p32text = (p32 === null || p32 === undefined) ? "" : String(p32);

  var flags = {
    straightline_emotion: (maxSame >= 6 && emotion_bank !== null && emotion_bank <= 6),

    social_desirability: p32text.toLowerCase().indexOf("never lose momentum") !== -1,

    /* Holds a belief firmly but cannot say what would change their mind.
       Worth naming gently in the report - reporting only the high firmness
       score would amount to praising stubbornness. */
    strong_but_unexamined: (belief_bank !== null && bRevisability !== null &&
                            belief_bank >= 8 && bRevisability <= 1),

    /* High tolerance for uncertainty combined with poor judgement on u7.
       This is risk-seeking without calibration, and it is the one pattern
       in this section that should be named plainly rather than framed as
       a strength. */
    risk_uncalibrated: (uncertainty_tolerance !== null &&
                        uncertainty_tolerance >= 7 && uncalibrated),

    sart_not_taken: (SART === null),

    missing_data: (belief_bank === null || emotion_bank === null || clm === null),
    llm_unscoreable: llmMissing,
    llm_problems: llmProblems,
    unmatched_items: unmatched
  };


  /* ==========================================================================
     SECTION 12 — RETURN
     ========================================================================== */

  return {
    scoring_version: SCORING_VERSION,

    /* --- the three banks this section measures --- */
    belief_bank:  round1(belief_bank),
    emotion_bank: round1(emotion_bank),
    clm:          round1(clm),

    /* --- final factors --- */
    ei_score:                 round1(ei_score),
    firmness_score:           round1(firmness_score),
    focus_score:              round1(focus_score),
    informed_decision_making: round1(informed_decision_making),
    consistency_score:        round1(consistency_score),

    /* --- Factor 20: intrapersonal intelligence --- */
    intrapersonal_intelligence: round1(intrapersonal_intelligence),
    self_awareness_bank:        round1(self_awareness_bank),

    /* --- Factor 21: processing speed. Passed through from SART.
           Reported ALONGSIDE focus, never alone: a fast mean RT bought
           with commission errors is a speed-accuracy trade-off, not
           faster processing. --- */
    processing_speed: (PSPEED === null) ? null : round1(PSPEED),

    /* --- Factor 22: uncertainty tolerance.
           A POSITION, not a level. Low = suited to structured work,
           high = suited to ambiguous work. Neither end is a deficit. --- */
    uncertainty_tolerance: round1(uncertainty_tolerance),
    persistence_raw:       round1(persistence_raw),

    /* DATA QUALITY - not to be confused with the Confidence factor (#16).
     This describes how much of the INPUT was available, not anything
     about the student.
       "full"    every component present
       "partial" something missing, remaining weights renormalised
       null      the directly-measured component was absent, factor withheld */
    data_quality: {
      belief_bank: cBelief, emotion_bank: cEmotion, clm: cClm,
      ei: cEi, firmness: cFirm, focus: cFocus,
      idm: cIdm, consistency: cCons, intrapersonal: cIntra
    },

    /* --- store these: you need them when weights change --- */
    components: {
      belief_mcq:  round1(beliefMcq),  belief_open:  round1(beliefOpen),
      emotion_mcq: round1(emotionMcq), emotion_open: round1(emotionOpen),
      clm_mcq:     round1(clmMcq),     clm_open:     round1(dayOpen),
      belief_subscores:  { reasons: bReasons, evidence: bEvidence,
                           revisability: bRevisability },
      emotion_subscores: { granularity: eGranular, complexity: eComplexity,
                           perspective: ePerspective },
      intrapersonal_subscores: { specificity: iSpecific, causal_insight: iCausal,
                                 integration: iIntegration },
      sart_attention: SART
    },

    /* --- narrative only --- */
    values_profile:   values_profile,
    belief_category:  p31 || null,
    momentum_blocker: p32 || null,

    flags: flags
  };
}
