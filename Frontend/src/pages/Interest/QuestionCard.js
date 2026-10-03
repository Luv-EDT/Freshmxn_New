// One question on the interest form, as a card (Round 10, S10): the question in plain words, one
// line on what to write, and the longer help folded away under "See examples" — it used to sit behind
// a "?" that most people never opened, while the page itself was a wall of boxes.
function QuestionCard({ title, prompt, examples, htmlFor, children }) {
    return (
        <div className="if-question">
            {htmlFor ? <label htmlFor={htmlFor} className="if-question-title">{title}</label> : <p className="if-question-title">{title}</p>}
            {prompt && <p className="if-question-prompt">{prompt}</p>}
            {examples && examples.length > 0 && (
                <details className="if-examples">
                    <summary>See examples</summary>
                    {examples.map((line, index) => (
                        <p key={index}>{line.strong && <strong>{line.strong} </strong>}{line.text || line}</p>
                    ))}
                </details>
            )}
            {children}
        </div>
    )
}

export default QuestionCard
