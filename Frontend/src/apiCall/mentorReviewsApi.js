import axiosInstance from "./axiosInstance"

// The mentor calls catch and return error.response, like mentorsApi.js, so a 400 still resolves and
// the sheet can show response.data.message.

export async function getMyReviewSheet() {
    try {
        const response = await axiosInstance.get("/mentorReviews/getMyReviewSheet")
        return response
    } catch (error) {
        return error.response
    }
}

export async function saveMyReview(payload) {
    try {
        const response = await axiosInstance.put("/mentorReviews/saveMyReview", payload)
        return response
    } catch (error) {
        return error.response
    }
}

export async function getSuggestionsForAdmin() {
    const response = await axiosInstance.get("/mentorReviews/getSuggestionsForAdmin")
    return response
}

// Round 17: the monthly review — topics Claude kept as they are, and the one deletion
export async function getUnchangedTopicsForAdmin() {
    const response = await axiosInstance.get("/mentorReviews/getUnchangedTopicsForAdmin")
    return response
}

export async function removeOpinionForAdmin(professionId, mentor, topic) {
    const response = await axiosInstance.put(`/mentorReviews/removeOpinionForAdmin/${professionId}`, { mentor, topic })
    return response
}
