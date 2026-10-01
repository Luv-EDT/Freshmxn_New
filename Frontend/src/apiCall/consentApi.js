import axiosInstance from "./axiosInstance"

export async function getMyConsent() {
    const response = await axiosInstance.get("/consent/getMyConsent")
    return response
}

export async function sendParentOtp(payload) {
    const response = await axiosInstance.post("/consent/sendParentOtp", payload || {})
    return response
}

export async function verifyParentOtp(payload) {
    const response = await axiosInstance.post("/consent/verifyParentOtp", payload)
    return response
}
