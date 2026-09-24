import { useState } from "react"
import { IPIP_ITEMS, IPIP_SCALE, IPIP_STEM, IPIP_PAGE_SIZE } from "./ipip50Items"

// IPIP-50 — 50 personality items plus the two embedded quality checks.
//
// Ten to a page rather than one 52-item wall: a scroll that long gets abandoned, and abandonment
// mid-block is worse than a slower completion, because a block below the coverage gate nulls the
// whole trait.
//
// EVERY ITEM RENDERS IDENTICALLY, including the two quality checks. QC1 ("Have never used a
// computer or phone") only detects careless answering while it reads as an ordinary item, and QC2
// ("Please select Moderately accurate") only works if a student actually reads it. Styling them
// differently, grouping them at the end, or labelling them would destroy both.
//
// No "unanswered" default and no pre-selection. A middle option chosen by the UI rather than the
// student is a fabricated answer, and the scorer cannot tell the difference — it would count toward
// coverage as if the student had responded.

function Ipip50({ answers, onChange, onDone }) {
    const [page, setPage] = useState(0)

    const totalPages = Math.ceil(IPIP_ITEMS.length / IPIP_PAGE_SIZE)
    const start = page * IPIP_PAGE_SIZE
    const pageItems = IPIP_ITEMS.slice(start, start + IPIP_PAGE_SIZE)

    const answeredOnPage = pageItems.filter((item) => answers[item.id]).length
    const pageComplete = answeredOnPage === pageItems.length
    const answeredTotal = IPIP_ITEMS.filter((item) => answers[item.id]).length

    const isLastPage = page === totalPages - 1

    const handleNext = () => {
        if (isLastPage) {
            onDone()
            return
        }
        setPage(page + 1)
        window.scrollTo(0, 0)
    }

    const handleBack = () => {
        setPage(Math.max(0, page - 1))
        window.scrollTo(0, 0)
    }

    return (
        <div>
            <h2>How you see yourself</h2>
            <p>
                There are no right answers here, and nobody is scored as better or worse. Answer with
                how you actually are, not how you think you should be.
            </p>
            <p>
                <strong>{answeredTotal}</strong> of {IPIP_ITEMS.length} answered · page {page + 1} of {totalPages}
            </p>

            <hr />

            <p><em>{IPIP_STEM}</em></p>

            {pageItems.map((item) => (
                <div key={item.id}>
                    <p><strong>{item.text}</strong></p>
                    {/* Each option is its own full-width row, not five labels on one line.
                        On a phone an inline row wraps into an unreadable tangle and the tap
                        targets end up smaller than a fingertip — and a mis-tap here is a wrong
                        answer that scores, not an error the student notices. Block rows with
                        generous padding give the whole line as a target on mobile, and cost
                        nothing on desktop. */}
                    <div>
                        {IPIP_SCALE.map((option) => (
                            <label
                                key={option.value}
                                className="choice"
                            >
                                <input
                                    type="radio"
                                    name={item.id}
                                    value={option.value}
                                    checked={answers[item.id] === option.value}
                                    onChange={() => onChange(item.id, option.value)}
                                />
                                {" "}{option.label}
                            </label>
                        ))}
                    </div>
                </div>
            ))}

            <hr />

            <div>
                {page > 0 && (
                    <button type="button" onClick={handleBack}>
                        Back
                    </button>
                )}
                {" "}
                <button type="button" onClick={handleNext} disabled={!pageComplete}>
                    {isLastPage ? "Finish this section" : "Next"}
                </button>
                {!pageComplete && (
                    <p><em>Answer all {pageItems.length} on this page to continue.</em></p>
                )}
            </div>
        </div>
    )
}

export default Ipip50
