// THE STUDENT BRIEF A MENTOR PREPARES FROM (owner, Round 34). The session guide asks a mentor to read
// the student first and find connection points: what they're into, what they've achieved, what they're
// struggling with, where they are in their education. Only those — family background and beliefs are
// left out, and support needs only when the student agreed their mentor may know (Round 10). The
// student agrees to this when they send their choice.

const STAGES = {
    class9_10: "In Class 9–10",
    class11_12: "In Class 11–12",
    college: "In college",
    early_professional: "Working",
}

const NEED_LABELS = { vision: "seeing the screen", hearing: "hearing", motor: "movement / fine motor", reading: "reading (e.g. dyslexia)", attention: "attention" }

const textOf = (item, key) => (typeof item === "string" ? item : item && typeof item[key] === "string" ? item[key] : "")
const list = (items, key, max) => [...new Set((Array.isArray(items) ? items : []).map((item) => textOf(item, key).trim()).filter(Boolean))].slice(0, max)

// user: the student's User row; submission: their Submission (or null)
const studentBrief = (user, submission, degreeLabelFor = () => null) => {
    const interest = (submission && submission.interest) || {}
    const current = interest.currentInterests || {}
    const detail = (user && user.journeyDetail) || {}
    const stage = STAGES[user && user.journey] || null
    const degree = degreeLabelFor(detail)
    const education = [
        stage,
        detail.class ? `Class ${detail.class}` : null,
        Array.isArray(detail.stream) && detail.stream.length ? `stream: ${detail.stream.join(", ")}` : null,
        degree,
        detail.courseYear ? `year ${detail.courseYear}` : null,
        Number.isFinite(detail.experienceYears) ? `${detail.experienceYears} years working` : null,
    ].filter(Boolean).join(" · ")

    const accommodations = submission && submission.psychometric && submission.psychometric.accommodations
    const support = accommodations && accommodations.shareWithMentor === true
        ? (accommodations.needs || []).map((need) => NEED_LABELS[need] || need)
        : []

    return {
        education: education || null,
        interests: list(current.persistentInterests, "activity", 8),
        achievements: (Array.isArray(current.achievementRelated) ? current.achievementRelated : [])
            .map((row) => [textOf(row, "activity"), textOf(row, "achievement")].filter(Boolean).join(" — "))
            .filter(Boolean)
            .slice(0, 6),
        challenges: list((interest.currentChallenges || {}).presentConcerns, "problem", 5),
        support,
    }
}

module.exports = { studentBrief, STAGES }
