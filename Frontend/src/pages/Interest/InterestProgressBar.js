// "Step N of M" with a thin bar; the full step list folds away under "All steps" — ten buttons used
// to fill a phone's first screen before the first question (Round 10, S10). The steps are computed
// from the student's journey, so a Class 9 student never sees College or Post-College.
// onStepClick(targetIndex) saves the section first and may return false to stop a forward jump when
// the section isn't valid.

function InterestProgressBar({ steps, currentStepIndex, goToStep, onStepClick }) {
    const progressPercentage = steps.length === 0 ? 0 : ((currentStepIndex + 1) / steps.length) * 100

    const handleStepClick = (targetIndex) => {
        if (targetIndex === currentStepIndex) return

        // First run the section-specific save function if provided
        if (onStepClick) {
            const shouldNavigate = onStepClick(targetIndex)
            if (shouldNavigate === false) {
                return // Prevent navigation
            }
        }

        goToStep(targetIndex)
    }

    return (
        <div className="if-progress">
            <p className="if-progress-label">
                Step {currentStepIndex + 1} of {steps.length} · <strong>{steps[currentStepIndex]?.title}</strong>
            </p>
            <div className="if-progress-bar" aria-hidden="true"><span style={{ width: `${progressPercentage}%` }} /></div>
            <details className="if-steps">
                <summary>All steps</summary>
                <ol>
                    {steps.map((step, index) => (
                        <li key={step.key}>
                            <button
                                type="button"
                                className={`if-step-link${index === currentStepIndex ? " is-current" : ""}`}
                                onClick={() => handleStepClick(index)}
                                disabled={index === currentStepIndex}
                                aria-current={index === currentStepIndex ? "step" : undefined}
                            >
                                {index + 1}. {step.title}
                            </button>
                        </li>
                    ))}
                </ol>
            </details>
        </div>
    )
}

export default InterestProgressBar
