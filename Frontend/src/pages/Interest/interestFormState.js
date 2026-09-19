import stringSimilarity from "string-similarity"

// Everything the interest form knows about its data, kept out of the components:
//   - the initial state (ported from virtual-career-counselling App.jsx)
//   - which steps a student sees for their journey
//   - the extraction + dedupe pipeline that feeds Current Interests / Persistent Challenges
//   - converting the form state to the shape saved in submissions.interest, and back

export const LIFE_STAGE_KEYS = ["postCollege", "college", "highSchool", "preHighSchool"]
export const PROBLEM_GROUPS = ["individualInternalProblems", "interpersonalInternalProblems", "externalProblems"]
const ACTIVITY_GROUPS = ["personalGrowth", "curiosityDriven", "socialRecognition", "effortlessEngagement"]

export const YOU_OR_THEM_OPTIONS = [
    "Internal (self-doubt, fear, lack of clarity, difficult to handle, lacked skills etc)",
    "Interpersonal (influence or pressure from family, friends, mentors, etc.)",
    "External (financial constraints, lack of opportunities, systemic issues, etc.)",
]

// Current Interests has a 4th option; Current Challenges uses only the first 3 (ported as-is)
export const YOU_OR_THEM_OPTIONS_WITH_TIME = [...YOU_OR_THEM_OPTIONS, "Time constraints/Phase of life ended"]

// Map youOrThem values to corresponding problem categories.
// "Time constraints/Phase of life ended" is an external circumstance, not something about the
// student — without this line it fell through to "none" and the answer silently disappeared
// from the challenges checklist.
const REASON_MAP = {
    [YOU_OR_THEM_OPTIONS[0]]: "individualInternalProblems",
    [YOU_OR_THEM_OPTIONS[1]]: "interpersonalInternalProblems",
    [YOU_OR_THEM_OPTIONS[2]]: "externalProblems",
    [YOU_OR_THEM_OPTIONS_WITH_TIME[3]]: "externalProblems",
}


// ─── Initial state ───────────────────────────────────────────────────────────

const createProblemRow = () => ({ problem: "", source: "typed", activities: [""] })

const createLifeStage = () => ({
    personalGrowth: [""],
    curiosityDriven: [""],
    individualInternalProblems: [createProblemRow()],
    interpersonalInternalProblems: [createProblemRow()],
    externalProblems: [createProblemRow()],
    socialRecognition: [""],
    effortlessEngagement: [""],
    additionalInterests: [{ activity: "", reason: "" }],
})

export const createInitialFormState = () => ({
    preHighSchool: { ...createLifeStage(), skipped: false },
    highSchool: createLifeStage(),
    college: createLifeStage(),
    postCollege: createLifeStage(),

    currentInterests: {
        persistentInterests: [],    // [{ activity, confidence }]
        longTermPursuits: [],
        discontinuedPursuits: {},   // keyed by activity while editing; saved as an array
        achievementRelated: {},     // keyed by activity while editing; saved as an array
        passion: [],
    },

    currentChallenges: {
        presentConcerns: [],
    },

    persistentProblems: {
        internal: [],
        interpersonal: [],
        external: [],
    },

    backgroundInfo: {
        competitionPreference: "",
        competitionActions: "",
        parentEducation1: "",
        parentEducation2: "",
        parentProfession1: "",
        parentProfession2: "",
        financialSituationGrowingUp: "",
        financialSituationCurrent: "",
        parentsNativePlace1: "",
        parentsNativePlace2: "",
        culturalIdentity: [""],     // an array now (was one comma-separated string)
        disability: "",
        disabilitySpecify: "",
        academicClassification: "",
        familyTrauma: "",
        familyTraumaSpecify: "",
        personalTrauma: "",
        personalTraumaSpecify: "",
        supportNetwork: [""],
    },

    aspirationalProfessions: [{ professionText: "", professionId: null }],
})

