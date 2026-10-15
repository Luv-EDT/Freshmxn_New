import { useEffect, useState } from "react"
import { AutoComplete } from "antd"
import ChipListInput from "../Interest/ChipListInput"
import ActivityReferenceList from "../Interest/ActivityReferenceList"
import { ACTIVITY_REFERENCE_LISTS } from "../Interest/activityReferenceLists"
import { getCareerNames } from "../../apiCall/professionsApi"

// THE STORY QUESTION (owner, Round 33) — one common question, asked across three timelines: school or
// college (the near and far past), now, and what they aspire to. The inputs are the real Virtual Career
// Counselling ones (ChipListInput with voice, the "Stuck?" list, pinned at the top while they scroll); the
// tap-to-add examples come from the same activity lists. The last box also type-aheads over our real
// careers' names (the public GET /professions/getNames) — a career picked there keeps its id, and any
// wording of their own is kept too.
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
    // careers picked from our list, by the text shown on their chip
    const [picked, setPicked] = useState(() => Object.fromEntries((initial.draws || []).filter((draw) => draw.professionId).map((draw) => [draw.text, draw.professionId])))
    const [search, setSearch] = useState("")
    const [names, setNames] = useState([])

    useEffect(() => {
        getCareerNames().then((response) => setNames(response.data.data || [])).catch(() => setNames([]))
    }, [])

    const total = filled(lists.past).length + filled(lists.present).length + filled(lists.future).length
    const addChip = (when, text) => {
        if (total >= MAX_THINGS || filled(lists[when]).includes(text)) return
        setLists({ ...lists, [when]: [...filled(lists[when]), text] })
    }

    const options = search.trim().length >= 2
        ? names.filter((row) => row.profession.toLowerCase().includes(search.trim().toLowerCase())).slice(0, 8).map((row) => ({ value: row.profession, id: row.id }))
        : []

    const pickCareer = (value, option) => {
        addChip("future", value)
        setPicked({ ...picked, [value]: option.id })
        setSearch("")
    }

    const draws = ["past", "present", "future"]
        .flatMap((when) => filled(lists[when]).map((text) => ({ text, when, ...(when === "future" && picked[text] ? { professionId: picked[text] } : {}) })))
        .slice(0, MAX_THINGS)
    // the first career they picked from our list is "the profession they'd like to go into"
    const firstCareer = draws.find((draw) => draw.professionId)
    const aspiration = firstCareer ? { text: firstCareer.text, professionId: firstCareer.professionId } : null

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
                    {box.when === "future" && (
                        <>
                            <label className="demo-label demo-label-small" htmlFor="demo-aspiration">Or pick a career you'd like to go into, from our list</label>
                            <AutoComplete
                                id="demo-aspiration"
                                className="demo-aspiration"
                                value={search}
                                options={options}
                                onChange={setSearch}
                                onSelect={pickCareer}
                                placeholder="Type a career, e.g. architect"
                                style={{ width: "100%" }}
                            />
                        </>
                    )}
                </div>
            ))}

            <button type="button" className="btn btn-primary" disabled={busy || draws.length === 0} onClick={() => onNext({ draws, aspiration })}>
                {busy ? "Saving…" : "Next"}
            </button>
            {draws.length === 0 && <p className="demo-hint">Add at least one thing to go on.</p>}
            {total >= MAX_THINGS && <p className="demo-hint">That's plenty for a demo — the full counselling asks about much more.</p>}
        </section>
    )
}

export default DemoPulls
