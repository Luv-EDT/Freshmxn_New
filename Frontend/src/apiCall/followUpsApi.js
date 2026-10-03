import axiosInstance from "./axiosInstance"

export async function getFollowUpForm(token) {
    const response = await axiosInstance.get(`/followUps/getForm/${token}`)
    return response
}

export async function submitFollowUp(token, payload) {
    const response = await axiosInstance.post(`/followUps/submit/${token}`, payload)
    return response
}

export async function unsubscribeFollowUp(token) {
    const response = await axiosInstance.post(`/followUps/unsubscribe/${token}`, {})
    return response
}

export async function getAllFollowUpsForAdmin() {
    const response = await axiosInstance.get("/followUps/getAllForAdmin")
    return response
}

export async function runHousekeepingForAdmin(job) {
    const response = await axiosInstance.post("/followUps/runHousekeepingForAdmin", { job })
    return response
}
