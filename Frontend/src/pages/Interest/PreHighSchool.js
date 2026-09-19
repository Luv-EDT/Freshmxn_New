import LifeStageSection from "./LifeStageSection"
import { ACTIVITY_REFERENCE_LISTS } from "./activityReferenceLists"
import { PROBLEM_PROMPTS } from "./problemPrompts"

// text ported unchanged from virtual-career-counselling PreHighSchool.jsx
const STAGE = {
    heading: "🧒 Pre-High School",
    subtitle: "Think back to your childhood before 9th standard. What activities did you enjoy?",
    isSkippable: true,
    referenceList: ACTIVITY_REFERENCE_LISTS.preHighSchool,
    prompts: PROBLEM_PROMPTS.preHighSchool,
    placeholders: {
        personalGrowth: "e.g., Class monitor, learning to swim",
        curiosityDriven: "e.g., Science projects, exploring nature",
        individualInternalProblems: ["e.g., Fear of speaking in public", "e.g., Joining debate club"],
        interpersonalInternalProblems: ["e.g., Peer pressure to skip studies", "e.g., Joining study group"],
        externalProblems: ["e.g., Plastic waste in school", "e.g., Organizing clean-up drive"],
        socialRecognition: "e.g., Winning drawing competition",
        effortlessEngagement: "e.g., Playing cricket with friends",
    },
    help: {
        personalGrowth: ["Activities that helped you develop confidence, discipline, or self-awareness.", "Examples: leadership training, career advancement, skill development.", "Write short, specific answers."],
        curiosityDriven: ["Activities that sparked your interest and curiosity.", "Examples: science projects, exploring nature.", "Write short, specific answers."],
        individualInternalProblems: ["Problems that you faced internally and how you solved them.", "Examples: fear of speaking in public, low self-esteem.", "Write short, specific answers."],
        interpersonalInternalProblems: ["Problems that you faced with others and how you solved them.", "Examples: peer pressure to skip studies, conflicts with friends.", "Write short, specific answers."],
        externalProblems: ["Problems that you faced externally and how you solved them.", "Examples: plastic waste in school, environmental issues.", "Write short, specific answers."],
        socialRecognition: ["Activities that you were recognized for and why.", "Examples: winning a drawing competition, being a class monitor.", "Write short, specific answers."],
        effortlessEngagement: ["Activities that you enjoyed without much effort.", "Examples: playing cricket with friends, watching a movie.", "Write short, specific answers."],
        additionalInterests: ["Interests that you have outside of school and work.", "Examples: painting, reading, gardening.", "Write short, specific answers."],
    },
}

function PreHighSchool(props) {
    return <LifeStageSection {...props} stage={STAGE} />
}

export default PreHighSchool
