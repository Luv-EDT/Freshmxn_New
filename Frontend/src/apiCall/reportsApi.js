import axiosInstance from "./axiosInstance"

export async function getMyReport() {
    const response = await axiosInstance.get("/reports/getMyReport")
    return response
}
