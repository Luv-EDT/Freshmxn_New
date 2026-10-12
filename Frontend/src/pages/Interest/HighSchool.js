import LifeStageSection from "./LifeStageSection"
import { ACTIVITY_REFERENCE_LISTS } from "./activityReferenceLists"
import { PROBLEM_PROMPTS } from "./problemPrompts"

// text first ported from virtual-career-counselling HighSchool.jsx
// Round 28 (owner): the prompts are crisp, and "noticed or praised" asks for the ACTIVITY people
// praised, never the prize or award it led to
const STAGE = {
    heading: "🎓 High School",
    subtitle: "9th to 12th standard — in class, after school, at home.",
    isSkippable: false,
    referenceList: ACTIVITY_REFERENCE_LISTS.highSchool,
    prompts: PROBLEM_PROMPTS.highSchool,
    placeholders: {
        personalGrowth: "e.g., Student council president, learning guitar",
        curiosityDriven: "e.g., Science projects, debate club",
        individualInternalProblems: ["e.g., Fear of speaking in public", "e.g., Joining debate club"],
        interpersonalInternalProblems: ["e.g., Peer pressure to skip studies", "e.g., Joining study group"],
        externalProblems: ["e.g., Plastic waste in school", "e.g., Organizing clean-up drive"],
        socialRecognition: "e.g., Explaining maths to classmates",
        effortlessEngagement: "e.g., Playing basketball with friends",
    },
    help: {
        personalGrowth: ["What you did that made you braver, more disciplined or more sure of yourself.", "Examples: student council, learning guitar, coaching juniors, preparing for an exam on your own."],
        curiosityDriven: ["What you explored just because you were curious.", "Examples: science projects, coding small apps, debating, reading about space or history."],
        individualInternalProblems: [{ strong: "Personal challenges:", text: "Self-doubt, fear, lack of skills, or confusion." }, "Describe the problem briefly, then list activities that helped you overcome it.", "Examples: fear of public speaking → joining debate club"],
        interpersonalInternalProblems: [{ strong: "Relationship challenges:", text: "Issues with family, friends, or social pressure." }, "Describe the problem briefly, then list activities that helped you overcome it.", "Examples: peer pressure → joining positive groups"],
        externalProblems: [{ strong: "Community or environmental issues:", text: "Problems you noticed around you." }, "Describe the problem briefly, then list activities you took to help.", "Examples: plastic waste → organizing clean-up drives"],
        socialRecognition: ["What you DID that people noticed or praised — the activity, not the prize.", "Examples: explaining maths to friends, organising a fest stall, debating, designing the class magazine."],
        effortlessEngagement: ["What felt easy and fun — where time flew.", "Examples: playing basketball, sketching, editing videos, cooking."],
        additionalInterests: ["Anything else you enjoyed doing — write the activity and why.", "Examples: volunteering, photography, a part-time job."],
    },
}

function HighSchool(props) {
    return <LifeStageSection {...props} stage={STAGE} />
}

export default HighSchool
