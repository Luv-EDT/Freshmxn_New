// The chips under each profession — why this one is on the student's list, in their own terms.
//
// THERE IS NO TAG FIELD IN THE DATA. Every chip below is a join the engine already made and then
// left sitting in the payload unused. That is the whole idea: the report stops being a ranking with
// a number beside it and starts being a ranking that says what it was built from.
//
// EACH CHIP MUST BE TRUE OF THIS STUDENT AND THIS PROFESSION. A chip that could appear on anybody's
// report is decoration, and the report already has a rule against sentences that fit everyone.

// The seven-word vocabulary shared by the student's dominant reasons and every profession's
// `drivingReasons` — the two come from byte-identical lists, so the join is exact.
const REASON_WORDS = {
    curiosityDriven: "curiosity",
    personalGrowth: "getting better at things",
    socialRecognition: "being recognised",
    effortlessEngagement: "losing track of time",
    individualInternalProblems: "problems you have faced",
    interpersonalInternalProblems: "problems between people",
    externalProblems: "problems out in the world",
}

const MAX_CHIPS = 3

// ⚠ THE REASON JOIN IS COMPUTED HERE, NOT READ FROM `reasonOverlap`.
//
// `entry.reasonOverlap` looks like exactly the right field and is a trap: program2 sets it to `[]`
// for every list-"A" profession before it is ever computed — those are the strongest-evidence
// matches, so the professions that most deserve a chip would be the only ones without one. It is
// also a ranking input over there (it decides B vs C), and one value serving as both a score input
// and a student-facing explanation drifts apart the first time either changes.
//
// The overlap below is descriptive only. It says the student and the profession share a motivation;
// it never claims that is why the profession ranked.
const sharedReasons = (entry, dominantReasons) => {
    const mine = dominantReasons || []
    const theirs = entry.drivingReasons || []
    return theirs.filter((reason) => mine.includes(reason))
}

export const chipsFor = (entry, dominantReasons) => {
    const chips = []

    // Strongest first: a thing the student actually does that led here.
    if (entry.matchedBy && entry.matchedBy.length > 0) {
        const activity = entry.matchedBy[0].activity
        if (activity) chips.push(`From your ${activity}`)
    }

    // They told us they wanted this by name.
    if (entry.fromAspiration || entry.namedDirectly) chips.push("You named this")

    // A motivation the student and the profession share.
    const shared = sharedReasons(entry, dominantReasons)
    if (shared.length > 0 && REASON_WORDS[shared[0]]) {
        chips.push(`Driven by ${REASON_WORDS[shared[0]]}, like you`)
    }

    // A measured strength this profession leans on. Already humanised by reportsRouter.
    if (entry.supportingFactors && entry.supportingFactors.length > 0) {
        chips.push(`Your ${entry.supportingFactors[0].factor}`)
    }

    // Long-pursued rather than recent — the evidence the A-list is built on.
    if (chips.length < MAX_CHIPS && entry.matchedBy && entry.matchedBy.some((hit) => hit.longTerm)) {
        chips.push("Something you have stuck with")
    }

    return chips.slice(0, MAX_CHIPS)
}

// A one-line summary of what the student's own tags are, shown once above the list so the chips
// below have a referent.
export const studentTags = (dominantReasons) => (dominantReasons || [])
    .map((reason) => REASON_WORDS[reason])
    .filter(Boolean)
