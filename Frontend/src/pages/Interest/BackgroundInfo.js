import { useState, useEffect } from "react"
import InterestProgressBar from "./InterestProgressBar"

const PARENT_EDUCATION_OPTIONS = [
    { value: "No formal education", label: "No formal education" },
    { value: "Primary education", label: "Primary education" },
    { value: "High school graduate", label: "High school graduate" },
    { value: "Some college", label: "Some college (or diploma)" },
    { value: "Bachelor's degree", label: "Bachelor's degree" },
    { value: "Master's degree", label: "Master's degree" },
    { value: "Doctoral/Professional degree", label: "Doctoral/Professional degree" },
    // every question here is required, so a student with one parent still needs an answer to give
    { value: "Not applicable", label: "Not applicable / prefer not to say" },
]

const FINANCIAL_OPTIONS = ["Financially struggling", "Lower middle class", "Middle class", "Upper middle class", "Affluent"]

const YES_NO_OPTIONS = ["Yes", "No", "Prefer not to say"]

const COMPETITION_OPTIONS = [
    { value: "thrive", label: "I thrive in competitive environments and enjoy standing out through direct competition" },
    { value: "unique", label: "I prefer finding unique/out-of-the-box approaches to stand out rather than direct competition" },
    { value: "comfortable", label: "I'm comfortable being part of a crowd and choosing safer options, without seeking recognition" },
    { value: "recognition", label: "I don't seek competition, nor do I intentionally take out-of-the-box approaches—but I still desire recognition and appreciation." },
]

// exported: the mentor onboarding form asks mentors the same question in the same words (PRD §B.9)
export const ACADEMIC_OPTIONS = [
    { value: "Category A", label: "Category A: Knew exactly which path to take, applied to specific colleges with clear goals, and achieved them" },
    { value: "Category B", label: "Category B: Followed successful peers' paths and achieved desired outcomes" },
    { value: "Category C", label: "Category C: Tried to follow established paths but couldn't achieve desired outcomes" },
    { value: "Category D", label: "Category D: Took a relaxed approach without specific educational/career targets" },
]

