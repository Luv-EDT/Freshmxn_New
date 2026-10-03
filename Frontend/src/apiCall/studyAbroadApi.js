import axiosInstance from "./axiosInstance"

export async function expressInterest(careerIds, consent) {
    const response = await axiosInstance.post("/studyAbroad/expressInterest", { careerIds, consent })
    return response
}

export async function getMyInterest() {
    const response = await axiosInstance.get("/studyAbroad/getMyInterest")
    return response
}

export async function getLeadsForAdmin() {
    const response = await axiosInstance.get("/studyAbroad/getLeadsForAdmin")
    return response
}

export async function updateLeadForAdmin(id, status, adminNote) {
    const response = await axiosInstance.put(`/studyAbroad/updateLeadForAdmin/${id}`, { status, adminNote })
    return response
}
