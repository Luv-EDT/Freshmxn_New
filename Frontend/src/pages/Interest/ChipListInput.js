import { useState } from "react"
import VoiceInput from "../VoiceInput"

// A list of short answers as chips: type one, press Add (or Enter), it becomes a chip; × removes it.
// Round 10 (S10) — replaces a growing stack of empty boxes and "Add More Activities" buttons.
//
// THE DATA IS THE SAME ARRAY OF STRINGS AS BEFORE. Whatever is still being typed is kept as the last
// element, so pressing Next or Save without pressing Add loses nothing — blank strings were always in
// these arrays and are dropped when the form is saved (interestFormState.buildSubmissionInterest).
function ChipListInput({ values, onChange, placeholder, id, label, addLabel = "Add" }) {
    const [draft, setDraft] = useState("")

    const filled = (values || []).filter((value) => typeof value === "string" && value.trim() !== "")
    // while typing, the draft is the last element of `values` — it is not a chip yet
    const chips = draft.trim() && filled[filled.length - 1] === draft ? filled.slice(0, -1) : filled

    const typeDraft = (text) => {
        setDraft(text)
        onChange([...chips, text])
    }

    const add = () => {
        const text = draft.trim()
        if (!text) return
        setDraft("")
        onChange(chips.includes(text) ? [...chips, ""] : [...chips, text, ""])
    }

    const remove = (index) => onChange([...chips.filter((_, i) => i !== index), draft])

    return (
        <div className="chip-input">
            {chips.length > 0 && (
                <ul className="chip-list" aria-label={label ? `${label} — added` : "Added"}>
                    {chips.map((chip, index) => (
                        <li key={`${chip}-${index}`} className="chip-item">
                            <span>{chip}</span>
                            <button type="button" className="chip-remove" onClick={() => remove(index)} aria-label={`Remove ${chip}`}>×</button>
                        </li>
                    ))}
                </ul>
            )}
            <div className="chip-entry">
                <input
                    type="text"
                    id={id}
                    aria-label={label}
                    value={draft}
                    placeholder={placeholder}
                    onChange={(event) => typeDraft(event.target.value)}
                    onKeyDown={(event) => {
                        // Enter adds the chip — it must not submit the whole step
                        if (event.key === "Enter") {
                            event.preventDefault()
                            add()
                        }
                    }}
                />
                <button type="button" className="chip-add" onClick={add} disabled={!draft.trim()}>{addLabel}</button>
            </div>
            {/* spoken words go into the box, to be checked and added like typed ones (Round 13) */}
            <VoiceInput compact value={draft} onChange={typeDraft} />
        </div>
    )
}

export default ChipListInput
