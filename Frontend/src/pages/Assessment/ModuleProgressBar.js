// Page navigation inside a module — the assessment's equivalent of InterestProgressBar.
//
// WHY IT EXISTS: editing. Without it, a student who wants to change one answer on page 1 of a
// six-page module has to walk Back through every page in between, and a student reviewing a
// finished module has no way to reach page 4 at all. That is the case it was asked for.
//
// BACKWARDS IS ALWAYS FREE. Those pages are already answered by definition, and blocking a student
// from revisiting their own answers is hostile for no gain.
//
// FORWARDS ONLY THROUGH COMPLETED PAGES. Not to police anybody — an unanswered item is simply not
// scored — but because skipping ahead is how a student ends up with a module that looks finished
// and is not. That is exactly the confusion this bar is meant to remove, so it must not create it.

function ModuleProgressBar({ pages, currentIndex, isComplete, onJump }) {
    if (pages.length <= 1) return null

    // The furthest page reachable: everything up to and including the first incomplete one.
    let furthest = 0
    while (furthest < pages.length - 1 && isComplete(furthest)) furthest += 1

    const answered = pages.filter((page, index) => isComplete(index)).length

    return (
        <div>
            <p>
                Section {currentIndex + 1} of {pages.length} · {answered} of {pages.length} finished
            </p>

            {/* Wraps rather than scrolls: on a phone a horizontal row of six buttons either
                overflows off-screen or shrinks below a usable tap target. */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "12px" }}>
                {pages.map((page, index) => {
                    const reachable = index <= furthest
                    const done = isComplete(index)
                    const isCurrent = index === currentIndex

                    return (
                        <button
                            type="button"
                            key={page.key || index}
                            onClick={() => reachable && !isCurrent && onJump(index)}
                            disabled={!reachable || isCurrent}
                            title={reachable ? page.title : "Finish the sections before this one first"}
                            style={{
                                padding: "10px 12px",
                                minHeight: "44px",          // a real tap target on a phone
                                fontWeight: isCurrent ? "bold" : "normal",
                                opacity: reachable ? 1 : 0.45,
                                cursor: reachable && !isCurrent ? "pointer" : "default",
                            }}
                        >
                            {index + 1}. {page.title}{done ? " ✓" : ""}
                        </button>
                    )
                })}
            </div>
            <hr />
        </div>
    )
}

export default ModuleProgressBar
