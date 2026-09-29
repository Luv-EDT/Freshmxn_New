import { useState, useEffect, useRef } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { useDispatch, useSelector } from "react-redux"
import { message } from "antd"
import { savePsychometric, submitPsychometric, getMySubmission, getStoryState } from "../../apiCall/submissionsApi"
import { setUser } from "../../store/userSlice"
import Navbar from "../Navbar"
import JourneyProgress from "../JourneyProgress"
import AssessmentIntro from "./AssessmentIntro"
import Ipip50 from "./Ipip50"
import Perspective from "./Perspective"
import DigitSpan from "./DigitSpan"
import StoryRecall from "./StoryRecall"
import ExternalTest from "./ExternalTest"
import Sart from "./Sart"
import LikertModule from "./LikertModule"
import {
    ROSENBERG_ITEMS, ROSENBERG_SCALE, ROSENBERG_ATTRIBUTION,
    CONFIDENCE_ITEMS,
    MI_ITEMS, MI_SCALE,
} from "./moduleItems"
import { ASSESSMENT_MODULES, moduleByKey, completedModules, startedModules, canSubmit } from "./assessmentModules"

// Stage 2 — the psychometric assessment. Same shape as InterestForm.js, deliberately: one shell
// holding state, saving to the server whenever the student leaves a module, so the assessment
// survives a closed tab, a flat battery or a switch from phone to laptop.
//
// ONE MODULE PER SAVE. `/savePsychometric` writes to `psychometric.<module>` only, so redoing
// IPIP-50 cannot wipe the SART data sitting beside it. Sending the whole object would do exactly
// that, and it would look like "the assessment lost my answers" three modules later.
//
// THE LOCAL DRAFT IS NOT BELT-AND-BRACES. Day 1.5 found a real data-loss bug in the interest form:
// typing only updated section-local state, which never reached the saved object until the student
// navigated, so a refresh mid-section lost everything since the last page change. The fix was a
// debounced write to localStorage on every keystroke WITHOUT a setState — cheap, and it makes a
// sudden refresh cost nothing. Copied here rather than re-derived, because the bug is invisible
// until it happens to someone.

const DRAFT_DEBOUNCE_MS = 400

// Modules that write their own answers to the server as they go, rather than holding them in this
// shell's state until the student leaves.
//
// THEY MUST NOT GET THE "SAVE AND COME BACK LATER" BUTTON. It sends `psychometric[moduleKey]` from
// this shell, and for these five that value is either stale or — on a section the student has only
// just opened — `undefined`, which the save endpoint correctly rejects as missing answers. The
// student would see "Could not save" on a section that had in fact saved everything already, which
// is the worst possible thing to tell someone about their own data. Each of these has its own way
// out, and "← All sections" is always there.
const SELF_SAVING = ["digitSpan", "storyRecall", "extReasoning", "extVerbal", "sartRaw"]

