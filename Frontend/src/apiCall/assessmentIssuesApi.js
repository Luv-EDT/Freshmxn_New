import axiosInstance from "./axiosInstance"

export async function reportIssue(payload) {
    const response = await axiosInstance.post("/assessmentIssues/reportIssue", payload)
    return response
}

export async function getAllIssuesForAdmin() {
    const response = await axiosInstance.get("/assessmentIssues/getAllForAdmin")
    return response
}

export async function grantRetakeForAdmin(id, payload) {
    const response = await axiosInstance.put(`/assessmentIssues/grantRetakeForAdmin/${id}`, payload || {})
    return response
}

export async function dismissIssueForAdmin(id, payload) {
    const response = await axiosInstance.put(`/assessmentIssues/dismissForAdmin/${id}`, payload || {})
    return response
}
