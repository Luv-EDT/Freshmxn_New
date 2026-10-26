import axiosInstance from "./axiosInstance"

// These catch and return error.response, like the auth calls in userApi.js, so a 400 still
// resolves and the page can show response.data.message

export async function registerMentor(payload) {
    try {
        const response = await axiosInstance.post("/mentors/register", payload)
        return response
    } catch (error) {
        return error.response
    }
}

export async function onboardMentor(payload) {
    try {
        const response = await axiosInstance.post("/mentors/onboard", payload)
        return response
    } catch (error) {
        return error.response
    }
}

export async function getMyMentorProfile() {
    try {
        const response = await axiosInstance.get("/mentors/getMyMentorProfile")
        return response
    } catch (error) {
        return error.response
    }
}

export async function updateMyMentorProfile(payload) {
    try {
        const response = await axiosInstance.put("/mentors/updateMyMentorProfile", payload)
        return response
    } catch (error) {
        return error.response
    }
}

export async function getAllMentorsForAdmin() {
    const response = await axiosInstance.get("/mentors/getAllForAdmin")
    return response
}

export async function approveMentorForAdmin(id) {
    const response = await axiosInstance.put(`/mentors/approveForAdmin/${id}`)
    return response
}

// Round 34: Tier 3 (the admin's call), and a mentor's region and Tier-3 rate
export async function setTier3ForAdmin(mentorProfileId) {
    const response = await axiosInstance.put(`/mentors/setTier3ForAdmin/${mentorProfileId}`, {})
    return response
}

export async function updateMentorTermsForAdmin(mentorProfileId, payload) {
    const response = await axiosInstance.put(`/mentors/updateTermsForAdmin/${mentorProfileId}`, payload)
    return response
}