function AssessmentShell() {
    const navigate = useNavigate()
    const dispatch = useDispatch()
    const { module: moduleKey } = useParams()
    const { user } = useSelector((state) => state.user)

    const [psychometric, setPsychometric] = useState(null)   // null until loaded
    const [storyState, setStoryState] = useState(null)       // the live clock, fetched from the server
    const [stamps, setStamps] = useState({ lastSavedAt: null, psychometricSubmittedAt: null })
    const [dirtySinceSubmit, setDirtySinceSubmit] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const draftTimer = useRef(null)

    const storageKey = user ? `freshmxnAssessment_${user._id}` : null
    const current = moduleByKey(moduleKey)
    const isIntro = moduleKey === "start"

    useEffect(() => {
        if (!user) return
        loadSaved()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?._id])

    // Whichever of the server copy and the local draft is newer. The draft only ever holds
    // in-progress typing for the module being worked on, so a stale one can never overwrite a
    // module the student finished on another device.
    const loadSaved = async () => {
        let serverCopy = {}

        try {
            const response = await getMySubmission()
            const saved = response.data.data || {}
            serverCopy = saved.psychometric || {}

            // The two timestamps that decide what the submit button should say. The server already
            // stamps `lastSavedAt` on every module save and `psychometricSubmittedAt` on submit, so
            // "is there anything new to submit?" needs no new field — just the comparison.
            setStamps({
                lastSavedAt: saved.lastSavedAt || null,
                psychometricSubmittedAt: saved.psychometricSubmittedAt || null,
            })

            // The server's answer supersedes the optimistic flag — otherwise a submit would leave
            // the button stuck on "you have new answers" forever.
            setDirtySinceSubmit(false)
        } catch (error) {
            message.error("Could not load your saved answers")
        }

        let draft = null

        try {
            const stored = storageKey ? localStorage.getItem(storageKey) : null
            draft = stored ? JSON.parse(stored) : null
        } catch (error) {
            draft = null   // a corrupt draft is discarded, never allowed to break the page
        }

        setPsychometric(draft ? { ...serverCopy, ...draft } : serverCopy)

        // The story's clock is the one piece of module state the browser cannot work out for
        // itself — it runs on the server from a stored timestamp. Fetched here so the section list
        // can show what is actually happening ("about 53 minutes left") rather than the generic
        // blurb, which stops being true the moment the story is opened.
        try {
            const story = await getStoryState()
            setStoryState(story.data.data)
        } catch (error) {
            setStoryState(null)   // the list falls back to the static note
        }
    }

    // Debounced, and NO setState. This is the whole point: it runs on every keystroke without
    // re-rendering 50 radio buttons, and it means a refresh loses at most 400ms of work.
    const reportDraft = (nextPsychometric) => {
        if (!storageKey) return

        clearTimeout(draftTimer.current)
        draftTimer.current = setTimeout(() => {
            try {
                localStorage.setItem(storageKey, JSON.stringify(nextPsychometric))
            } catch (error) {
                // A full or blocked localStorage must never break the assessment. The server copy
                // is the real one; the draft is a convenience.
            }
        }, DRAFT_DEBOUNCE_MS)
    }

    // `field` is which sub-object of the module's block the value belongs in. Every scale module
    // uses "answers"; Perspective also writes "narrative" (report labels) and "openText" (the
    // student's own words, which the pipeline grades later and which must never be confused with
    // the graded "open" scores).
    const updateAnswer = (itemId, value, field = "answers") => {
        // THE BUTTON FLIPS ON THE KEYSTROKE, NOT ON THE ROUND TRIP. `hasNewAnswers` is derived from
        // two server timestamps, which is correct but arrives late: a student changed an answer,
        // walked back to the list, and the button still said "Read my report" until the page was
        // reloaded — so the honest state was there and invisible, which is worse than not having it.
        //
        // This is the optimistic half. The moment anything is edited we know there is something new
        // to submit, and we do not need the server to confirm it. `saveModule` then writes the real
        // timestamp underneath, so a reload or another device still gets the truthful answer.
        setDirtySinceSubmit(true)

        setPsychometric((previous) => {
            const block = previous[moduleKey] || {}
            const next = {
                ...previous,
                [moduleKey]: { ...block, [field]: { ...(block[field] || {}), [itemId]: value } },
            }
            reportDraft(next)
            return next
        })
    }

    const saveModule = async () => {
        if (!current || !psychometric) return false

        setIsSaving(true)

        try {
            const response = await savePsychometric({ module: moduleKey, block: psychometric[moduleKey] })

            // The authoritative half. The endpoint returns the `lastSavedAt` it just wrote, so the
            // submit button's state is correct without another round trip to fetch it.
            const savedAt = response && response.data && response.data.data && response.data.data.savedAt
            if (savedAt) setStamps((previous) => ({ ...previous, lastSavedAt: savedAt }))

            // The server now holds it, so the draft has done its job. Clearing it stops a stale
            // draft shadowing a newer answer saved from another device.
            if (storageKey) localStorage.removeItem(storageKey)

            if (user.progress.psychometric === "not_started") {
                dispatch(setUser({ ...user, progress: { ...user.progress, psychometric: "in_progress" } }))
            }

            return true
        } catch (error) {
            message.error("Could not save — check your connection and try again")
            return false
        } finally {
            setIsSaving(false)
        }
    }

    const handleModuleDone = async () => {
        const saved = await saveModule()
        if (saved) navigate("/assessment/start")
    }

    // For the modules in SELF_SAVING. They have already written their answers to the server, so
    // there is nothing here to save — but this shell's copy of `psychometric` was loaded once, when
    // the component mounted, and returning to the intro is a route change rather than a remount.
    //
    // WITHOUT THE RELOAD THE SECTION STILL SAYS "START". A student finishes the digit span, lands
    // back on the list, and sees the section they have just completed offering to begin. The data
    // is safe and the page is lying about it, which is indistinguishable from the data being lost —
    // and the obvious response is to do the whole thing again.
    const handleServerSavedDone = async () => {
        await loadSaved()
        navigate("/assessment/start")
    }

    // "Save and come back later" has to actually leave. It previously only saved, so the student
    // pressed it, nothing visibly happened, and the obvious conclusion was that saving had failed.
    const handleSaveAndLeave = async () => {
        const saved = await saveModule()
        if (saved) {
            message.success("Saved — you can pick up where you left off")
            navigate("/assessment/start")
        }
    }

    const handleSubmit = async () => {
        setIsSubmitting(true)

        try {
            await submitPsychometric()
            setDirtySinceSubmit(false)
            setStamps((previous) => ({ ...previous, psychometricSubmittedAt: new Date().toISOString() }))
            dispatch(setUser({ ...user, progress: { ...user.progress, psychometric: "done" } }))
            message.success("Submitted — your report is being prepared")
            navigate("/report")
        } catch (error) {
            // The answers are already saved module by module, so this is always safe to retry —
            // say so rather than leaving the student wondering what they just lost.
            message.error("Your answers are saved, but the report could not be started. Please try again.")
        } finally {
            setIsSubmitting(false)
        }
    }

    if (!user) return null
    if (psychometric === null) return <div><Navbar />Loading your assessment…</div>

    const done = completedModules(psychometric)

    // Is there anything the report has not already been built from?
    //
    // WHY THE BUTTON HAS TO KNOW. Offering "Submit and build my report" to a student whose report is
    // already waiting sends them round a minute-long pipeline to be handed what they could have read
    // immediately — and a second submit re-bills the model calls for an identical result. Never
    // submitted is a genuine submit; submitted with changes since is a genuine resubmit; submitted
    // with nothing since is a link to the report.
    const hasNewAnswers = dirtySinceSubmit || Boolean(
        stamps.lastSavedAt
        && stamps.psychometricSubmittedAt
        && new Date(stamps.lastSavedAt) > new Date(stamps.psychometricSubmittedAt)
    )

    if (isIntro || !current) {
        return (
            <div>
                <Navbar />
                <JourneyProgress user={user} current="assessment" />
                <AssessmentIntro
                    modules={ASSESSMENT_MODULES}
                    completed={done}
                    started={startedModules(psychometric)}
                    storyState={storyState}
                    onOpen={(key) => navigate(`/assessment/${key}`)}
                    onSubmit={handleSubmit}
                    canSubmit={canSubmit(psychometric)}
                    isSubmitting={isSubmitting}
                    alreadySubmitted={user.progress.psychometric === "done"}
                    hasNewAnswers={hasNewAnswers}
                    onReadReport={() => navigate("/report")}
                />
            </div>
        )
    }

    if (!current.built) {
        return (
            <div>
                <Navbar />
                <h2>{current.title}</h2>
                <p>This section is not open yet. You can submit what you have finished — your report
                   will say which parts are still to come.</p>
                <button type="button" onClick={() => navigate("/assessment/start")}>Back</button>
            </div>
        )
    }

    return (
        <div>
            <Navbar />
            <p>
                <button type="button" onClick={() => navigate("/assessment/start")}>
                    ← All sections
                </button>
                {isSaving && <span> · saving…</span>}
            </p>

            {moduleKey === "ipip50" && (
                <Ipip50
                    answers={(psychometric.ipip50 && psychometric.ipip50.answers) || {}}
                    onChange={updateAnswer}
                    onDone={handleModuleDone}
                />
            )}

            {moduleKey === "mi" && (
                <LikertModule
                    title="What you are drawn to"
                    intro="This asks what feels natural to you, not what you are good at. Nobody is strong in all seven, and a low answer here is information, not a weakness."
                    stem="How much is each of these like you?"
                    items={MI_ITEMS}
                    scale={MI_SCALE}
                    answers={(psychometric.mi && psychometric.mi.answers) || {}}
                    onChange={updateAnswer}
                    onDone={handleModuleDone}
                />
            )}

            {moduleKey === "rosenberg" && (
                <LikertModule
                    title="How you rate yourself"
                    intro={`Ten statements. There is no middle option on purpose — pick the side you lean to. ${ROSENBERG_ATTRIBUTION}.`}
                    items={ROSENBERG_ITEMS}
                    scale={ROSENBERG_SCALE}
                    answers={(psychometric.rosenberg && psychometric.rosenberg.answers) || {}}
                    onChange={updateAnswer}
                    onDone={handleModuleDone}
                />
            )}

            {moduleKey === "storyRecall" && (
                <StoryRecall onDone={handleServerSavedDone} />
            )}

            {moduleKey === "digitSpan" && (
                <DigitSpan
                    alreadyTaken={Boolean(psychometric.digitSpan && psychometric.digitSpan.completedAt)}
                    onDone={handleServerSavedDone}
                />
            )}

            {moduleKey === "perspective" && (
                <Perspective
                    answers={(psychometric.perspective && psychometric.perspective.answers) || {}}
                    narrative={(psychometric.perspective && psychometric.perspective.narrative) || {}}
                    openText={(psychometric.perspective && psychometric.perspective.openText) || {}}
                    onAnswer={(id, value) => updateAnswer(id, value, "answers")}
                    onNarrative={(id, value) => updateAnswer(id, value, "narrative")}
                    onOpenText={(id, value) => updateAnswer(id, value, "openText")}
                    onDone={handleModuleDone}
                />
            )}

            {(moduleKey === "extReasoning" || moduleKey === "extVerbal") && (
                <ExternalTest
                    moduleKey={moduleKey}
                    onDone={handleServerSavedDone}
                />
            )}

            {moduleKey === "sartRaw" && (
                <Sart
                    // A SCORED session is the one that cannot be repeated. A session refused for bad
                    // timing saves `sartMeta` and no `sartRaw` at all, so this is false and the
                    // student may try again — from another device, or after closing whatever was
                    // stealing their frames. Keying on the meta block instead would lock them out
                    // over a measurement that never happened.
                    alreadyTaken={typeof psychometric.sartRaw === "string" && psychometric.sartRaw.trim() !== ""}
                    onDone={handleServerSavedDone}
                />
            )}

            {moduleKey === "confidence" && (
                <LikertModule
                    title="Confidence in six situations"
                    intro="Six situations rather than six ratings. Pick what would honestly happen, not what sounds best — several of these have more than one good answer."
                    items={CONFIDENCE_ITEMS}
                    answers={(psychometric.confidence && psychometric.confidence.answers) || {}}
                    onChange={updateAnswer}
                    onDone={handleModuleDone}
                    pageSize={3}
                />
            )}

            {!SELF_SAVING.includes(moduleKey) && (
                <p>
                    <button type="button" className="btn btn-ghost" style={{ padding: "12px 18px", minHeight: "44px", fontSize: "16px" }} onClick={handleSaveAndLeave} disabled={isSaving}>
                        {isSaving ? "Saving…" : "Save and come back later"}
                    </button>
                </p>
            )}
        </div>
    )
}

export default AssessmentShell
