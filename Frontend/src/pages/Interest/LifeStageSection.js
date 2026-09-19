import { useState, useEffect } from "react"
import ActivityReferenceList from "./ActivityReferenceList"
import InterestProgressBar from "./InterestProgressBar"
import HelpIcon from "./HelpIcon"
import ProblemPromptList from "./ProblemPromptList"

// One life-stage section (Pre-High School / High School / College / Post-College).
// The four original files were identical except for their text, so the fields live here once and
// each stage file passes its own `stage` copy (heading, help text, placeholders, reference list, prompts).

const SIMPLE_GROUPS = [
    { key: "personalGrowth", label: "Personal Growth Activities" },
    { key: "curiosityDriven", label: "Curiosity-Driven Activities" },
]

const PROBLEM_GROUP_LABELS = {
    individualInternalProblems: "Individual Internal Problems",
    interpersonalInternalProblems: "Interpersonal Problems",
    externalProblems: "External Problems",
}

const LATER_SIMPLE_GROUPS = [
    { key: "socialRecognition", label: "Social Recognition Activities" },
    { key: "effortlessEngagement", label: "Effortless Engagement Activities" },
]

function LifeStageSection({ stage, formData, updateFormData, handleNext, handlePrevious, isFirstStep, steps, currentStepIndex, goToStep, isSaving, requestSave, reportDraft }) {
    // Local state for the form
    const [localFormData, setLocalFormData] = useState(formData)

    // Update local state when formData prop changes
    // keep the local draft current while typing, so a refresh mid-section loses nothing
    useEffect(() => {
        reportDraft(localFormData)
    }, [localFormData])

    useEffect(() => {
        setLocalFormData(formData)
    }, [formData])

    // ── simple activity lists ────────────────────────────────────────────────
    const handleInputChange = (group, index, value) => {
        setLocalFormData((prev) => ({
            ...prev,
            [group]: prev[group].map((item, i) => (i === index ? value : item)),
        }))
    }

    const handleAddMore = (group) => {
        setLocalFormData((prev) => ({
            ...prev,
            [group]: [...prev[group], ""],
        }))
    }

    // ── problems ─────────────────────────────────────────────────────────────
    const handleProblemChange = (group, index, value) => {
        setLocalFormData((prev) => ({
            ...prev,
            [group]: prev[group].map((row, i) => (i === index ? { ...row, problem: value } : row)),
        }))
    }

    const handleProblemActivitiesChange = (group, index, idx, value) => {
        setLocalFormData((prev) => ({
            ...prev,
            [group]: prev[group].map((row, i) =>
                i === index ? { ...row, activities: row.activities.map((act, j) => (j === idx ? value : act)) } : row
            ),
        }))
    }

    const handleAddMoreActivities = (group, index) => {
        setLocalFormData((prev) => ({
            ...prev,
            [group]: prev[group].map((row, i) => (i === index ? { ...row, activities: [...row.activities, ""] } : row)),
        }))
    }

    const handleAddMoreProblems = (group) => {
        setLocalFormData((prev) => ({
            ...prev,
            [group]: [...prev[group], { problem: "", source: "typed", activities: [""] }],
        }))
    }

    const handleRemoveProblem = (group, index) => {
        setLocalFormData((prev) => {
            const remaining = prev[group].filter((_, i) => i !== index)
            return {
                ...prev,
                [group]: remaining.length > 0 ? remaining : [{ problem: "", source: "typed", activities: [""] }],
            }
        })
    }

    // a prompt fills the first empty row, or adds a new one — saved with source: "prompt"
    const handlePickPrompt = (group, promptText) => {
        setLocalFormData((prev) => {
            const rows = [...prev[group]]
            const emptyIndex = rows.findIndex((row) => !row.problem.trim() && row.activities.every((act) => !act.trim()))

            if (emptyIndex >= 0) {
                rows[emptyIndex] = { ...rows[emptyIndex], problem: promptText, source: "prompt" }
            } else {
                rows.push({ problem: promptText, source: "prompt", activities: [""] })
            }

            return { ...prev, [group]: rows }
        })
    }

    // ── additional interests ─────────────────────────────────────────────────
    const handleAdditionalChange = (index, field, value) => {
        setLocalFormData((prev) => ({
            ...prev,
            additionalInterests: prev.additionalInterests.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
        }))
    }

    const handleAddMoreAdditional = () => {
        setLocalFormData((prev) => ({
            ...prev,
            additionalInterests: [...prev.additionalInterests, { activity: "", reason: "" }],
        }))
    }

    // ── skip (Pre-High School only) ──────────────────────────────────────────
    const handleSkipChange = (isSkipped) => {
        setLocalFormData((prev) => ({ ...prev, skipped: isSkipped }))
    }

    // ── navigation ───────────────────────────────────────────────────────────
    // Save changes and proceed to previous section
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

    // Save changes and proceed to next section
    const handleContinue = (e) => {
        e.preventDefault()
        updateFormData(localFormData)
        handleNext()
    }

    // ── render helpers ───────────────────────────────────────────────────────
    const renderHelp = (key, title) => (
        <HelpIcon title={title}>
            {stage.help[key].map((line, i) => (
                <p key={i}>{line.strong && <strong>{line.strong} </strong>}{line.text || line}</p>
            ))}
        </HelpIcon>
    )

    const renderSimpleGroup = ({ key, label }) => (
        <div key={key}>
            <label><strong>{label}</strong></label> {renderHelp(key, label)}
            {localFormData[key].map((val, idx) => (
                <div key={`${key}${idx}`}>
                    <input
                        id={`${key}${idx + 1}`}
                        name={`${key}${idx + 1}`}
                        value={val}
                        onChange={(e) => handleInputChange(key, idx, e.target.value)}
                        placeholder={stage.placeholders[key]}
                    />
                </div>
            ))}
            <button type="button" onClick={() => handleAddMore(key)}>Add More Activities</button>
        </div>
    )

    const renderProblemGroup = (group) => {
        const label = PROBLEM_GROUP_LABELS[group]
        const usedProblems = localFormData[group].map((row) => row.problem)

        return (
            <div key={group}>
                <label><strong>{label}</strong></label> {renderHelp(group, label)}

                <ProblemPromptList
                    prompts={stage.prompts[group]}
                    usedProblems={usedProblems}
                    onPick={(promptText) => handlePickPrompt(group, promptText)}
                />

                {localFormData[group].map((row, index) => (
                    <div key={`${group}-${index}`}>
                        <div>
                            <label>Problem:</label>
                            <br />
                            <input
                                type="text"
                                value={row.problem}
                                onChange={(e) => handleProblemChange(group, index, e.target.value)}
                                placeholder={stage.placeholders[group][0]}
                            />
                            {" "}
                            <button type="button" onClick={() => handleRemoveProblem(group, index)}>Remove</button>
                        </div>
                        <div>
                            <label>Activities that helped:</label>
                            {row.activities.map((activity, idx) => (
                                <div key={`${group}-activity-${index}-${idx}`}>
                                    <input
                                        type="text"
                                        value={activity}
                                        onChange={(e) => handleProblemActivitiesChange(group, index, idx, e.target.value)}
                                        placeholder={stage.placeholders[group][1]}
                                    />
                                </div>
                            ))}
                            <button type="button" onClick={() => handleAddMoreActivities(group, index)}>Add More Activities</button>
                        </div>
                    </div>
                ))}
                <button type="button" onClick={() => handleAddMoreProblems(group)}>Add More Problems</button>
            </div>
        )
    }

    return (
        <div>
            <InterestProgressBar
                steps={steps}
                currentStepIndex={currentStepIndex}
                goToStep={goToStep}
                onStepClick={() => {               // Function to save data before navigation
                    updateFormData(localFormData)  // Save current form data
                    return true
                }}
            />

            <div>
                <h2>{stage.heading}</h2>
                <p>{stage.subtitle}</p>
                <div>
                    <h3>📋 What are "activities"?</h3>
                    <p>Activities include both completed achievements (like winning competitions) and ongoing pursuits (like playing cricket, reading books).</p>
                </div>
            </div>

            {/* Change 2 — Pre-High School can be skipped */}
            {stage.isSkippable && (
                <div>
                    <label>
                        <input
                            type="checkbox"
                            checked={!!localFormData.skipped}
                            onChange={(e) => handleSkipChange(e.target.checked)}
                        />
                        {" "}I can't clearly recall this period — skip it
                    </label>
                    <p><em>If you can't recall, just answer everything in the High School section instead.</em></p>
                </div>
            )}

            <form onSubmit={handleContinue}>
                {!localFormData.skipped && (
                    <>
                        <ActivityReferenceList activities={stage.referenceList} />

                        {SIMPLE_GROUPS.map(renderSimpleGroup)}

                        {["individualInternalProblems", "interpersonalInternalProblems", "externalProblems"].map(renderProblemGroup)}

                        {LATER_SIMPLE_GROUPS.map(renderSimpleGroup)}

                        {/* Additional Interests */}
                        <div>
                            <label><strong>Additional Interests</strong></label> {renderHelp("additionalInterests", "Additional Interests")}
                            {localFormData.additionalInterests.map((row, idx) => (
                                <div key={`additionalInterests${idx}`}>
                                    <input
                                        placeholder="Activity"
                                        id={`additionalInterests${idx + 1}-activity`}
                                        value={row.activity}
                                        onChange={(e) => handleAdditionalChange(idx, "activity", e.target.value)}
                                    />
                                    {" "}
                                    <input
                                        placeholder="Why you liked it"
                                        id={`additionalInterests${idx + 1}-reason`}
                                        value={row.reason}
                                        onChange={(e) => handleAdditionalChange(idx, "reason", e.target.value)}
                                    />
                                </div>
                            ))}
                            <button type="button" onClick={handleAddMoreAdditional}>Add More Activities</button>
                        </div>
                    </>
                )}

                {/* Navigation Buttons */}
                <div>
                    {!isFirstStep && (
                        <button type="button" onClick={handleContinuePrevious} disabled={isSaving}>Previous</button>
                    )}
                    {" "}
                    <button type="button" onClick={handleSaveForLater} disabled={isSaving}>Save</button>
                    {" "}
                    <button type="submit" disabled={isSaving}>{isSaving ? "Saving..." : "Next"}</button>
                </div>
            </form>
        </div>
    )
}

export default LifeStageSection
