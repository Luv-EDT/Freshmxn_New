import LifeStageSection from "./LifeStageSection"
import { ACTIVITY_REFERENCE_LISTS } from "./activityReferenceLists"
import { PROBLEM_PROMPTS } from "./problemPrompts"

// text first ported from virtual-career-counselling College.jsx
// Round 28 (owner): the prompts are crisp, and "noticed or praised" asks for the ACTIVITY people
// praised, never the prize or award it led to
const STAGE = {
    heading: "🎓 College Activities",
    subtitle: "Your college years — classes, clubs, internships, life outside.",
    isSkippable: false,
    referenceList: ACTIVITY_REFERENCE_LISTS.college,
    prompts: PROBLEM_PROMPTS.college,
    placeholders: {
        personalGrowth: "e.g., Club president, internship experience",
        curiosityDriven: "e.g., Research projects, case competitions",
        individualInternalProblems: ["e.g., Fear of networking", "e.g., Joining professional clubs"],
        interpersonalInternalProblems: ["e.g., Group project conflicts", "e.g., Team leadership roles"],
        externalProblems: ["e.g., Campus sustainability issues", "e.g., Organizing sustainability club"],
        socialRecognition: "e.g., Running the college fest's sponsorship",
        effortlessEngagement: "e.g., Playing intramural sports",
    },
    help: {
        personalGrowth: ["What you did that made you braver, more disciplined or more sure of yourself.", "Examples: running a club, an internship, living on your own, a part-time job."],
        curiosityDriven: ["What you explored just because you were curious.", "Examples: research projects, online courses, case competitions, building something."],
        individualInternalProblems: [{ strong: "Personal challenges:", text: "Self-doubt, fear, lack of skills, or confusion." }, "Describe the problem briefly, then list activities that helped you overcome it.", "Examples: fear of public speaking → joining debate club"],
        interpersonalInternalProblems: [{ strong: "Relationship challenges:", text: "Issues with family, friends, or social pressure." }, "Describe the problem briefly, then list activities that helped you overcome it.", "Examples: peer pressure → joining positive groups"],
        externalProblems: [{ strong: "Community or environmental issues:", text: "Problems you noticed around you." }, "Describe the problem briefly, then list activities you took to help.", "Examples: plastic waste → organizing clean-up drives"],
        socialRecognition: ["What you DID that people noticed or praised — the activity, not the prize.", "Examples: running a club event, tutoring juniors, designing posters, leading a project."],
        effortlessEngagement: ["What felt easy and fun — where time flew.", "Examples: sports, music, writing, organising trips."],
        additionalInterests: ["Anything else you enjoyed doing — write the activity and why.", "Examples: volunteering, travel, a hobby you picked up."],
    },
}

function College(props) {
    return <LifeStageSection {...props} stage={STAGE} />
}

export default College
