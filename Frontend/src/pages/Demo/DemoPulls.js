import { useEffect, useState } from "react"
import { AutoComplete } from "antd"
import ChipListInput from "../Interest/ChipListInput"
import ActivityReferenceList from "../Interest/ActivityReferenceList"
import { ACTIVITY_REFERENCE_LISTS } from "../Interest/activityReferenceLists"
import { getCareerNames } from "../../apiCall/professionsApi"

// QUESTION 1 — WHAT PULLS YOU (owner, Round 32): past, present and one day, freed from "can I do it?".
// The inputs are the real Virtual Career Counselling ones (ChipListInput with voice, the "Stuck?" list);
// the tap-to-add examples come from the same activity lists. The profession question type-aheads over
// our real careers' names (the public GET /professions/getNames), and any wording is kept.
const MAX_THINGS = 8

const short = (text) => String(text).split(" (")[0].trim()
const examples = (lists) => lists.flatMap((key) => ACTIVITY_REFERENCE_LISTS[key] || []).filter((text) => !/^Other/.test(text)).map(short)

const BOXES = [
    { when: "past", label: "Things you loved doing when you were younger", placeholder: "e.g. drawing, building things", chips: examples(["preHighSchool"]).slice(0, 8) },
    { when: "present", label: "Things you enjoy now", placeholder: "e.g. coding, debating, playing cricket", chips: examples(["highSchool", "college"]).slice(0, 8) },
    { when: "future", label: "Things you'd love to do or become one day — don't think about whether you can, or have the money or time", placeholder: "e.g. design games, travel the world, start a café", chips: [] },
]

const filled = (list) => (list || []).map((text) => String(text).trim()).filter(Boolean)

function DemoPulls({ initial, onNext, busy }) {
    const start = (when) => (initial.draws || []).filter((draw) => draw.when === when).map((draw) => draw.text)
    const [lists, setLists] = useState({ past: start("past"), present: start("present"), future: start("future") })
    const [aspiration, setAspiration] = useState(initial.aspiration || { text: "", professionId: null })
    const [names, setNames] = useState([])

    useEffect(() => {
        getCareerNames().then((response) => setNames(response.data.data || [])).catch(() => setNames([]))
    }, [])

    const total = filled(lists.past).length + filled(lists.present).length + filled(lists.future).length
    const addChip = (when, text) => {
        if (total >= MAX_THINGS || filled(lists[when]).includes(text)) return
        setLists({ ...lists, [when]: [...filled(lists[when]), text] })
    }

    const options = aspiration.text.trim().length >= 2
        ? names.filter((row) => row.profession.toLowerCase().includes(aspiration.text.trim().toLowerCase())).slice(0, 8).map((row) => ({ value: row.profession, id: row.id }))
        : []

    const draws = ["past", "present", "future"].flatMap((when) => filled(lists[when]).map((text) => ({ text, when }))).slice(0, MAX_THINGS)

    return (
        <section className="demo-step">
            <h2>What pulls you?</h2>
            <p className="demo-lead">Anything counts — from when you were small, from now, or from your dreams. Up to {MAX_THINGS} things in all.</p>

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

            <ActivityReferenceList activities={[...ACTIVITY_REFERENCE_LISTS.preHighSchool, ...ACTIVITY_REFERENCE_LISTS.highSchool, ...ACTIVITY_REFERENCE_LISTS.college]} />

            <div className="demo-box">
                <label className="demo-label" htmlFor="demo-aspiration">Which profession would you like to go into — as you see it today?</label>
                <AutoComplete
                    id="demo-aspiration"
                    className="demo-aspiration"
                    value={aspiration.text}
                    options={options}
                    onChange={(text) => setAspiration({ text, professionId: null })}
                    onSelect={(value, option) => setAspiration({ text: value, professionId: option.id })}
                    placeholder="Type a profession — or leave it blank"
                    style={{ width: "100%" }}
                />
                <p className="demo-hint">Not on our list? Write it your way — we read that too.</p>
            </div>

            <button type="button" className="btn btn-primary" disabled={busy || draws.length === 0} onClick={() => onNext({ draws, aspiration })}>
                {busy ? "Saving…" : "Next"}
            </button>
            {draws.length === 0 && <p className="demo-hint">Add at least one thing to go on.</p>}
        </section>
    )
}

export default DemoPulls
