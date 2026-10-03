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

export async function getReviewsForAdmin() {
    const response = await axiosInstance.get("/mentorReviews/getReviewsForAdmin")
    return response
}

export async function decideReviewItemForAdmin(id, key, decision) {
    const response = await axiosInstance.put(`/mentorReviews/decideReviewItemForAdmin/${id}`, { key, decision })
    return response
}
