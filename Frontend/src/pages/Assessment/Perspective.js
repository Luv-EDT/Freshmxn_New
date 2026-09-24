import { useState } from "react"
import ModuleProgressBar from "./ModuleProgressBar"
import {
    PERSPECTIVE_MCQ,
    PERSPECTIVE_NARRATIVE,
    PERSPECTIVE_OPEN,
    VALUES_FULFILMENT,
    VALUES_IMPORTANCE,
    VALUES_SCALE_FULFILMENT,
    VALUES_SCALE_IMPORTANCE,
    OPEN_ITEM_NOTE,
} from "./perspectiveItems"

// The Perspective block — the largest module, and the one that carries the assessment past the
// release threshold. Four different answer shapes, which is why it cannot just reuse LikertModule:
//
//     MCQ        A–E, stored as the letter          → psychometric.perspective.answers
//     values     1–5, stored as a NUMBER            → psychometric.perspective.answers
//     narrative  a label, stored as the full string → psychometric.perspective.narrative
//     open text  the student's own words            → psychometric.perspective.openText
//
// WHY openText AND NOT open. `open` holds GRADED sub-scores and is written by the pipeline after
// llmScorer runs. If the UI wrote raw text there, an ungraded submission would be scored against
// whatever the scorer made of a string. They are separate keys so that cannot happen — see
// Backend/workers/gradeOpenItems.js.
//
// VALUES ARE NUMBERS, NOT LETTERS. perspectiveScoring.js reads P23–P30 with num(), so storing "A"
// would silently produce nulls across the whole values profile.

const PAGES = [
    { key: "belief", title: "Beliefs and decisions", items: PERSPECTIVE_MCQ.filter((item) => /^P[1-6]$/.test(item.id)) },
    { key: "focus", title: "Focus and attention", items: PERSPECTIVE_MCQ.filter((item) => /^P(8|9|1[0-2])$/.test(item.id)) },
    { key: "emotion", title: "Reading emotion", items: PERSPECTIVE_MCQ.filter((item) => /^P(1[4-9]|2[01])$/.test(item.id)) },
    { key: "uncertainty", title: "Working without certainty", items: PERSPECTIVE_MCQ.filter((item) => /^U[1-7]$/.test(item.id)) },
]

