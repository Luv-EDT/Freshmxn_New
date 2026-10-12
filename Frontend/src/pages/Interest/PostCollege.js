import LifeStageSection from "./LifeStageSection"
import { ACTIVITY_REFERENCE_LISTS } from "./activityReferenceLists"
import { PROBLEM_PROMPTS } from "./problemPrompts"

// text first ported from virtual-career-counselling PostCollege.jsx.
// The old heading's "(Only to be filled by those who have finished/left college)" is gone —
// the journey now decides who sees this section.
// Round 28 (owner): the prompts are crisp, and "noticed or praised" asks for the ACTIVITY people
// praised, never the prize or award it led to
const STAGE = {
    heading: "💼 Post-College Activities",
    subtitle: "Since college — at work and outside it.",
    isSkippable: false,
    referenceList: ACTIVITY_REFERENCE_LISTS.postCollege,
    prompts: PROBLEM_PROMPTS.postCollege,
    placeholders: {
        personalGrowth: "e.g., Leadership training program, career promotion",
        curiosityDriven: "e.g., Learning Python programming, taking online courses",
        individualInternalProblems: ["e.g., Career uncertainty", "e.g., Professional development courses"],
        interpersonalInternalProblems: ["e.g., Work-life balance issues", "e.g., Time management workshops"],
        externalProblems: ["e.g., Financial constraints", "e.g., Budgeting strategies"],
        socialRecognition: "e.g., Training new joiners",
        effortlessEngagement: "e.g., Mentoring junior colleagues",
    },
    help: {
        personalGrowth: ["What you did that made you braver, more disciplined or more sure of yourself.", "Examples: leading a team, changing jobs, learning a new skill, managing your own money."],
        curiosityDriven: ["What you explored just because you were curious.", "Examples: online courses, side projects, learning a language, reading."],
        individualInternalProblems: [{ strong: "Personal challenges:", text: "Self-doubt, fear, lack of skills, or confusion." }, "Describe the problem briefly, then list activities that helped you overcome it.", "Examples: career uncertainty → professional development courses"],
        interpersonalInternalProblems: [{ strong: "Relationship challenges:", text: "Issues with family, friends, or social pressure." }, "Describe the problem briefly, then list activities that helped you overcome it.", "Examples: work-life balance → time management strategies"],
        externalProblems: [{ strong: "Community or environmental issues:", text: "Problems you noticed around you." }, "Describe the problem briefly, then list activities you took to help.", "Examples: financial constraints → budgeting strategies"],
        socialRecognition: ["What you DID that people noticed or praised — the activity, not the reward.", "Examples: training new joiners, fixing a broken process, handling tough clients, writing reports."],
        effortlessEngagement: ["What felt easy and fun — where time flew.", "Examples: mentoring, creative projects, sport, cooking."],
        additionalInterests: ["Anything else you enjoyed doing — write the activity and why.", "Examples: volunteering, travel, a hobby."],
    },
}

function PostCollege(props) {
    return <LifeStageSection {...props} stage={STAGE} />
}

export default PostCollege
