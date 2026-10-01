import { DEGREE_FAMILIES } from "./journeyOptions"

// The degree questions on Register and Complete Profile (owner, Round 10): college students give the
// degree they are doing (or joining) and its subject; working students their degree, its subject and
// the field they work in. Matching uses the degree so the years already put into it are not counted
// as switching cost for careers it leads to. Same list as Backend/data/degree_options.json.
function DegreeFields({ journey, detail, onChange }) {
    if (journey !== "college" && journey !== "early_professional") return null

    const working = journey === "early_professional"
    const choosing = journey === "college" && detail.collegeStage === "pre_admission"
    const families = working ? DEGREE_FAMILIES : DEGREE_FAMILIES.filter((family) => family.id !== "none")
    const family = DEGREE_FAMILIES.find((entry) => entry.id === detail.degree)

    return (
        <div>
            <label htmlFor="degree">
                {working ? "Your highest qualification" : choosing ? "Which degree are you planning to join?" : "Which degree are you doing?"}
            </label>
            <br />
            <select
                id="degree"
                value={detail.degree || ""}
                onChange={(event) => { onChange("degree", event.target.value); onChange("subject", "") }}
                required={!choosing}
            >
                <option value="">{choosing ? "Not decided yet" : "-- Select --"}</option>
                {families.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}
            </select>

            {family && family.subjects.length > 0 && (
                <div>
                    <label htmlFor="subject">Which subject or branch?</label>
                    <br />
                    <select id="subject" value={detail.subject || ""} onChange={(event) => onChange("subject", event.target.value)} required>
                        <option value="">-- Select --</option>
                        {family.subjects.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}
                    </select>
                </div>
            )}

            {working && (
                <div>
                    <label htmlFor="field">What field do you work in?</label>
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

export default DegreeFields