// fills any missing/empty piece with its default, so a saved draft or an old submission always renders
const normalizeLifeStage = (stage) => {
    const normalized = { ...stage }

    ACTIVITY_GROUPS.forEach((group) => {
        if (!Array.isArray(normalized[group]) || normalized[group].length === 0) normalized[group] = [""]
    })

    PROBLEM_GROUPS.forEach((group) => {
        if (!Array.isArray(normalized[group]) || normalized[group].length === 0) {
            normalized[group] = [createProblemRow()]
        } else {
            normalized[group] = normalized[group].map((row) => ({
                problem: row.problem || "",
                source: row.source || "typed",
                activities: Array.isArray(row.activities) && row.activities.length > 0 ? row.activities : [""],
            }))
        }
    })

    if (!Array.isArray(normalized.additionalInterests) || normalized.additionalInterests.length === 0) {
        normalized.additionalInterests = [{ activity: "", reason: "" }]
    }

    return normalized
}

export const normalizeFormState = (saved) => {
    const initial = createInitialFormState()

    if (!saved || typeof saved !== "object") return initial

    const merged = { ...initial }

    LIFE_STAGE_KEYS.forEach((key) => {
        merged[key] = normalizeLifeStage({ ...initial[key], ...(saved[key] || {}) })
    })

    merged.currentInterests = { ...initial.currentInterests, ...(saved.currentInterests || {}) }
    merged.currentChallenges = { ...initial.currentChallenges, ...(saved.currentChallenges || {}) }
    merged.persistentProblems = { ...initial.persistentProblems, ...(saved.persistentProblems || {}) }
    merged.backgroundInfo = { ...initial.backgroundInfo, ...(saved.backgroundInfo || {}) }

    // older drafts stored culturalIdentity as one comma-separated string
    if (typeof merged.backgroundInfo.culturalIdentity === "string") {
        merged.backgroundInfo.culturalIdentity = merged.backgroundInfo.culturalIdentity.split(",").map((place) => place.trim())
    }

    ;["culturalIdentity", "supportNetwork"].forEach((field) => {
        if (!Array.isArray(merged.backgroundInfo[field]) || merged.backgroundInfo[field].length === 0) {
            merged.backgroundInfo[field] = [""]
        }
    })

    merged.aspirationalProfessions = Array.isArray(saved.aspirationalProfessions) && saved.aspirationalProfessions.length > 0
        ? saved.aspirationalProfessions
        : initial.aspirationalProfessions

    return merged
}


// ─── Which steps a student sees ──────────────────────────────────────────────

// "done" is the thank-you page, which replaces the old submit page — every section is already
// saved as it is left.
export const ALL_STEPS = [
    { key: "intro", title: "Start" },
    { key: "post-college", title: "Post-College", lifeStage: "postCollege" },
    { key: "college", title: "College", lifeStage: "college" },
    { key: "high-school", title: "High School", lifeStage: "highSchool" },
    { key: "pre-high-school", title: "Pre-High School", lifeStage: "preHighSchool" },
    { key: "current-interests", title: "Current Interests" },
    { key: "challenges", title: "Your Challenges" },
    { key: "background", title: "Background Information" },
    { key: "aspirations", title: "Aspirations" },
    { key: "done", title: "Done" },
]

// school students: High School + Pre-High School only. College appears once enrolled; Post-College when working.
export const getVisibleLifeStages = (user) => {
    const journey = user?.journey
    const isEnrolledInCollege = journey === "college" && user?.journeyDetail?.collegeStage === "enrolled"
    const stages = []

    if (journey === "early_professional") stages.push("postCollege")
    if (journey === "early_professional" || isEnrolledInCollege) stages.push("college")
    stages.push("highSchool", "preHighSchool")

    return stages
}

// the intro is shown every time the form is opened, first visit or an edit — the instructions are
// as easy to forget as they are to miss
export const getVisibleSteps = (user) => {
    const stages = getVisibleLifeStages(user)

    return ALL_STEPS.filter((step) => !step.lifeStage || stages.includes(step.lifeStage))
}

