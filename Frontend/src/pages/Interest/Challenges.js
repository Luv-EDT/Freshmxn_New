import { useState, useEffect } from "react"
import InterestProgressBar from "./InterestProgressBar"
import { YOU_OR_THEM_OPTIONS } from "./interestFormState"

// One page for both halves of the same question, persistent first: tick the problems from your
// past that still bite, then add anything current that isn't already on the list. Asking it this
// way round means the student can see what we already picked up before racking their brain again.
// The stored shape is unchanged — persistentProblems.{internal,interpersonal,external} and
// currentChallenges.presentConcerns — so nothing downstream has to care that they share a screen.

const GROUPS = [
    { key: "internal", reason: "individualInternalProblems", label: "Things inside you", empty: "Nothing from your earlier answers landed here." },
    { key: "interpersonal", reason: "interpersonalInternalProblems", label: "Things involving other people", empty: "Nothing from your earlier answers landed here." },
    { key: "external", reason: "externalProblems", label: "Things outside your control", empty: "Nothing from your earlier answers landed here." },
]

function Challenges({ persistentData, currentData, extractedProblems, updatePersistent, updateCurrent, handleNext, handlePrevious, steps, currentStepIndex, goToStep, isSaving, requestSave, reportDraft }) {
    const [localPersistent, setLocalPersistent] = useState(persistentData)
    const [localCurrent, setLocalCurrent] = useState(currentData)
    const [concernErrors, setConcernErrors] = useState({}) // { [rowIndex]: message }
    const [showValidationErrors, setShowValidationErrors] = useState(false)

    useEffect(() => {
        setLocalPersistent(persistentData)
    }, [persistentData])

    useEffect(() => {
        setLocalCurrent(currentData)
    }, [currentData])

    // this page owns two slices of the form, so the draft carries both
    useEffect(() => {
        reportDraft({ persistentProblems: localPersistent, currentChallenges: localCurrent })
    }, [localPersistent, localCurrent])

    // ─── Persistent: tick what still affects you ─────────────────────────────
    // stores the whole problem object ({ problem, reason, activityFailure }), not just the text
    const handleCheckboxChange = (group, value) => {
        setLocalPersistent((prev) => {
            const currentValues = (prev[group] || []).filter((item) => item && item.problem)
            const selectedProblemObject = extractedProblems.find((p) => p.problem === value)
            const newValues = currentValues.some((item) => item.problem === value)
                ? currentValues.filter((item) => item.problem !== value)
                : [...currentValues, selectedProblemObject || { problem: value }]

            return {
                ...prev,
                [group]: newValues,
            }
        })
    }

    // ─── Current: anything else, right now ───────────────────────────────────
    const getRowError = (concern) => {
        const problemFilled = (concern?.problem || "").trim() !== ""
        const youOrThemSelected = (concern?.youOrThem || "") !== ""
        return problemFilled !== youOrThemSelected ? "Both fields are required if one is filled." : null
    }

    const handleProblemChange = (index, field, value) => {
        const updatedConcerns = (localCurrent.presentConcerns || []).map((concern, i) =>
            i === index ? { ...concern, [field]: value } : concern
        )

        setLocalCurrent({
            ...localCurrent,
            presentConcerns: updatedConcerns,
        })

        // Clear the error when the row becomes valid
        if (showValidationErrors) {
            const newConcernErrors = { ...concernErrors }
            const rowError = getRowError(updatedConcerns[index])
            if (rowError) newConcernErrors[index] = rowError
            else delete newConcernErrors[index]
            setConcernErrors(newConcernErrors)
        }
    }

    const handleAddMore = () => {
        setLocalCurrent((prev) => ({
            ...prev,
            presentConcerns: [...(prev.presentConcerns || []), { problem: "", youOrThem: "" }],
        }))
    }

    const handleDelete = (idx) => {
        setLocalCurrent({
            ...localCurrent,
            presentConcerns: (localCurrent.presentConcerns || []).filter((_, i) => i !== idx),
        })
        setConcernErrors({})
    }

    const validateForm = () => {
        const newConcernErrors = {}
        ;(localCurrent.presentConcerns || []).forEach((concern, index) => {
            const rowError = getRowError(concern)
            if (rowError) newConcernErrors[index] = rowError
        })
        setConcernErrors(newConcernErrors)
        setShowValidationErrors(true)
        return Object.keys(newConcernErrors).length === 0
    }

    const saveBoth = () => {
        updatePersistent(localPersistent)
        updateCurrent(localCurrent)
    }

    const handleContinuePrevious = (e) => {
        e.preventDefault()
        saveBoth()
        handlePrevious()
    }

    // save without moving, so a student can stop here and come back later
    const handleSaveForLater = () => {
        saveBoth()
        requestSave()
    }

    const handleContinue = (e) => {
        e.preventDefault()
        if (!validateForm()) return
        saveBoth()
        handleNext()
    }

    const selectedCount = GROUPS.reduce((total, group) => total + (localPersistent[group.key] || []).length, 0)

    return (
        <div>
            <InterestProgressBar
                steps={steps}
                currentStepIndex={currentStepIndex}
                goToStep={goToStep}
                onStepClick={(targetIndex) => {
                    // Only validate for forward navigation
                    if (targetIndex > currentStepIndex && !validateForm()) {
                        alert("Please fill in all required fields before proceeding.")
                        return false
                    }
                    saveBoth()
                    return true
                }}
            />

            <div>
                <h2>♾️ Your Challenges</h2>
                <p>First the problems we already picked up from your answers, then anything else on your mind right now.</p>
            </div>

            <form onSubmit={handleContinue}>
                {/* ─── Part 1: which of these keep coming back ──────────────── */}
                <div>
                    <h3>Which of these still affect you today?</h3>
                    <p>These come from what you told us about each stage of your life. Tick the ones that haven't gone away.</p>

                    {GROUPS.map((group) => {
                        const options = extractedProblems.filter((it) => it.reason === group.reason)

                        return (
                            <div key={group.key}>
                                <label><strong>{group.label}</strong></label>
                                {options.length === 0 ? (
                                    <p>{group.empty}</p>
                                ) : options.map((option, probIdx) => (
                                    <div key={`${group.key}-problem-${probIdx}`}>
                                        <input
                                            type="checkbox"
                                            id={`${group.key}-problem-${probIdx}`}
                                            checked={(localPersistent[group.key] || []).some((p) => p.problem === option.problem)}
                                            onChange={() => handleCheckboxChange(group.key, option.problem)}
                                        />
                                        <label htmlFor={`${group.key}-problem-${probIdx}`}>{option.problem}</label>
                                    </div>
                                ))}
                            </div>
                        )
                    })}
                </div>

                <hr />

                {/* ─── Part 2: anything else, right now ─────────────────────── */}
                <div>
                    <h3>Anything else troubling you right now?</h3>
                    <p>
                        {selectedCount > 0
                            ? `You've ticked ${selectedCount} above. Add anything current that isn't already listed there.`
                            : "Add anything you're facing right now that isn't listed above."}
                    </p>

                    {(localCurrent.presentConcerns || []).map((val, idx) => (
                        <div key={`presentConcerns${idx}`}>
                            <input
                                placeholder={`Describe the present concern ${idx + 1}`}
                                id={`presentConcernsProblem${idx + 1}`}
                                value={val.problem || ""}
                                onChange={(e) => handleProblemChange(idx, "problem", e.target.value)}
                            />
                            {showValidationErrors && concernErrors[idx] && !val.problem && <p>Problem description is required.</p>}

                            <div>
                                <label htmlFor={`presentConcernsYouOrThem${idx + 1}`}>What held you back?</label>
                                {" "}
                                <select
                                    id={`presentConcernsYouOrThem${idx + 1}`}
                                    value={val.youOrThem || ""}
                                    onChange={(e) => handleProblemChange(idx, "youOrThem", e.target.value)}
                                >
                                    <option value="">-- Select an Option --</option>
                                    {YOU_OR_THEM_OPTIONS.map((option) => (
                                        <option key={option} value={option}>{option}</option>
                                    ))}
                                </select>
                            </div>
                            {showValidationErrors && concernErrors[idx] && !val.youOrThem && <p>This selection is required.</p>}
                            {showValidationErrors && concernErrors[idx] && (
                                <p>Please complete both fields for this concern if you are providing details for it.</p>
                            )}

                            <button type="button" onClick={() => handleDelete(idx)} aria-label="Delete problem">Delete</button>
                        </div>
                    ))}

                    <button type="button" onClick={handleAddMore}>Add More Problems</button>
                </div>

                {/* Navigation Buttons */}
                <div>
                    <button type="button" onClick={handleContinuePrevious} disabled={isSaving}>Previous</button>
                    {" "}
                    <button type="button" onClick={handleSaveForLater} disabled={isSaving}>Save</button>
                    {" "}
                    <button type="submit" disabled={isSaving}>{isSaving ? "Saving..." : "Next"}</button>
                </div>
            </form>
        </div>
    )
}

export default Challenges
