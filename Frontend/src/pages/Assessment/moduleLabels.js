// Kept in its own file with no imports, so the pipeline fixtures can load it in Node.
//
// WHICH FINISHED MODULES CAN STILL BE CHANGED (owner, Round 10, item 22). The questionnaires stay
// editable until Submit, so their button invites an edit. The tests are one attempt, so theirs only
// looks: "Review answers" for a test the student answered here, "Review scores" for the two whose
// result was read from a screenshot of another website.
export const EDITABLE_MODULES = ["ipip50", "mi", "rosenberg", "confidence", "perspective"]

export const reviewLabel = (module) => {
    if (!module) return "Review answers"
    if (EDITABLE_MODULES.includes(module.key)) return "Review and edit"
    if (module.external) return "Review scores"
    return "Review answers"
}

// A TEST WE'VE IMPROVED COMES FIRST (owner, Round 31): a test offered again, or one the student took up
// and hasn't finished, leads the deck; everything else keeps its order.
export const deckOrder = (modules, offers = {}, keptEarlier = {}) => {
    const first = (module) => Boolean(offers[module.key] || keptEarlier[module.key])
    return [...modules.filter(first), ...modules.filter((module) => !first(module))]
}
