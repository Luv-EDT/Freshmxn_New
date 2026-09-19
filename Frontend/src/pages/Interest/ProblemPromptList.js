import { useState } from "react"

// "Can't think of any?" — click a prompt to drop it into the problem list as an editable row
function ProblemPromptList({ prompts, usedProblems, onPick }) {
    const [isExpanded, setIsExpanded] = useState(false)

    return (
        <div>
            <button type="button" onClick={() => setIsExpanded(!isExpanded)}>
                {isExpanded ? "Hide examples ▴" : "Can't think of any? See some examples ▾"}
            </button>
            {isExpanded && (
                <div>
                    <p>Click one that sounds familiar — you can edit the words after adding it.</p>
                    {prompts.map((prompt) => {
                        const isUsed = usedProblems.includes(prompt)
                        return (
                            <button
                                type="button"
                                key={prompt}
                                disabled={isUsed}
                                onClick={() => onPick(prompt)}
                            >
                                {isUsed ? "✓ " : "+ "}{prompt}
                            </button>
                        )
                    })}
                </div>
            )}
        </div>
    )
}

export default ProblemPromptList