// "How did you approach your transition from school to college?" — not for someone still in school
export const showsAcademicClassification = (user) => {
    return user?.journey === "college" || user?.journey === "early_professional"
}


// ─── Extraction + dedupe (ported from App.jsx) ───────────────────────────────

export const normalize = (text) =>
    text?.toLowerCase().trim().replace(/\s+/g, " ") ?? ""

// Function to deduplicate activities and problems
// Can handle both arrays of strings and arrays of objects with a specified key
const deduplicate = (arr, key = "activity", threshold = 0.75) => {
    if (!arr || !Array.isArray(arr)) return []

    // Check if we're dealing with an array of strings or array of objects
    const isArrayOfStrings = arr.length > 0 && typeof arr[0] === "string"

    // First, filter out empty items
    const filteredArr = isArrayOfStrings
        ? arr.filter((item) => typeof item === "string" && item.trim() !== "")
        : arr.filter((item) => {
            if (!item || typeof item !== "object") return false
            const value = item[key]
            return value && typeof value === "string" && value.trim() !== ""
        })

    if (filteredArr.length <= 1) return filteredArr

    const unique = []
    const similarityGroups = {}

    filteredArr.forEach((item) => {
        // Get the value to compare (either the string itself or the property value)
        const value = isArrayOfStrings ? item : item[key]
        const normalizedCurrent = normalize(value)

        // Skip if it's an empty string after normalization
        if (!normalizedCurrent) return

        let bestMatchKey = null
        let bestMatchRating = 0

        // Find the best match among existing groups
        Object.keys(similarityGroups).forEach((groupKey) => {
            const similarity = stringSimilarity.compareTwoStrings(normalizedCurrent, groupKey)
            if (similarity > threshold && similarity > bestMatchRating) {
                bestMatchRating = similarity
                bestMatchKey = groupKey
            }
        })

        if (bestMatchKey) {
            // Add to existing similarity group
            similarityGroups[bestMatchKey].push(item)
        } else {
            // Create new similarity group
            similarityGroups[normalizedCurrent] = [item]
        }
    })

    // For each group, take the first item as the representative
    Object.values(similarityGroups).forEach((group) => {
        if (group.length > 0) {
            unique.push(group[0])
        }
    })

    // console.log(`Deduplicated from ${arr.length} to ${unique.length} items`)
    return unique
}

