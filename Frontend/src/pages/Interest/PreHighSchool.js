import LifeStageSection from "./LifeStageSection"
import { ACTIVITY_REFERENCE_LISTS } from "./activityReferenceLists"
import { PROBLEM_PROMPTS } from "./problemPrompts"

// text first ported from virtual-career-counselling PreHighSchool.jsx
// Round 28 (owner): the prompts are crisp, and "noticed or praised" asks for the ACTIVITY people
// praised, never the prize or award it led to
const STAGE = {
    heading: "🧒 Pre-High School",
    subtitle: "Before 9th standard — at school, at home, with friends.",
    isSkippable: true,
    referenceList: ACTIVITY_REFERENCE_LISTS.preHighSchool,
    prompts: PROBLEM_PROMPTS.preHighSchool,
    placeholders: {
        personalGrowth: "e.g., Class monitor, learning to swim",
        curiosityDriven: "e.g., Science projects, exploring nature",
        individualInternalProblems: ["e.g., Fear of speaking in public", "e.g., Joining debate club"],
        interpersonalInternalProblems: ["e.g., Peer pressure to skip studies", "e.g., Joining study group"],
        externalProblems: ["e.g., Plastic waste in school", "e.g., Organizing clean-up drive"],
        socialRecognition: "e.g., Drawing posters for class events",
        effortlessEngagement: "e.g., Playing cricket with friends",
    },
    help: {
        personalGrowth: ["What you did that made you braver, more disciplined or more sure of yourself.", "Examples: being class monitor, learning to swim, looking after a younger sibling, saving pocket money."],
        curiosityDriven: ["What you tried just to find out how or why.", "Examples: opening up old toys, watching ants, science kits, reading encyclopaedias."],
        individualInternalProblems: ["Problems that you faced internally and how you solved them.", "Examples: fear of speaking in public, low self-esteem."],
        interpersonalInternalProblems: ["Problems that you faced with others and how you solved them.", "Examples: peer pressure to skip studies, conflicts with friends."],
        externalProblems: ["Problems that you faced externally and how you solved them.", "Examples: plastic waste in school, environmental issues."],
        socialRecognition: ["What you DID that people noticed or praised — the activity, not the prize.", "Examples: drawing, singing in assembly, helping classmates with homework, keeping the class neat."],
        effortlessEngagement: ["What you could do for hours without getting tired of it.", "Examples: playing cricket, making things out of paper, telling stories, puzzles."],
        additionalInterests: ["Anything else you enjoyed doing — write the activity and why.", "Examples: painting, gardening, dancing at family functions."],
    },
}

function PreHighSchool(props) {
    return <LifeStageSection {...props} stage={STAGE} />
}

export default PreHighSchool
