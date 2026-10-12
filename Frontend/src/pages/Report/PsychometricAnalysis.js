import { Link } from "react-router-dom"
import Navbar from "../Navbar"
import BackToDashboard from "../BackToDashboard"
import PsychometricScores from "../User/PsychometricScores"

// YOUR PSYCHOMETRIC ANALYSIS (owner, Round 28) — its own page, linked from the report and the Profile.
// The four fundamentals first, then everything else the assessment measured, in the same groups and
// words as before (GET /reports/getMyScores: words only, never a number; uncertainty tolerance and
// firmness as positions; "Partial · N%" where only part of a factor was measured).
function PsychometricAnalysis() {
    return (
        <div className="report-page">
            <Navbar />
            <BackToDashboard />
            <p className="report-back"><Link to="/report">← Your report</Link></p>
            <h1 className="report-title">Your psychometric analysis</h1>

            <div className="report-card psych-intro">
                <p>
                    <strong>The four fundamentals</strong> — confidence, sticking with things, picking up new things
                    and deciding with good information — help in every career and every interest. Everyone gains from
                    having them on the higher side, and all four grow with practice.
                </p>
                <p>
                    <strong>Everything else here doesn't make you good or bad — only different.</strong> Every career
                    and every activity you pick asks for its own mix and amount of these qualities. Leave those
                    combinations to us: that is how we pick the careers that fit you, because everybody is different.
                </p>
            </div>

            <PsychometricScores allOpen />
        </div>
    )
}

export default PsychometricAnalysis
