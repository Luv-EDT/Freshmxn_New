// "Step N of M" with a thin bar; the full list folds away under "All stages" — ten buttons used to
// fill a phone's first screen before the first question (Round 10, S10). The steps are computed
// from the student's journey, so a Class 9 student never sees College or Post-College.
// onStepClick(targetIndex) hands the section's answers up first and returns false when something
// required is missing; the form (goToStep) decides whether that stops the move (Round 13).
function InterestProgressBar({ steps, currentStepIndex, goToStep, onStepClick }) {
    const progressPercentage = steps.length === 0 ? 0 : ((currentStepIndex + 1) / steps.length) * 100

    const handleStepClick = (targetIndex) => {
        if (targetIndex === currentStepIndex) return
        goToStep(targetIndex, { sectionOk: onStepClick ? onStepClick(targetIndex) !== false : true })
    }

    const stateOf = (step, index) => index === currentStepIndex ? " is-current" : step.done ? " is-done" : step.closed ? " is-closed" : ""

    return (
        <div className="if-progress">
            <p className="if-progress-label">
                Step {currentStepIndex + 1} of {steps.length} · <strong>{steps[currentStepIndex]?.title}</strong>
            </p>
            <div className="if-progress-bar" aria-hidden="true"><span style={{ width: `${progressPercentage}%` }} /></div>
            <details className="if-steps">
                <summary className="if-chip-summary">All stages</summary>
                <ol>
                    {steps.map((step, index) => (
                        <li key={step.key}>
                            <button
                                type="button"
                                className={`if-step-link${stateOf(step, index)}`}
                                onClick={() => handleStepClick(index)}
                                aria-current={index === currentStepIndex ? "step" : undefined}
                            >
                                {step.done && index !== currentStepIndex ? "✓ " : `${index + 1}. `}{step.title}
                            </button>
                        </li>
                    ))}
                </ol>
            </details>
        </div>
    )
}

export default InterestProgressBar
