import axiosInstance from "./axiosInstance"

// Round 29: a student's notifications — clearing one deletes it
const call = async (request) => {
    try {
        return await request()
    } catch (error) {
        return error.response
    }
}

export const getMyNotifications = () => call(() => axiosInstance.get("/notifications/getMine"))
export const clearNotification = (id) => call(() => axiosInstance.delete(`/notifications/clearMine/${id}`))
export const clearAllNotifications = () => call(() => axiosInstance.delete("/notifications/clearAllMine"))
