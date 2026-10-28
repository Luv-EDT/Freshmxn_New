import { useState, useEffect } from "react"
import VoiceInput from "../VoiceInput"
import ActivityReferenceList, { DRAG_TYPE } from "./ActivityReferenceList"
import InterestProgressBar from "./InterestProgressBar"
import ProblemPromptList from "./ProblemPromptList"
import QuestionCard from "./QuestionCard"
import ChipListInput from "./ChipListInput"

// One life-stage section (Pre-High School / High School / College / Post-College).
// The four original files were identical except for their text, so the fields live here once and
// each stage file passes its own `stage` copy (heading, help text, placeholders, reference list, prompts).
//
// LAID OUT AS THREE CARDS (Round 10, S10): what you did, what got in your way, anything else. Each
// question is asked in plain words, its first help line shows under it and the rest folds under
// "See examples". Same fields, same data — only the page changed.

const ACTIVITY_GROUPS = [
    { key: "personalGrowth", title: "What helped you grow?" },
    { key: "curiosityDriven", title: "What did you explore just because you were curious?" },
    { key: "socialRecognition", title: "What did you do that people noticed or praised?" },
    { key: "effortlessEngagement", title: "What felt effortless — where time just flew?" },
]

const PROBLEM_GROUPS = [
    { key: "individualInternalProblems", title: "Struggles inside you" },
    { key: "interpersonalInternalProblems", title: "Struggles with people around you" },
    { key: "externalProblems", title: "Problems you saw around you" },
]

