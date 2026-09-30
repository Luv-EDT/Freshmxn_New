// The top of "What to do next": one picture of the student's options at their stage (Round 9).
// Built entirely from journeyHeadline() in reportPlan.js — this file only draws it.
//
//   class 9-10     the stream map: how many of your top careers each Class 11 stream keeps open
//   class 11-12    the exam map: which exams open the most of your top careers, and how hard they are
//   college        which of your top careers you can move into from where you are
//   early career   the same split, plus the strengths that carry over
function ReportHeadline({ headline }) {
    if (!headline) return null

    if (headline.kind === "stream") {
        return (
            <div className="report-headline">
                <p className="report-headline-title">Choosing your stream</p>
                <p className="report-small">How many of your top {headline.of} careers each Class 11 stream keeps open:</p>
                <ul className="stream-map">
                    {headline.rows.map((row) => (
                        <li key={row.key}>
                            <span className="stream-name">{row.label}</span>
                            <span className="stream-bar" aria-hidden="true">
                                <span style={{ width: `${Math.round((row.open / headline.of) * 100)}%` }} />
                            </span>
                            <span className="stream-count">{row.open} of {headline.of}</span>
                            {row.closes.length > 0 && (
                                <span className="stream-closes">Would close: {row.closes.join(", ")}</span>
                            )}
                        </li>
                    ))}
                </ul>
            </div>
        )
    }

    if (headline.kind === "exams") {
        return (
            <div className="report-headline">
                <p className="report-headline-title">The exams that matter for you</p>
                <ul className="report-small">
                    {headline.rows.map((row) => (
                        <li key={row.exam}>
                            <strong>{row.exam}</strong> — opens {row.careers.length === 1 ? "1 of your top careers" : `${row.careers.length} of your top careers`}
                            {row.applicantsPerSeat ? ` · about ${row.applicantsPerSeat} applicants per seat` : ""}
                            <br />
                            <span className="muted-line">{row.careers.join(", ")}</span>
                        </li>
                    ))}
                </ul>
            </div>
        )
    }

    if (headline.kind === "switch") {
        const groups = [
            ["open", "Open to you from where you are"],
            ["after_any_degree", "Open once you finish your degree"],
            ["restart_undergrad", "Would mean starting a new degree"],
        ].filter(([key]) => headline.split[key].length > 0)

        return (
            <div className="report-headline">
                <p className="report-headline-title">What you can move into</p>
                <ul className="report-small">
                    {groups.map(([key, label]) => (
                        <li key={key}>
                            <strong>{label}</strong> ({headline.split[key].length})
                            <br />
                            <span className="muted-line">{headline.split[key].join(", ")}</span>
                        </li>
                    ))}
                </ul>
                {headline.strengths.length > 0 && (
                    <p className="report-small">What carries over from you: <strong>{headline.strengths.join(", ")}</strong>.</p>
                )}
            </div>
        )
    }

    return null
}

export default ReportHeadline
