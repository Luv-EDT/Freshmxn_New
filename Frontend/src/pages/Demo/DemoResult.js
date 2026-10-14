import ProfessionCard from "../Report/ProfessionCard"
import DemoPlans from "./DemoPlans"

// THE DEMO REPORT (owner, Round 32): the two strongest careers from the real engines, each opening into
// the real career card; the visitor's own words that led there; the two factors as words; and an honest
// note of how much this was — true numbers, never a confidence figure or a match score.
const TOTAL_FACTORS = 31
const TOTAL_CAREERS = 223

const OPENNESS_WORDS = {
    High: "You lean towards new ideas, imagination and abstract thinking.",
    Medium: "You mix new ideas with what you already know works.",
    Low: "You prefer the concrete and the practical to the abstract.",
}

function DemoResult({ result }) {
    const { name, careers, details, pointedTo, opennessLevel, reasoningRight, reasoningOf } = result

    return (
        <section className="demo-step demo-result">
            <h1>{name}, here's a glimpse.</h1>

            <div className="demo-factors">
                <div className="demo-factor">
                    <p className="demo-label">Openness</p>
                    <p><strong>{opennessLevel || "Not measured"}</strong>{opennessLevel && ` — ${OPENNESS_WORDS[opennessLevel]}`}</p>
                </div>
                <div className="demo-factor">
                    <p className="demo-label">Reasoning — a taste</p>
                    <p><strong>{reasoningRight} of {reasoningOf} puzzles right.</strong> The full test has 16, and it's the one that counts.</p>
                </div>
            </div>

            <h2>Two careers your answers point to</h2>
            {careers.length === 0 && (
                <p>Your words didn't point to one of our careers yet — that happens with a few short answers. The full counselling asks about four stages of your life, and finds far more.</p>
            )}
            {careers.length === 1 && <p className="demo-hint">Your words pointed to one career this time. The full counselling asks about four stages of your life, and finds far more.</p>}
            <div className="match-list">
                {careers.map(({ entry, words }, index) => (
                    <div key={entry.professionId} className="demo-career">
                        {words && (
                            <p className="demo-words">
                                You said <strong>“{words.said}”</strong> pulls you{words.why ? <>, and that it stays because <em>“{words.why}”</em></> : null}.
                            </p>
                        )}
                        <ProfessionCard
                            entry={entry}
                            detail={details[entry.professionId]}
                            detailsLoaded
                            rank={index + 1}
                            topRank={index + 1}
                            switchCost={0}
                        />
                    </div>
                ))}
            </div>

            <div className="demo-gap">
                <h2>How much this was</h2>
                <p>
                    We measured <strong>2 of {TOTAL_FACTORS} factors</strong> and showed <strong>{careers.length} of the {TOTAL_CAREERS} careers</strong> we
                    rank{typeof pointedTo === "number" ? <> — your words alone pointed to {pointedTo}</> : null}. The full program measures all {TOTAL_FACTORS},
                    reads your whole story across four stages of your life, and ranks every career it points to — each with its road,
                    exams, money and future.
                </p>
            </div>

            <DemoPlans />
        </section>
    )
}

export default DemoResult