function LifeStageSection({ stage, formData, updateFormData, handleNext, handlePrevious, isFirstStep, steps, currentStepIndex, goToStep, isSaving, requestSave, reportDraft, resumeList }) {
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

    // ── problems ─────────────────────────────────────────────────────────────
    const handleProblemChange = (group, index, value) => {
        setLocalFormData((prev) => ({
            ...prev,
            [group]: prev[group].map((row, i) => (i === index ? { ...row, problem: value } : row)),
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

    // ── from the "Stuck?" list (Round 37, owner): a tapped or dragged activity goes straight into a question ──
    const ADD_TARGETS = [...ACTIVITY_GROUPS, { key: "additionalInterests", title: "Anything else you enjoyed?" }]
    const addActivity = (key, text) => {
        setLocalFormData((prev) => {
            if (key === "additionalInterests") {
                const rows = prev.additionalInterests
                if (rows.some((row) => row.activity.trim().toLowerCase() === text.toLowerCase())) return prev
                const empty = rows.findIndex((row) => !row.activity.trim() && !row.reason.trim())
                return {
                    ...prev,
                    additionalInterests: empty >= 0
                        ? rows.map((row, i) => (i === empty ? { ...row, activity: text } : row))
                        : [...rows, { activity: text, reason: "" }],
                }
            }
            const list = (prev[key] || []).filter((value) => typeof value === "string" && value.trim() !== "")
            if (list.some((value) => value.toLowerCase() === text.toLowerCase())) return prev
            return { ...prev, [key]: [...list, text] }
        })
    }
    // a question's card takes an activity dropped on it
    const dropOn = (key) => ({
        onDragOver: (event) => event.preventDefault(),
        onDrop: (event) => {
            event.preventDefault()
            const text = event.dataTransfer.getData(DRAG_TYPE).trim()
            if (text) addActivity(key, text)
        },
    })

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
    // a help list's first line is the prompt shown under the question; the rest are examples
    const promptOf = (key) => {
        const line = stage.help[key][0]
        return line.strong ? `${line.strong} ${line.text}` : line
    }
    const examplesOf = (key) => stage.help[key].slice(1)

    const renderActivityGroup = ({ key, title }) => (
        <QuestionCard key={key} title={title} prompt={promptOf(key)} examples={examplesOf(key)} htmlFor={`${key}-input`}>
            <div className="if-drop" {...dropOn(key)}>
                <ChipListInput
                    id={`${key}-input`}
                    label={title}
                    values={localFormData[key]}
                    onChange={(list) => setLocalFormData((prev) => ({ ...prev, [key]: list }))}
                    placeholder={stage.placeholders[key]}
                />
            </div>
        </QuestionCard>
    )

    const renderProblemGroup = ({ key: group, title }) => {
        const usedProblems = localFormData[group].map((row) => row.problem)

        return (
            <QuestionCard key={group} title={title} prompt={promptOf(group)} examples={examplesOf(group)}>
                <ProblemPromptList
                    prompts={stage.prompts[group]}
                    usedProblems={usedProblems}
                    onPick={(promptText) => handlePickPrompt(group, promptText)}
                />

                {localFormData[group].map((row, index) => (
                    <div key={`${group}-${index}`} className="if-problem">
                        <label htmlFor={`${group}-${index}-problem`} className="if-small-label">The problem</label>
                        <input
                            type="text"
                            id={`${group}-${index}-problem`}
                            value={row.problem}
                            onChange={(e) => handleProblemChange(group, index, e.target.value)}
                            placeholder={stage.placeholders[group][0]}
                        />
                        <VoiceInput compact value={row.problem} onChange={(text) => handleProblemChange(group, index, text)} />
                        <label htmlFor={`${group}-${index}-helped`} className="if-small-label">What helped</label>
                        <ChipListInput
                            id={`${group}-${index}-helped`}
                            label="What helped"
                            values={row.activities}
                            onChange={(list) => setLocalFormData((prev) => ({
                                ...prev,
                                [group]: prev[group].map((item, i) => (i === index ? { ...item, activities: list } : item)),
                            }))}
                            placeholder={stage.placeholders[group][1]}
                        />
                        <button type="button" className="if-link-button" onClick={() => handleRemoveProblem(group, index)}>Remove this problem</button>
                    </div>
                ))}
                <button type="button" className="if-add" onClick={() => handleAddMoreProblems(group)}>+ Add another problem</button>
            </QuestionCard>
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

            <div className="if-step-head">
                <h2>{stage.heading}</h2>
                <p>{stage.subtitle}</p>
                {/* Round 28 (owner): everything, not only what lasted — the next stage narrows it down */}
                <p className="if-write-all">Write down <strong>everything</strong> you did or went through in these years — even once, even if you stopped, even if you can't do it now. We'll narrow it down later.</p>
            </div>

            {/* Pre-High School can be skipped */}
            {stage.isSkippable && (
                <div className="if-card if-skip">
                    <label>
                        <input
                            type="checkbox"
                            checked={!!localFormData.skipped}
                            onChange={(e) => handleSkipChange(e.target.checked)}
                        />
                        {" "}I can't clearly recall this period — skip it
                    </label>
                    <p className="if-question-prompt">If you can't recall, just answer everything in the High School section instead.</p>
                </div>
            )}

            <form onSubmit={handleContinue}>
                {!localFormData.skipped && (
                    <>
                        <section className="if-card">
                            <h3 className="if-card-title">What you did</h3>
                            {ACTIVITY_GROUPS.map(renderActivityGroup)}
                        </section>

                        <section className="if-card">
                            <h3 className="if-card-title">What got in your way</h3>
                            <p className="if-question-prompt">For each problem, add what you did that helped.</p>
                            {PROBLEM_GROUPS.map(renderProblemGroup)}
                        </section>

                        <section className="if-card">
                            <h3 className="if-card-title">Anything else</h3>
                            <QuestionCard title="Anything else you enjoyed?" prompt={promptOf("additionalInterests")} examples={examplesOf("additionalInterests")}>
                                <div className="if-drop" {...dropOn("additionalInterests")}>
                                    {localFormData.additionalInterests.map((row, idx) => (
                                        <div key={`additionalInterests${idx}`} className="if-pair">
                                            <input
                                                placeholder="Activity"
                                                aria-label="Activity"
                                                id={`additionalInterests${idx + 1}-activity`}
                                                value={row.activity}
                                                onChange={(e) => handleAdditionalChange(idx, "activity", e.target.value)}
                                            />
                                            <input
                                                placeholder="Why you liked it"
                                                aria-label="Why you liked it"
                                                id={`additionalInterests${idx + 1}-reason`}
                                                value={row.reason}
                                                onChange={(e) => handleAdditionalChange(idx, "reason", e.target.value)}
                                            />
                                            <VoiceInput compact value={row.reason} onChange={(text) => handleAdditionalChange(idx, "reason", text)} />
                                        </div>
                                    ))}
                                    <button type="button" className="if-add" onClick={handleAddMoreAdditional}>+ Add another</button>
                                </div>
                            </QuestionCard>
                        </section>

                        {/* last in the section but sticky to the bottom of the screen, so it is in reach the whole way down */}
                        <ActivityReferenceList activities={stage.referenceList} fromResume={resumeList || []} targets={ADD_TARGETS} onAdd={addActivity} resumeOnly />
                    </>
                )}

                {/* Navigation Buttons */}
                <div className="if-nav">
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
