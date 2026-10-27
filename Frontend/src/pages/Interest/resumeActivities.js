// THE RÉSUMÉ'S ACTIVITIES (owner, Round 36) — what the résumé reader found, per stage of life, kept in
// this browser for this student so each stage's "Stuck?" list shows them first. Display only, like the
// lists themselves: nothing reaches the answers until the student writes it in. The file is never kept.
export const STAGE_KEYS = ["preHighSchool", "highSchool", "college", "postCollege"]

const keyFor = (userId) => `freshmxnResumeActivities_${userId}`

export const loadResumeActivities = (userId) => {
    try { return JSON.parse(localStorage.getItem(keyFor(userId))) || null } catch (error) { return null }
}

export const keepResumeActivities = (userId, lists) => {
    try {
        if (lists) localStorage.setItem(keyFor(userId), JSON.stringify(lists))
        else localStorage.removeItem(keyFor(userId))
    } catch (error) { /* a private window — the lists show until the page closes */ }
}

// the reader's lists → only the four stages, each a list of strings
export const cleanLists = (found) => Object.fromEntries(STAGE_KEYS.map((key) => [key, ((found || {})[key] || []).filter((item) => typeof item === "string" && item.trim())]))

export const countOf = (lists) => STAGE_KEYS.reduce((sum, key) => sum + ((lists || {})[key] || []).length, 0)
