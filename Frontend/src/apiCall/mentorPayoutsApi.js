import axiosInstance from "./axiosInstance"

// Round 34: what we owe mentors — record-only; the admin pays outside the app and marks it paid

const call = async (request) => {
    try {
        return await request()
    } catch (error) {
        return error.response
    }
}

export const getMyPayouts = () => call(() => axiosInstance.get("/mentorPayouts/getMine"))

export const getPayoutsForAdmin = () => call(() => axiosInstance.get("/mentorPayouts/getAllForAdmin"))
export const markPayoutPaidForAdmin = (id, payload) => call(() => axiosInstance.put(`/mentorPayouts/markPaidForAdmin/${id}`, payload))
export const decideFirstSessionForAdmin = (id, payload) => call(() => axiosInstance.put(`/mentorPayouts/decideFirstSessionForAdmin/${id}`, payload))
export const addFollowUpPayoutForAdmin = (payload) => call(() => axiosInstance.post("/mentorPayouts/addFollowUpForAdmin", payload))
