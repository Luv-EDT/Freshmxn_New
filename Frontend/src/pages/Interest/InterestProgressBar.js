// clickable step list. The steps are computed from the student's journey, so a Class 9 student
// never sees College or Post-College. onStepClick(targetIndex) saves the section first and may
// return false to stop a forward jump when the section isn't valid.

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
        <div>
            <div>
                Step {currentStepIndex + 1} of {steps.length}: <strong>{steps[currentStepIndex]?.title}</strong>
                {" "}({Math.round(progressPercentage)}%)
            </div>
            <div>
                {steps.map((step, index) => (
                    <button
                        type="button"
                        key={step.key}
                        onClick={() => handleStepClick(index)}
                        disabled={index === currentStepIndex}
                    >
                        {index + 1}. {step.title}
                    </button>
                ))}
            </div>
            <hr />
        </div>
    )
}

export default InterestProgressBar
