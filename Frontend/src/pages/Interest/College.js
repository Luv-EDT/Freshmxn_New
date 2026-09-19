import LifeStageSection from "./LifeStageSection"
import { ACTIVITY_REFERENCE_LISTS } from "./activityReferenceLists"
import { PROBLEM_PROMPTS } from "./problemPrompts"

// text ported unchanged from virtual-career-counselling College.jsx
const STAGE = {
    heading: "🎓 College Activities",
    subtitle: "Think back to your college years. What activities did you enjoy?",
    isSkippable: false,
    referenceList: ACTIVITY_REFERENCE_LISTS.college,
    prompts: PROBLEM_PROMPTS.college,
    placeholders: {
        personalGrowth: "e.g., Club president, internship experience",
        curiosityDriven: "e.g., Research projects, case competitions",
        individualInternalProblems: ["e.g., Fear of networking", "e.g., Joining professional clubs"],
        interpersonalInternalProblems: ["e.g., Group project conflicts", "e.g., Team leadership roles"],
        externalProblems: ["e.g., Campus sustainability issues", "e.g., Organizing sustainability club"],
        socialRecognition: "e.g., Winning case competition",
        effortlessEngagement: "e.g., Playing intramural sports",
    },
    help: {
        personalGrowth: ["Activities that helped you develop confidence, discipline, or self-awareness.", "Examples: leadership roles, overcoming fears, learning new skills.", "Write short, specific answers."],
        curiosityDriven: ["Activities that made you ask questions or explore new things.", "Examples: research projects, reading books, asking \"why\" questions.", "Write short, specific answers."],
        individualInternalProblems: [{ strong: "Personal challenges:", text: "Self-doubt, fear, lack of skills, or confusion." }, "Describe the problem briefly, then list activities that helped you overcome it.", "Examples: fear of public speaking → joining debate club"],
        interpersonalInternalProblems: [{ strong: "Relationship challenges:", text: "Issues with family, friends, or social pressure." }, "Describe the problem briefly, then list activities that helped you overcome it.", "Examples: peer pressure → joining positive groups"],
        externalProblems: [{ strong: "Community or environmental issues:", text: "Problems you noticed around you." }, "Describe the problem briefly, then list activities you took to help.", "Examples: plastic waste → organizing clean-up drives"],
        socialRecognition: ["Activities where you felt appreciated, recognized, or praised by others.", "Examples: winning competitions, receiving awards, being thanked.", "Write short, specific answers."],
        effortlessEngagement: ["Activities that felt natural, fun, and easy — where time flew by.", "Examples: playing games, drawing, reading stories.", "Don't overthink — just what felt enjoyable."],
        additionalInterests: ["Any other activities you enjoyed that weren't covered above.", "Write the activity and briefly why you liked it.", "Keep answers short and specific."],
    },
}

function College(props) {
    return <LifeStageSection {...props} stage={STAGE} />
}

export default College
