import { useEffect, useState } from "react"
import { getMyTestResults } from "../../apiCall/submissionsApi"

// "Your result" on a finished timed test (owner, Round 28): the count the student can understand
// ("11 of 16 puzzles right") and the same High / Medium / Low word the profile uses. The server
// works it out with the profile's own scorers; nothing here knows an answer. Shown only once the
// test is over, so it can never change how the test itself is taken.
const NOTES = {
    not_measured: "Not measured — this run didn't finish, so it is left out rather than counted as low.",
    set_aside: "Not measured — set aside because of what you told us. It is never counted as low.",
    invalid: "We couldn't measure this one properly. If something went wrong on your device, tell us below.",
}

function TestResult({ moduleKey }) {
    const [result, setResult] = useState(null)

    useEffect(() => {
        let live = true
        getMyTestResults()
            .then((response) => { if (live) setResult(response.data.data[moduleKey] || null) })
            .catch(() => {})
        return () => { live = false }
    }, [moduleKey])

    if (!result) return null

    return (
        <div className="test-result">
            <p className="test-result-title">Your result</p>
            {result.state === "done" ? (
                <>
                    <p className="test-result-line">{result.line}</p>
                    {result.level && <p>Level: <strong>{result.level}</strong></p>}
                    {result.levels && (
                        <p>Speed: <strong>{result.levels.speed || "Not measured"}</strong> · Focus: <strong>{result.levels.focus || "Not measured"}</strong></p>
                    )}
                    <p className="test-result-note">Compared with what the test can show, not with other students.</p>
                </>
            ) : (
                <p>{NOTES[result.state]}</p>
            )}
        </div>
    )
}

export default TestResult
