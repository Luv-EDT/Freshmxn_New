import axiosInstance from "./axiosInstance"

export async function getMyWaitlist() {
    try {
        const response = await axiosInstance.get("/mentorWaitlist/getMyWaitlist")
        return response
    } catch (error) {
        return error.response
    }
}

export async function chooseProfession(payload) {
    try {
        const response = await axiosInstance.post("/mentorWaitlist/chooseProfession", payload)
        return response
    } catch (error) {
        return error.response
    }
}

// admin actions are keyed on the STUDENT's user id
export async function getWaitlistForAdmin() {
    const response = await axiosInstance.get("/mentorWaitlist/getAllForAdmin")
    return response
}

export async function matchForAdmin(studentId, payload) {
    const response = await axiosInstance.put(`/mentorWaitlist/matchForAdmin/${studentId}`, payload)
    return response
}

export async function resolveForAdmin(studentId, payload) {
    const response = await axiosInstance.put(`/mentorWaitlist/resolveForAdmin/${studentId}`, payload)
    return response
}

export async function resetChoiceForAdmin(studentId, payload) {
    const response = await axiosInstance.put(`/mentorWaitlist/resetChoiceForAdmin/${studentId}`, payload)
    return response
}

// Round 18: what the student wants from the sessions, and the master's/settling-abroad waitlist
export async function saveMyHelp(payload) {
    try {
        const response = await axiosInstance.put("/mentorWaitlist/saveMyHelp", payload)
        return response
    } catch (error) {
        return error.response
    }
}

// Round 28: start another mentor session already paid for — a new choice, or the same field with a
// different mentor
export async function startAnotherSession(payload) {
    try {
        const response = await axiosInstance.post("/mentorWaitlist/startAnotherSession", payload)
        return response
    } catch (error) {
        return error.response
    }
}

// Round 28: the admin marks a matched session done (it is logged on the student's place)
export async function completeSessionForAdmin(studentId, payload) {
    const response = await axiosInstance.put(`/mentorWaitlist/completeSessionForAdmin/${studentId}`, payload || {})
    return response
}
