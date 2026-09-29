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
