import { useState, useEffect, useRef } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { useDispatch, useSelector } from "react-redux"
import { message, Modal } from "antd"
import { saveInterest, getMySubmission } from "../../apiCall/submissionsApi"
import { setUser } from "../../store/userSlice"
import Navbar from "../Navbar"
import InterestIntro from "./InterestIntro"
import PostCollege from "./PostCollege"
import College from "./College"
import HighSchool from "./HighSchool"
import PreHighSchool from "./PreHighSchool"
import CurrentInterests from "./CurrentInterests"
import Challenges from "./Challenges"
import BackgroundInfo from "./BackgroundInfo"
import AspirationalProfessions from "./AspirationalProfessions"
import InterestSubmit from "./InterestSubmit"
import {
    createInitialFormState,
    normalizeFormState,
    fromSubmissionInterest,
    getVisibleSteps,
    getVisibleLifeStages,
    showsAcademicClassification,
    extractInterestData,
    buildSubmissionInterest,
} from "./interestFormState"

// Stage 1 — the interest form. Holds the whole form state (ported from virtual-career-counselling
// App.jsx) and saves it to the server every time the student leaves a section, so the form survives
// a closed tab, a flat battery or a switch from phone to laptop. There is no submit page: reaching
// the end is what marks it complete.
function InterestForm() {
    const navigate = useNavigate()
    const dispatch = useDispatch()
    const { step } = useParams()
    const { user } = useSelector((state) => state.user)
    const [formState, setFormState] = useState(null) // null until the draft / saved answers are loaded
    const [extractedActivities, setExtractedActivities] = useState([])
    const [extractedProblems, setExtractedProblems] = useState([])
    const [isSaving, setIsSaving] = useState(false)
    const [saveError, setSaveError] = useState("")
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [pendingAction, setPendingAction] = useState(null)   // a queued save or section change, see goToStep
    const sectionDraftTimer = useRef(null)                     // debounce for in-progress typing, see reportSectionDraft
    const sectionRef = useRef(null)                            // the open section, for its form's required items
    // Round 13: where the student is and how far they have got. `reachedStep` is the furthest stage
    // they arrived at with everything before it complete; a tab beyond it, or Finish, is refused
    // with a dialog. Saved with the answers, so "Continue where you left off" works on any device.
    const [progress, setProgress] = useState({ lastStep: null, reachedStep: null })
    const [blockedAt, setBlockedAt] = useState(null)           // the stage a refused jump points to

    const steps = getVisibleSteps(user)
    const currentStepIndex = steps.findIndex((s) => s.key === step)
    const storageKey = user ? `freshmxnInterestForm_${user._id}` : null   // per student, so a shared computer never mixes answers
    const hasSubmitted = user?.progress?.interestForm === "done"
    const savedReached = steps.findIndex((s) => s.key === progress.reachedStep)
    const reachedIndex = hasSubmitted ? steps.length - 1 : Math.max(savedReached, 0)

    // "start" is where /interest lands. A student who already submitted is asked whether they
    // meant to edit, instead of being dropped back into section 1.
    const isLandingStep = step === "start"

    // ─── Load: whichever of the server copy and the local draft is newer ─────
    useEffect(() => {
        if (!user) return
        fetchSavedForm()
    }, [user?._id])

    const readLocalDraft = () => {
        const raw = localStorage.getItem(storageKey)

        if (!raw) return null

        try {
            const parsed = JSON.parse(raw)
            // drafts written before autosave existed have no wrapper
            if (parsed && parsed.formState) return parsed
            return { savedAt: null, formState: parsed }
        } catch (error) {
            console.log("Ignoring unreadable draft")
            return null
        }
    }

    const fetchSavedForm = async () => {
        const draft = readLocalDraft()
        let submission = null

        try {
            const response = await getMySubmission()
            submission = response.data.data
        } catch (error) {
            // offline or server down — the local draft is still a perfectly good fallback
            console.log("Could not load saved answers from the server")
        }

        const serverSavedAt = submission?.lastSavedAt || submission?.submittedAt
        const draftSavedAt = draft?.savedAt

        // the server wins unless this browser holds something newer (e.g. a crash mid-section)
        const preferDraft = draft && (!serverSavedAt || (draftSavedAt && new Date(draftSavedAt) > new Date(serverSavedAt)))

        // A form saved before Round 13 has no record of how far it got. Rather than send that student
        // back to the first stage, it keeps the freedom it had: every stage up to Aspirations is open.
        const legacy = { lastStep: null, reachedStep: "aspirations" }

        if (preferDraft) {
            setProgress(draft.progress || legacy)
            setFormState(normalizeFormState(draft.formState))
            return
        }

        if (submission?.interest && Object.keys(submission.interest).length > 0) {
            setProgress(submission.interest.formProgress || legacy)
            setFormState(fromSubmissionInterest(submission.interest))
            return
        }

        setFormState(draft ? normalizeFormState(draft.formState) : createInitialFormState())
    }

    // ─── Local draft + re-derive the activity/problem lists whenever anything changes ─
    useEffect(() => {
        if (!formState || !storageKey) return

        writeLocalDraft(formState, progress)

        const derived = extractInterestData(formState, getVisibleLifeStages(user))
        setExtractedActivities(derived.extractedActivities)
        setExtractedProblems(derived.extractedProblems)
    }, [formState])

    const writeLocalDraft = (state, at = progress) => {
        localStorage.setItem(storageKey, JSON.stringify({ savedAt: new Date().toISOString(), formState: state, progress: at }))
    }

    // Each section keeps its own local copy while it is being filled in and only hands it up when
    // the student navigates or presses Save — so until then formState, and therefore the local
    // draft, knows nothing about what is being typed. A refresh mid-section used to lose it.
    // Sections now report every keystroke here, debounced, and it goes straight to localStorage
    // WITHOUT setState: no re-render and no re-running the dedupe pipeline while someone types.
    const reportSectionDraft = (patch) => {
        if (!formState || !storageKey) return

        clearTimeout(sectionDraftTimer.current)
        sectionDraftTimer.current = setTimeout(() => {
            writeLocalDraft({ ...formState, ...patch })
        }, 400)
    }

    // ─── Unknown step in the URL → first step ────────────────────────────────
    useEffect(() => {
        if (formState && !isLandingStep && currentStepIndex === -1 && steps.length > 0) {
            navigate(`/interest/${steps[0].key}`, { replace: true })
        }
    }, [formState, currentStepIndex, isLandingStep])

    // a student who hasn't started doesn't need to be asked — send them straight in
    const resumeIndex = steps.findIndex((s) => s.key === progress.lastStep)
    const canResume = !hasSubmitted && resumeIndex > 0
    useEffect(() => {
        if (formState && isLandingStep && !hasSubmitted && !canResume && steps.length > 0) {
            navigate(`/interest/${steps[0].key}`, { replace: true })
        }
    }, [formState, isLandingStep, hasSubmitted, canResume])

    // a typed or bookmarked URL can't skip stages either
    useEffect(() => {
        if (formState && currentStepIndex > reachedIndex) {
            navigate(`/interest/${steps[reachedIndex].key}`, { replace: true })
        }
    }, [formState, currentStepIndex, reachedIndex])

    // ─── Saving ──────────────────────────────────────────────────────────────
    const saveToServer = async (isFinishing, at) => {
        const interest = { ...buildSubmissionInterest(formState, extractedActivities, extractedProblems, user), formProgress: at }

        // going back to review an already-finished form must not un-finish it
        const response = await saveInterest({ interest, isComplete: isFinishing || hasSubmitted })

        // the server is the source of truth once it has the answers
        localStorage.setItem(storageKey, JSON.stringify({
            savedAt: response.data.data.lastSavedAt || new Date().toISOString(),
            formState,
            progress: at,
        }))

        return response
    }

    // ─── Saving and navigation ───────────────────────────────────────────────
    // A section calls updateFormData() and then asks to save or move on in the same click. Saving
    // inline would read the formState from before that update and silently drop the answers the
    // student just typed, so the request is queued and an effect performs it on the next render,
    // once formState actually holds them. A fresh object each time means asking twice for the same
    // thing still fires.
    //
    // Moving forward needs the open section's required items (its form, plus the section's own check
    // passed in as sectionOk) and every stage before the target complete. Going back is always
    // allowed — but leaving a section with a required item empty pulls `reachedStep` back to it.
    const sectionComplete = () => {
        const form = sectionRef.current && sectionRef.current.querySelector("form")
        return !form || form.checkValidity()
    }

    const goToStep = (index, { sectionOk = true } = {}) => {
        if (index < 0 || index >= steps.length) return
        const complete = sectionOk && sectionComplete()

        if (index > currentStepIndex) {
            const open = Math.max(reachedIndex, currentStepIndex + 1)
            if (!complete) {
                const form = sectionRef.current && sectionRef.current.querySelector("form")
                if (form) form.reportValidity()
                return setBlockedAt(currentStepIndex)
            }
            if (index > open) return setBlockedAt(open)
        }

        const reached = index > currentStepIndex ? Math.max(reachedIndex, index) : complete ? reachedIndex : Math.min(reachedIndex, currentStepIndex)
        setPendingAction({ kind: "navigate", index, at: { lastStep: steps[index].key, reachedStep: steps[reached].key } })
    }

    const requestSave = () => setPendingAction({ kind: "save", at: { lastStep: step, reachedStep: steps[reachedIndex].key } })

    useEffect(() => {
        if (!pendingAction || !formState) return
        runPendingAction(pendingAction)
    }, [pendingAction])

    const runPendingAction = async (action) => {
        // the section has just handed its data up properly, so a queued keystroke write is stale
        clearTimeout(sectionDraftTimer.current)

        const isNavigating = action.kind === "navigate"
        const isFinishing = isNavigating && steps[action.index].key === "done"

        try {
            setIsSaving(true)
            setSaveError("")

            if (isFinishing) setIsSubmitting(true)

            await saveToServer(isFinishing, action.at)
            setProgress(action.at)

            if (isFinishing) {
                dispatch(setUser({
                    user: { ...user, progress: { ...user.progress, interestForm: "done" } },
                }))
                message.success("Interest form submitted successfully")
            }

            if (isNavigating) {
                navigate(`/interest/${steps[action.index].key}`)
                window.scrollTo(0, 0)
            } else {
                message.success("Progress saved — you can come back any time")
            }
        } catch (error) {
            // never lose a section to a bad connection: stay put, keep the answers, say so
            setSaveError(error.response?.data?.message || "Couldn't save — check your connection and try again.")
        } finally {
            setIsSaving(false)
            setIsSubmitting(false)
            setPendingAction(null)
        }
    }

    const handleNextSection = () => goToStep(currentStepIndex + 1)
    const handlePreviousSection = (options) => goToStep(currentStepIndex - 1, options)

    // Handler for updating form state
    const updateFormState = (section, data) => {
        setFormState((prevState) => ({
            ...prevState,
            [section]: Array.isArray(data) ? data : { ...prevState[section], ...data },
        }))
    }

    if (!user || !formState) {
        return <div>Loading...</div>
    }

    // ─── Opened again: finished → offer to edit; saved part-way → pick up where they stopped ───
    if (isLandingStep && (hasSubmitted || canResume)) {
        return (
            <div>
                <Navbar />
                <div className="page if-landing">
                    {hasSubmitted ? (
                        <>
                            <h2>You've already submitted your interest form</h2>
                            <p>Would you like to edit your answers? You can change anything until your report is generated.</p>
                        </>
                    ) : (
                        <>
                            <h2>Continue where you left off</h2>
                            <p>Your answers are saved. You're on <strong>{steps[resumeIndex].title}</strong>.</p>
                        </>
                    )}
                    <div className="if-nav">
                        <button type="button" className="btn btn-primary" onClick={() => navigate(`/interest/${steps[hasSubmitted ? 0 : resumeIndex].key}`)}>
                            {hasSubmitted ? "Yes, edit my answers" : "Continue"}
                        </button>
                        {canResume && <button type="button" onClick={() => navigate(`/interest/${steps[0].key}`)}>Go to the first stage</button>}
                        <button type="button" onClick={() => navigate("/dashboard")}>{hasSubmitted ? "No, back to home" : "Back to home"}</button>
                    </div>
                </div>
            </div>
        )
    }

    if (currentStepIndex === -1) {
        return <div>Loading...</div>
    }

    // props every section gets for the progress bar and navigation; each stage knows whether it is
    // done or still closed, so the bar can show it
    const commonProps = {
        steps: steps.map((s, index) => ({ ...s, done: index < reachedIndex, closed: index > Math.max(reachedIndex, currentStepIndex + 1) })),
        currentStepIndex,
        goToStep,
        handleNext: handleNextSection,
        handlePrevious: handlePreviousSection,
        isFirstStep: currentStepIndex === 0,
        isSaving,
        requestSave,
    }

    const renderSection = () => {
        switch (steps[currentStepIndex].key) {
            case "intro":
                return <InterestIntro handleNext={handleNextSection} hasSubmitted={hasSubmitted} />
            case "post-college":
                return <PostCollege {...commonProps} formData={formState.postCollege} updateFormData={(data) => updateFormState("postCollege", data)} reportDraft={(data) => reportSectionDraft({ postCollege: data })} />
            case "college":
                return <College {...commonProps} formData={formState.college} updateFormData={(data) => updateFormState("college", data)} reportDraft={(data) => reportSectionDraft({ college: data })} />
            case "high-school":
                return <HighSchool {...commonProps} formData={formState.highSchool} updateFormData={(data) => updateFormState("highSchool", data)} reportDraft={(data) => reportSectionDraft({ highSchool: data })} />
            case "pre-high-school":
                return <PreHighSchool {...commonProps} formData={formState.preHighSchool} updateFormData={(data) => updateFormState("preHighSchool", data)} reportDraft={(data) => reportSectionDraft({ preHighSchool: data })} />
            case "current-interests":
                return (
                    <CurrentInterests
                        {...commonProps}
                        formData={formState.currentInterests}
                        extractedActivities={extractedActivities}
                        extractedProblems={extractedProblems}
                        updateFormData={(data) => updateFormState("currentInterests", data)}
                        updateExtractedProblems={setExtractedProblems}
                        reportDraft={(data) => reportSectionDraft({ currentInterests: data })}
                    />
                )
            case "challenges":
                return (
                    <Challenges
                        {...commonProps}
                        persistentData={formState.persistentProblems}
                        currentData={formState.currentChallenges}
                        extractedProblems={extractedProblems}
                        updatePersistent={(data) => updateFormState("persistentProblems", data)}
                        updateCurrent={(data) => updateFormState("currentChallenges", data)}
                        reportDraft={reportSectionDraft}
                    />
                )
            case "background":
                return (
                    <BackgroundInfo
                        {...commonProps}
                        formData={formState.backgroundInfo}
                        showAcademicClassification={showsAcademicClassification(user)}
                        updateFormData={(data) => updateFormState("backgroundInfo", data)}
                        reportDraft={(data) => reportSectionDraft({ backgroundInfo: data })}
                    />
                )
            case "aspirations":
                return (
                    <AspirationalProfessions
                        {...commonProps}
                        formData={formState.aspirationalProfessions}
                        updateFormData={(data) => updateFormState("aspirationalProfessions", data)}
                        reportDraft={(data) => reportSectionDraft({ aspirationalProfessions: data })}
                        isLastContentStep={true}
                    />
                )
            case "done":
                return (
                    <InterestSubmit
                        {...commonProps}
                        isSubmitting={isSubmitting}
                        isSubmitted={hasSubmitted}
                        onGoHome={() => navigate("/dashboard")}
                    />
                )
            default:
                return null
        }
    }

    return (
        <div>
            <Navbar />
            {isSaving && <p>Saving...</p>}
            {saveError && <p><strong>{saveError}</strong></p>}
            <div ref={sectionRef}>{renderSection()}</div>
            <Modal
                open={blockedAt !== null}
                title={blockedAt === null ? "" : `Finish ${steps[blockedAt].title} first`}
                okText={blockedAt === currentStepIndex ? "OK" : `Go to ${blockedAt === null ? "" : steps[blockedAt].title}`}
                cancelText="Stay here"
                cancelButtonProps={{ style: blockedAt === currentStepIndex ? { display: "none" } : {} }}
                onOk={() => {
                    const target = blockedAt
                    setBlockedAt(null)
                    if (target !== currentStepIndex) goToStep(target)
                }}
                onCancel={() => setBlockedAt(null)}
            >
                <p>
                    Please complete the required items in <strong>{blockedAt === null ? "" : steps[blockedAt].title}</strong> before
                    moving ahead. The stages open in order, so nothing gets missed.
                </p>
                <p>You can press Save and come back any time.</p>
            </Modal>
        </div>
    )
}

export default InterestForm
