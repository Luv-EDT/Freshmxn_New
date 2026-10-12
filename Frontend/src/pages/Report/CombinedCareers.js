import ProfessionCard from "./ProfessionCard"

// "Careers that combine two of yours" (owner, Round 10) — beside the ranking, never in it. Each one
// joins two areas the student's own activities led to (Backend/matching/combined.js): Wildlife
// Photographer when photography and nature both showed up, Sports Nutritionist for nutrition and
// sport. Hand-checked careers, never invented per student.
//
// Round 19 (owner): the same card as every other match, with a note that these mix two professions.
// The Blue-collar tag travels as it does on every other card. There is no Core engineering tag
// any more (owner, Round 18) — core engineering is a filter on the main list.
// Round 28 (owner): each is exactly two professions, and shows only when BOTH are among the top 15
// the student is looking at — so the combinations follow their filters and sorts. Five at most.
const MAX_SHOWN = 5

function CombinedCareers({ combined, journey, shownIds }) {
    const shown = new Set(shownIds || [])
    const visible = (Array.isArray(combined) ? combined : [])
        .filter((career) => !shownIds || (career.parentIds || []).every((id) => shown.has(String(id))))
        .slice(0, MAX_SHOWN)
    if (visible.length === 0) return null

    return (
        <section className="combined-careers" id="combined">
            <h2>Combined careers</h2>
            <p className="report-small">
                These mix two professions, often from different sectors — both of them already among your top matches.
            </p>
            <div className="match-list">
                {visible.map((career, index) => (
                    <ProfessionCard
                        key={career.combinedId}
                        entry={career}
                        journey={journey}
                        rank={index + 1}
                        combined
                    />
                ))}
            </div>
        </section>
    )
}

export default CombinedCareers
