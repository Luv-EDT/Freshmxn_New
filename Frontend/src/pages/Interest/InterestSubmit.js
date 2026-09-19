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

            <h1>Thank You!</h1>

            {isSubmitting ? (
                <p>Saving your answers...</p>
            ) : (
                <>
                    <p>Your responses have been saved.</p>
                    <p>Next up is the psychometric assessment — it will unlock here soon.</p>
                    <p>You can still come back and edit your answers until your report is generated.</p>
                </>
            )}

            <div>
                <button type="button" onClick={handlePrevious} disabled={isSubmitting}>Go back and review</button>
                {" "}
                <button type="button" onClick={onGoHome} disabled={isSubmitting}>Go to Home</button>
            </div>
        </div>
    )
}

export default InterestSubmit
