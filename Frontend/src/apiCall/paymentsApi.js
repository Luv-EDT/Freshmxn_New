import axiosInstance from "./axiosInstance"

export async function getPricing() {
    const response = await axiosInstance.get("/payments/getPricing")
    return response
}

export async function getQuote(payload) {
    const response = await axiosInstance.post("/payments/getQuote", payload)
    return response
}

export async function requestAccess(payload) {
    const response = await axiosInstance.post("/payments/requestAccess", payload)
    return response
}

export async function createOrder(payload) {
    const response = await axiosInstance.post("/payments/create-order", payload)
    return response
}

export async function getMyRequests() {
    const response = await axiosInstance.get("/payments/getMyRequests")
    return response
}

export async function getMyPayments() {
    const response = await axiosInstance.get("/payments/getMyPayments")
    return response
}

export async function getRefundOptions() {
    const response = await axiosInstance.get("/payments/getRefundOptions")
    return response
}

export async function requestRefund(payload) {
    const response = await axiosInstance.post("/payments/requestRefund", payload)
    return response
}

export async function requestFinancialAid(payload) {
    const response = await axiosInstance.post("/payments/requestFinancialAid", payload)
    return response
}

export async function getMyFinancialAid() {
    const response = await axiosInstance.get("/payments/getMyFinancialAid")
    return response
}

export async function getMyRefundRequests() {
    const response = await axiosInstance.get("/payments/getMyRefundRequests")
    return response
}

export async function getAllRequestsForAdmin() {
    const response = await axiosInstance.get("/payments/getAllRequestsForAdmin")
    return response
}

export async function grantAccessForAdmin(id) {
    const response = await axiosInstance.put(`/payments/grantForAdmin/${id}`, {})
    return response
}

export async function declineAccessForAdmin(id) {
    const response = await axiosInstance.put(`/payments/declineForAdmin/${id}`, {})
    return response
}

export async function overturnGrantForAdmin(id) {
    const response = await axiosInstance.put(`/payments/overturnGrantForAdmin/${id}`, {})
    return response
}

export async function downgradeUserForAdmin(id) {
    const response = await axiosInstance.put(`/payments/downgradeForAdmin/${id}`, {})
    return response
}

export async function getAllRefundRequestsForAdmin() {
    const response = await axiosInstance.get("/payments/getAllRefundRequestsForAdmin")
    return response
}

export async function refundForAdmin(id, payload) {
    const response = await axiosInstance.put(`/payments/refundForAdmin/${id}`, payload)
    return response
}

export async function declineRefundForAdmin(id, payload) {
    const response = await axiosInstance.put(`/payments/declineRefundForAdmin/${id}`, payload)
    return response
}

export async function getFailedRefundsForAdmin() {
    const response = await axiosInstance.get("/payments/getFailedRefundsForAdmin")
    return response
}

export async function getAllFinancialAidForAdmin() {
    const response = await axiosInstance.get("/payments/getAllFinancialAidForAdmin")
    return response
}

export async function approveFinancialAidForAdmin(id, payload) {
    const response = await axiosInstance.put(`/payments/approveFinancialAidForAdmin/${id}`, payload)
    return response
}

export async function declineFinancialAidForAdmin(id, payload) {
    const response = await axiosInstance.put(`/payments/declineFinancialAidForAdmin/${id}`, payload)
    return response
}
