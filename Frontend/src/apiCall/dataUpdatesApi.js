import axiosInstance from "./axiosInstance"

export async function getProposalsForAdmin(status) {
    const response = await axiosInstance.get("/dataUpdates/getProposalsForAdmin", { params: { status } })
    return response
}

export async function decideProposalForAdmin(id, decision, adminNote) {
    const response = await axiosInstance.put(`/dataUpdates/decideProposalForAdmin/${id}`, { decision, adminNote })
    return response
}

export async function exportPatchForAdmin() {
    const response = await axiosInstance.get("/dataUpdates/exportPatchForAdmin")
    return response
}

export async function getScoutForAdmin(status) {
    const response = await axiosInstance.get("/dataUpdates/getScoutForAdmin", { params: { status } })
    return response
}

export async function decideScoutForAdmin(id, decision, adminNote) {
    const response = await axiosInstance.put(`/dataUpdates/decideScoutForAdmin/${id}`, { decision, adminNote })
    return response
}

export async function decideDraftForAdmin(candidateId, decision, adminNote) {
    const response = await axiosInstance.put(`/dataUpdates/decideDraftForAdmin/${candidateId}`, { decision, adminNote })
    return response
}

export async function getAiUsageForAdmin(month) {
    const response = await axiosInstance.get("/dataUpdates/getAiUsageForAdmin", { params: { month } })
    return response
}

export async function getModelChoiceForAdmin() {
    const response = await axiosInstance.get("/dataUpdates/getModelChoiceForAdmin")
    return response
}

export async function setResearchModelForAdmin(model) {
    const response = await axiosInstance.put("/dataUpdates/setResearchModelForAdmin", { model })
    return response
}
