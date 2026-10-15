import { useState } from "react"
import ChipListInput from "../Interest/ChipListInput"
import ActivityReferenceList from "../Interest/ActivityReferenceList"
import { ACTIVITY_REFERENCE_LISTS } from "../Interest/activityReferenceLists"

// THE STORY QUESTION (owner, Round 33) — one common question, asked across three timelines: school or
// college (the near and far past), now, and what they aspire to. The inputs are the real Virtual Career
// Counselling ones (ChipListInput with voice, the "Stuck?" list, pinned at the top while they scroll); the
// tap-to-add examples come from the same activity lists. A career they aspire to is written in their own
// words — the activity step reads it like any other (owner, Round 33: no separate career picker).
const MAX_THINGS = 12

const short = (text) => String(text).split(" (")[0].trim()
const examples = (lists) => lists.flatMap((key) => ACTIVITY_REFERENCE_LISTS[key] || []).filter((text) => !/^Other/.test(text)).map(short)

const BOXES = [
    { when: "past", label: "In school or college — the near or far past", placeholder: "e.g. drawing, debating, fixing gadgets", chips: examples(["preHighSchool", "highSchool"]).slice(0, 8) },
    { when: "present", label: "Now — what you like or are interested in", placeholder: "e.g. coding, cricket, reading about space", chips: examples(["college"]).slice(0, 8) },
    { when: "future", label: "What you aspire to do or become — don't worry about whether you can", placeholder: "e.g. design games, start a café, become a doctor", chips: [] },
]

const filled = (list) => (list || []).map((text) => String(text).trim()).filter(Boolean)

function DemoPulls({ initial, onNext, busy }) {
    const start = (when) => (initial.draws || []).filter((draw) => draw.when === when).map((draw) => draw.text)
    const [lists, setLists] = useState({ past: start("past"), present: start("present"), future: start("future") })

    const total = filled(lists.past).length + filled(lists.present).length + filled(lists.future).length
    const addChip = (when, text) => {
        if (total >= MAX_THINGS || filled(lists[when]).includes(text)) return
        setLists({ ...lists, [when]: [...filled(lists[when]), text] })
    }

    const draws = ["past", "present", "future"]
        .flatMap((when) => filled(lists[when]).map((text) => ({ text, when })))
        .slice(0, MAX_THINGS)
    return (
        <section className="demo-step">
            <div className="demo-reference">
                <ActivityReferenceList activities={[...ACTIVITY_REFERENCE_LISTS.preHighSchool, ...ACTIVITY_REFERENCE_LISTS.highSchool, ...ACTIVITY_REFERENCE_LISTS.college]} />
            </div>

            <h2>Your story, in a few words</h2>
            <p className="demo-question">
                What have you enjoyed, been curious about or felt good at? Think of activities, interests and
                passions — things you grew through, got noticed for, solved a problem with, or that simply felt good.
            </p>
            <p className="demo-lead">Anything counts — from when you were small, in high school or college, now, or in your dreams.</p>

            {BOXES.map((box) => (
                <div key={box.when} className="demo-box">
                    <label className="demo-label" htmlFor={`demo-${box.when}`}>{box.label}</label>
                    <ChipListInput
                        id={`demo-${box.when}`}
                        label={box.label}
                        values={lists[box.when]}
                        onChange={(values) => setLists({ ...lists, [box.when]: values })}
                        placeholder={box.placeholder}
                    />
                    {box.chips.length > 0 && (
                        <div className="demo-chips" aria-label="Examples — tap to add">
                            {box.chips.map((chip) => (
                                <button type="button" key={chip} className="demo-chip" onClick={() => addChip(box.when, chip)}>+ {chip}</button>
                            ))}
                        </div>
                    )}
                </div>
            ))}

            <button type="button" className="btn btn-primary" disabled={busy || draws.length === 0} onClick={() => onNext({ draws, aspiration: null })}>
                {busy ? "Saving…" : "Next"}
            </button>
            {draws.length === 0 && <p className="demo-hint">Add at least one thing to go on.</p>}
            {total >= MAX_THINGS && <p className="demo-hint">That's plenty for a demo — the full counselling asks about much more.</p>}
        </section>
    )
}

export default DemoPulls
