import axiosInstance from "./axiosInstance"

// Round 38 (owner): the signed Mentor Agreement. These catch and return error.response, like mentorsApi.js,
// so a 400 still resolves and the page can show response.data.message

export async function uploadMentorAgreement(payload) {
    try {
        const response = await axiosInstance.post("/mentorAgreements/upload", payload)
        return response
    } catch (error) {
        return error.response
    }
}

export async function getMyMentorAgreement() {
    try {
        const response = await axiosInstance.get("/mentorAgreements/getMine")
        return response
    } catch (error) {
        return error.response
    }
}

// the admin opens the scan itself — fetched with their login, then shown from a local link
export async function openMentorAgreementForAdmin(mentorUserId) {
    try {
        const response = await axiosInstance.get(`/mentorAgreements/fileForAdmin/${mentorUserId}`, { responseType: "blob" })
        return response
    } catch (error) {
        return error.response
    }
}
