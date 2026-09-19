import LifeStageSection from "./LifeStageSection"
import { ACTIVITY_REFERENCE_LISTS } from "./activityReferenceLists"
import { PROBLEM_PROMPTS } from "./problemPrompts"

// text ported unchanged from virtual-career-counselling PostCollege.jsx.
// The old heading's "(Only to be filled by those who have finished/left college)" is gone —
// the journey now decides who sees this section.
const STAGE = {
    heading: "💼 Post-College Activities",
    subtitle: "Think back to your post-college years. What activities did you enjoy?",
    isSkippable: false,
    referenceList: ACTIVITY_REFERENCE_LISTS.postCollege,
    prompts: PROBLEM_PROMPTS.postCollege,
    placeholders: {
        personalGrowth: "e.g., Leadership training program, career promotion",
        curiosityDriven: "e.g., Learning Python programming, taking online courses",
        individualInternalProblems: ["e.g., Career uncertainty", "e.g., Professional development courses"],
        interpersonalInternalProblems: ["e.g., Work-life balance issues", "e.g., Time management workshops"],
        externalProblems: ["e.g., Financial constraints", "e.g., Budgeting strategies"],
        socialRecognition: "e.g., Employee of the year award",
        effortlessEngagement: "e.g., Mentoring junior colleagues",
    },
    help: {
        personalGrowth: ["Activities that helped you develop confidence, discipline, or self-awareness.", "Examples: leadership training, career advancement, skill development.", "Write short, specific answers."],
        curiosityDriven: ["Activities that made you ask questions or explore new things.", "Examples: online courses, reading books, learning new skills.", "Write short, specific answers."],
        individualInternalProblems: [{ strong: "Personal challenges:", text: "Self-doubt, fear, lack of skills, or confusion." }, "Describe the problem briefly, then list activities that helped you overcome it.", "Examples: career uncertainty → professional development courses"],
        interpersonalInternalProblems: [{ strong: "Relationship challenges:", text: "Issues with family, friends, or social pressure." }, "Describe the problem briefly, then list activities that helped you overcome it.", "Examples: work-life balance → time management strategies"],
        externalProblems: [{ strong: "Community or environmental issues:", text: "Problems you noticed around you." }, "Describe the problem briefly, then list activities you took to help.", "Examples: financial constraints → budgeting strategies"],
        socialRecognition: ["Activities where you felt appreciated, recognized, or praised by others.", "Examples: promotions, awards, leadership positions.", "Write short, specific answers."],
        effortlessEngagement: ["Activities that felt natural, fun, and easy — where time flew by.", "Examples: mentoring, creative projects, hobbies.", "Don't overthink — just what felt enjoyable."],
        additionalInterests: ["Any other activities you enjoyed that weren't covered above.", "Write the activity and briefly why you liked it.", "Keep answers short and specific."],
    },
}

function PostCollege(props) {
    return <LifeStageSection {...props} stage={STAGE} />
}

export default PostCollege
