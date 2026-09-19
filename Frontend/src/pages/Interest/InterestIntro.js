// Shown once, before a student's first section. Ported from the original questionnaire's welcome
// screen and its Helpful Tips, minus the "refreshing will erase your progress" warning — with
// section-by-section autosave that is now the opposite of true.
function InterestIntro({ handleNext, hasSubmitted }) {
    return (
        <div>
            <h2>Welcome to your interest questionnaire</h2>

            <p>
                This is where your career guidance starts. Through a series of questions about different
                periods of your life — what you did, what you enjoyed, what got in your way — you'll build
                a picture of what actually motivates you.
            </p>

            <blockquote>
                <p>
                    <strong>☕ This one is worth your time.</strong> Filling this in is really an exercise in
                    getting to know yourself — a genuinely enjoyable bit of reflection rather than a form to
                    get through. So grab a coffee or a chai, get comfortable, and take it at your own pace.
                </p>
                <p>
                    <strong>Be completely honest — nobody here is judging you.</strong> There are no right
                    answers and nothing you write is graded. The more you tell us, the sharper your results
                    will be, and the more you'll understand about yourself by the end of it.
                </p>
            </blockquote>

            <h3>Before you begin</h3>
            <ul>
                <li>
                    ⏳ <strong>It takes about 45 minutes.</strong> The more honest and detailed you are, the
                    clearer your career direction becomes.
                </li>
                <li>
                    💾 <strong>Your answers are saved as you go.</strong> Each section is saved to your
                    account when you move to the next one, so you can stop any time and pick up where you
                    left off, on any device.
                </li>
                <li>
                    🕐 <strong>You don't have to finish in one sitting.</strong> Press <strong>Save</strong>
                    on any page and come back whenever you like to carry on from where you left off.
                </li>
                <li>
                    📝 <strong>For each stage of your life you'll fill in two things:</strong> the activities
                    you did, and the problems or challenges you faced.
                </li>
                <li>
                    📋 <strong>Use the Activity Reference List</strong> if you're stuck — it's full of
                    examples to jog your memory.
                </li>
                <li>
                    💡 <strong>Can't think of any problems?</strong> Each problem section has examples you
                    can click to add and then edit in your own words.
                </li>
                <li>
                    💭 <strong>Use the "?" icons</strong> — they explain how to answer each question.
                </li>
                <li>
                    🔁 <strong>Revisit your earlier sections once at the end.</strong> People almost always
                    remember more activities and problems after they've warmed up.
                </li>
            </ul>

            <h3>Your privacy</h3>
            <p>
                Your responses are confidential and used only to generate your personalised analysis.
                We never share your information with anyone.
            </p>

            <button type="button" onClick={handleNext}>
                {hasSubmitted ? "Continue to my answers" : "Start the questionnaire"}
            </button>
        </div>
    )
}

export default InterestIntro
