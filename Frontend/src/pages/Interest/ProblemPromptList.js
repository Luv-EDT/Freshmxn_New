import { useState } from "react"

// "Can't think of any?" — click a prompt to drop it into the problem list as an editable row
function ProblemPromptList({ prompts, usedProblems, onPick }) {
    const [isExpanded, setIsExpanded] = useState(false)

    return (
        <div className="if-prompts">
            <button type="button" className="if-link-button" onClick={() => setIsExpanded(!isExpanded)} aria-expanded={isExpanded}>
                {isExpanded ? "Hide examples ▴" : "Can't think of any? See some examples ▾"}
            </button>
            {isExpanded && (
                <div>
                    <p className="if-question-prompt">Tap one that sounds familiar — you can edit the words after adding it.</p>
                    <div className="if-prompt-chips">
                        {prompts.map((prompt) => {
                            const isUsed = usedProblems.includes(prompt)
                            return (
                                <button
                                    type="button"
                                    key={prompt}
                                    className={`if-prompt-chip${isUsed ? " is-used" : ""}`}
                                    disabled={isUsed}
                                    onClick={() => onPick(prompt)}
                                >
                                    {isUsed ? "✓ " : "+ "}{prompt}
                                </button>
                            )
                        })}
                    </div>
                </div>
            )}
        </div>
    )
}

export default ProblemPromptList
