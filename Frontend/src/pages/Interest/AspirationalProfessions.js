import { useState, useEffect, useRef } from "react"
import { AutoComplete } from "antd"
import InterestProgressBar from "./InterestProgressBar"
import { searchProfessions } from "../../apiCall/professionsApi"

// Change 3 — asked LAST on purpose, so naming a dream career can't colour the activity answers above.
// Each profession typed here is saved as an aspiration AND as a Medium-confidence persistent interest
// flagged source: "aspiration", so the career-choice bias stays visible instead of blending in.

function AspirationalProfessions({ formData, updateFormData, handleNext, handlePrevious, steps, currentStepIndex, goToStep, isLastContentStep, isSaving, requestSave, reportDraft }) {
    const [localFormData, setLocalFormData] = useState(formData)   // [{ professionText, professionId }]
    const [suggestions, setSuggestions] = useState({})              // { [rowIndex]: [{ value, label, id }] }
    const searchTimer = useRef(null)

    useEffect(() => {
        setLocalFormData(formData)
    }, [formData])

    // keep the local draft current while typing, so a refresh mid-section loses nothing
    useEffect(() => {
        reportDraft(localFormData)
    }, [localFormData])

    // ─── Autocomplete against the 223 professions ────────────────────────────
    const handleSearch = (index, text) => {
        clearTimeout(searchTimer.current)

        if (!text || text.trim().length < 2) {
            setSuggestions((prev) => ({ ...prev, [index]: [] }))
            return
        }

        searchTimer.current = setTimeout(async () => {
            try {
                const response = await searchProfessions(text.trim())
                setSuggestions((prev) => ({
                    ...prev,
                    [index]: response.data.data.map((profession) => ({
                        value: profession.profession,
                        id: profession.id,
                        label: profession.matchedRole
                            ? `${profession.profession} (e.g., ${profession.matchedRole})`
                            : profession.profession,
                    })),
                }))
            } catch (error) {
                setSuggestions((prev) => ({ ...prev, [index]: [] }))
            }
        }, 250)
    }

    // picking a suggestion passes its option (with the taxonomy id); typing free text clears any earlier match
    const handleTextChange = (index, text, option) => {
        const professionId = option && option.id ? option.id : null
        setLocalFormData((prev) => prev.map((row, i) => (i === index ? { professionText: text, professionId } : row)))
    }

    const handleAddMore = () => {
        setLocalFormData((prev) => [...prev, { professionText: "", professionId: null }])
    }

    const handleRemove = (index) => {
        setLocalFormData((prev) => {
            const remaining = prev.filter((_, i) => i !== index)
            return remaining.length > 0 ? remaining : [{ professionText: "", professionId: null }]
        })
    }

    // Save changes and proceed
    const handleContinuePrevious = (e) => {
        e.preventDefault()
        updateFormData(localFormData)
        handlePrevious()
    }

    // save without moving, so a student can stop here and come back later
    const handleSaveForLater = () => {
        updateFormData(localFormData)
        requestSave()
    }

    const handleContinue = (e) => {
        e.preventDefault()

        // this is the last section, so Next is what completes the form — worth asking
        if (isLastContentStep && !window.confirm("Finish and submit your interest form? You can still come back and edit it.")) {
            return
        }

        updateFormData(localFormData)
        handleNext()
    }

    return (
        <div>
            <InterestProgressBar
                steps={steps}
                currentStepIndex={currentStepIndex}
                goToStep={goToStep}
                onStepClick={() => {
                    updateFormData(localFormData)
                    return true
                }}
            />

            <div>
                <h2>🌟 Professions You're Drawn To</h2>
                <p>Which professions do you think you'd like to be in, based on what you currently fancy or think is good?</p>
                <p><em>This is optional — skip it completely if nothing comes to mind.</em></p>
            </div>

            <form onSubmit={handleContinue}>
                {localFormData.map((row, idx) => (
                    <div key={`aspiration${idx}`}>
                        <AutoComplete
                            style={{ width: "100%", maxWidth: 360 }}
                            value={row.professionText}
                            options={suggestions[idx] || []}
                            onSearch={(text) => handleSearch(idx, text)}
                            onChange={(text, option) => handleTextChange(idx, text, option)}
                            placeholder={`Profession ${idx + 1} (e.g., Doctor, Game Designer)`}
                        />
                        {" "}
                        {row.professionId && <span>✓ matched</span>}
                        {" "}
                        <button type="button" onClick={() => handleRemove(idx)}>Remove</button>
                    </div>
                ))}
                <button type="button" onClick={handleAddMore}>Add Another Profession</button>

                {/* Navigation Buttons */}
                <div>
                    <button type="button" onClick={handleContinuePrevious} disabled={isSaving}>Previous</button>
                    {" "}
                    <button type="button" onClick={handleSaveForLater} disabled={isSaving}>Save</button>
                    {" "}
                    <button type="submit" disabled={isSaving}>
                        {isSaving ? "Saving..." : isLastContentStep ? "Finish" : "Next"}
                    </button>
                </div>
            </form>
        </div>
    )
}

export default AspirationalProfessions
