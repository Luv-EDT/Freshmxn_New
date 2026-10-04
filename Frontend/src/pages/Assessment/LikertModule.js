import { useState } from "react"
import ModuleProgressBar from "./ModuleProgressBar"

// The shared renderer for every scale-based module — IPIP-50, MI, Rosenberg, Confidence, and the
// Likert half of the Perspective block.
//
// ONE COMPONENT, because these modules differ only in their items, their scale and their wording.
// Five near-identical copies would mean five places to fix the next mobile problem and five chances
// for one of them to drift — and drift here is invisible: a module that renders slightly wrong
// still submits answers, they are just the wrong ones.
//
// PER-ITEM SCALES ARE SUPPORTED. Most modules share one scale across every item, but the Confidence
// block gives each question its own five situational answers. An item may therefore carry its own
// `options`, and it wins over the module's default.
//
// MOBILE: every option is a full-width row with real padding rather than five labels sharing a
// line. On a phone an inline row wraps into a tangle with tap targets smaller than a fingertip, and
// a mis-tap here is a wrong answer that scores — not an error the student notices.

function LikertModule({ title, intro, stem, items, scale, answers, onChange, onDone, pageSize = 10 }) {
    const [page, setPage] = useState(0)

    const totalPages = Math.ceil(items.length / pageSize)
    const start = page * pageSize
    const pageItems = items.slice(start, start + pageSize)

    const pageComplete = pageItems.every((item) => answers[item.id])
    const answeredTotal = items.filter((item) => answers[item.id]).length
    const isLastPage = page === totalPages - 1

    const handleNext = () => {
        if (isLastPage) {
            onDone()
            return
        }
        setPage(page + 1)
        window.scrollTo(0, 0)
    }

    return (
        <div>
            <h2>{title}</h2>
            {intro && <p>{intro}</p>}
            <p><strong>{answeredTotal}</strong> of {items.length} answered</p>

            <ModuleProgressBar
                pages={Array.from({ length: totalPages }, (item, index) => ({ key: index, title: `${index * pageSize + 1}–${Math.min((index + 1) * pageSize, items.length)}` }))}
                currentIndex={page}
                isComplete={(index) => items.slice(index * pageSize, (index + 1) * pageSize).every((item) => answers[item.id])}
                onJump={(index) => { setPage(index); window.scrollTo(0, 0) }}
            />

            {stem && <p><em>{stem}</em></p>}

            {pageItems.map((item) => {
                const options = item.options || scale
                // Round 13 (lean pass): a plain agree-scale is one row of tiles — the two ends named under
                // it, the chosen answer echoed between them — instead of five stacked rows per question.
                // Questions with their own wording (item.options) keep full-width rows.
                const compact = !item.options && options.length <= 5
                const picked = options.find((option) => option.value === answers[item.id])

                return (
                    <div key={item.id} className={`question-card${answers[item.id] ? " is-answered" : ""}`}>
                        <p className="question-text"><strong>{item.text}</strong></p>
                        <div className={`choices${compact ? " is-scale" : ""}`} role="radiogroup" aria-label={item.text}>
                            {options.map((option, index) => (
                                <label
                                    key={option.value}
                                    className={`choice${answers[item.id] === option.value ? " is-checked" : ""}`}
                                    title={option.label}
                                >
                                    <input
                                        type="radio"
                                        name={item.id}
                                        value={option.value}
                                        checked={answers[item.id] === option.value}
                                        onChange={() => onChange(item.id, option.value)}
                                    />
                                    {compact ? (
                                        <>
                                            <span className="scale-num" aria-hidden="true">{index + 1}</span>
                                            <span className="scale-label">{option.label}</span>
                                        </>
                                    ) : <>{" "}{option.label}</>}
                                </label>
                            ))}
                        </div>
                        {compact && (
                            <p className="scale-ends" aria-hidden="true">
                                <span>{options[0].label}</span>
                                <strong>{picked ? picked.label : ""}</strong>
                                <span>{options[options.length - 1].label}</span>
                            </p>
                        )}
                    </div>
                )
            })}

            <hr />

            <div className="module-nav">
                {page > 0 && (
                    <button type="button" className="btn btn-ghost" onClick={() => { setPage(page - 1); window.scrollTo(0, 0) }}>
                        Back
                    </button>
                )}
                {" "}
                <button type="button" className="btn btn-primary" onClick={handleNext} disabled={!pageComplete}>
                    {isLastPage ? "Finish this section" : "Next"}
                </button>
                {!pageComplete && <p><em>Answer all {pageItems.length} on this page to continue.</em></p>}
            </div>
        </div>
    )
}

export default LikertModule