function BackgroundInfo({ formData, updateFormData, handleNext, handlePrevious, showAcademicClassification, steps, currentStepIndex, goToStep, isSaving, requestSave, reportDraft }) {
    // Local state for the form
    const [localFormData, setLocalFormData] = useState(formData)

    // Update local state when formData prop changes
    useEffect(() => {
        if (formData) {
            setLocalFormData(formData)
        }
    }, [formData])

    // keep the local draft current while typing, so a refresh mid-section loses nothing
    useEffect(() => {
        reportDraft(localFormData)
    }, [localFormData])

    // text inputs, selects and radios all store by name
    const handleInputChange = (e) => {
        const { name, value } = e.target
        setLocalFormData((prev) => ({
            ...prev,
            [name]: value,
        }))
    }

    // repeatable lists (supportNetwork, culturalIdentity)
    const handleListChange = (group, index, value) => {
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

    const handleContinue = (e) => {
        e.preventDefault()
        updateFormData(localFormData)
        handleNext()
    }

    // every question in this section is required. `required` on a radio group is satisfied by any
    // one of its buttons, and only blocks Next — Save deliberately still works on a part-filled form.
    const renderRadioGroup = (name, options) => (
        <div>
            {options.map((option) => {
                const value = typeof option === "string" ? option : option.value
                const label = typeof option === "string" ? option : option.label
                return (
                    <div key={value}>
                        <label>
                            <input
                                type="radio"
                                name={name}
                                value={value}
                                checked={localFormData[name] === value}
                                onChange={handleInputChange}
                                required
                            />
                            {" "}{label}
                        </label>
                    </div>
                )
            })}
        </div>
    )

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

            {/* Brief section header */}
            <div>
                <h2>📝 Background Information</h2>
                <p>Help us understand your context and preferences for better guidance</p>
                <div>
                    <h3>📋 Why this matters</h3>
                    <p>Your background helps us provide more personalized and relevant guidance for your unique situation.</p>
                    <p>
                        <strong>All the questions on this page are required</strong> — every one of them feeds
                        your results. The only exceptions are the "specify if comfortable" boxes, which stay
                        entirely up to you. You can still press Save and finish this page later.
                    </p>
                </div>
            </div>

            <form onSubmit={handleContinue}>
                {/* Competition Preference */}
                <div>
                    <label><strong>How You Approach Success</strong></label>
                    <p>How do you prefer to achieve recognition and stand out? Choose the approach that feels most natural to you.</p>
                    {renderRadioGroup("competitionPreference", COMPETITION_OPTIONS)}
                    {localFormData.competitionPreference === "recognition" && (
                        <div>
                            <label>Please describe what actions you take for this:</label>
                            <br />
                            <textarea
                                name="competitionActions"
                                value={localFormData.competitionActions}
                                onChange={handleInputChange}
                                rows="3"
                                placeholder="Describe your approach..."
                                required
                            />
                        </div>
                    )}
                </div>

                {/* Family Educational Background */}
                <div>
                    <label><strong>Parent Education</strong></label>
                    {["parentEducation1", "parentEducation2"].map((name, idx) => (
                        <div key={name}>
                            <label>Parent {idx + 1}:</label>{" "}
                            <select name={name} value={localFormData[name]} onChange={handleInputChange} required>
                                <option value="">Select education level</option>
                                {PARENT_EDUCATION_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                            </select>
                        </div>
                    ))}
                </div>

                {/* Family Professions */}
                <div>
                    <label><strong>Parent Professions</strong></label>
                    {["parentProfession1", "parentProfession2"].map((name, idx) => (
                        <div key={name}>
                            <label>Parent {idx + 1}:</label>{" "}
                            <input
                                type="text"
                                name={name}
                                value={localFormData[name]}
                                onChange={handleInputChange}
                                placeholder="e.g., Teacher, Engineer, Business Owner"
                                required
                            />
                        </div>
                    ))}
                </div>

                {/* Family Financial Background */}
                <div>
                    <label><strong>Financial Background</strong></label>
                    {[["financialSituationGrowingUp", "Growing up:"], ["financialSituationCurrent", "Currently:"]].map(([name, label]) => (
                        <div key={name}>
                            <label>{label}</label>{" "}
                            <select name={name} value={localFormData[name]} onChange={handleInputChange} required>
                                <option value="">Select financial situation</option>
                                {FINANCIAL_OPTIONS.map((option) => (
                                    <option key={option} value={option}>{option}</option>
                                ))}
                            </select>
                        </div>
                    ))}
                </div>

                {/* Geographic Information */}
                <div>
                    <label><strong>Cultural Background</strong></label>
                    {["parentsNativePlace1", "parentsNativePlace2"].map((name, idx) => (
                        <div key={name}>
                            <label>Parent {idx + 1}'s native place:</label>{" "}
                            <input
                                type="text"
                                name={name}
                                value={localFormData[name]}
                                onChange={handleInputChange}
                                placeholder="e.g., Mumbai, India"
                                required
                            />
                        </div>
                    ))}

                    <div>
                        <label>Places you feel culturally connected to:</label>
                        <p>Add one place per box</p>
                        {localFormData.culturalIdentity.map((val, idx) => (
                            <div key={`culturalIdentity${idx}`}>
                                <input
                                    id={`culturalIdentity${idx + 1}`}
                                    value={val}
                                    onChange={(e) => handleListChange("culturalIdentity", idx, e.target.value)}
                                    placeholder={idx === 0 ? "e.g., Mumbai" : "Another place"}
                                    required={idx === 0}
                                />
                            </div>
                        ))}
                        <button type="button" onClick={() => handleAddMore("culturalIdentity")}>Add More Places</button>
                    </div>
                </div>

                {/* Education is not asked here — the student's stage is already captured at signup */}

                {/* Disability Status */}
                <div>
                    <label><strong>Disability Status</strong></label>
                    {renderRadioGroup("disability", YES_NO_OPTIONS)}
                    {localFormData.disability === "Yes" && (
                        <div>
                            <label>Please specify if comfortable:</label>{" "}
                            <input
                                type="text"
                                name="disabilitySpecify"
                                value={localFormData.disabilitySpecify}
                                onChange={handleInputChange}
                                placeholder="Optional - describe if you're comfortable"
                            />
                        </div>
                    )}
                </div>

                {/* Academic Self-Classification — only for students who have made the school → college transition */}
                {showAcademicClassification && (
                    <div>
                        <label><strong>Your Academic Journey from High School to College</strong></label>
                        <p>How did you approach your transition from school to college? This helps us understand your decision-making style.</p>
                        {renderRadioGroup("academicClassification", ACADEMIC_OPTIONS)}
                    </div>
                )}

                {/* Personal History */}
                <div>
                    <label><strong>Personal History</strong></label>
                    <div>
                        <label>Has your family experienced any past trauma?</label>
                        <p>Examples include belonging to a minority group that faced discrimination</p>
                        {renderRadioGroup("familyTrauma", YES_NO_OPTIONS)}
                        {localFormData.familyTrauma === "Yes" && (
                            <div>
                                <label>Please specify if comfortable:</label>{" "}
                                <input
                                    type="text"
                                    name="familyTraumaSpecify"
                                    value={localFormData.familyTraumaSpecify}
                                    onChange={handleInputChange}
                                    placeholder="Optional - describe if you're comfortable"
                                />
                            </div>
                        )}
                    </div>
                    <div>
                        <label>Have you personally experienced childhood or recent trauma?</label>
                        <p>Trauma refers to deeply distressing experiences that overwhelmed your ability to cope</p>
                        {renderRadioGroup("personalTrauma", YES_NO_OPTIONS)}
                        {localFormData.personalTrauma === "Yes" && (
                            <div>
                                <label>Please specify if comfortable:</label>{" "}
                                <input
                                    type="text"
                                    name="personalTraumaSpecify"
                                    value={localFormData.personalTraumaSpecify}
                                    onChange={handleInputChange}
                                    placeholder="Optional - describe if you're comfortable"
                                />
                            </div>
                        )}
                    </div>
                </div>

                {/* Support Network */}
                <div>
                    <label><strong>People You Turn To for Support</strong></label>
                    <p>Who are the people in your life that you immediately feel close to and can rely on for guidance?</p>
                    {localFormData.supportNetwork.map((val, idx) => (
                        <div key={`supportNetwork${idx}`}>
                            <input
                                id={`supportNetwork${idx + 1}`}
                                value={val}
                                onChange={(e) => handleListChange("supportNetwork", idx, e.target.value)}
                                placeholder={`Person ${idx + 1} (e.g., mother, best friend, mentor)`}
                                required={idx === 0}
                            />
                        </div>
                    ))}
                    <button type="button" onClick={() => handleAddMore("supportNetwork")}>Add More People</button>
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

export default BackgroundInfo