// only the life stages this student sees count — and a skipped Pre-High School contributes nothing
export const extractInterestData = (formState, visibleLifeStages) => {
    if (!formState) return { extractedActivities: [], extractedProblems: [] }

    const extractedActivities = []
    const extractedProblems = []

    // same order as the original ("college", "postCollege", "highSchool", "preHighSchool") — dedupe keeps the first
    const categories = ["college", "postCollege", "highSchool", "preHighSchool"].filter((section) => {
        if (!visibleLifeStages.includes(section)) return false
        if (section === "preHighSchool" && formState.preHighSchool?.skipped) return false
        return true
    })

    categories.forEach((section) => {
        const data = formState[section]
        if (!data) return

        // Simple activity arrays
        ACTIVITY_GROUPS.forEach((key) => {
            data[key]?.forEach((act) => {
                if (normalize(act)) {
                    extractedActivities.push({ activity: normalize(act), reason: key })
                }
            })
        })

        // Additional interests
        data.additionalInterests?.forEach(({ activity, reason }) => {
            if (normalize(activity)) {
                extractedActivities.push({
                    activity: normalize(activity),
                    reason: normalize(reason || "additionalInterests"),
                })
            }
        })

        // Problem-based keys
        PROBLEM_GROUPS.forEach((key) => {
            data[key]?.forEach(({ problem, activities }) => {
                if (normalize(problem)) {
                    extractedProblems.push({ problem: normalize(problem), reason: key, activityFailure: false })
                }
                activities?.forEach((act) => {
                    if (normalize(act)) {
                        extractedActivities.push({ activity: normalize(act), reason: key })
                    }
                })
            })
        })
    })

    // Discontinued pursuits add the reasons people stopped as problems
    Object.values(formState.currentInterests?.discontinuedPursuits || {}).forEach((item) => {
        if (!item.isSelected) return

        // Handle otherReason when "Other" is in the reason array
        if (item.reason && item.reason.includes("Other") && item.otherReason) {
            extractedProblems.push({
                problem: `${normalize(item.otherReason)}*`,
                reason: REASON_MAP[item.youOrThem] || "none",
                activityFailure: true,
            })
        }

        // Other reasons in the reason array - exclude "Other" and the 4th option
        if (item.reason && Array.isArray(item.reason)) {
            item.reason.forEach((reasonItem) => {
                if (reasonItem !== "Other" && reasonItem !== "Time constraints/Phase of life ended") {
                    const existingProblem = extractedProblems.find((obj) => obj.problem === normalize(reasonItem))
                    if (existingProblem) {
                        existingProblem.activityFailure = true
                    } else {
                        extractedProblems.push({
                            problem: normalize(reasonItem),
                            reason: "discontinuedPursuits",
                            activityFailure: true,
                        })
                    }
                }
            })
        }
    })

    // Current Challenges
    ;(formState.currentChallenges?.presentConcerns || [])
        .filter((item) => item.problem && item.problem.trim() !== "")
        .forEach((item) => {
            extractedProblems.push({
                problem: normalize(item.problem),
                reason: REASON_MAP[item.youOrThem] || "none",
                activityFailure: false,
            })
        })

    return {
        extractedActivities: deduplicate(extractedActivities, "activity", 0.8),
        extractedProblems: deduplicate(extractedProblems, "problem", 0.8),
    }
}

// Cleanup: remove Current Interests selections whose activity no longer exists (ported from CurrentInterests.jsx)
export const cleanupCurrentInterests = (currentInterests, extractedActivities, extractedProblems) => {
    const availableActivities = new Set(extractedActivities.map((item) => item.activity))
    const cleanedFormData = { ...currentInterests }
    const removedOtherReasons = []

    cleanedFormData.persistentInterests = (cleanedFormData.persistentInterests || []).filter((item) =>
        availableActivities.has(item.activity)
    )
    cleanedFormData.longTermPursuits = (cleanedFormData.longTermPursuits || []).filter((activity) =>
        availableActivities.has(activity)
    )
    cleanedFormData.passion = (cleanedFormData.passion || []).filter((activity) =>
        availableActivities.has(activity)
    )

    const originalDiscontinued = cleanedFormData.discontinuedPursuits || {}
    cleanedFormData.discontinuedPursuits = Object.keys(originalDiscontinued)
        .filter((activity) => {
            const isAvailable = availableActivities.has(activity)
            if (!isAvailable) {
                const activityData = originalDiscontinued[activity]
                if (activityData && activityData.otherReason && activityData.otherReason.trim() !== "") {
                    removedOtherReasons.push(activityData.otherReason)
                }
            }
            return isAvailable
        })
        .reduce((obj, key) => {
            obj[key] = originalDiscontinued[key]
            return obj
        }, {})

    const originalAchievement = cleanedFormData.achievementRelated || {}
    cleanedFormData.achievementRelated = Object.keys(originalAchievement)
        .filter((activity) => availableActivities.has(activity))
        .reduce((obj, key) => {
            obj[key] = originalAchievement[key]
            return obj
        }, {})

    // Clean up extractedProblems by removing the collected otherReason values
    let cleanedExtractedProblems = [...extractedProblems]
    if (removedOtherReasons.length > 0) {
        cleanedExtractedProblems = extractedProblems.filter((problem) =>
            !removedOtherReasons.some((otherReason) =>
                problem.problem === otherReason || problem.reason === otherReason
            )
        )
    }

    return { cleanedFormData, cleanedExtractedProblems }
}