function Perspective({ answers, narrative, openText, onAnswer, onNarrative, onOpenText, onDone }) {
    const [page, setPage] = useState(0)

    // MCQ pages, then values, then narrative, then the four written answers.
    const totalPages = PAGES.length + 3
    const isValuesPage = page === PAGES.length
    const isNarrativePage = page === PAGES.length + 1
    const isOpenPage = page === PAGES.length + 2

    const mcqPage = PAGES[page]

    // Completeness per page index, used both to gate Next and to drive the navigation bar.
    const completeAt = (index) => {
        const mcq = PAGES[index]
        if (mcq) return mcq.items.every((item) => answers[item.id])
        if (index === PAGES.length) return [...VALUES_FULFILMENT, ...VALUES_IMPORTANCE].every((item) => answers[item.id])
        if (index === PAGES.length + 1) return PERSPECTIVE_NARRATIVE.every((item) => narrative[item.id])
        // The written answers are NOT required. A student who leaves one blank has it scored as
        // missing, which is honest — forcing text produces a sentence written to get past the
        // button, and that is worse than a null.
        return true
    }

    const pageComplete = completeAt(page)

    const navPages = [
        ...PAGES.map((item) => ({ key: item.key, title: item.title })),
        { key: "values", title: "What matters" },
        { key: "narrative", title: "Two quick ones" },
        { key: "open", title: "In your own words" },
    ]

    const advance = () => {
        if (page === totalPages - 1) {
            onDone()
            return
        }
        setPage(page + 1)
        window.scrollTo(0, 0)
    }

    const radioRow = (name, option, checked, onSelect) => (
        <label key={String(option.value)} className="choice">
            <input type="radio" name={name} checked={checked} onChange={onSelect} />
            {" "}{option.label}
        </label>
    )

    return (
        <div>
            <h2>How you think</h2>

            <ModuleProgressBar
                pages={navPages}
                currentIndex={page}
                isComplete={completeAt}
                onJump={(index) => { setPage(index); window.scrollTo(0, 0) }}
            />

            {mcqPage && (
                <>
                    <h3>{mcqPage.title}</h3>
                    {mcqPage.key === "uncertainty" && (
                        <p>
                            <em>
                                There is no better or worse end to this one. Some people do their best
                                work when the path is clear, others when it is not — we are working out
                                which you are, not scoring you.
                            </em>
                        </p>
                    )}
                    {mcqPage.items.map((item) => (
                        <div key={item.id}>
                            <p><strong>{item.text}</strong></p>
                            {item.options.map((option) => radioRow(
                                item.id,
                                option,
                                answers[item.id] === option.value,
                                () => onAnswer(item.id, option.value)
                            ))}
                        </div>
                    ))}
                </>
            )}

            {isValuesPage && (
                <>
                    <h3>What matters to you</h3>
                    <p>Two passes over the same four areas: how things are now, then how much each matters.</p>

                    <h4>Right now, how fulfilled do you feel in each?</h4>
                    {VALUES_FULFILMENT.map((item) => (
                        <div key={item.id}>
                            <p><strong>{item.text}</strong></p>
                            {VALUES_SCALE_FULFILMENT.map((option) => radioRow(
                                item.id,
                                option,
                                answers[item.id] === option.value,
                                () => onAnswer(item.id, option.value)
                            ))}
                        </div>
                    ))}

                    <h4>How important is each to you?</h4>
                    {VALUES_IMPORTANCE.map((item) => (
                        <div key={item.id}>
                            <p><strong>{item.text}</strong></p>
                            {VALUES_SCALE_IMPORTANCE.map((option) => radioRow(
                                item.id,
                                option,
                                answers[item.id] === option.value,
                                () => onAnswer(item.id, option.value)
                            ))}
                        </div>
                    ))}
                </>
            )}

            {isNarrativePage && (
                <>
                    <h3>Two quick ones</h3>
                    {PERSPECTIVE_NARRATIVE.map((item) => (
                        <div key={item.id}>
                            <p><strong>{item.text}</strong></p>
                            {item.options.map((option) => radioRow(
                                item.id,
                                option,
                                narrative[item.id] === option.value,
                                () => onNarrative(item.id, option.value)
                            ))}
                        </div>
                    ))}
                </>
            )}

            {isOpenPage && (
                <>
                    <h3>In your own words</h3>
                    <p>{OPEN_ITEM_NOTE}</p>
                    <p><em>You can leave any of these blank. A blank answer is simply not scored — it is never counted against you.</em></p>

                    {PERSPECTIVE_OPEN.map((item) => (
                        <div key={item.id}>
                            <h4>{item.title}</h4>
                            <p style={{ whiteSpace: "pre-line" }}>{item.text}</p>
                            {item.parts.length > 0 && (
                                <ul>
                                    {item.parts.map((part) => <li key={part}>{part}</li>)}
                                </ul>
                            )}
                            <textarea
                                rows={8}
                                value={openText[item.id] || ""}
                                onChange={(event) => onOpenText(item.id, event.target.value)}
                                style={{ width: "100%", boxSizing: "border-box", padding: "8px", fontSize: "16px" }}
                                placeholder="Take your time. A few sentences is enough."
                            />
                        </div>
                    ))}
                </>
            )}

            <hr />

            {page > 0 && (
                <button type="button" onClick={() => { setPage(page - 1); window.scrollTo(0, 0) }}>Back</button>
            )}
            {" "}
            <button type="button" className="btn btn-primary" onClick={advance} disabled={!pageComplete}>
                {page === totalPages - 1 ? "Finish this section" : "Next"}
            </button>
            {!pageComplete && <p><em>Answer everything on this page to continue.</em></p>}
        </div>
    )
}

export default Perspective
