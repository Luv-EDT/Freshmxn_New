import axiosInstance from "./axiosInstance"

export async function saveInterest(payload) {
    const response = await axiosInstance.post("/submissions/saveInterest", payload)
    return response
}

export async function getMySubmission() {
    const response = await axiosInstance.get("/submissions/getMySubmission")
    return response
}
