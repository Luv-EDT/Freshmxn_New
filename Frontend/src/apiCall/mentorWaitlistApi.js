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

// Round 34: the ticket menu — another mentor (with a strike when the mentor was at fault), or a student no-show
export async function newMentorForAdmin(studentId, payload) {
    const response = await axiosInstance.put(`/mentorWaitlist/newMentorForAdmin/${studentId}`, payload || {})
    return response
}

export async function studentNoShowForAdmin(studentId, payload) {
    const response = await axiosInstance.put(`/mentorWaitlist/studentNoShowForAdmin/${studentId}`, payload || {})
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

// Round 34: one "Session done" — the session is logged and the student's feedback form opens
export async function completeSessionForAdmin(studentId, payload) {
    const response = await axiosInstance.put(`/mentorWaitlist/completeSessionForAdmin/${studentId}`, payload || {})
    return response
}

// Round 28: how the mentor may reach the student — WhatsApp or email, with their consent
export async function saveMyContact(payload) {
    try {
        const response = await axiosInstance.put("/mentorWaitlist/saveMyContact", payload)
        return response
    } catch (error) {
        return error.response
    }
}
