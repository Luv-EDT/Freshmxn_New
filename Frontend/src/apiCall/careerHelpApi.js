import axiosInstance from "./axiosInstance"

// "How else can we help?" (Round 25) — the student's own row, and the admin's list

export async function getMyCareerHelp() {
    try {
        const response = await axiosInstance.get("/careerHelp/getMine")
        return response
    } catch (error) {
        return error.response
    }
}

export async function saveMyCareerHelp(payload) {
    try {
        const response = await axiosInstance.put("/careerHelp/saveMine", payload)
        return response
    } catch (error) {
        return error.response
    }
}

export async function getCareerHelpForAdmin() {
    const response = await axiosInstance.get("/careerHelp/getAllForAdmin")
    return response
}

export async function updateCareerHelpForAdmin(id, status, adminNote) {
    const response = await axiosInstance.put(`/careerHelp/updateForAdmin/${id}`, { status, adminNote })
    return response
}
