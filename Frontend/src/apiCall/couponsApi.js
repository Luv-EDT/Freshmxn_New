import axiosInstance from "./axiosInstance"

export async function getAllCoupons() {
    const response = await axiosInstance.get("/coupons/getAll")
    return response
}

export async function addCoupon(payload) {
    const response = await axiosInstance.post("/coupons/add", payload)
    return response
}

export async function updateCoupon(id, payload) {
    const response = await axiosInstance.put(`/coupons/update/${id}`, payload)
    return response
}

export async function deleteCoupon(id) {
    const response = await axiosInstance.delete(`/coupons/delete/${id}`)
    return response
}
