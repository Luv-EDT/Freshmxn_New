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

export async function decideSuggestionsForAdmin(professionId, action, index) {
    const response = await axiosInstance.put(`/mentorReviews/decideSuggestionsForAdmin/${professionId}`, { action, index })
    return response
}
