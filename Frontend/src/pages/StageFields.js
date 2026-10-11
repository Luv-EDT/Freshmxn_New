import { useEffect, useState } from "react"
import { Select } from "antd"
import DegreeFields from "./DegreeFields"
import { JOURNEY_OPTIONS, STREAM_SUBJECTS } from "./journeyOptions"
import { getCareerNames } from "../apiCall/professionsApi"

// "Where are you right now?" and everything that depends on it — one copy shared by Register,
// Complete Profile, the profile's Edit and the admin's student edit (Round 25), so the four can never
// ask different questions. The server keeps only what belongs to the chosen stage
// (cleanJourneyDetail), and matching reads it for the switching cost.
export const EMPTY_DETAIL = { class: "", stream: [], collegeStage: "", courseYear: "", experienceYears: "", degree: "", subject: "", field: "", class12Year: "", currentProfessionId: "" }

// a stored detail (numbers, missing keys) as the form's strings
export const detailForForm = (detail) => {
    const form = { ...EMPTY_DETAIL }
    Object.keys(EMPTY_DETAIL).forEach((key) => {
        const value = detail ? detail[key] : undefined
        if (value === undefined || value === null) return
        form[key] = Array.isArray(value) ? value : String(value)
    })
    if (detail && detail.preAdmission && !form.collegeStage) form.collegeStage = "pre_admission"
    return form
}

const THIS_YEAR = new Date().getFullYear()
const CLASS12_YEARS = Array.from({ length: 45 }, (_, index) => THIS_YEAR + 1 - index)
const SOMETHING_ELSE = "__other"

function CurrentProfession({ detail, onChange }) {
    const [names, setNames] = useState([])
    const [other, setOther] = useState(Boolean(detail.field) && !detail.currentProfessionId)

    useEffect(() => {
        getCareerNames().then((response) => setNames(response.data.data)).catch(() => setNames([]))
    }, [])

    const pick = (value) => {
        if (value === SOMETHING_ELSE) {
            setOther(true)
            onChange("currentProfessionId", "")
            return
        }
        setOther(false)
        onChange("currentProfessionId", value || "")
        onChange("field", "")
    }

    return (
        <div>
            <label htmlFor="current-profession">What do you work as now?</label>
            <br />
            <Select
                id="current-profession"
                showSearch
                optionFilterProp="label"
                placeholder="Type to search our careers"
                value={other ? SOMETHING_ELSE : detail.currentProfessionId || undefined}
                onChange={pick}
                style={{ width: "100%", maxWidth: 480 }}
                options={[...names.map((name) => ({ value: name.id, label: name.profession })), { value: SOMETHING_ELSE, label: "Something else — I'll type it" }]}
            />
            {other && (
                <div>
                    <label htmlFor="field">What is your work?</label>
                    <br />
                    <input
                        id="field"
                        type="text"
                        maxLength={80}
                        value={detail.field || ""}
                        onChange={(event) => onChange("field", event.target.value)}
                        placeholder="e.g. IT support, sales, teaching, accounts"
                        required
                    />
                </div>
            )}
        </div>
    )
}

function StageFields({ journey, setJourney, detail, setDetail }) {
    const change = (field, value) => setDetail((prev) => ({ ...prev, [field]: value }))
    const toggleStream = (subject) => setDetail((prev) => ({
        ...prev,
        stream: prev.stream.includes(subject) ? prev.stream.filter((entry) => entry !== subject) : [...prev.stream, subject],
    }))

    return (
        <>
            <div>
                <label>Where are you right now?</label>
                <br />
                <select value={journey} onChange={(event) => { setJourney(event.target.value); setDetail({ ...EMPTY_DETAIL }) }} required>
                    <option value="">-- Select --</option>
                    {JOURNEY_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                </select>
            </div>

            {journey === "class9_10" && (
                <div>
                    <label>Which class?</label>
                    <br />
                    <select value={detail.class} onChange={(event) => change("class", event.target.value)} required>
                        <option value="">-- Select --</option>
                        <option value="9">Class 9</option>
                        <option value="10">Class 10</option>
                    </select>
                </div>
            )}

            {journey === "class11_12" && (
                <div>
                    <label>Which class?</label>
                    <br />
                    <select value={detail.class} onChange={(event) => change("class", event.target.value)} required>
                        <option value="">-- Select --</option>
                        <option value="11">Class 11</option>
                        <option value="12">Class 12</option>
                    </select>
                    <p>Which subjects do you study?</p>
                    {STREAM_SUBJECTS.map((subject) => (
                        <label key={subject.value}>
                            <input type="checkbox" checked={detail.stream.includes(subject.value)} onChange={() => toggleStream(subject.value)} />
                            {subject.label}{" "}
                        </label>
                    ))}
                </div>
            )}

            {journey === "college" && (
                <div>
                    <label>Are you already in college?</label>
                    <br />
                    <select value={detail.collegeStage} onChange={(event) => change("collegeStage", event.target.value)} required>
                        <option value="">-- Select --</option>
                        <option value="pre_admission">Not yet — I just passed Class 12 and am choosing a course</option>
                        <option value="enrolled">Yes, I'm enrolled</option>
                    </select>
                    {detail.collegeStage === "enrolled" && (
                        <div>
                            <label>Which year?</label>
                            <br />
                            <select value={detail.courseYear} onChange={(event) => change("courseYear", event.target.value)} required>
                                <option value="">-- Select --</option>
                                <option value="1">1st year</option>
                                <option value="2">2nd year</option>
                                <option value="3">3rd year</option>
                                <option value="4">4th year or later</option>
                            </select>
                        </div>
                    )}
                </div>
            )}

            {journey === "early_professional" && (
                <div>
                    <label>Years of work experience</label>
                    <br />
                    <input type="number" min="0" max="40" value={detail.experienceYears} onChange={(event) => change("experienceYears", event.target.value)} required />
                </div>
            )}

            {/* Round 10: the degree, so the years already in it are not counted as switching cost */}
            <DegreeFields journey={journey} detail={detail} onChange={change} />

            {/* Round 25: some entrances close a few years after Class 12 (JEE: 3) */}
            {(journey === "college" || journey === "early_professional") && (
                <div>
                    <label htmlFor="class12-year">Which year did you finish Class 12?</label>
                    <br />
                    <select id="class12-year" value={detail.class12Year} onChange={(event) => change("class12Year", event.target.value)} required>
                        <option value="">-- Select --</option>
                        {CLASS12_YEARS.map((year) => <option key={year} value={year}>{year}</option>)}
                    </select>
                </div>
            )}

            {/* Round 25: staying in your own career costs no switching years */}
            {journey === "early_professional" && <CurrentProfession detail={detail} onChange={change} />}
        </>
    )
}

export default StageFields