// ─── Form state ⇄ submissions.interest ───────────────────────────────────────

export const buildSubmissionInterest = (formState, extractedActivities, extractedProblems, user) => {
    const visibleLifeStages = getVisibleLifeStages(user)
    const { cleanedFormData, cleanedExtractedProblems } = cleanupCurrentInterests(
        formState.currentInterests,
        extractedActivities,
        extractedProblems
    )

    const interest = {}

    // Life stages — only the ones this student was shown
    visibleLifeStages.forEach((stage) => {
        if (stage === "preHighSchool" && formState.preHighSchool.skipped) {
            interest.preHighSchool = { skipped: true }
            return
        }
        interest[stage] = { ...formState[stage] }
        if (stage === "preHighSchool") interest.preHighSchool.skipped = false
    })

    // Aspirations — asked last, fed into persistent interests at Medium confidence, flagged so the bias stays visible
    const aspirationalProfessions = (formState.aspirationalProfessions || [])
        .filter((row) => row.professionText && row.professionText.trim() !== "")
        .map((row) => ({ professionText: row.professionText.trim(), professionId: row.professionId || null }))

    const aspirationInterests = aspirationalProfessions.map((row) => ({
        activity: normalize(row.professionText),
        confidence: "Medium",
        source: "aspiration",
    }))

    interest.currentInterests = {
        persistentInterests: [
            ...cleanedFormData.persistentInterests.map((item) => ({ ...item, source: "activity" })),
            ...aspirationInterests,
        ],
        passion: cleanedFormData.passion,
        longTermPursuits: cleanedFormData.longTermPursuits,
        // objects keyed by activity text → arrays (Mongo keys can't contain dots)
        discontinuedPursuits: Object.entries(cleanedFormData.discontinuedPursuits)
            .filter(([, data]) => data.isSelected)
            .map(([activity, data]) => ({
                activity,
                reason: data.reason || [],
                otherReason: data.otherReason || "",
                youOrThem: data.youOrThem || "",
            })),
        achievementRelated: Object.entries(cleanedFormData.achievementRelated)
            .filter(([, data]) => data.isSelected)
            .map(([activity, data]) => ({ activity, achievement: data.achievement || "" })),
    }

    interest.currentChallenges = {
        presentConcerns: (formState.currentChallenges.presentConcerns || []).map((item) => ({
            problem: item.problem,
            youOrThem: item.youOrThem,
            source: "typed",
        })),
    }

    interest.persistentProblems = formState.persistentProblems

    interest.backgroundInfo = { ...formState.backgroundInfo }
    if (!showsAcademicClassification(user)) {
        delete interest.backgroundInfo.academicClassification
    }

    interest.aspirationalProfessions = aspirationalProfessions
    interest.extractedActivities = extractedActivities
    interest.extractedProblems = cleanedExtractedProblems

    return interest
}

// a previously submitted form back into editable state
export const fromSubmissionInterest = (interest) => {
    if (!interest) return createInitialFormState()

    const saved = { ...interest }
    const currentInterests = interest.currentInterests || {}

    saved.currentInterests = {
        persistentInterests: (currentInterests.persistentInterests || [])
            .filter((item) => item.source !== "aspiration")     // rebuilt from aspirationalProfessions on submit
            .map((item) => ({ activity: item.activity, confidence: item.confidence || "" })),
        passion: currentInterests.passion || [],
        longTermPursuits: currentInterests.longTermPursuits || [],
        discontinuedPursuits: (currentInterests.discontinuedPursuits || []).reduce((obj, item) => {
            obj[item.activity] = { isSelected: true, reason: item.reason || [], otherReason: item.otherReason || "", youOrThem: item.youOrThem || "" }
            return obj
        }, {}),
        achievementRelated: (currentInterests.achievementRelated || []).reduce((obj, item) => {
            obj[item.activity] = { isSelected: true, achievement: item.achievement || "" }
            return obj
        }, {}),
    }

    return normalizeFormState(saved)
}
