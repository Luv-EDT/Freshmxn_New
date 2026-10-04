// Shown each time the form is opened. Round 10 (S10): the welcome is down to what a student needs to
// start; the tips and the privacy note fold away under "How to answer" — they were about 400 words
// between a student and the first question.
function InterestIntro({ handleNext, hasSubmitted }) {
    return (
        <div className="if-intro">
            <h2>Welcome to your interest questionnaire</h2>

            <p className="if-lead">
                Your career guidance starts here. You'll go through each stage of your life — what you did,
                what you enjoyed, what got in your way — and build a picture of what really motivates you.
            </p>
            <p>
                There are no right answers and nothing is graded: the more honestly you write, the sharper your
                results. It takes about 45 minutes, and your answers save as you go, so you can stop and come
                back any time.
            </p>

            <details className="if-examples if-how">
                <summary className="if-chip-summary"><span className="if-q" aria-hidden="true">?</span> How to answer</summary>
                <ul>
                    <li><strong>For each stage of your life you'll fill in two things:</strong> the activities you did, and the problems or challenges you faced.</li>
                    <li><strong>Short and specific beats long.</strong> "Played district-level cricket" says more than "sports".</li>
                    <li><strong>Stuck?</strong> Each stage has a list of activities to jog your memory, and each problem question has examples you can tap to add and then edit in your own words.</li>
                    <li><strong>"See examples"</strong> under a question explains what it is asking for.</li>
                    <li><strong>You don't have to finish in one sitting.</strong> Press <strong>Save</strong> on any page and carry on later, on any device.</li>
                    <li><strong>Revisit your earlier sections once at the end.</strong> People almost always remember more after they've warmed up.</li>
                </ul>
                <p><strong>Your privacy.</strong> Your responses are confidential and used only to generate your personalised analysis. We never share your information with anyone.</p>
            </details>

            <button type="button" className="btn btn-primary" onClick={handleNext}>
                {hasSubmitted ? "Continue to my answers" : "Start the questionnaire"}
            </button>
        </div>
    )
}

export default InterestIntro
