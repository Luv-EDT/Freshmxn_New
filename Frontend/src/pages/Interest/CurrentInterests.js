import { useState, useEffect } from "react"
import InterestProgressBar from "./InterestProgressBar"
import { cleanupCurrentInterests, YOU_OR_THEM_OPTIONS_WITH_TIME } from "./interestFormState"

const CONFIDENCE_LIST = ["High", "Medium", "Low"]

function CurrentInterests({ formData, extractedActivities, extractedProblems, updateFormData, updateExtractedProblems, handleNext, handlePrevious, steps, currentStepIndex, goToStep, isSaving, requestSave, reportDraft }) {
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

    // keep passion / long-term / paused / achievements limited to activities still marked as ongoing
    useEffect(() => {
        const activitySet = new Set((formData.persistentInterests || []).map((item) => item.activity))

        setLocalFormData((prev) => {
            const keepSelected = (obj) => Object.keys(obj || {})
                .filter((activity) => activitySet.has(activity))
                .reduce((result, key) => {
                    result[key] = obj[key]
                    return result
                }, {})

            return {
                ...prev,
                longTermPursuits: (prev.longTermPursuits || []).filter((activity) => activitySet.has(activity)),
                passion: (prev.passion || []).filter((activity) => activitySet.has(activity)),
                discontinuedPursuits: keepSelected(prev.discontinuedPursuits),
                achievementRelated: keepSelected(prev.achievementRelated),
            }
        })
    }, [formData.persistentInterests])

    // when earlier sections change, drop selections whose activity no longer exists
    useEffect(() => {
        setLocalFormData((prev) => {
            const { cleanedFormData } = cleanupCurrentInterests(prev, extractedActivities, extractedProblems)
            return JSON.stringify(cleanedFormData) !== JSON.stringify(prev) ? cleanedFormData : prev
        })
    }, [extractedProblems, extractedActivities])

    // ─── Save helpers ────────────────────────────────────────────────────────
    const saveCleaned = () => {
        const { cleanedFormData, cleanedExtractedProblems } = cleanupCurrentInterests(localFormData, extractedActivities, extractedProblems)
        updateFormData(cleanedFormData)
        if (cleanedExtractedProblems.length !== extractedProblems.length) {
            updateExtractedProblems(cleanedExtractedProblems)
        }
    }

    // Validation for the Next button and forward progress-bar jumps
    const validateCurrentSection = () => {
        // Check persistent interests have confidence levels
        for (const interest of localFormData.persistentInterests || []) {
            if (!interest.confidence || interest.confidence.trim() === "") {
                alert("Please select confidence levels for all persistent interests.")
                return false
            }
        }

        // Check discontinued pursuits have reasons if selected
        for (const [activity, data] of Object.entries(localFormData.discontinuedPursuits || {})) {
            if (data.isSelected) {
                const reasons = data.reason || []
                if (reasons.length === 0) {
                    alert(`Please select at least one reason for discontinuing "${activity}".`)
                    return false
                }
                if (reasons.includes("Other")) {
                    if (!data.otherReason || data.otherReason.trim() === "") {
                        alert(`Please specify the reason for discontinuing "${activity}".`)
                        return false
                    }
                    if (!data.youOrThem || data.youOrThem.trim() === "") {
                        alert(`Please select what held you back for "${activity}".`)
                        return false
                    }
                }
            }
        }

        // Check achievement related have descriptions if selected
        for (const [activity, data] of Object.entries(localFormData.achievementRelated || {})) {
            if (data.isSelected && (!data.achievement || data.achievement.trim() === "")) {
                alert(`Please describe your achievement for "${activity}".`)
                return false
            }
        }

        return true
    }

    // Save changes and proceed to previous section
    const handleContinuePrevious = (e) => {
        e.preventDefault()
        saveCleaned()
        handlePrevious()
    }

    // save without moving, so a student can stop here and come back later
    const handleSaveForLater = () => {
        saveCleaned()
        requestSave()
    }

    // Save changes and proceed to next section
    const handleContinue = (e) => {
        e.preventDefault()
        if (!validateCurrentSection()) return
        saveCleaned()
        handleNext()
    }

    // ─── Selection handlers ──────────────────────────────────────────────────
    const handleTogglePersistent = (activity, isChecked) => {
        if (isChecked) {
            // Remove activity from persistentInterests and all associated fields
            setLocalFormData((prev) => {
                const updatedDiscontinued = { ...(prev.discontinuedPursuits || {}) }
                delete updatedDiscontinued[activity]
                const updatedAchievement = { ...(prev.achievementRelated || {}) }
                delete updatedAchievement[activity]

                return {
                    ...prev,
                    persistentInterests: (prev.persistentInterests || []).filter((item) => item.activity !== activity),
                    longTermPursuits: (prev.longTermPursuits || []).filter((a) => a !== activity),
                    passion: (prev.passion || []).filter((a) => a !== activity),
                    discontinuedPursuits: updatedDiscontinued,
                    achievementRelated: updatedAchievement,
                }
            })
        } else {
            setLocalFormData((prev) => ({
                ...prev,
                persistentInterests: [...(prev.persistentInterests || []), { activity, confidence: "" }],
            }))
        }
    }

    const handleConfidenceChange = (activity, confidence) => {
        setLocalFormData((prev) => ({
            ...prev,
            persistentInterests: (prev.persistentInterests || []).map((item) =>
                item.activity === activity ? { ...item, confidence } : item
            ),
        }))
    }

    const handleToggleInList = (group, activity) => {
        setLocalFormData((prev) => {
            const current = prev[group] || []
            return {
                ...prev,
                [group]: current.includes(activity) ? current.filter((a) => a !== activity) : [...current, activity],
            }
        })
    }

    const updateDiscontinued = (activity, slot) => {
        setLocalFormData((prev) => {
            const updated = { ...(prev.discontinuedPursuits || {}) }
            if (slot) updated[activity] = slot
            else delete updated[activity]
            return { ...prev, discontinuedPursuits: updated }
        })
    }

    const updateAchievement = (activity, slot) => {
        setLocalFormData((prev) => {
            const updated = { ...(prev.achievementRelated || {}) }
            if (slot) updated[activity] = slot
            else delete updated[activity]
            return { ...prev, achievementRelated: updated }
        })
    }

    const ongoingActivities = extractedActivities.filter((act) =>
        (localFormData.persistentInterests || []).some((pi) => pi.activity === act.activity)
    )

    const emptyOngoingNote = (
        <p>
            No ongoing activities found from earlier sections.
            <br />
            <span>You can select them above or continue if none apply.</span>
        </p>
    )

    return (
        <div>
            <InterestProgressBar
                steps={steps}
                currentStepIndex={currentStepIndex}
                goToStep={goToStep}
                onStepClick={(targetIndex) => {
                    // Only validate for forward navigation
                    if (targetIndex > currentStepIndex && !validateCurrentSection()) {
                        return false // Prevent navigation
                    }
                    saveCleaned()
                    return true
                }}
            />

            {/* Brief section header */}
            <div>
                <h2>💡 Current Interests</h2>
                <p>Look back at your past activities and see which ones still feel meaningful to you today.</p>
                <div>
                    <h3>📋 How to reflect on your interests</h3>
                    <p>Think about which activities you still enjoy or care about today and which ones you've outgrown. This helps us understand what motivates you right now.</p>
                </div>
            </div>

            <form onSubmit={handleContinue}>
                {/* Persistent Interests */}
                <div>
                    <label><strong>Ongoing Interests</strong></label> <span>*</span>
                    <p>Which of your earlier activities would you still like to continue? Pick the ones that still feel meaningful to you, even if you don't have time for them right now.</p>

                    {extractedActivities.length === 0 ? (
                        <p>No activities found from earlier sections. Please go back and add some activities first.</p>
                    ) : (
                        extractedActivities.map((option, actIdx) => {
                            const currentInterest = (localFormData.persistentInterests || []).find((item) => item.activity === option.activity)
                            const isChecked = !!currentInterest

                            return (
                                <div key={`persistentInterests-activity-${actIdx}`}>
                                    <input
                                        type="checkbox"
                                        id={`persistentInterests-activity-${actIdx}`}
                                        checked={isChecked}
                                        onChange={() => handleTogglePersistent(option.activity, isChecked)}
                                    />
                                    <label htmlFor={`persistentInterests-activity-${actIdx}`}>{option.activity}</label>

                                    {isChecked && (
                                        <div>
                                            <label htmlFor={`persistentInterest-confidence-select-${actIdx}`}>Confidence Level: <span>*</span></label>
                                            {" "}
                                            <select
                                                id={`persistentInterest-confidence-select-${actIdx}`}
                                                value={currentInterest.confidence}
                                                onChange={(e) => handleConfidenceChange(option.activity, e.target.value)}
                                                required
                                            >
                                                <option value="">Select confidence level</option>
                                                {CONFIDENCE_LIST.map((confOption) => (
                                                    <option key={confOption} value={confOption}>{confOption}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                </div>
                            )
                        })
                    )}
                </div>

                {/* Passion */}
                <div>
                    <label><strong>Strongest Passions</strong></label>
                    <p>Which of your ongoing interests are you most passionate about? These are the ones that excite you and you often think about.</p>
                    <p>(Note: Passion is just an extreme form of interest).</p>

                    {ongoingActivities.length === 0 ? emptyOngoingNote : ongoingActivities.map((item, idx) => (
                        <div key={`passion-activity-${idx}`}>
                            <input
                                type="checkbox"
                                id={`passion-activity-${idx}`}
                                checked={(localFormData.passion || []).includes(item.activity)}
                                onChange={() => handleToggleInList("passion", item.activity)}
                            />
                            <label htmlFor={`passion-activity-${idx}`}>{item.activity}</label>
                        </div>
                    ))}
                </div>

                {/* Longer Term Pursuits */}
                <div>
                    <label><strong>Long-Term Commitments</strong></label>
                    <p>Which activities have you been doing for more than 6 months? These show your dedication and consistency.</p>

                    {ongoingActivities.length === 0 ? emptyOngoingNote : ongoingActivities.map((item, idx) => (
                        <div key={`longTermPursuit-activity-${idx}`}>
                            <input
                                type="checkbox"
                                id={`longTermPursuit-activity-${idx}`}
                                checked={(localFormData.longTermPursuits || []).includes(item.activity)}
                                onChange={() => handleToggleInList("longTermPursuits", item.activity)}
                            />
                            <label htmlFor={`longTermPursuit-activity-${idx}`}>{item.activity}</label>
                        </div>
                    ))}
                </div>

                {/* Discontinued Pursuits */}
                <div>
                    <label><strong>Activities You've Paused</strong></label>
                    <p>Which activities did you pursue but later stop? Please share why you paused or stopped them.</p>

                    {ongoingActivities.length === 0 ? emptyOngoingNote : ongoingActivities.map((item, idx) => {
                        const slot = (localFormData.discontinuedPursuits || {})[item.activity] || { isSelected: false, reason: [], otherReason: "", youOrThem: "" }
                        const reasons = slot.reason || []

                        return (
                            <div key={`discontinued-activity-${idx}`}>
                                <input
                                    type="checkbox"
                                    id={`discontinued-activity-select-${idx}`}
                                    checked={slot.isSelected}
                                    onChange={(e) => updateDiscontinued(
                                        item.activity,
                                        e.target.checked ? { isSelected: true, reason: [], otherReason: "", youOrThem: "" } : null
                                    )}
                                />
                                <label htmlFor={`discontinued-activity-select-${idx}`}>{item.activity}</label>

                                {slot.isSelected && (
                                    <div>
                                        <label>Reason for stopping:</label>
                                        {extractedProblems.length === 0 && !(reasons.includes("Other") && slot.otherReason) && (
                                            <p>No problems found. Select "Other" to specify.</p>
                                        )}

                                        {extractedProblems.filter((problemOption) => !problemOption.problem.endsWith("*")).map((problemOption, pIdx) => (
                                            <div key={`disc-reason-${idx}-${pIdx}`}>
                                                <input
                                                    type="checkbox"
                                                    id={`disc-reason-${idx}-${pIdx}`}
                                                    checked={reasons.includes(problemOption.problem)}
                                                    onChange={(e) => updateDiscontinued(item.activity, {
                                                        ...slot,
                                                        isSelected: true,
                                                        reason: e.target.checked
                                                            ? [...reasons, problemOption.problem]
                                                            : reasons.filter((r) => r !== problemOption.problem),
                                                    })}
                                                />
                                                <label htmlFor={`disc-reason-${idx}-${pIdx}`}>{problemOption.problem}</label>
                                            </div>
                                        ))}

                                        <div>
                                            <input
                                                type="checkbox"
                                                id={`disc-reason-${idx}-Other`}
                                                checked={reasons.includes("Other")}
                                                onChange={(e) => updateDiscontinued(item.activity, e.target.checked
                                                    ? { ...slot, isSelected: true, reason: [...reasons, "Other"] }
                                                    : { ...slot, isSelected: true, reason: reasons.filter((r) => r !== "Other"), otherReason: "", youOrThem: "" }
                                                )}
                                            />
                                            <label htmlFor={`disc-reason-${idx}-Other`}>Other</label>
                                        </div>

                                        {reasons.includes("Other") && (
                                            <div>
                                                <input
                                                    type="text"
                                                    placeholder="Specify your reason"
                                                    value={slot.otherReason || ""}
                                                    onChange={(e) => updateDiscontinued(item.activity, { ...slot, isSelected: true, otherReason: e.target.value })}
                                                    required
                                                />
                                                <div>
                                                    <label>What held you back?</label>
                                                    {YOU_OR_THEM_OPTIONS_WITH_TIME.map((yotOption, yotIdx) => (
                                                        <div key={`disc-yot-${idx}-${yotIdx}`}>
                                                            <input
                                                                type="radio"
                                                                id={`disc-yot-${idx}-${yotIdx}`}
                                                                name={`disc-yot-${idx}`}
                                                                checked={slot.youOrThem === yotOption}
                                                                onChange={() => updateDiscontinued(item.activity, {
                                                                    ...slot,
                                                                    isSelected: true,
                                                                    youOrThem: yotOption,
                                                                    // "Time constraints/Phase of life ended" IS the reason, so fill it in
                                                                    // rather than making them type it out to pass validation
                                                                    otherReason: yotOption === YOU_OR_THEM_OPTIONS_WITH_TIME[3] && !slot.otherReason
                                                                        ? yotOption
                                                                        : slot.otherReason,
                                                                })}
                                                                required
                                                            />
                                                            <label htmlFor={`disc-yot-${idx}-${yotIdx}`}>{yotOption}</label>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>

                {/* Achievement Related Pursuits */}
                <div>
                    <label><strong>Achievements & Highlights</strong></label> <span>*</span>
                    <p>Which of your ongoing interests have led to something you're proud of? Describe what you achieved or learned through them.</p>

                    {ongoingActivities.length === 0 ? emptyOngoingNote : ongoingActivities.map((item, idx) => {
                        const slot = (localFormData.achievementRelated || {})[item.activity] || { isSelected: false, achievement: "" }

                        return (
                            <div key={`achievement-activity-${idx}`}>
                                <input
                                    type="checkbox"
                                    id={`achievement-activity-select-${idx}`}
                                    checked={slot.isSelected}
                                    onChange={(e) => updateAchievement(item.activity, e.target.checked ? { isSelected: true, achievement: "" } : null)}
                                />
                                <label htmlFor={`achievement-activity-select-${idx}`}>{item.activity}</label>

                                {slot.isSelected && (
                                    <div>
                                        <label htmlFor={`achievement-text-${idx}`}>Describe your achievement:</label>
                                        {" "}
                                        <input
                                            type="text"
                                            id={`achievement-text-${idx}`}
                                            placeholder="What are you proud of accomplishing?"
                                            value={slot.achievement || ""}
                                            onChange={(e) => updateAchievement(item.activity, { ...slot, isSelected: true, achievement: e.target.value })}
                                            required
                                        />
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>

                {/* Note about adding more activities */}
                <p><strong>Need to add more activities?</strong> Go back to previous sections and add them there, then return here to select them.</p>

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

export default CurrentInterests
