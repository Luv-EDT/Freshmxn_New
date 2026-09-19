import { useState, useEffect, useRef } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { useDispatch, useSelector } from "react-redux"
import { message } from "antd"
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

    const steps = getVisibleSteps(user)
    const currentStepIndex = steps.findIndex((s) => s.key === step)
    const storageKey = user ? `freshmxnInterestForm_${user._id}` : null   // per student, so a shared computer never mixes answers
    const hasSubmitted = user?.progress?.interestForm === "done"

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

        if (preferDraft) {
            setFormState(normalizeFormState(draft.formState))
            return
        }

        if (submission?.interest && Object.keys(submission.interest).length > 0) {
            setFormState(fromSubmissionInterest(submission.interest))
            return
        }

        setFormState(draft ? normalizeFormState(draft.formState) : createInitialFormState())
    }

    // ─── Local draft + re-derive the activity/problem lists whenever anything changes ─
    useEffect(() => {
        if (!formState || !storageKey) return

        writeLocalDraft(formState)

        const derived = extractInterestData(formState, getVisibleLifeStages(user))
        setExtractedActivities(derived.extractedActivities)
        setExtractedProblems(derived.extractedProblems)
    }, [formState])

    const writeLocalDraft = (state) => {
        localStorage.setItem(storageKey, JSON.stringify({ savedAt: new Date().toISOString(), formState: state }))
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

    // a student who hasn't submitted doesn't need to be asked — send them straight in
    useEffect(() => {
        if (formState && isLandingStep && !hasSubmitted && steps.length > 0) {
            navigate(`/interest/${steps[0].key}`, { replace: true })
        }
    }, [formState, isLandingStep, hasSubmitted])

    // ─── Saving ──────────────────────────────────────────────────────────────
    const saveToServer = async (isFinishing) => {
        const interest = buildSubmissionInterest(formState, extractedActivities, extractedProblems, user)

        // going back to review an already-finished form must not un-finish it
        const response = await saveInterest({ interest, isComplete: isFinishing || hasSubmitted })

        // the server is the source of truth once it has the answers
        localStorage.setItem(storageKey, JSON.stringify({
            savedAt: response.data.data.lastSavedAt || new Date().toISOString(),
            formState,
        }))

        return response
    }

    // ─── Saving and navigation ───────────────────────────────────────────────
    // A section calls updateFormData() and then asks to save or move on in the same click. Saving
    // inline would read the formState from before that update and silently drop the answers the
    // student just typed, so the request is queued and an effect performs it on the next render,
    // once formState actually holds them. A fresh object each time means asking twice for the same
    // thing still fires.
    const goToStep = (index) => {
        if (index < 0 || index >= steps.length) return
        setPendingAction({ kind: "navigate", index })
    }

    const requestSave = () => setPendingAction({ kind: "save" })

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

            await saveToServer(isFinishing)

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
    const handlePreviousSection = () => goToStep(currentStepIndex - 1)

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

    // ─── Already submitted, and they clicked "Interest Form" in the navbar ───
    if (isLandingStep && hasSubmitted) {
        return (
            <div>
                <Navbar />
                <h2>You've already submitted your interest form</h2>
                <p>Would you like to edit your answers? You can change anything until your report is generated.</p>
                <button type="button" onClick={() => navigate(`/interest/${steps[0].key}`)}>Yes, edit my answers</button>
                {" "}
                <button type="button" onClick={() => navigate("/")}>No, back to home</button>
            </div>
        )
    }

    if (currentStepIndex === -1) {
        return <div>Loading...</div>
    }

    // props every section gets for the progress bar and navigation
    const commonProps = {
        steps,
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
                        onGoHome={() => navigate("/")}
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
            {renderSection()}
        </div>
    )
}

export default InterestForm
