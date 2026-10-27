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
import { loadResumeActivities, keepResumeActivities, cleanLists, countOf } from "./resumeActivities"
import {
    createInitialFormState,
    normalizeFormState,
    fromSubmissionInterest,
    getVisibleSteps,
    getVisibleLifeStages,
    showsAcademicClassification,
    stageProblems,
    extractInterestData,
    buildSubmissionInterest,
} from "./interestFormState"

// what a refresh, a closed tab or a lost connection would cost while editing (Round 28)
const UNSAVED_WARNING = "If you refresh or lose your connection now, the changes you made in this session will be lost."

// Stage 1 — Virtual Career Counselling (the interest form; owner's name since Round 28). Holds the
// whole form state (ported from virtual-career-counselling App.jsx) and saves it to the server every
// time the student leaves a section, so the form survives a closed tab, a flat battery or a switch from
// phone to laptop. There is no submit page: reaching the end is what marks it complete.
//
// EDITING AFTER FINISHING (owner, Round 28) is different: the student may only be looking, or trying
// words out. Nothing is kept in this browser and moving between sections saves nothing — only "Save
// changes" does. Leaving, refreshing or going offline with unsaved changes is warned about.
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
    const sectionDraft = useRef({})                            // the open section's latest typing, for "Save and go"
    const [leaveOpen, setLeaveOpen] = useState(false)          // leaving asks first (Rounds 19, 28)
    const [leaveTo, setLeaveTo] = useState("/dashboard")       // where a guarded link was going
    const [dirty, setDirty] = useState(false)                  // editing: changes not saved yet
    const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine)
    const savedBaseline = useRef(null)                         // editing: the answers as last saved
    const sectionRef = useRef(null)                            // the open section, for its form's required items
    // Round 13: where the student is and how far they have got. `reachedStep` is the furthest stage
    // they arrived at with everything before it complete; a tab beyond it, or Finish, is refused
    // with a dialog. Saved with the answers, so "Continue where you left off" works on any device.
    const [progress, setProgress] = useState({ lastStep: null, reachedStep: null })
    const [blockedAt, setBlockedAt] = useState(null)           // the stage a refused jump points to
    const [blockedNeeds, setBlockedNeeds] = useState([])       // what that stage still needs, in words
    const lastBlocked = useRef(null)
    // Round 36 (owner): the activities a résumé gave, per stage — shown first in each stage's list
    const [resumeActivities, setResumeActivities] = useState(null)
    useEffect(() => {
        if (user?._id) setResumeActivities(loadResumeActivities(user._id))
    }, [user?._id])
    const takeResume = (found) => {
        const lists = cleanLists(found)
        keepResumeActivities(user._id, countOf(lists) ? lists : null)
        setResumeActivities(countOf(lists) ? lists : null)
        return countOf(lists)
    }
    const clearResume = () => {
        keepResumeActivities(user._id, null)
        setResumeActivities(null)
    }
    const resumeList = (key) => (resumeActivities || {})[key] || []

    const steps = getVisibleSteps(user)
    const currentStepIndex = steps.findIndex((s) => s.key === step)
    const storageKey = user ? `freshmxnInterestForm_${user._id}` : null   // per student, so a shared computer never mixes answers
    const hasSubmitted = user?.progress?.interestForm === "done"
    const editMode = hasSubmitted                              // Round 28: save only on "Save changes"
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
        // editing a finished form starts from what was saved, never from a draft in this browser
        if (editMode) localStorage.removeItem(storageKey)
        const draft = editMode ? null : readLocalDraft()
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
            const saved = fromSubmissionInterest(submission.interest)
            savedBaseline.current = JSON.stringify(saved)
            setProgress(submission.interest.formProgress || legacy)
            setFormState(saved)
            return
        }

        setFormState(draft ? normalizeFormState(draft.formState) : createInitialFormState())
    }

    // ─── Local draft + re-derive the activity/problem lists whenever anything changes ─
    useEffect(() => {
        if (!formState || !storageKey) return

        if (editMode) setDirty(JSON.stringify(formState) !== savedBaseline.current)
        else writeLocalDraft(formState, progress)

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

        sectionDraft.current = { ...sectionDraft.current, ...patch }
        clearTimeout(sectionDraftTimer.current)
        sectionDraftTimer.current = setTimeout(() => {
            // editing: nothing goes to this browser — only whether there is something unsaved
            if (editMode) setDirty(JSON.stringify({ ...formState, ...sectionDraft.current }) !== savedBaseline.current)
            else writeLocalDraft({ ...formState, ...patch })
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

    // a typed or bookmarked URL can't skip stages either — past the furthest stage reached, or past a
    // stage that still has a required item empty (an old draft can say "reached Aspirations" with an
    // unfinished Background)
    useEffect(() => {
        if (!formState || currentStepIndex < 0) return
        const missing = steps.slice(0, currentStepIndex).findIndex((s) => stageProblems(s.key, formState, user).length > 0)
        const limit = missing === -1 ? reachedIndex : Math.min(reachedIndex, missing)
        if (currentStepIndex > limit) {
            navigate(`/interest/${steps[limit].key}`, { replace: true })
        }
    }, [formState, currentStepIndex, reachedIndex])

    // ─── Saving ──────────────────────────────────────────────────────────────
    const saveToServer = async (isFinishing, at) => {
        const interest = { ...buildSubmissionInterest(formState, extractedActivities, extractedProblems, user), formProgress: at }

        // going back to review an already-finished form must not un-finish it
        const response = await saveInterest({ interest, isComplete: isFinishing || hasSubmitted })

        // the server is the source of truth once it has the answers
        if (editMode) {
            savedBaseline.current = JSON.stringify(formState)
            setDirty(false)
        } else {
            localStorage.setItem(storageKey, JSON.stringify({
                savedAt: response.data.data.lastSavedAt || new Date().toISOString(),
                formState,
                progress: at,
            }))
        }

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
    const sectionForm = () => sectionRef.current?.querySelector("form")
    const sectionComplete = () => !sectionForm() || sectionForm().checkValidity()

    // the first stage before `index` (other than the open one, which the section checks itself) that
    // still has a required item empty — Round 17: a jump checks every stage it passes, not just this one
    const firstIncompleteBefore = (index) => {
        for (let at = 0; at < index; at += 1) {
            if (at === currentStepIndex) continue
            const needs = stageProblems(steps[at].key, formState, user)
            if (needs.length > 0) return { at, needs }
        }
        return null
    }

    const block = (at, needs = []) => {
        setBlockedNeeds(needs)
        setBlockedAt(at)
    }

    const goToStep = (index, { sectionOk = true } = {}) => {
        if (index < 0 || index >= steps.length) return
        const complete = sectionOk && sectionComplete()

        if (index > currentStepIndex) {
            const open = Math.max(reachedIndex, currentStepIndex + 1)
            if (!complete) {
                sectionForm()?.reportValidity()
                return block(currentStepIndex)
            }
            const missing = firstIncompleteBefore(index)
            if (missing) return block(missing.at, missing.needs)
            if (index > open) return block(open)
        }

        const reached = index > currentStepIndex ? Math.max(reachedIndex, index) : complete ? reachedIndex : Math.min(reachedIndex, currentStepIndex)
        setPendingAction({ kind: "navigate", index, at: { lastStep: steps[index].key, reachedStep: steps[reached].key } })
    }

    const requestSave = () => setPendingAction({ kind: "save", at: { lastStep: step, reachedStep: steps[reachedIndex].key } })

    // Leaving → "Save and go" (owner, Rounds 19 and 28): what the open section has typed but not yet
    // handed up is merged in first, then saved, then the student goes where the link was going.
    const saveAndGo = () => {
        const typed = sectionDraft.current
        setFormState((previous) => ({ ...previous, ...typed }))
        setPendingAction({ kind: "save", then: leaveTo, at: { lastStep: step, reachedStep: steps[reachedIndex].key } })
    }

    // Round 28: the menu, the logo and every other link ask first too — before, only the page's own
    // button did, and the navbar's Dashboard left without a word. While editing, only when something
    // is unsaved; the first time through, always (the section being typed isn't saved until you move on).
    const guardLeaving = !editMode || dirty
    useEffect(() => {
        if (!guardLeaving) return undefined
        const onClick = (event) => {
            const link = event.target.closest && event.target.closest("a[href]")
            if (!link || link.target === "_blank" || (sectionRef.current && sectionRef.current.contains(link))) return
            const url = new URL(link.href, window.location.href)
            if (url.origin !== window.location.origin || url.pathname.startsWith("/interest")) return
            event.preventDefault()
            event.stopPropagation()
            setLeaveTo(url.pathname + url.search + url.hash)
            setLeaveOpen(true)
        }
        document.addEventListener("click", onClick, true)
        return () => document.removeEventListener("click", onClick, true)
    }, [guardLeaving])

    // editing: a refresh or a closed tab with unsaved changes is warned about; so is going offline
    useEffect(() => {
        if (!editMode || !dirty) return undefined
        const onBeforeUnload = (event) => {
            event.preventDefault()
            event.returnValue = UNSAVED_WARNING
            return UNSAVED_WARNING
        }
        window.addEventListener("beforeunload", onBeforeUnload)
        return () => window.removeEventListener("beforeunload", onBeforeUnload)
    }, [editMode, dirty])
    useEffect(() => {
        const up = () => setOnline(true)
        const down = () => setOnline(false)
        window.addEventListener("online", up)
        window.addEventListener("offline", down)
        return () => {
            window.removeEventListener("online", up)
            window.removeEventListener("offline", down)
        }
    }, [])

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

            // editing: moving between sections saves nothing — only Save changes (or finishing) does
            if (!(editMode && isNavigating && !isFinishing)) await saveToServer(isFinishing, action.at)
            setProgress(action.at)

            if (isFinishing) {
                dispatch(setUser({
                    user: { ...user, progress: { ...user.progress, interestForm: "done" } },
                }))
                message.success(editMode ? "Your changes are saved" : "Virtual Career Counselling submitted — well done")
            }

            sectionDraft.current = {}
            if (action.then) {
                setLeaveOpen(false)
                navigate(action.then)
            } else if (isNavigating) {
                navigate(`/interest/${steps[action.index].key}`)
                window.scrollTo(0, 0)
            } else {
                message.success(editMode ? "Your changes are saved" : "Progress saved — you can come back any time")
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
        delete sectionDraft.current[section]
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
                            <h2>You've already finished Virtual Career Counselling</h2>
                            <p>Would you like to look at or edit your answers? Nothing changes until you press <strong>Save</strong>.</p>
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
        steps: steps.map((s, index) => ({ ...s, done: index < reachedIndex && stageProblems(s.key, formState, user).length === 0, closed: index > Math.max(reachedIndex, currentStepIndex + 1) })),
        currentStepIndex,
        goToStep,
        handleNext: handleNextSection,
        handlePrevious: handlePreviousSection,
        isFirstStep: currentStepIndex === 0,
        isSaving,
        requestSave,
    }
    // the dialog fades out after blockedAt clears — it keeps the stage it named until it is gone
    if (blockedAt !== null) lastBlocked.current = blockedAt
    const shownBlock = blockedAt === null ? lastBlocked.current : blockedAt
    const blockedTitle = shownBlock === null ? "" : steps[shownBlock].title

    const renderSection = () => {
        switch (steps[currentStepIndex].key) {
            case "intro":
                return <InterestIntro handleNext={handleNextSection} hasSubmitted={hasSubmitted} resumeActivities={resumeActivities} onResume={takeResume} onClearResume={clearResume} />
            case "post-college":
                return <PostCollege {...commonProps} formData={formState.postCollege} updateFormData={(data) => updateFormState("postCollege", data)} reportDraft={(data) => reportSectionDraft({ postCollege: data })} resumeList={resumeList("postCollege")} />
            case "college":
                return <College {...commonProps} formData={formState.college} updateFormData={(data) => updateFormState("college", data)} reportDraft={(data) => reportSectionDraft({ college: data })} resumeList={resumeList("college")} />
            case "high-school":
                return <HighSchool {...commonProps} formData={formState.highSchool} updateFormData={(data) => updateFormState("highSchool", data)} reportDraft={(data) => reportSectionDraft({ highSchool: data })} resumeList={resumeList("highSchool")} />
            case "pre-high-school":
                return <PreHighSchool {...commonProps} formData={formState.preHighSchool} updateFormData={(data) => updateFormState("preHighSchool", data)} reportDraft={(data) => reportSectionDraft({ preHighSchool: data })} resumeList={resumeList("preHighSchool")} />
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
                        isEditing={hasSubmitted}
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
            {/* Round 28 (owner): the menu already has Dashboard, so the page's own button goes back a section */}
            {currentStepIndex > 0 && (
                <div className="back-to-dashboard">
                    <button type="button" className="btn btn-ghost btn-sm tap" onClick={() => handlePreviousSection({ sectionOk: false })}>
                        ← Previous section
                    </button>
                </div>
            )}
            {editMode && (
                <div className={`if-edit-banner${dirty ? " is-dirty" : ""}`} role="status">
                    {dirty
                        ? <>You have <strong>unsaved changes</strong>. Press <strong>Save</strong> to keep them.</>
                        : <>You're editing your answers. Moving between sections saves nothing — only <strong>Save</strong> does.</>}
                </div>
            )}
            {editMode && dirty && !online && (
                <div className="if-edit-banner is-dirty" role="alert">{UNSAVED_WARNING}</div>
            )}
            <Modal
                open={leaveOpen}
                title="Leave this page?"
                onCancel={() => setLeaveOpen(false)}
                footer={[
                    <button key="stay" type="button" className="btn btn-ghost" onClick={() => setLeaveOpen(false)}>Stay</button>,
                    <button key="leave" type="button" className="btn btn-ghost" onClick={() => navigate(leaveTo)}>Leave without saving</button>,
                    <button key="save" type="button" className="btn btn-primary" onClick={saveAndGo} disabled={isSaving}>
                        {isSaving ? "Saving…" : "Save and go"}
                    </button>,
                ]}
            >
                <p>{editMode ? "Your changes haven't been saved and will be lost. Save them first?" : "Answers you haven't saved may be lost. Save them first?"}</p>
                {saveError && <p><strong>{saveError}</strong></p>}
            </Modal>
            {isSaving && <p>Saving...</p>}
            {saveError && <p><strong>{saveError}</strong></p>}
            <div ref={sectionRef}>{renderSection()}</div>
            <Modal
                open={blockedAt !== null}
                title={blockedTitle && `Finish ${blockedTitle} first`}
                okText={shownBlock === currentStepIndex ? "OK" : `Go to ${blockedTitle}`}
                cancelText="Stay here"
                cancelButtonProps={{ style: shownBlock === currentStepIndex ? { display: "none" } : {} }}
                onOk={() => {
                    const target = blockedAt
                    setBlockedAt(null)
                    if (target !== currentStepIndex) goToStep(target)
                }}
                onCancel={() => setBlockedAt(null)}
            >
                <p>
                    Please complete the required items in <strong>{blockedTitle}</strong> before
                    moving ahead. The stages open in order, so nothing gets missed.
                </p>
                {blockedNeeds.length > 0 && (
                    <>
                        <p>Still needed:</p>
                        <ul>{blockedNeeds.map((need) => <li key={need}>{need}</li>)}</ul>
                    </>
                )}
                <p>You can press Save and come back any time.</p>
            </Modal>
        </div>
    )
}

export default InterestForm
