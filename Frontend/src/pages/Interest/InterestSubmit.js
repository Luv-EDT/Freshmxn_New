import InterestProgressBar from "./InterestProgressBar"

// There is no submit page any more — every section was saved as the student left it, so reaching
// the end is the whole "submission". This is just the thank-you.
function InterestSubmit({ handlePrevious, isSubmitting, isSubmitted, onGoHome, steps, currentStepIndex, goToStep }) {
    return (
        <div>
            <InterestProgressBar
                steps={steps}
                currentStepIndex={currentStepIndex}
                goToStep={goToStep}
            />

            <div className="if-card if-done">
            <h1>Thank you!</h1>

            {isSubmitting ? (
                <p>Saving your answers...</p>
            ) : (
                <>
                    <p>Your responses have been saved.</p>
                    <p>Next up is the assessment — open it from your dashboard whenever you're ready.</p>
                    <p>You can still come back and edit your answers until your report is generated.</p>
                </>
            )}

            <div className="if-nav">
                <button type="button" onClick={handlePrevious} disabled={isSubmitting}>Go back and review</button>
                {" "}
                <button type="button" className="btn btn-primary" onClick={onGoHome} disabled={isSubmitting}>Go to my dashboard</button>
            </div>
            </div>
        </div>
    )
}

export default InterestSubmit
