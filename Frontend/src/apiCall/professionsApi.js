import axiosInstance from "./axiosInstance"

export async function searchProfessions(query) {
    const response = await axiosInstance.get("/professions/search", { params: { q: query } })
    return response
}
